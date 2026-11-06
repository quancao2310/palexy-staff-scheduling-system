# Auto-scheduler design (brief section 2.5 / 4)

Date: 2026-11-06 · Status: draft for approval

## Intent

The store manager clicks **Auto-schedule** and gets a sensible first draft of the week: who works which shift on
which day. Busier hours get more people than quiet ones, nobody exceeds their maximum weekly hours, and the work is
shared as evenly as the team's limits allow. The draft is a starting point: the manager must be able to see it by
day, shift and person, and change it by hand (roster view and editing are a separate feature, see Non-goals).

Why this shape: the brief (section 4) asks for a *defensible approach with clear reasoning*, not a perfect optimum.
So the scheduler maximizes one explicit, explainable score, and every number in it can be justified out loud.

## Goals

- Demand-aware: more people in busier hours (section 2.5).
- Respects each person's maximum weekly hours (hard rule).
- Fair: utilisation (scheduled hours ÷ maximum hours) is as even as possible across the team; nobody is left at
  zero or near-zero while others are maxed out.
- Honest: when demand exceeds the team's capacity, or hours cannot be covered, the result says so (warnings,
  totals) instead of failing or hiding it.
- Deterministic: the same inputs always produce the same draft.
- Explainable in the README and on screen in a few sentences.

## Non-goals

- Inventing shifts. The scheduler uses **only the shifts the manager has defined** (brief 2.4/4.2). Suggesting new
  shifts is a possible later addition.
- The roster grid with direct editing, live summary table, over-max and understaffed warnings *while editing*
  (brief 2.6/2.7, roadmap item 6). This design produces the data those features need but not those screens.
- Availability, days off, roles/skills, closed days, rest-day rules, a proven-optimal solver.

## Anti-goals (a failure even if it "works")

- Padding every quiet hour so everyone reaches their maximum hours.
- Silently leaving hours short or uncovered.
- Quietly redefining "needed staff" to make warnings disappear when the team is small.
- Different answers on repeated clicks.

## Constraints

- Existing stack: Java 25, Spring Boot 4.1, Flyway (schema changes only as new migrations, `ddl-auto: validate`),
  PostgreSQL 17. Package per feature under `com.palexy.scheduler`; DTOs as records; errors are RFC 9457
  problem-details via `GlobalExceptionHandler` / `FieldProblemException`.
- Existing data: `staff(name, max_weekly_hours)`, `shift(start_hour, end_hour)` (end 24 = midnight, shifts may
  overlap, no duplicates), `transaction_count(day_of_week 1..7, hour 0..23, transactions)`. There is **no
  assignment table yet**; this feature adds it.
- Time model: hour `h` is the clock hour `[h, h+1)`. A shift `[start, end)` covers hours `start .. end-1`.
- No new heavy dependencies; the algorithm is plain Java.

## Decisions (made with the product owner unless marked "my call")

### 1. Inputs and hard rules

- Inputs: all staff, all shifts and all transaction counts of the schedule.
- An hour is **open** when at least one shift covers it, on every day (there is no concept of a closed day).
- Hard rules: (a) nobody's total scheduled hours exceed their maximum; (b) nobody works two overlapping shifts on a
  day (the summary counts staff-hours as people on shift, so overlap would double count). Several
  non-overlapping shifts on one day, including split shifts and back-to-back shifts, are allowed; (c) every open
  hour has at least one person whenever capacity allows it.

### 2. Required staff per hour ("need")

- **N = 16 transactions per staff-hour**, chosen from the NACS State of the Industry Report (2024 data): the average
  convenience store handles 16.1 customer transactions per labor hour. The sample data (open 07:00-23:00, about 27
  transactions an hour) looks like such a store. It is an assumption to be stated in the README. (My call: N is a
  configuration property `app.scheduler.transactions-per-staff-hour: 16`, not a per-schedule field, to avoid a
  schema and UI change; making it per-schedule is a later extension.)
- `need(h) = max(1, q + (r > N / (k + 1) ? 1 : 0))` where `q = floor(tx / N)`, `r = tx - q·N`, `k = 2`. In words:
  one person per full 16 transactions, plus one more if the leftover would keep that person at least a third
  busy (leftover of 6 or more). Example: 64 transactions → q=4, r=0 → need 4; 70 → r=6 → need 5.
- `need` is fixed by N and the data only. It never changes with team size, and every "understaffed" warning is
  measured against it.

### 3. The score (what the scheduler maximizes)

Costs, all in transaction units (one staff-hour of capacity = N = 16), summed over the week:

