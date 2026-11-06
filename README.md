# Staff Scheduler

A web app that helps a store manager plan one typical week of staff schedules from historical hourly demand.

> **Status:** schedules, staff, shifts and transaction (demand) upload are implemented end to end (UI, API,
> database). The auto-scheduler, roster editing and summary table (brief sections 2.5-2.7) are next; see the
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

## Auto-scheduler approach

_To be written when the scheduler is implemented._ It will cover: converting transactions per hour into required
staff (the value of N and why), mapping that onto shifts, assignment under max-hours limits, the fairness rule, and
how shortfalls and surplus are surfaced to the user.

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
5. Auto-scheduler + demand model
6. Roster view with direct editing, live aggregated summary and warnings (over max hours, understaffed hours)
7. Stretch: coverage view, availability/days off, roles, export
