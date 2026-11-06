# Auto-scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An **Auto-schedule** button that drafts a weekly roster (day × shift × staff) from the demand data, respecting maximum hours and sharing work evenly, and reports shortfalls instead of hiding them.

**Architecture:** A pure-Java engine (`autoschedule.engine`, no Spring/JPA) maximizes one explicit score in five steps: need per hour → headcount per day-shift → assign people → local-search improvement → report. A thin Spring layer loads staff/shifts/demand, runs the engine, replaces the schedule's rows in a new shared `assignment` table, and returns the draft. The frontend adds a Roster tab with the button, a result panel and a read-only grid.

**Tech Stack:** Java 25, Spring Boot 4.1.2, Flyway, PostgreSQL 17, JUnit 5 + AssertJ + Testcontainers; React 19, TypeScript, TanStack Query, shadcn/ui, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-06-auto-scheduler-design.md` (read it first; the section numbers below refer to it).

## Global Constraints

- **N = 16** transactions per staff-hour, as config property `app.scheduler.transactions-per-staff-hour: 16` (NACS 2024: 16.1). Not a per-schedule field.
- `need(h) = max(1, q + (r·(k+1) > N ? 1 : 0))`, `q = tx / N`, `r = tx % N`, `k = shortfallWeight / idleWeight = 2`.
- Initial weights: shortfall 2, idle 1, fairness 1, long-day 1 with 10 h threshold, `maxMoves` 2000. Tuned only in Task 6; final values go in `SchedulerParams.defaults` and the README.
- Cost terms are in transaction units (one staff-hour = N): unmet `max(0, tx − N·staff)`, idle `max(0, N·staff − tx)`, fairness `N·Σ(hours_p − u·max_p)²` with `u` = scheduled hours ÷ total max hours, long days `N·Σ max(0, dayHours − 10)`.
- Hard rules: hours ≤ max per person; no overlapping shifts for one person on one day (split and back-to-back shifts allowed); each open hour ≥ 1 person when capacity allows. Surplus: coverage may exceed `need` by at most 1 in any hour.
- Hour `h` is `[h, h+1)`; a shift `[start, end)` covers hours `start..end-1`; `end = 24` is valid. An hour is open on every day when any shift covers it. Days are ISO 1..7.
- Use only the manager-defined shifts. Deterministic output (fixed iteration order, ties broken by lowest id). No new dependencies.
- `autoschedule.engine` must not import Spring, JPA or `jakarta`. Follow the existing patterns: package per feature, DTOs as records, Flyway-only schema changes (`ddl-auto: validate`), RFC 9457 problem-details via `GlobalExceptionHandler`.
- The working tree already has uncommitted staff/shift/schedule/transactions code. Build on it; do not revert or reformat it. Commit steps apply only when the user has approved committing; end commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Run backend commands from `backend/` (`./mvnw`), frontend commands from `frontend/`.

## Review Focus

1. A shift ending at 24:00 (e.g. 15:00-24:00) covers hour 23. Tested in Task 1.
2. A person whose maximum is below the shortest shift (e.g. 4 h): no crash, zero hours, `UNDER_UTILISED` warning. Tested in Task 5.
3. A day with all-zero or missing transactions (a "closed" day) still gets 1 person per open hour. Tested in Task 5.
4. A big team (40 staff × 40 h) finishes in under 5 seconds. Tested in Task 6.
5. Deleting a staff member or shift that has assignments still succeeds, and re-running replaces the roster instead of duplicating it. Tested in Task 7. (Double-click is covered in Task 8.)

## File Structure

```
backend/src/main/resources/db/migration/V2__assignment.sql
backend/src/main/resources/application.yaml                         (modify: app.scheduler)
backend/src/main/java/com/palexy/scheduler/
  autoschedule/engine/   ShiftDef StaffDef ScheduleProblem Placement SchedulerParams Need Score ScoreCalculator
                         Slot HeadcountPlanner SlotAssigner LocalSearch Warning WarningType StaffLoad Stats Draft
                         DraftReporter AutoScheduler
  autoschedule/          SchedulerProperties AutoScheduleService AutoScheduleController AutoScheduleResponse
  roster/                Assignment AssignmentRepository AssignmentResponse RosterService RosterController
  common/error/FieldProblemException.java                           (modify: add unprocessable())