| Term | Definition | Initial weight |
|---|---|---|
| Unmet demand | `max(0, tx - N·staff)` per open hour | `k = 2` (a missing person-hour is twice as bad as an idle one; the owner's judgement) |
| Idle capacity | `max(0, N·staff - tx)` per open hour | 1 |
| Unfairness | `N · Σ_p (hours_p - u·max_p)²`, where `u` = total scheduled hours ÷ total maximum hours | 0.05 (tuned; at 1 the search deleted real demand to equalize 8-hour lumps) |
| Long days | per person-day, hours beyond 10 in that day, times `N` (my call; a soft guard against 07:00-23:00 doubles) | 1 |

The weights are starting values; the builder tunes them so the acceptance scenarios below hold, and records the
final values. Score = −(sum of weighted costs). Hours with zero coverage count their full transactions as unmet.

### 4. Algorithm

1. **Demand.** Compute `need(d, h)` for every open hour.
2. **Headcount per day-shift.** For each day pick how many people each shift gets, `x[d,s]`, to minimize the hour
   costs, given the whole week's capacity (sum of maximum hours) and that a day can never use more people at once
   than there are staff. Start from the cheapest set of shifts that covers every open hour once, then repeatedly add
   the person-shift with the best net gain per staff-hour while the gain is positive and capacity remains. Value
   of an added person in an hour = `min(N, transactions still unserved)`; this naturally cuts the poorly used
   fifth person at a 64-transaction hour before the third person at a 40-transaction hour when capacity runs out.
   With overlapping shifts a short peak shift can be chosen instead of stretching a long one. This is greedy and
   not guaranteed optimal; step 4 repairs it.
3. **Assign people.** Take the day-shift slots from most to least valuable. Give each slot to the eligible person
   (hours left, no overlap) with the lowest utilisation after assignment, ties broken by staff id. A slot nobody
   can take stays open and becomes a shortage warning.
4. **Improve.** Local search over single moves: reassign a slot to another person, swap two people's slots, add a
   person to a day-shift (allowed only up to `need + 1` in every hour that shift covers, and used chiefly to lift
   someone with almost no hours: this is the agreed "overstaff a little"), remove a person from a day-shift. Accept
   a move only if it keeps all hard rules and strictly improves the score; scan in a fixed order; stop when no move
   improves or after an iteration cap. A final draft must be a local optimum, which a test verifies.
5. **Report.** Compute warnings and totals (below).

### 5. Output and persistence

- New table `assignment(id, schedule_id, day_of_week 1..7, shift_id, staff_id)`, unique on
  (schedule_id, day_of_week, shift_id, staff_id), foreign keys cascading from `schedule`, `shift`, `staff`
  (migration `V2__assignment.sql`). This table is **shared** with the roster-editing feature (roadmap item 6).
- `POST /api/schedules/{id}/auto-schedule` replaces any existing assignments of the schedule in one transaction and
  returns the draft: the assignments plus warnings and stats. It overwrites manual edits; the UI confirms first when
  a roster already exists.
- `GET /api/schedules/{id}/assignments` returns the current assignments (read model for the roster view).
- Warnings (each with day/hour/staff as relevant): `UNDERSTAFFED` (needs X, has Y), `UNCOVERED_HOUR` (transactions
  exist but no shift covers the hour, so the manager should add a shift), `UNDER_UTILISED` (a person's utilisation
  is below half the team's average), plus stats: total shortfall in staff-hours, total unmet transactions, total
  idle staff-hours, per-person hours and utilisation, final score.
- Refusals (HTTP 422 problem-details with a clear message): no staff, no shifts, or no transaction data.

### 6. UI (my call on scope)

- An **Auto-schedule** button on the schedule page, disabled with an explanation when staff, shifts or transactions
  are missing, confirming before it overwrites an existing roster.
- A result panel showing the stats and warnings, and a **minimal read-only grid** (days × shifts, names in cells) so
  the draft is visible. Item 6 replaces that grid with the editable roster; the API does not change.

### 7. Acceptance scenarios (engine tests, no database needed)

All use the provided sample CSV unless stated.

Reference figures at N=16 on the sample data with the default shifts: staffing every hour exactly needs 215
staff-hours a week; covering each shift's busiest hour needs 296. Team sizes below are chosen against those.

1. **Typical** (default shifts, 8 staff × 40h = 320h, enough for the 296): no one over their maximum, no overlaps,
   every open hour ≥ 1, the busiest day-shift has more people than the quietest (with 8-hour blocks a shift's
   headcount follows its average load, so the test compares whole day-shifts, not single hours), utilisation spread
   (max − min) is at most one shift, deterministic across runs.
2. **Short team** (3 staff × 40h = 120h): hours at or below maximum, large shortfall reported, `UNDERSTAFFED`
   warnings on the least valuable hours, busy hours covered before quiet ones.
3. **Big team** (16 staff × 40h = 640h): nobody at zero hours, extra people added for fairness never push an hour
   above `need + 1` (hours above that come only from shift blocks, whose headcount follows their busiest hour),
   idle hours reported.
4. **Overlapping shift added** (11:00-15:00): the score is better than without it.
5. **Uncovered hours** (only 07:00-15:00 shift, data to 23:00): `UNCOVERED_HOUR` warnings, not an error.
6. **Split shift** allowed; **overlap** never produced.
7. **Local optimum**: no single move from the final draft improves the score.
8. Endpoint integration test (Testcontainers): replaces previous assignments, 422 cases.

## Left to the builder

Package and class names, internal data structures, the exact tie-breaking and iteration cap, tuning the weights
within the behaviour above, the visual design of the button, panel and grid, and how the result panel is worded.

## Calls I made (please check)

- N is a config constant, not an editable per-schedule field.
- The long-day penalty (soft, 10h threshold) and the "under-utilised = below half the team average" warning rule.
- Every day's covered hours count as open (no closed days), so a day missing from the CSV still gets 1 person per
  hour.
- Auto-schedule overwrites the whole roster; confirmation lives in the UI.
- A small read-only grid is included in this work, to be replaced by the roster feature.
