# Roster editing and shift management design (brief section 2.7)

Date: 2026-11-06 · Status: draft for approval

## Intent

After Auto-schedule, the manager has a draft week. Brief 2.7 asks that they can **read** it at a glance, **change** it
directly ("quick and obvious, not buried behind forms"), **manage shifts** with an equally clear interface, and get
**live feedback**: the summary (2.6) follows every edit, and problems such as someone over their maximum hours or an
understaffed hour are explained, "rather than silently accepting or blocking them".

Why this shape: a manager fixes a draft by looking at the grid and fixing the cell that looks wrong. So the grid is the
editor; there is no separate edit mode or form. Problems appear next to the thing that caused them and say why.

## Goals

- Edit any cell of the week grid in two clicks: open the cell, tick or untick people. Removing one person is one click.
- Every edit is saved immediately (no Save button) and the grid, the warnings strip and the Summary tab reflect it
  straight away.
- Warnings explain themselves in words: who, how many hours over, which hour needs how many people and has how many.
- Edits that break a *preference* (over maximum hours, understaffed hours) are allowed and flagged. Edits that are
  *impossible* (one person on two overlapping shifts at once) are prevented in the popover, with the reason shown.
- Shift create/edit/delete keep working as today and now say what they do to the roster; the roster and summary
  follow.
- Usable with a keyboard and on a phone-width screen (grid scrolls sideways; popover is touch-sized).

## Non-goals

- Drag and drop (brief stretch goal; the design leaves room for it as a later addition on the same endpoints).
- Re-running the scheduler for part of the week ("fill the gaps"), availability, days off, roles, export.
- Multi-user concurrency: single user, no authentication (README assumption). Last write wins.
- A separate coverage view (stretch). The warnings strip plus the Summary tab cover "where are the gaps".
- Redesigning the Shifts tab. It already has a list with a timeline bar and add/edit/delete dialogs; this work adds
  consequences to it (below), not a new layout.

## Anti-goals (a failure even if it "works")

- Silently refusing an edit, or silently accepting one that breaks a rule, with no explanation.
- The roster, strip and Summary tab ever disagreeing with each other. All three derive from the same data.
- Needing a modal form or a page reload to move one person.
- A warning that does not say which person, day or hour it is about.

## Constraints

- Existing stack and conventions (see README): Spring Boot 4.1, Flyway, feature package per domain, DTO records,
  RFC 9457 errors via `FieldProblemException` / `ResourceNotFoundException`; React 19, TanStack Query, shadcn/ui
  (Radix; `radix-ui` is already a dependency), Tailwind.
- `assignment(id, schedule_id, day_of_week, shift_id, staff_id)` exists with a unique key on
  (schedule, day, shift, staff) and cascading deletes from schedule, shift and staff. **No schema change is needed.**
- The "need" rule (one person per 16 transactions, see auto-scheduler design) already exists on the client in
  `summary/compute.ts` (`needOf`, `buildSummary`). The roster reuses it, so the roster, the strip and the Summary tab
  call an hour understaffed under exactly the same rule.
- The summary counts staff-hours as the *distinct* people on shift in that hour (`buildSummary` uses a set), so a
  person on two overlapping shifts counts once there. Overlap is still prevented because it is impossible in real
  life, and because a person's weekly hours are the sum of their assigned shift lengths (the scheduler's rule), which
  would overstate what they can actually work. Over-max is measured by that sum (`problems.ts` says so in a comment).
- **Vocabulary (taken from `summary/compute.ts`, the one source of truth).** For an hour with `need` people required:
  *understaffed* = at least one person on shift but fewer than `need`; *nobody scheduled* (the Summary calls it
  `uncovered`) = zero people in an hour that has demand or needs staff. Inside that second group, `need = 0` means no
  shift covers the hour at all (fix: add a shift), `need > 0` means the hour is inside a shift nobody is assigned to
  (fix: assign someone). The roster uses these same two groups and the same counts as the Summary tab.
- Hours are whole clock hours; a shift `[start, end)` covers hours `start .. end-1`; day 1 = Monday.

## Decisions

Made with the product owner: the interaction model is **A, click a cell and pick people from a popover** (not drag and
drop, not a side panel), and the roster tab carries a one-line live warnings strip. Everything else is my call, marked
as such, and listed again at the end.

### 1. Roster grid (reads and edits)

Same layout as today: shifts down the side, Monday to Sunday across.

- **Cell content.** The people in that shift on that day as chips, sorted by name. A chip shows the name and a small ✕
  button ("Remove Anna from Monday 07:00-15:00"). An empty cell shows a quiet "+ Add" button (the same button sits
  after the chips in a non-empty cell).
- **Opening a cell.** "+ Add" (or clicking anywhere in the cell, or Enter on it) opens a popover anchored to the cell,
  titled with day and shift, e.g. "Tuesday 07:00-15:00".