backend/src/test/java/com/palexy/scheduler/autoschedule/engine/     one test class per engine class + Fixtures + DraftRules
backend/src/test/java/com/palexy/scheduler/autoschedule/AutoScheduleIntegrationTest.java
frontend/src/features/roster/   api.ts RosterTab.tsx RosterGrid.tsx AutoSchedulePanel.tsx RosterTab.test.tsx
frontend/src/features/schedules/api.ts, ScheduleLayout.tsx, frontend/src/routes.tsx   (modify)
README.md                                                           (modify)
```

---

### Task 1: Engine model, need formula, score

**Files:** Create `ShiftDef, StaffDef, ScheduleProblem, Placement, SchedulerParams, Need, Score, ScoreCalculator` under `autoschedule/engine/`; Test `NeedTest`, `ScoreCalculatorTest`, `ShiftDefTest`, and test support `Fixtures`.

**Interfaces:**
- Produces (package `com.palexy.scheduler.autoschedule.engine`):
  - `record ShiftDef(long id, int startHour, int endHour)` with `int length()`, `boolean covers(int hour)`, `boolean overlaps(ShiftDef other)`.
  - `record StaffDef(long id, String name, int maxWeeklyHours)`.
  - `record ScheduleProblem(List<ShiftDef> shifts, List<StaffDef> staff, List<TransactionCell> demand)` (reuse `com.palexy.scheduler.transactions.TransactionCell`) with `int transactions(int day, int hour)` (0 when absent), `boolean isOpen(int hour)`, `int totalCapacity()` (sum of max hours).
  - `record Placement(int day, long shiftId, long staffId)`.
  - `record SchedulerParams(int transactionsPerStaffHour, double shortfallWeight, double idleWeight, double fairnessWeight, double longDayWeight, int longDayThresholdHours, int maxMoves)` with `static SchedulerParams defaults(int n)` using the Global Constraints values.
  - `final class Need { static int of(int transactions, SchedulerParams p); }`
  - `record Score(double unmetTransactions, double idleCapacity, double fairness, double longDays, double cost)` with `double value()` returning `-cost`.
  - `final class ScoreCalculator { static Score evaluate(ScheduleProblem p, Collection<Placement> placements, SchedulerParams params); static int[][] coverage(ScheduleProblem p, Collection<Placement> placements); }` where `coverage[day][hour]` (index 1..7 × 0..23) counts people on shift.
- `Fixtures` (test): `sampleDemand()` parses `demo/sample_transaction_interview.csv` from the classpath via `TransactionReportParser.parse(bytes).cells()`; `defaultShifts()` = ids 1: 7-15, 2: 15-23; `team(int count, int maxHours)` = ids 1..count.

- [ ] **Step 1: Write failing tests**
  - `NeedTest`, parameterized with `defaults(16)`: `0→1, 6→1, 21→1, 22→2, 38→3, 64→4, 70→5`.
  - `ShiftDefTest`: `new ShiftDef(1,15,24).covers(23)` is true, `covers(14)` is false, `length()==9`; `(7,15).overlaps((11,15))` true, `(7,15).overlaps((15,23))` false.
  - `ScoreCalculatorTest`, problem = one shift `ShiftDef(1,7,9)`, three staff (ids 1-3, max 40), demand day 1 hour 7 = 40 and hour 8 = 16 (everything else absent):
    - only staff 1 on (day 1, shift 1): `unmetTransactions==24`, `idleCapacity==0`, `fairness≈42.667` (±1e-3), `cost≈90.667`, `value()≈-90.667`.
    - all three staff on it: `unmetTransactions==0`, `idleCapacity==40`, `fairness==0`, `cost==40`.
    - second problem with `ShiftDef(2,7,23)` and staff 1 on it: `longDays==96`.
    - `coverage(...)[1][7]==3` for the all-three case, `coverage[2][7]==0`.
- [ ] **Step 2: Run to verify they fail:** `./mvnw -q test -Dtest='NeedTest,ShiftDefTest,ScoreCalculatorTest'`. Expected: compilation failure.
- [ ] **Step 3: Implement the types above.** Weighted `cost = shortfallWeight·unmet + idleWeight·idle + fairnessWeight·fairness + longDayWeight·longDays`; all days 1..7 and every open hour count, including hours with no demand row.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(autoschedule): engine model, need formula and score`.

