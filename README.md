# Staff Scheduler

A web app that helps a store manager plan one typical week of staff schedules from historical hourly demand.

> **Status:** schedules, staff, shifts, transaction (demand) upload and the auto-scheduler are implemented end to
> end (UI, API, database). Roster editing with live warnings (brief sections 2.6-2.7) is next; see the
> [Roadmap](#roadmap).

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
- Package name `com.palexy.scheduler`; Java 25 LTS; PostgreSQL pinned to 17 (PG 18 changed the data-directory layout).

_(More will be added as decisions are made.)_

## AI usage note

_To be written at the end of the project:_ what was delegated to Claude, what was verified, and where its
suggestions were overridden.

## Roadmap

1. ~~Create / list schedules~~ done
2. ~~Staff CRUD~~ done
3. ~~Shifts CRUD (seeded with 07:00-15:00 and 15:00-23:00)~~ done
4. ~~Transaction CSV import~~ done
5. ~~Auto-scheduler + demand model~~ done
6. Roster view with direct editing, live aggregated summary and warnings (over max hours, understaffed hours)
7. Stretch: coverage view, availability/days off, roles, export