- **The popover** lists every team member as a checkbox row: name on the left, **hours used / maximum** on the right
  (e.g. `32 / 40 h`). The list is the whole team, alphabetical, with a filter box only when there are more than 8
  people (my call). Ticking a box assigns that person to this cell; unticking removes them. The popover stays open so
  several people can be added in one go; Escape, outside click or Done closes it. The hours shown are *after* the
  tick: ticking someone shows what their total would become.
- **Over the maximum (warn, allow).** If assigning a person would take them above their maximum weekly hours, the row
  is amber with "+4 h over" and the box can still be ticked. The tick is not blocked; the result is flagged (below).
- **Overlap (prevent, explain).** A person already on an overlapping shift that same day gets a disabled row with
  "Already on 11:00-15:00 this day" (my call; see Constraints for why). Back-to-back shifts (15:00 end, 15:00 start)
  do not overlap and stay allowed, as in the auto-scheduler.
- **Reassigning** is remove here, add there. There is no drag in this version.
- **Undo.** Removing a chip shows a toast "Removed Anna from Tue 07:00-15:00. Undo" (my call), which re-adds the person
  if clicked within the toast's lifetime.
- **Saving.** Each tick/untick/remove is one request, applied to the screen immediately (optimistic) and rolled back
  with an error toast if the request fails. Taps in quick succession must not corrupt the grid (see Left to the
  builder).