---

### Task 2: Headcount planner (spec section 4, step 2)

**Files:** Create `Slot.java`, `HeadcountPlanner.java`; Test `HeadcountPlannerTest`.

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `record Slot(int day, ShiftDef shift)`; `final class HeadcountPlanner { static List<Slot> plan(ScheduleProblem p, SchedulerParams params); }`. The list is **ordered by value**: the base cover first, then the added people in the order chosen. Later tasks assign people in list order, so a short team loses the tail first.

- [ ] **Step 1: Write failing tests** (`defaultShifts()`, `sampleDemand()` unless stated):
  - base cover: with `team(12,40)` the first 14 slots are exactly one per (day, shift), and they are sorted by that slot's total transactions, descending.
  - picks the efficient shift: shifts `1: 7-15`, `2: 15-23`, `3: 11-15`; `team(10,40)`; demand 64 on day 1 hours 11-14 and 16 on every other hour of day 1 (nothing on other days). Day 1 gets exactly 3 slots of shift 3 and exactly 1 slot of shift 1 beyond/within the base cover (i.e. `count(day 1, shift 1)==1`, `count(day 1, shift 3)==3`).
  - capacity: `team(2,40)` → no slots beyond the base cover (base alone is 112 h > 80 h); and with `team(2,40)` and 100 transactions every hour, `coverage` of the returned slots never exceeds 2 in any added-person step (check `max coverage ≤ 2` after excluding base duplicates; the base cover itself is 1).
  - only the base cover is returned when adding anyone would not improve the cost (demand 16 everywhere, `team(10,40)` → exactly 14 slots).
- [ ] **Step 2: Run to verify they fail:** `./mvnw -q test -Dtest=HeadcountPlannerTest`. Expected: compilation failure.
- [ ] **Step 3: Implement `plan`.**
  1. Base cover: per day, the minimum-total-length set of shifts covering every open hour (DP over hours 0..24; deterministic tie-break: lower shift id). Return these slots first, sorted by the slot's total transactions descending, then day, then shift id. They are returned regardless of capacity.
  2. Increments: repeatedly evaluate adding one more person to each (day, shift): gain = reduction of `shortfallWeight·unmet + idleWeight·idle` over that shift's hours (using current per-hour coverage), divided by `shift.length()`. Take the largest gain > 0 (ties: lowest day, then shift id). Skip a candidate if it would push any covered hour above `staff.size()` people or push `Σ slot lengths of added slots + base` above `totalCapacity()` (base slots count toward the total; once the base alone exceeds capacity, add nothing). Stop when no candidate qualifies.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(autoschedule): headcount planner`.

---

### Task 3: Slot assigner and hard-rule checker (step 3)

**Files:** Create `SlotAssigner.java`; Test `SlotAssignerTest`, test support `DraftRules.java`.

**Interfaces:**
- Consumes: `HeadcountPlanner.plan`, Task 1 types.
- Produces: `final class SlotAssigner { static List<Placement> assign(ScheduleProblem p, List<Slot> orderedSlots); }`. Test support: `DraftRules.violations(ScheduleProblem p, Collection<Placement> placements): List<String>` (empty = valid) checking max hours, same-person overlaps/duplicates on a day, and unknown staff/shift ids.

