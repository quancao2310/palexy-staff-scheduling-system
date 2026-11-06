# Staff Scheduler

A web app that helps a store manager plan one typical week of staff schedules from historical hourly demand.

> **Status:** schedules, staff, shifts, transaction (demand) upload, the auto-scheduler, the aggregated summary and
> direct roster editing with live warnings are implemented end to end (UI, API, database); see the
> [Roadmap](#roadmap) for what is left.

## Stack

| Layer    | Choice                                                                                  |
| -------- | --------------------------------------------------------------------------------------- |
| Frontend | React 19 + TypeScript + Vite, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query, React Router |
| Backend  | Java 25 (LTS), Spring Boot 4.1 (Web MVC, Data JPA, Validation, Actuator), Flyway, Maven |
| Database | PostgreSQL 17                                                                           |
| Runtime  | Docker Compose (multi-stage images, non-root, read-only root filesystem)                |
| Tests    | JUnit 5 + Testcontainers (real Postgres) · Vitest + Testing Library                    |

## Quick start (Docker)

Requires Docker with Compose v2. No `.env` file is needed.

```bash
docker compose up --build
```

Open **http://localhost:8080**. The first build takes a couple of minutes; later builds reuse cached layers.
Stop with `Ctrl+C`; `docker compose down` removes the containers but **keeps your data** (named volume `pgdata`),
`docker compose down -v` wipes it too.

On first start with an empty database the app creates a **sample schedule** (10 staff with 12-40 max hours, the two
default shifts and the sample transaction report) so there is something to look at straight away. Set
`DEMO_DATA=false` (in `.env` or the environment) to start empty.

To change the port or database credentials, copy `.env.example` to `.env` and edit it.

## Local development (hot reload)

Run only Postgres in Docker, and the apps natively. Requires JDK 25 and Node 22+.

```bash
# 1. database, published on 127.0.0.1:5432
docker compose -f compose.yaml -f compose.dev.yaml up -d db

# 2. backend → http://localhost:8080   (Flyway migrates the schema on startup)
cd backend && ./mvnw spring-boot:run

# 3. frontend → http://localhost:5173  (Vite proxies /api to :8080)
cd frontend && npm install && npm run dev
```

No Postgres at all? `cd backend && ./mvnw spring-boot:test-run` starts the API against a throwaway
Testcontainers database.

## Tests and checks

```bash
cd backend  && ./mvnw verify                          # boots the app against a real Postgres (Testcontainers)
cd frontend && npm run lint && npm test && npm run build
```

Backend tests need a running Docker daemon (Testcontainers).

## Architecture

```
Browser ──► nginx :8080 ──┬─ /           static React bundle (SPA fallback to index.html)
 (only published port)    └─ /api/*  ──► Spring Boot :8080 (private) ──► PostgreSQL :5432 (private)
```

- **Same origin everywhere → no CORS.** nginx proxies `/api` in Docker; Vite's dev proxy does it locally.
- **Flyway owns the schema** (`backend/src/main/resources/db/migration`); Hibernate only validates it (`ddl-auto: validate`).
- **Errors are RFC 9457 problem-details** (`application/problem+json`); validation failures include a per-field
  `errors` map so the UI can show messages next to inputs. (Wired up in `GlobalExceptionHandler`; no feature uses it yet.)
- **Container hardening:** multi-stage builds, pinned base images, non-root users (backend uid 10001, nginx uid 101),
  read-only root filesystem with a `/tmp` tmpfs, all Linux capabilities dropped, `no-new-privileges`, memory limits,
  health-gated startup order (`db` → `backend` → `frontend`), graceful shutdown, layered Spring Boot jar for small rebuilds.

### Repository layout

```
backend/        Spring Boot API          (Dockerfile, pom.xml, src/…)
frontend/       React SPA                (Dockerfile, nginx/, src/…)
sample-data/    Example transaction CSV
compose.yaml    db + backend + frontend  (the one command)
compose.dev.yaml  overlay that publishes Postgres for local development
```

Planned convention: organise feature code by domain in both apps. Backend: a package per feature under
`com.palexy.scheduler` (entity → repository → service → controller, DTOs as records, schema changes as new Flyway
migrations). Frontend: a `src/features/<name>/` folder with query hooks (`api.ts`, built on `src/lib/api.ts`) and components.

## API

All under `/api`; errors are RFC 9457 problem-details (field errors in `errors`, rejected CSV lines in `problems`).

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /schedules`, `GET/PATCH/DELETE /schedules/{id}` | list, create (seeds 07:00-15:00 and 15:00-23:00), rename, delete |
| `GET/POST /schedules/{id}/staff`, `PUT/DELETE .../staff/{staffId}` | staff CRUD |
| `GET/POST /schedules/{id}/shifts`, `PUT/DELETE .../shifts/{shiftId}` | shift CRUD (`startHour`, `endHour`) |
| `GET/PUT/DELETE /schedules/{id}/transactions` | read, upload (multipart `file`, replaces), clear demand data |
| `POST /schedules/{id}/auto-schedule` | draft the roster (replaces the current one); returns `assignments`, `warnings`, `stats`. 422 when staff, shifts or demand data are missing |
| `GET /schedules/{id}/assignments` | the current roster: `[{id, day, shiftId, staffId}]`, day 1 = Monday |
| `POST /schedules/{id}/assignments` | put one person on a shift on a day: body `{day, shiftId, staffId}`; 201. 404 if the shift or person is not in the schedule, 409 if already there, 400 for a bad day |
| `DELETE /schedules/{id}/assignments/{assignmentId}` | take one person off a shift; 204 (404 if not in the schedule) |

## Auto-scheduler approach

The scheduler maximizes one explicit score; every term is a number a manager can reason about. It is plain Java
(`autoschedule/engine`, no framework), deterministic, and covered by unit tests on the sample week.

**1. Required staff per hour.** `need = max(1, ⌊tx / 16⌋ + 1 if the leftover would keep one more person at least a
third busy)`. **N = 16 transactions per staff-hour** is the NACS State of the Industry Report (2024 data) average for
convenience stores, 16.1 ([source](https://www.convenience.org/stay-current/news/2026/march/31/2-boosting-labor-efficiency-checkouts_branded));
the sample data (open 07:00-23:00, about 27 transactions an hour) looks like such a store. It is an assumption, set by
`app.scheduler.transactions-per-staff-hour`. The "a third busy" rule comes from valuing a missing person twice as
bad as an idle one (k = 2): another person is worth adding when their unserved transactions exceed N / (k + 1).
Every open hour needs at least one person. `need` depends only on N and the data, never on team size, so a warning
means the same thing whatever the team looks like.

**2. Score (lower cost is better).** In transaction units: 2 × transactions beyond what the people on shift can
handle (N each) + 1 × unused capacity + 0.05 × N × Σ(hours − fair share)² + 1 × N × hours beyond 10 in one day.
Fair share is the same utilisation (hours ÷ maximum hours) for everyone. The fairness weight is low on purpose: shifts
are 8-hour lumps, and at weight 1 the search deleted shifts of real demand just to make totals identical, so
fairness decides *who* works the shifts, not *how many* there are.

**3. Steps.**
1. *Headcount per day-shift:* the cheapest set of shifts covering every open hour, then extra people in order of
   value (cost saved per staff-hour) while the team's hours and the number of staff allow. Shifts are the
   manager's, so a short midday shift is used if one exists.
2. *Assign:* work down that list, giving each seat to the eligible person (hours left, no overlapping shift that
   day) who would end up least utilised.
3. *Improve:* try single moves (reassign, swap, add, remove) and keep any that lower the cost, until none does (or a fixed work limit is reached, which only a very large store hits).
   Adding a person for fairness never takes an hour above `need + 1`, and no move leaves an hour with nobody.

**4. Shortage and surplus are reported, not hidden.** The result lists `UNDERSTAFFED` hours (needs 3, has 2),
`UNCOVERED_HOUR`s (transactions in an hour no shift covers: add a shift), and `UNDER_UTILISED` people, plus the
shortfall in staff-hours, unmet transactions and idle staff-hours. On the seeded team (10 people, 260 contracted
hours) the draft schedules 216 hours, everyone between 67% and 100% of their maximum, and flags 25 understaffed hours
(26 person-hours short, 289 of 3,058 transactions beyond capacity).

**Known limit.** With 8-hour blocks a shift's headcount follows its average load, so a peak inside a block (Friday
13:00) can stay understaffed while capacity is left unused: another person on the block would sit idle for the rest of
the shift. The warnings show exactly where; adding a shorter shift over the peak (e.g. 11:00-15:00) lets the scheduler
cover it.

## Assumptions

- One schedule = one typical week (Monday–Sunday), independent of calendar dates.
- Sample CSV columns are treated as generic days of the week; the date range on its first line is ignored.
- Single user, no authentication (out of scope per the brief).
- Shifts are whole hours within one day (`end` may be 24:00). The summary table is one cell per clock hour, so
  "staff hours = staff on shift" only holds with whole-hour shifts. Overlapping shifts are allowed; identical ones are not.
- Staff names are unique per schedule (case-insensitive); max weekly hours is a whole number from 1 to 168.
- A transaction upload replaces the previous one. Days are matched by name (`Fri, 07 Aug` is Friday), a title row,
  BOM, CRLF/LF and `, ; TAB` delimiters are tolerated, hours may be `7am`, `12pm`, `07:00` or `13`. Missing days or
  empty cells count as 0 and the user is told; unreadable cells reject the whole file with line numbers.
- Auto-schedule uses only the shifts the manager defined; it never invents shifts. An hour is "open" when some shift
  covers it, on every day: there is no closed-day concept, so a day missing from the CSV still gets one person per hour.
- A person may work several non-overlapping shifts in a day (split or back-to-back), never overlapping ones; days over
  10 hours cost a little in the score. Auto-schedule overwrites the whole roster (the UI asks first). Its warnings are
  returned with the result and not stored.
- Roster editing (brief 2.7): click a cell on the Roster tab and tick or untick people; every change is saved at
  once (no Save button) and the grid, the warnings strip and the Summary tab follow. Going over a person's maximum
  hours or leaving an hour short is allowed and flagged with the reason, never blocked. One person on two overlapping
  shifts the same day is prevented in the picker (with the reason shown), since it is impossible. The server only
  checks that the shift and person belong to the schedule and that the pair is not already there. A person's weekly
  hours are the sum of their assigned shift lengths. Deleting a shift says how many assignments it removes; editing
  a shift's times keeps its assignments and warns if that creates overlaps or over-maximum weeks. No drag and drop.
- Package name `com.palexy.scheduler`; Java 25 LTS; PostgreSQL pinned to 17 (PG 18 changed the data-directory layout).

_(More will be added as decisions are made.)_

## AI usage note

I used Claude Code for the build. This note says what it did, what I decided and how the result was checked, first
for sections 2.1-2.4, then for the auto-scheduler, then for the aggregated summary table, then for viewing and editing
the roster and shifts.

### Schedules, staff, shifts and transaction upload (2.1-2.4)

I set the scope: the workflow for 2.1-2.4 first, a clear UI without stretch features such as drag and drop, and unit
tests only where they add value. Claude read the assignment and the empty scaffold and wrote a plan (data model, API,
screens, tests), which I reviewed before any code was written. It then built the Flyway migration, the REST API, the
CSV parser, the React screens and the tests, and clicked through the running app in a browser.

Claude proposed these decisions in the plan and I approved them. Each is listed under Assumptions with its reason:

- Shifts are whole hours within one day (end may be 24:00), because the summary table has one cell per clock hour.
  Overlaps are allowed; exact duplicates are not.
- Staff names are unique per schedule ignoring case, and max weekly hours is 1-168.
- A schedule has one transaction upload, and a new upload replaces it.
- The CSV reader is tolerant (days matched by name, title row, BOM, other delimiters, `7am` or `13:00` labels). It was
  shaped by Claude reading the provided sample, which has a byte-order mark, CRLF line ends, a title row and a week that
  starts on Friday. A file with an unreadable cell is rejected whole with line numbers, so nothing is half-imported.
- The same rules (end after start, no duplicate shift or name) are enforced in the database as well as the API.

Decisions I made while it worked:

- Remove comments that only restate the code.
- Add more staff for the demo. Claude offered options and I chose a seeder in the repo with ten people with varied maximum
  hours. It runs only on an empty database, and `DEMO_DATA=false` turns it off.
- Commit one feature at a time.

Checks and what they found:

- 25 unit tests on the CSV parser (the provided sample, reordered columns, BOM and CRLF, bad counts with line
  numbers, duplicates, the cap on reported problems), plus frontend tests for the staff form, the shift rules, time
  formatting and routing. Typecheck, lint and the production build pass.
- In the browser Claude checked validation errors, a duplicate shift, the CSV error and warning states, a narrow
  screen and the create-schedule flow. This caught mistakes in its own first version: the shift dialog's end-time list
  came up blank and read "1 hours", and the name field lost focus after adding a person, which defeated the
  quick-add row. Both were fixed.
- Not covered: no automated test of the endpoints or database, and the Docker stack was checked through the API, not
  in a browser.

### Auto-scheduler (2.5 and 4)

I used Claude Code throughout the auto-scheduler. First I brainstormed the approach with it and made the product
decisions myself. Then I had it write the design document, the implementation plan, the scheduling engine, the API,
the Roster tab and the tests. Claude researched the throughput benchmark behind N=16, drafted the design, implemented
the plan, and ran a fresh read-only reviewer over the design and over the finished code.

The product decisions were mine:

- Choosing the cost model.
- Treating a missing person as twice as bad as an idle one.
- Accepting a little overstaffing so nobody is left near zero hours.
- Using only the shifts the manager defines.
- Allowing split shifts, which corrected a one-shift-per-day rule Claude had proposed.

Claude's output was checked, not trusted:

- Several of its claims were wrong and were caught with scripts and tests. It misstated how N would behave for a
  small team, and its first acceptance team sizes were too small for the demand.
- Its first fairness weight made the search delete real demand to equalize hours. I tuned it down after measuring.
- A few acceptance assertions were loosened after observing that 8-hour blocks follow average load. This is
  documented in the design.
- The 16.1 transactions per labor hour figure comes from a vendor-sponsored NACS page that quotes the 2024 report. I
  read the page itself, but not the report. N is an assumption and is configurable.
- I ran the full backend and frontend suites, plus an end-to-end run on the seeded sample. The final review found
  four Important issues (an unguarded overwrite, a contradictory empty result, a slow search at scale, and a missing
  explanation), and all four were fixed.

### Aggregated summary table (2.6)

The summary was designed before the roster existed, because the brief asks for design judgement and the auto-scheduler
was still being built. I asked Claude for the UI/UX of the table and thought about how it should be read. Claude read
the brief and the existing screens (the demand heat map, the tab bar, the theme), then built browser mockups from the
real sample CSV rather than describing options in words. I picked one of three cell layouts, then approved a
full-page mockup. Claude built the page, and later wired it to the real roster API after reading the backend.

My decisions:

- The cell leads with transactions per staff-hour and shows the other two figures underneath ("48 ÷ 3"), with a
  switch to lead with transactions or staff hours instead. Claude had proposed stacking all three values in each
  cell, or three separate grids. I chose the layout that scans fastest and still shows every value.
- "Understaffed" must follow the scheduler's own rule (one person per 16 transactions, plus one when the leftover is
  6 or more), so the summary and the roster warnings never disagree. The mockup I had approved used a simpler "20 or
  more transactions per staff-hour" rule. Claude found that it would miss hours the roster flags, such as Saturday
  9am (57 transactions, 3 staff, 19.0 per staff-hour, but the roster says it needs 4), and I changed it.

Claude's calls that I accepted, listed so they can be challenged: an hour is "quiet" below 8 transactions per
staff-hour (half the target), a person double-booked in one hour counts once, and an hour with demand and nobody
scheduled is shown hatched as "uncovered".

Checks and what they found:

- In the browser on mocked data, Claude caught three mistakes in its own first version: the Day total row was hidden
  inside the scrolling grid, the shading came out salmon and pink instead of amber and blue because a theme variable
  did not resolve, and the weekly figures stacked into a tall column on a phone. All were fixed.
- Reading the backend, Claude found it had duplicated the roster feature's assignment type and hook, and removed its
  copy so the two tabs share one cache entry.
- Claude claimed that deleting a person or shift would leave stale rosters in the browser, and added code to refresh
  them. That was wrong: the query client refetches when a tab opens. Claude removed the code after confirming in the
  browser that the page refreshes without it. Its formatter also re-wrapped three committed roster files by accident;
  it noticed and restored them.
- 21 new tests: the demand rule, staff-hour counting, division by zero, overall against average, status
  classification, and the tab itself (tiles, chips, the cell switch, the empty and error states). The full frontend
  suite, typecheck, lint and production build pass.
- On the rebuilt Docker stack, with a throwaway schedule drafted by Auto-schedule: total staff hours matched the sum of
  per-person hours (240), the 14 understaffed cells were exactly the 14 backend warnings with the same "needs N, has
  M", and removing a person took the total from 240 to 200 without a reload.
- Not covered: the 16 and the "leftover 6 or more" rule are copied into the frontend because no API exposes them, and
  no test checks them against the backend, so a backend change needs a matching frontend change. The "quiet"
  threshold is a display choice no one has tested with real managers. I did not test with a screen reader, and dark
  mode was checked on mocked data only.

### Viewing and editing the roster and shifts (2.7)

I asked Claude to design, plan and build this. It read the brief and the existing roster, summary and shift code, then
showed browser mockups of three ways to edit: click a cell and pick people from a popover, drag people from a team
panel, or a mix of both. It recommended the mix. Claude wrote the design document, a fresh read-only reviewer read it
as a builder would, and only then did I ask for the plan and the build.

My decisions:

- The popover, not Claude's recommended mix and not drag and drop. Each cell lists its people and opens a checklist
  of the team with hours used out of maximum.
- A one-line warnings strip under the grid, as well as the Summary tab.

Claude's calls, listed in the design under "Calls I made" and accepted when I asked for the build: going over a
person's maximum hours or leaving an hour short is flagged, never blocked; two overlapping shifts for one person on one
day are prevented in the picker with the reason shown; removing someone offers Undo; the grid is editable before any
roster exists; the auto-schedule result panel is dismissed on the first manual edit because its warnings go stale;
editing a shift's times never moves assignments and only warns; no drag and drop.

Checks and what they found:

- The reviewer found that the design contradicted itself on "understaffed" versus "nobody scheduled", which the
  Summary tab already counts separately. The strip now uses the Summary's own two categories and numbers. Claude had
  also written that the summary double counts a person on overlapping shifts. Reading the code showed it counts them
  once, so the design now gives the real reason for preventing overlap. Both were fixed before any code was written.
- Frontend lint, typecheck, production build and the full suite (47 tests) pass. That includes 7 new tests on the
  pure helpers (weekly hours, overlap with touching ends, short hours, and agreement with the Summary's counts) and
  the existing roster tests, updated for the editable grid.
- The backend compiles, and I exercised the new endpoints by hand against the real database: create (201), duplicate
  (409), bad day or missing field (400), a shift from nowhere (404), delete (204) and a repeated delete (404). I did
  not write backend tests for them, and I did not re-run the backend suite after the change.
- In the browser on the sample schedule, Claude ticked and removed people, used Undo, pushed someone over their
  maximum (red chips and a named warning), checked that an overlapping shift is disabled, read the delete count on
  the Shifts tab and edited a shift into an overlap to see the warning. It caught two mistakes in its own build: the
  disabled row squeezed the person's name down to "Da…", and the toast read "1 person now overlap". Both were fixed,
  and the sample data was restored afterwards.
- Not covered: I did not test the keyboard flow (Tab, Space, Escape) or a phone-width screen, or use a screen reader.
  The Summary tab was not re-checked in the browser after edits, only through the shared data. The optimistic update
  under very rapid clicks rests on reasoning, not a test. Concurrent edits are last write wins.

_This note covers sections 2.1-2.7._

## Roadmap

1. ~~Create / list schedules~~ done
2. ~~Staff CRUD~~ done
3. ~~Shifts CRUD (seeded with 07:00-15:00 and 15:00-23:00)~~ done
4. ~~Transaction CSV import~~ done
5. ~~Auto-scheduler + demand model~~ done
6. ~~Roster view with direct editing, live aggregated summary and warnings (over max hours, understaffed hours)~~ done
7. Stretch: coverage view, availability/days off, roles, export