- **Empty roster.** When there is no roster yet, the grid is shown anyway with empty cells (replacing today's "No
  roster yet" placeholder as the only content), so the manager can build a roster by hand without Auto-schedule. The
  Auto-schedule button and its overwrite confirmation stay as they are (my call).

### 2. Problems shown on the grid

Computed on the client from the same four queries the Summary tab uses (staff, shifts, demand, assignments), live,
with no extra request.

- **Short cell.** A shift-day cell gets an amber border and a footer such as "⚠ 2 hours short" when at least one hour it
  covers has fewer people than its need, counting both *understaffed* and *nobody scheduled* hours (people on shift in
  that hour across all shifts < need). An empty cell in a shift that needs people is therefore amber too. The footer's
  tooltip or expanded text names the hours: "13:00 needs 4, has 3", "08:00 needs 2, nobody scheduled". It is a property
  of the *hours*, so two cells covering the same hour can both show it; that is correct and not a bug.
- **Over-max person.** A chip of someone over their maximum (anywhere in the week) turns red with a ⚠ and a tooltip
  "Anna works 44 of 40 h this week".
- **Hours no shift covers** (demand in an hour outside every shift) are not cell problems, since no cell contains
  them; they appear only in the strip.
- **Tooltips are not the only carrier:** every warning also exists as visible text (the strip) or in an accessible
  name, never colour alone.

### 3. Live warnings strip (under the grid)

One line, updated on every edit, for example:

> **3 understaffed hours · 2 hours with nobody scheduled · Fay is 4 h over · 216 staff-hours** · View summary →

- The first two numbers are exactly the Summary tab's chips: "understaffed" = `counts.understaffed`, "with nobody
  scheduled" = `counts.uncovered` (which includes hours no shift covers). Same data, same numbers, by construction
  (they come from `buildSummary`).
- Segments appear only when non-zero; when there are no problems it says "No problems: every hour has enough people and
  nobody is over their maximum." with a quiet check icon.
- Each problem segment expands (click) into a short list: "Fri 13:00 needs 4, has 2", "Sat 08:00 needs 2, nobody
  scheduled", "Sun 22:00: no shift covers this hour, add a shift", "Fay works 44 of 40 h". This keeps the line short
  but never hides the facts (my call: an expandable list rather than a link only).
- On a roster with nobody in it, the strip is truthful rather than quiet: it reports every open hour as nobody
  scheduled. No special casing.
- "View summary →" goes to the Summary tab. The strip never duplicates the Summary grid.
- The Auto-schedule result panel keeps showing the warnings *from the moment of drafting*. Once the manager edits, those
  go stale, so the panel is dismissed on the first edit (my call).

### 4. Shifts: consequences become visible

The Shifts tab layout stays. Behaviour added:

- **Delete.** The confirmation says what it removes: "12 assignments across the week will be removed" (count from the
  assignments query; "Nobody is assigned to it" when zero). Today's text is the generic "Anyone assigned to this shift
  will be unassigned." The cascade already happens in the database.
- **Edit times.** Assignments stay with the shift. After saving, if the new times now overlap another shift that someone
  works the same day, or push someone over their maximum, the success toast says so ("Shift updated. 2 people now
  overlap on other shifts") and the strip lists it. Nothing is silently changed (my call: warn, never auto-fix).
- **Add.** A new shift starts empty; the roster grid gains a row; if it covers hours no other shift covered, the strip
  stops reporting them as uncovered (derived, no code needed).
- All three keep invalidating the roster and summary data so every tab follows (already in place in `shifts/api.ts`;
  verified by tests).

### 5. Staff changes

No UI change. Removing a person already cascades to their assignments; the staff API already invalidates the roster
data. Lowering a person's maximum hours simply shows up as over-max (strip + red chip).

### 6. API (new, in `roster`)

| Endpoint | Behaviour |
| --- | --- |
| `POST /api/schedules/{id}/assignments` body `{day, shiftId, staffId}` | creates one assignment, returns 201 + `AssignmentResponse`. 404 if the schedule, shift or person is not in that schedule. 400 (field errors) for `day` outside 1..7. 409 if that person is already in that cell. |
| `DELETE /api/schedules/{id}/assignments/{assignmentId}` | removes it. 404 if it is not in that schedule. 204. |

- The server enforces **integrity only** (things belong to the schedule, no duplicates). It does not enforce maximum
  hours or overlap. Those are the manager's call, surfaced by the UI (my call; this is what keeps "warn, don't block"
  true for hours, and overlap is prevented in the UI where the reason can be shown).
- Create is idempotent-friendly: a repeated identical POST returns 409, which the client treats as "already there".
- `GET /assignments` and `POST /auto-schedule` are unchanged.

### 7. Where the code goes

- Backend: `roster/` gets `AssignmentRequest` (record, validated), `RosterService.add/remove`, controller methods.
  A `findByIdAndScheduleId` on the repository.
- Frontend `features/roster/`: `api.ts` gains `useAddAssignment` / `useRemoveAssignment` (optimistic);
  `RosterGrid.tsx` becomes the editable grid; new `AssignPopover.tsx` (team checklist), `RosterStatus.tsx` (strip),
  and a pure `roster/problems.ts` for per-person hours, overlap and the understaffed hours of a cell (unit tested),
  reusing `summary/compute.ts` for need and hourly staffing. A shadcn `popover` component is added under
  `components/ui`.
- `shifts/ShiftsTab.tsx`: richer delete text and post-edit conflict message.
- README: API table, assumptions, roadmap item 6 ticked.

## Acceptance scenarios

Frontend component tests unless stated (Vitest + Testing Library, API stubbed as in `RosterTab.test.tsx`); backend
integration tests use Testcontainers like `AutoScheduleIntegrationTest`.

1. Opening an empty cell shows every team member with `hours / max`; ticking one calls POST once, shows the chip at
   once, and the Summary-bound data (assignments query) contains the new row.
2. Unticking / ✕ calls DELETE and removes the chip; Undo in the toast re-adds it.
3. A failed POST rolls the chip back and shows an error toast; the grid equals the server state.
4. Ticking someone who would exceed their maximum is allowed; their chips turn red, the strip says "Fay is 4 h over",
   the popover row said "+4 h over" before the tick.
5. A person on an overlapping shift that day is disabled in the popover with the reason; one on a back-to-back shift
   is not.
6. Removing people until an hour falls below its need (but not to zero) puts the amber footer on the affected cells and
   "N understaffed hours" in the strip, with the expandable list naming hour, needed and scheduled. Removing the last
   person from an hour adds it to "N hours with nobody scheduled" instead. Both numbers equal the Summary tab's
   `buildSummary` `counts.understaffed` and `counts.uncovered` for the same data (a test asserts this agreement), and
   an hour outside every shift appears in the strip's list with the "add a shift" wording but in no cell.
7. With no problems the strip shows the all-clear text.
8. No roster yet: the grid renders with empty cells (all amber, since every open hour needs people), the strip reports
   the open hours as nobody scheduled, and a cell can be filled.
9. Deleting a shift: the dialog states the number of assignments it removes; afterwards the roster has no such row and
   the strip updates.
10. Editing a shift's times so two of a person's shifts overlap: the toast and strip report it; nothing is removed.
11. Keyboard: Tab reaches a cell button, Enter opens the popover, Space toggles a person, Escape closes and returns
    focus to the cell.
12. Backend: POST creates (201) and the row appears in GET; duplicate is 409; shift or staff from another schedule is
    404; day 0 or 8 is 400 with a field error; DELETE removes (204), a second DELETE is 404; deleting the shift or
    person cascades.
13. Pure `problems.ts`: hours per person, over-max amounts, overlap detection (including touching ends), understaffed
    hours of a cell.

## Left to the builder

Exact visual design (spacing, colours within the existing theme, icon choices), wording of toasts and tooltips within
the behaviour above, the optimistic-update mechanics (including how to keep rapid successive clicks consistent and what
temporary ids to use), whether the popover is built on Radix Popover directly or the shadcn wrapper, component
splitting, and the tuning of the long-list filter threshold.

## Calls I made (please check)

- Overlap is prevented in the popover (with a reason), not merely warned; the server does not check it. Weekly hours
  are the sum of assigned shift lengths, so a double-booked person (possible only after a shift-time edit) is measured
  by that sum.
- The strip uses the Summary tab's two categories (understaffed, nobody scheduled) and numbers, not a merged count.
- Over-max and understaffed are allowed and flagged; the server never blocks on hours.
- Popover toggles people on and off and stays open; filter box only with more than 8 people.
- Undo toast on removal.
- The grid is shown (editable) even before any roster exists.
- Auto-schedule result panel is dismissed on the first manual edit because its warnings go stale.
- Strip segments expand into a list instead of linking only to the Summary tab.
- Shift time edits never change assignments; conflicts are reported, not repaired.
- No drag and drop in this version.