- [ ] **Step 1: Write failing tests:**
  - `DraftRules`: returns a non-empty list for (a) a person over their max, (b) a person on `7-15` and `11-15` the same day, (c) the same placement twice; returns empty for a valid split day (`7-10`-type pair using shifts `1: 7-10`, `2: 16-21`).
  - Lowest projected utilisation: staff A (id 1, max 40), B (id 2, max 20); three slots of `7-15` on days 1, 2, 3 in that order → days 1 and 2 go to A, day 3 goes to B (A: 8/40 → 16/40 tie with B 8/20 → lower id A; then A 24/40 > B 8/20).
  - eligibility: a staff with max 4 never gets an 8 h shift; with only that staff the result is empty, no exception; `DraftRules.violations` is empty for any result.
  - overlap: one person can take `15-23` on the day they took `7-15`, but not `11-15`.
- [ ] **Step 2: Run to verify they fail:** `./mvnw -q test -Dtest=SlotAssignerTest`.
- [ ] **Step 3: Implement `assign`:** for each slot in order, among staff with `hours + length ≤ max` and no overlapping placement that day, choose the minimum of `(hours + length) / max`, ties by lowest staff id; if none, skip the slot.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(autoschedule): slot assigner and rule checker`.

---

### Task 4: Local search (step 4)

**Files:** Create `LocalSearch.java`; Test `LocalSearchTest`.

**Interfaces:**
- Produces: `final class LocalSearch { static Optional<List<Placement>> findImprovement(ScheduleProblem p, SchedulerParams params, List<Placement> current); static List<Placement> improve(ScheduleProblem p, SchedulerParams params, List<Placement> start); }`. `findImprovement` returns the first rule-respecting single move that lowers `cost` by more than 1e-9, scanning moves in a fixed order; `improve` applies them until none is found or `params.maxMoves()` moves were applied.
- Move types: reassign a placement to another person; swap two placements between two people; add a person to a (day, shift) (only if every covered hour ends at ≤ `Need.of(tx)+1`); remove a person from a (day, shift).

- [ ] **Step 1: Write failing tests:**
  - fairness: one shift `7-15`, two staff max 40; start placements: staff 1 on days 1-5, staff 2 on days 6-7. After `improve`: score strictly better than the start, hours differ by ≤ 8, every day still covered, `DraftRules.violations` empty.
  - local optimum: after `improve`, `findImprovement` is empty.
  - cap: `maxMoves = 0` returns the input unchanged.
  - surplus: three staff (max 40), one shift `7-15`, demand 16 everywhere (need 1), start with staff 1 and 2 sharing days and staff 3 empty → after `improve`, staff 3 has at least one shift and `coverage[d][h] ≤ 2` everywhere.
- [ ] **Step 2: Run to verify they fail:** `./mvnw -q test -Dtest=LocalSearchTest`.
- [ ] **Step 3: Implement.** Evaluate each candidate move with `ScoreCalculator.evaluate`; fixed scan order: day, shift id, staff id. Keep it simple (re-evaluate fully); the problem is small.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(autoschedule): local search improvement`.

---

### Task 5: Orchestrator, warnings and stats (steps 1 and 5)

**Files:** Create `Warning, WarningType, StaffLoad, Stats, Draft, DraftReporter, AutoScheduler`; Test `AutoSchedulerTest`.

**Interfaces:**
- Produces: `enum WarningType { UNDERSTAFFED, UNCOVERED_HOUR, UNDER_UTILISED }`; `record Warning(WarningType type, Integer day, Integer hour, Long staffId, Integer needed, Integer scheduled, String message)`; `record StaffLoad(long staffId, String name, int hours, int maxHours, double utilisation)`; `record Stats(int shortfallStaffHours, double unmetTransactions, double idleStaffHours, double score, List<StaffLoad> staff)`; `record Draft(List<Placement> placements, List<Warning> warnings, Stats stats)`; `final class AutoScheduler { static Draft generate(ScheduleProblem p, SchedulerParams params); }` = plan → assign → improve → report.
- Definitions: `UNDERSTAFFED` for every open hour with `coverage < need` (`needed`, `scheduled` filled); `UNCOVERED_HOUR` for each (day, hour) with transactions > 0 that no shift covers; `UNDER_UTILISED` for each person whose utilisation is below half the team average (skipped when the average is 0); `shortfallStaffHours = Σ max(0, need − coverage)`; `idleStaffHours = idleCapacity / N`; `score = Score.value()`. Warnings sorted by type, day, hour. `message` is a plain sentence the UI shows verbatim (e.g. "Friday 13:00 needs 4 people, has 3").

- [ ] **Step 1: Write failing tests:**
  - uncovered: shift `7-15` only, tx 10 at day 1 hour 20 → one `UNCOVERED_HOUR(day 1, hour 20)`; no warning for uncovered hours without transactions; no exception.
  - understaffed + shortfall: one staff max 8, shift `7-15`, tx 64 in each hour of day 1 only → contains `UNDERSTAFFED(day 1, hour 9, needed 4, scheduled 1)` and `UNDERSTAFFED(day 2, hour 9, needed 1, scheduled 0)`; `shortfallStaffHours == 72`.
  - Review Focus 2: staff A max 40 and B max 4, shift `7-15` → B has 0 hours, an `UNDER_UTILISED` warning for B, `stats.staff` lists both, no exception.
  - Review Focus 3: sample demand with day 7 removed from `demand` and `team(8,40)` → every hour on day 7 has coverage ≥ 1.
  - determinism: `generate` twice on the same input gives equal `Draft`s.
  - empty team or empty shifts: returns an empty placement list without throwing.
- [ ] **Step 2: Run to verify they fail:** `./mvnw -q test -Dtest=AutoSchedulerTest`.
- [ ] **Step 3: Implement `DraftReporter` and `AutoScheduler.generate`** per the definitions above.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(autoschedule): orchestrator, warnings and stats`.

---

### Task 6: Acceptance scenarios and weight tuning (spec section 7)

**Files:** Test `AutoSchedulerAcceptanceTest`; Modify `SchedulerParams.java` only if tuning is needed.

**Interfaces:** Consumes `AutoScheduler.generate`, `Fixtures`, `DraftRules`, `ScoreCalculator.coverage`, `LocalSearch.findImprovement`.

- [ ] **Step 1: Write the tests** (sample demand, default shifts, N=16 unless stated):
  1. Typical `team(8,40)`: no `DraftRules` violations; coverage ≥ 1 for every open hour on every day; `coverage[5][13] > coverage[5][22]`; utilisation max − min ≤ 0.2; two runs equal.
  2. Short `team(3,40)`: total hours ≤ 120; `stats.shortfallStaffHours > 0`; `UNDERSTAFFED` warnings exist; every hour with coverage ≥ 2 has `Need ≥ 2`.
  3. Big `team(16,40)`: nobody has 0 hours; `coverage[d][h] ≤ Need(tx)+1` everywhere; `stats.idleStaffHours > 0`.
  4. Overlap: `team(8,40)` with an extra `ShiftDef(3, 11, 15)` scores strictly higher (`stats.score`) than without it.
  5. Uncovered: only `ShiftDef(1,7,15)` and data to 23:00 → `UNCOVERED_HOUR` warnings, no exception.
  6. Split: a person can have `1: 7-10` and `2: 16-21` on the same day (use `team(1,40)` and only these two shifts): at least one day has both placements for that person, and `DraftRules` accepts the result. No result ever has an overlap (assert `DraftRules` empty in every scenario above).
  7. Local optimum: `LocalSearch.findImprovement` is empty on the result of scenarios 1-3.
  8. Review Focus 4: `team(40,40)` with the default shifts finishes within 5 seconds (`assertTimeoutPreemptively`).
- [ ] **Step 2: Run:** `./mvnw -q test -Dtest=AutoSchedulerAcceptanceTest`. Expected: failures point at weights or logic.
- [ ] **Step 3: If anything fails, fix the cause first** (a rule violation or wrong scan is a bug, not a weight problem). Only for balance or surplus assertions, adjust `fairnessWeight`, `longDayWeight` or `maxMoves` in `SchedulerParams.defaults`, keeping `shortfallWeight = 2` and `idleWeight = 1`. Record the final values in a comment above `defaults`.
- [ ] **Step 4: Run all engine tests:** `./mvnw -q test -Dtest='com.palexy.scheduler.autoschedule.engine.*Test'`. Expected: PASS.
- [ ] **Step 5: Commit** `test(autoschedule): acceptance scenarios and tuned weights`.

---

### Task 7: Persistence and API

**Files:** Create `V2__assignment.sql`, `roster/{Assignment,AssignmentRepository,AssignmentResponse,RosterService,RosterController}.java`, `autoschedule/{SchedulerProperties,AutoScheduleService,AutoScheduleController,AutoScheduleResponse}.java`; Modify `application.yaml`, `FieldProblemException.java`; Test `AutoScheduleIntegrationTest` (Testcontainers, `@SpringBootTest(webEnvironment=RANDOM_PORT, properties="app.demo-data.enabled=false")`, `@Import(TestcontainersConfiguration.class)`, `RestClient` like `SchedulerApplicationTests`).

**Interfaces:**
- Consumes: `AutoScheduler.generate`, `StaffRepository.findAllInSchedule`, `ShiftRepository.findByScheduleIdOrderByStartHourAscEndHourAsc`, `TransactionCountRepository.findAll`, `ScheduleRepository.existsById`.
- Produces (JSON):
  - `GET /api/schedules/{id}/assignments` → `[{id, day, shiftId, staffId}]` (`AssignmentResponse(Long id, int day, Long shiftId, Long staffId)`), ordered by day, shift, staff.
  - `POST /api/schedules/{id}/auto-schedule` → 200 `{assignments: [...], warnings: [{type, day, hour, staffId, needed, scheduled, message}], stats: {shortfallStaffHours, unmetTransactions, idleStaffHours, score, staff: [{staffId, name, hours, maxHours, utilisation}]}}`. 404 for an unknown schedule; 422 problem-details with `errors: {staff|shifts|transactions: message}` when there are no staff, no shifts or no transaction data.
  - `FieldProblemException.unprocessable(String field, String message)` → HTTP 422.
  - `SchedulerProperties(int transactionsPerStaffHour)` bound from `app.scheduler`; the service builds `SchedulerParams.defaults(n)`.
- Schema: `assignment(id identity pk, schedule_id → schedule ON DELETE CASCADE, day_of_week 1..7, shift_id → shift ON DELETE CASCADE, staff_id → staff ON DELETE CASCADE, UNIQUE(schedule_id, day_of_week, shift_id, staff_id))`.

- [ ] **Step 1: Write the failing integration tests** (create data through the existing API: schedule, staff, `PUT .../transactions` with the demo CSV as multipart):
  - happy path: POST returns assignments; every staff member's summed shift hours ≤ their max; `GET .../assignments` returns the same set.
  - rerun replaces: POST twice → GET count equals the second response's count (no duplicates); same JSON assignments both times.
  - 422 cases: schedule with no staff, with all shifts deleted via the API, and with no transactions → status 422 and the matching `errors` key; unknown schedule id → 404.
  - Review Focus 5: after a draft, `DELETE` a staff member who has assignments → 204 and GET assignments no longer contains them; same for a shift.
- [ ] **Step 2: Run to verify they fail:** `./mvnw -q test -Dtest=AutoScheduleIntegrationTest` (needs Docker). Expected: FAIL (404 on the new routes).
- [ ] **Step 3: Implement.** Replace rows with a JPQL bulk delete `@Modifying(flushAutomatically = true, clearAutomatically = true)` before `saveAll`, in one transaction (a plain `deleteAll` risks the unique constraint firing because Hibernate flushes inserts before deletes). Entity style follows `Staff`/`Shift` (plain `Long` ids, protected constructor). Add `app.scheduler.transactions-per-staff-hour: 16` to `application.yaml`.
- [ ] **Step 4: Run the integration test and `./mvnw -q verify`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(autoschedule): assignment table and auto-schedule API`.

---

### Task 8: Frontend roster tab

**Files:** Create `frontend/src/features/roster/{api.ts,RosterTab.tsx,RosterGrid.tsx,AutoSchedulePanel.tsx,RosterTab.test.tsx}`; Modify `features/schedules/api.ts` (add `scheduleKeys.assignments(id)`), `features/schedules/ScheduleLayout.tsx` (a fourth nav item "Roster"; make `Step.done` optional, render no check icon when it is undefined, and exclude such steps from the `missing` list so the "Setup complete" message still works), `routes.tsx` (add `{ path: 'roster', element: <RosterTab /> }`).

**Interfaces:**
- Consumes: the API shapes from Task 7; existing `useSchedule`, `useStaff`, `useShifts`, `ConfirmDialog`, `DAYS`, `showError`, `lib/time.ts`, `stubApi`/`renderApp` from `@/test/render`.
- Produces: `api.ts` exports `interface Assignment`, `AutoScheduleResult`, `useAssignments(scheduleId)`, `useAutoSchedule(scheduleId)` (mutation, `POST /schedules/{id}/auto-schedule`; on success set the assignments query from `result.assignments`).

- [ ] **Step 1: Write failing tests in `RosterTab.test.tsx`** (stub schedule, 2 staff, 2 shifts, transactions; route `/schedules/1/roster`):
  - disabled: the "Auto-schedule" button is disabled, with text explaining what is missing, when `hasTransactions` is false.
  - generate: clicking it on an empty roster POSTs once and the grid shows the staff name in the right day column and shift row, and the panel shows a warning's `message`.
  - confirm: with existing assignments, clicking opens "Replace the current roster?" and nothing is POSTed until the user confirms.
  - 422: the problem `detail` is shown to the user and the grid is unchanged.
  - Review Focus (double click): while the request is pending, the button is disabled and two clicks produce one POST.
- [ ] **Step 2: Run to verify they fail:** `npx vitest run src/features/roster/RosterTab.test.tsx`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** The grid has shifts as rows (time label), Mon-Sun as columns, staff names as badges (or "–" when empty). The panel shows total shortfall, idle hours, unmet transactions, per-person hours bars, and warnings grouped by type; it appears only for the draft just generated, because warnings are not stored (the live warnings belong to the editable roster, roadmap item 6, which replaces this grid; the API does not change).
- [ ] **Step 4: Run the tests, then** `npm run lint && npm test && npm run build`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(frontend): roster tab with auto-schedule`.

---

### Task 9: README

**Files:** Modify `README.md`.

- [ ] **Step 1:** Replace the "Auto-scheduler approach" placeholder (currently lines 100-104) with: the value of N and its source (NACS 16.1, with the link and the caveat that it is a convenience-store average), the `need` rule with the k=2 reading, the five steps, the score terms and final weights from Task 6, how shortage and surplus show up, and what is out of scope (new shifts, availability, closed days).
- [ ] **Step 2:** Add to Assumptions: every covered hour is open every day; split shifts allowed, overlaps never; auto-schedule overwrites the roster; N is a config constant; warnings are not stored. Update the Status line, API table (two endpoints) and mark Roadmap item 5 done.
- [ ] **Step 3:** Verify by running the app per the README (`docker compose up --build`), clicking Auto-schedule on the seeded sample schedule and confirming a roster and warnings appear. Expected: the demo team (260 h) is short of the 296 h the default shifts need, so shortfall warnings appear.
- [ ] **Step 4: Commit** `docs: describe the auto-scheduler approach`.

---

## Self-review

- **Spec coverage:** goals and rules (Tasks 1-5), score (1), algorithm steps 1-5 (1-5), output/persistence/endpoints/refusals (7), UI (8), acceptance scenarios 1-8 (6, 7), README (9). "Left to the builder" items are left open.
- **Type consistency:** `Slot`, `Placement`, `Draft`, `Warning`, `Stats` names match across Tasks 2-8; the JSON shape in Task 7 matches the TypeScript in Task 8.
- **Spec change:** acceptance team sizes were corrected (8 / 3 / 16 staff) after computing 296 h of shift-level need at N=16; the spec was edited to match.
