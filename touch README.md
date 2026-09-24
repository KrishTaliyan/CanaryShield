# FlagGuard

**Feature flags and canary releases with automatic rollback and blast-radius control.**

Hackathon project by **Satvik** (backend) and **Krish** (frontend).

> **Read this first.** This README is the single source of truth for this repository, for both team members and for every AI agent working in it. If a prompt, a code comment, or an agent's own idea conflicts with this file, this file wins. This file changes only through a pull request approved by both Satvik and Krish.

**AI agents:** read this whole file before writing any code. Your rules are in [section 6](#6-rules-for-ai-agents), the API you must implement is in [section 8](#8-api-contract-frozen), and your task is in [section 10](#10-task-board).

## Contents

1. [Mission and scope](#1-mission-and-scope)
2. [Team and ownership](#2-team-and-ownership)
3. [Architecture and tech stack](#3-architecture-and-tech-stack)
4. [Repository structure](#4-repository-structure)
5. [Local environment](#5-local-environment)
6. [Rules for AI agents](#6-rules-for-ai-agents)
7. [Team rules: Git, commits, PRs](#7-team-rules-git-commits-prs)
8. [API contract (frozen)](#8-api-contract-frozen)
9. [Core logic specification](#9-core-logic-specification)
10. [Task board](#10-task-board)
11. [Definition of done](#11-definition-of-done)
12. [Coding conventions](#12-coding-conventions)
13. [Stretch goals and out of scope](#13-stretch-goals-and-out-of-scope)
14. [Demo script](#14-demo-script)

---

## 1. Mission and scope

**Goal:** build a lightweight feature-flag and canary-deployment platform. It releases a new feature to a small, controlled group of users, watches its health in Prometheus, and automatically rolls it back when its error rate crosses a threshold. A bad release should only ever affect a small slice of users. That is **blast-radius control**.

**Core flow:** Configure → gradual release → user evaluation → observe → detect failure → automatic rollback.

**The project is successful when this demo works end to end, driven from the dashboard:**

1. The flag `new_payment_flow` exists at 0%, so everyone uses the old payment.
2. The load generator runs, and charts show about 1% baseline errors.
3. We roll out 5% → 10% → 25%, and some QuickCart users get the new payment.
4. We turn on chaos, and the new payment starts failing.
5. Prometheus shows the canary error rate rising above 3% while the old flow stays near 1%.
6. The guardian rolls the flag back to 0% within about 30 seconds.
7. Everyone is back on the old payment, and errors drop.
8. The dashboard shows the incident: reason, exposed %, exposed users, and time to rollback.

**If something is not described in this README, it is not part of the project.** See [section 13](#13-stretch-goals-and-out-of-scope).

## 2. Team and ownership

| Person | Role | Owns (only this person and their agents edit these) |
|---|---|---|
| **Satvik** | Backend | `platform/`, `loadgen/`, `infra/`, `scripts/`, `docker-compose.yml`, `.env.example`, `docs/architecture.md` |
| **Krish** | Frontend | `dashboard/`, `quickcart/` (web and server), `docs/demo-script.md`, `docs/images/` |
| Both | Shared | `README.md` and `.gitignore` (changed only by a PR approved by both) |

The work is split into **15 tasks each** (S0–S14 for Satvik, K0–K14 for Krish), all of similar size. QuickCart's server is a small Node/Express app owned by Krish. This keeps the workload equal, and it shows that the platform works with apps written in any language.

## 3. Architecture and tech stack

```text
 KRISH                                     SATVIK
 ─────                                     ──────
 Dashboard (React :5173) ──REST + SSE────► Platform API (Go :8080)
                                             ├─ flags · rollout · targeting · evaluation
 QuickCart web (React :5174)                 ├─ guardian (polls Prometheus, rolls back)
        │                                    ├─► PostgreSQL :5432 (source of truth)
        ▼                                    └─► Redis :6379 (flag cache + pub/sub)
 QuickCart server (Node :4000) ──POST /sdk/v1/evaluate──► Platform API
        ▲          │
        │          └── GET /metrics ◄── Prometheus :9090 ◄── queried by the guardian
        │
 Load generator (Go) ── simulated users calling POST /api/pay
```

How one payment flows through the system:

1. The QuickCart server receives a payment and asks the platform: "old or new flow for this user?"
2. The platform answers from its in-memory flag snapshot, which Redis pub/sub keeps fresh.
3. QuickCart runs the old or new payment code and counts the result in Prometheus metrics labelled `flow="old"` or `flow="new"`.
4. Every 5 seconds the guardian queries Prometheus. If the new flow's error rate breaks the threshold twice in a row, it rolls the flag back to 0% and opens an incident.
5. The dashboard shows everything live through Server-Sent Events (SSE).

| Layer | Technology |
|---|---|
| Platform backend | Go 1.22+ |
| Database | PostgreSQL 16 |
| Cache and pub/sub | Redis 7 |
| Monitoring | Prometheus (version pinned in `docker-compose.yml`) |
| Dashboard, QuickCart web | React + Vite + TypeScript + Tailwind CSS |
| QuickCart server | Node.js 20+ with Express |
| Local infrastructure | Docker Compose |

### Approved dependencies

Nothing outside this list may be added without the folder owner's explicit approval, written in the PR description.

| Folder | Allowed dependencies |
|---|---|
| `platform/` | Go standard library, `github.com/go-chi/chi/v5`, `github.com/go-chi/cors`, `github.com/jackc/pgx/v5`, `github.com/redis/go-redis/v9`, `github.com/prometheus/client_golang` |
| `loadgen/` | Go standard library only |
| `dashboard/` | `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `recharts`, `tailwindcss`, `lucide-react`, plus Vite, TypeScript and ESLint tooling |
| `quickcart/web/` | `react`, `react-dom`, `react-router-dom`, `tailwindcss`, plus Vite, TypeScript and ESLint tooling |
| `quickcart/server/` | `express`, `cors`, `prom-client` |

## 4. Repository structure

Create files only where this tree shows them. If a task needs a file that is not listed here or in the task, stop and ask.

```text
flagguard/
├── README.md                        # both, via PR only
├── .gitignore                       # both, via PR only
├── .env.example                     # Satvik
├── docker-compose.yml               # Satvik
├── docs/
│   ├── architecture.md              # Satvik (S14)
│   ├── demo-script.md               # Krish (K14)
│   └── images/                      # Krish (K14): screenshots, GIF
├── infra/                           # Satvik
│   ├── migrations/0001_init.sql
│   └── prometheus/prometheus.yml
├── scripts/
│   └── seed.sh                      # Satvik
├── platform/                        # Satvik: Go module "flagguard/platform"
│   ├── go.mod
│   ├── Dockerfile
│   ├── cmd/server/main.go
│   └── internal/
│       ├── config/                  config.go
│       ├── db/                      postgres.go
│       ├── models/                  flag.go, event.go, incident.go, health.go
│       ├── flags/                   repository.go, service.go
│       ├── targeting/               match.go, match_test.go
│       ├── rollout/                 bucket.go, bucket_test.go, transitions.go, transitions_test.go
│       ├── evaluation/              evaluator.go, evaluator_test.go, reasons.go, snapshot.go
│       ├── cache/                   redis.go, pubsub.go, reconciler.go
│       ├── monitoring/              prometheus.go
│       ├── guardian/                guardian.go, health.go, rollback.go
│       ├── audit/                   events.go, incidents.go, auditlog.go
│       ├── stream/                  sse.go
│       └── httpapi/                 router.go, middleware.go, errors.go, handlers_*.go
├── loadgen/                         # Satvik: Go module "flagguard/loadgen"
│   ├── go.mod
│   ├── main.go
│   └── users.go
├── dashboard/                       # Krish: React + Vite + TS
│   ├── Dockerfile
│   └── src/
│       ├── main.tsx, App.tsx
│       ├── api/                     client.ts, types.ts, flags.ts, incidents.ts, chaos.ts
│       ├── mocks/                   fixtures.ts
│       ├── hooks/                   useFlags.ts, useFlag.ts, useMetrics.ts, useEventStream.ts
│       ├── pages/                   FlagsList.tsx, CreateFlag.tsx, FlagDetail.tsx, Incidents.tsx, Playground.tsx
│       └── components/              Layout, StatusBadge, HealthBadge, RolloutRing, ConditionsEditor,
│                                    OverridesEditor, GuardrailForm, ErrorRateChart, TrafficChart,
│                                    EventTimeline, IncidentCard, IncidentBanner, ChaosPanel (all .tsx)
└── quickcart/                       # Krish
    ├── web/                         # React + Vite + TS
    │   ├── Dockerfile
    │   └── src/
    │       ├── main.tsx, App.tsx, api.ts, cart.tsx
    │       ├── pages/               Products.tsx, Cart.tsx, Checkout.tsx, Confirmation.tsx
    │       └── components/          PersonaSwitcher.tsx, PaymentBadge.tsx
    └── server/                      # Node + Express (ES modules)
        ├── Dockerfile
        ├── package.json
        └── src/
            ├── index.js, config.js, metrics.js, flagClient.js, chaos.js
            ├── data/                products.js, personas.js
            ├── payment/             legacy.js, v2.js
            └── routes/              products.js, personas.js, pay.js, chaos.js
```

## 5. Local environment

During development, the infrastructure runs in Docker and the apps run directly on your machine.

| Service | URL | Start command |
|---|---|---|
| PostgreSQL | `localhost:5432` | `docker compose up -d` |
| Redis | `localhost:6379` | `docker compose up -d` |
| Prometheus | http://localhost:9090 | `docker compose up -d` |
| Platform API | http://localhost:8080 | `cd platform && go run ./cmd/server` |
| Dashboard | http://localhost:5173 | `cd dashboard && npm run dev` |
| QuickCart web | http://localhost:5174 | `cd quickcart/web && npm run dev` |
| QuickCart server | http://localhost:4000 | `cd quickcart/server && npm run dev` |
| Load generator | (terminal) | `cd loadgen && go run . -rps 30` |

Prometheus runs inside Docker but scrapes apps on the host. So `infra/prometheus/prometheus.yml` targets `host.docker.internal:4000` and `host.docker.internal:8080`, and the Prometheus service in `docker-compose.yml` sets `extra_hosts: ["host.docker.internal:host-gateway"]` (required on Linux).

**Every app must work with the defaults below even when no `.env` file exists.** All variables are listed in `.env.example`.

| Variable | Used by | Default |
|---|---|---|
| `DATABASE_URL` | platform | `postgres://flagguard:flagguard@localhost:5432/flagguard?sslmode=disable` |
| `REDIS_URL` | platform | `redis://localhost:6379/0` |
| `PROMETHEUS_URL` | platform | `http://localhost:9090` |
| `PORT` | platform / QuickCart server | `8080` / `4000` |
| `ADMIN_TOKEN` | platform | `dev-admin-token` |
| `SDK_API_KEY` | platform, QuickCart server | `dev-sdk-key` |
| `CORS_ORIGINS` | platform, QuickCart server | `http://localhost:5173,http://localhost:5174` |
| `PLATFORM_URL` | QuickCart server | `http://localhost:8080` |
| `VITE_PLATFORM_URL` | dashboard | `http://localhost:8080` |
| `VITE_ADMIN_TOKEN` | dashboard | `dev-admin-token` |
| `VITE_QUICKCART_URL` | dashboard, QuickCart web | `http://localhost:4000` |
| `VITE_USE_MOCKS` | dashboard | `false` |

Resetting the database (`docker compose down -v && docker compose up -d`) deletes all data. Only a human may run it.

---

## 6. Rules for AI agents

Every AI agent working in this repo (Claude, Cursor, Copilot, Antigravity, ChatGPT or any other) must follow these rules. **Humans: start every agent session with the prompt template in 6.4.**

### 6.1 The golden rule

**Do exactly the one task you were given. Nothing more, nothing less.** If something is unclear, missing, or seems wrong, stop and ask the human. Do not guess, and do not "improve" anything you were not asked to touch.

### 6.2 Always do

1. Read this whole README before writing any code.
2. Work on exactly **one task ID** (for example `S6` or `K8`) per session. That task's **Goal**, **Files** and **Done when** in [section 10](#10-task-board) are your complete scope.
3. Implement the API contract ([section 8](#8-api-contract-frozen)) and core logic ([section 9](#9-core-logic-specification)) **exactly**: same paths, methods, field names (camelCase), enum values, status codes, metric names, Redis keys and constants.
4. Stay inside the task owner's folders ([section 2](#2-team-and-ownership)) and the files listed in the task. Two things are always allowed:
   - Satvik's tasks may register routes in `platform/internal/httpapi/router.go` and wire dependencies in `platform/cmd/server/main.go`.
   - Krish's tasks may add routes in `App.tsx` and navigation links in `Layout.tsx` when the task adds a page.
5. Use only the approved dependencies ([section 3](#approved-dependencies)).
6. Keep everything runnable: existing builds and tests must still pass after your change.
7. Run the checks in [section 11](#11-definition-of-done) before saying the task is done.
8. Finish with the task report in 6.5.

### 6.3 Never do

1. **Never work on another task**, "next steps", or stretch goals, even if they look small or related.
2. **Never edit the other person's folders**, `README.md`, `.gitignore`, or any file not allowed by 6.2.
3. **Never change the contract**: API paths, fields, enum values, database schema, metric names, Redis keys, ports or environment variable names. If you think one is wrong, stop and report it.
4. **Never add dependencies**, frameworks, ORMs, state managers, UI kits or services that are not in the approved list.
5. **Never refactor, rename, move, reformat or "clean up"** code outside your task.
6. **Never delete or overwrite** files you did not create in this task.
7. **Never use paid services**, cloud accounts, external APIs or real secrets. Everything runs locally.
8. **Never leave fake work**: no `TODO` stubs, placeholder logic or hardcoded responses in place of required behaviour. Mock data belongs only in `dashboard/src/mocks/`.
9. **Never run destructive commands** without the human's explicit approval: `docker compose down -v`, `rm -rf`, `DROP TABLE`, `git reset --hard`, `git push --force`.
10. **Never commit, push, merge or open PRs** unless the human asks. Never commit to `main`.
11. **Never add features**, endpoints, fields, pages, settings or config options that are not in this README.

### 6.4 Prompt template (paste at the start of every agent session)

```text
You are an AI coding agent on the FlagGuard hackathon repository.
1. Read README.md completely before doing anything.
2. Your task is <TASK ID> "<task title>" (owner: <Satvik | Krish>).
   Your scope is ONLY that task's Goal, Files and "Done when" in README section 10.
3. Follow README section 6 (Rules for AI agents) strictly.
4. Implement the API contract (section 8) and core logic (section 9) exactly as written.
5. If anything is unclear, missing, or conflicts with the README, stop and ask me.
6. When finished, run the checks in section 11 and reply in the Task Report format (section 6.5).
Extra instructions from me (optional): <...>
```

### 6.5 Task report format

```text
Task: <ID> <title>
Status: done | blocked | partially done
Files created/changed:
  - path/to/file: what changed and why
How to test (commands and expected results):
  1. ...
Checks run: build ✅/❌  tests ✅/❌  lint ✅/❌
Assumptions made:
Not done / questions for the human:
```

### 6.6 When the task depends on unfinished work

If your task needs something the other person has not built yet, build against the contract in [section 8](#8-api-contract-frozen): Krish's agents use `dashboard/src/mocks/`, and Satvik's agents use `curl` and unit tests. Note it in the report. **Never build the other person's part yourself.**

---

## 7. Team rules: Git, commits, PRs

### Ownership and responsibility

- Commit only inside your own folders ([section 2](#2-team-and-ownership)). If you need a change in the other person's area, ask them or open an issue.
- **You are responsible for every line you commit, even if an AI wrote it.** Read it, run it, and be ready to explain it to the judges.

### One-time setup (on each laptop)

```bash
git config user.name  "Your Name"
git config user.email "the-email-of-your-github-account"
```

If this email does not match your GitHub account, your commits will not count on your profile or the contributors graph.

At hour 0, create one GitHub Issue per task (S0–S14, K0–K14), assign each to its owner, and add them to a GitHub Project board with the columns To do, In progress, Review and Done. **Track progress on the board, not by editing this README.**

### Branches

- `main` is protected: always runnable, no direct commits.
- One branch per task: `feat/S6-evaluator`, `feat/K3-rollout-ring`, `fix/K10-chart-threshold`.

### Commits

- Format: `type(scope): short summary (TaskID)`, for example:
  - `feat(evaluation): add reason codes (S6)`
  - `test(rollout): check bucket distribution (S5)`
  - `feat(dashboard): add rollout ring buttons (K3)`
- Types: `feat`, `fix`, `test`, `docs`, `chore`, `style`.
- Scopes for Satvik: `infra`, `db`, `api`, `flags`, `rollout`, `targeting`, `evaluation`, `cache`, `monitoring`, `guardian`, `audit`, `stream`, `loadgen`, `docs`.
- Scopes for Krish: `dashboard`, `quickcart-web`, `quickcart-server`, `docs`.
- Commit small and often: one logical step per commit (for example model → repository → handler → tests), at least every 30–60 minutes of work.
- No giant "final" commits. Never commit someone else's work. Never commit `.env`, `node_modules/`, build output or binaries.

### Pull requests

- One PR per task, titled like `[S6] Evaluator and evaluate endpoints`. In the description, paste the agent's task report and add `Closes #<issue number>`.
- The other person reviews every PR: it runs, it matches the contract, and it stays in scope. Aim to review within 30 minutes.
- Merge with **Create a merge commit** or **Rebase and merge**. **Never use Squash and merge**: it collapses all your commits into one and hides your work from the evaluators.

### Changing this README or the contract

- Only through a PR titled `[CONTRACT] ...` or `[README] ...`, approved by both Satvik and Krish.
- After merging, tell the other person what changed, and give your agents the updated file.

### Communication

- Tell the other person when you start and finish each task.
- If you are blocked for more than 20 minutes, say so.
- Meet at each checkpoint in [section 10](#10-task-board) for a 15-minute integration test together.
- **Code freeze 1 hour before submission:** only bug fixes after that, no new features.

---

## 8. API contract (frozen)

Both sides build against this section in parallel. Nothing here changes without a `[CONTRACT]` PR approved by both.

### 8.1 Conventions

- JSON only, `camelCase` field names, UTF-8.
- Timestamps are ISO 8601 UTC strings (`"2026-09-24T10:00:00Z"`), except chart points, which use unix seconds.
- **Percentages** are numbers from 0 to 100 (`25` means 25%). **Rates** are fractions from 0 to 1 (`0.03` means 3%).
- Admin endpoints (`/api/v1/*`) require `Authorization: Bearer <ADMIN_TOKEN>`. The one exception is `GET /api/v1/stream?token=<ADMIN_TOKEN>`, because the browser `EventSource` API cannot send headers.
- SDK endpoints (`/sdk/v1/*`) require `X-API-Key: <SDK_API_KEY>`.
- No authentication: `GET /healthz` and `GET /metrics`.
- Error format, used by both the platform and the QuickCart server:

```json
{ "error": { "code": "INVALID_TRANSITION", "message": "cannot advance a paused flag" } }
```

| HTTP status | `code` values |
|---|---|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 404 | `NOT_FOUND` |
| 409 | `ALREADY_EXISTS`, `INVALID_TRANSITION`, `VERSION_CONFLICT` |
| 422 | `VALIDATION_FAILED` |
| 500 | `INTERNAL` |

### 8.2 Objects

**Flag**

```json
{
  "key": "new_payment_flow",
  "name": "New payment flow",
  "description": "Payment v2 released as a canary",
  "enabled": true,
  "status": "rolling_out",
  "controlVariant": "old",
  "treatmentVariant": "new",
  "rolloutPercentage": 25,
  "rolloutSteps": [5, 10, 25, 50, 100],
  "conditions": [
    { "attribute": "country", "operator": "in", "values": ["India"] }
  ],
  "overrides": { "include": ["u_demo_canary"], "exclude": [] },
  "guardrail": {
    "enabled": true,
    "errorRateThreshold": 0.03,
    "minSamples": 20,
    "consecutiveBreaches": 2
  },
  "healthStatus": "HEALTHY",
  "version": 7,
  "createdAt": "2026-09-24T09:00:00Z",
  "updatedAt": "2026-09-24T10:00:00Z"
}
```

- `status`: `draft` | `rolling_out` | `paused` | `completed` | `rolled_back`
- `healthStatus`: `HEALTHY` | `WARNING` | `BREACHED` | `INSUFFICIENT_DATA` | `NOT_MONITORED`
- Condition `operator`: `eq` | `neq` | `in` | `not_in` | `gt` | `lt` | `exists`. `values` is always an array: `eq`, `neq`, `gt` and `lt` use `values[0]`, and `exists` uses `[]`.
- Known context attributes: `userId` (string), `country` (string), `plan` (`"free"` | `"premium"`), `betaUser` (boolean). Other string keys are allowed too.
- The flag's hashing `salt` is internal and never appears in API responses.

**Health**

```json
{
  "flagKey": "new_payment_flow",
  "status": "WARNING",
  "canaryErrorRate": 0.12,
  "baselineErrorRate": 0.01,
  "samples": 64,
  "breachCount": 1,
  "threshold": 0.03,
  "checkedAt": "2026-09-24T10:00:05Z"
}
```

Rates are `null` when there is no data. For `NOT_MONITORED`: rates and `checkedAt` are `null`, and `samples` and `breachCount` are `0`.

**Metrics** (chart data)

```json
{
  "flagKey": "new_payment_flow",
  "threshold": 0.03,
  "rangeSeconds": 300,
  "stepSeconds": 5,
  "series": {
    "canaryErrorRate":   [[1727172000, 0.012], [1727172005, 0.4]],
    "baselineErrorRate": [[1727172000, 0.01]],
    "rpsNew":            [[1727172000, 7.5]],
    "rpsOld":            [[1727172000, 22.1]]
  }
}
```

Each point is `[unixSeconds, value]`. Points without data are left out; values are never `NaN`.

**Event**

```json
{
  "id": 42,
  "flagKey": "new_payment_flow",
  "type": "step_changed",
  "fromPercentage": 10,
  "toPercentage": 25,
  "actor": "admin",
  "reason": null,
  "createdAt": "2026-09-24T10:00:00Z"
}
```

- `type`: `created` | `updated` | `conditions_changed` | `overrides_changed` | `guardrail_changed` | `started` | `step_changed` | `paused` | `resumed` | `completed` | `rolled_back` | `killed`
- `actor`: `admin` | `system:guardian`

**Incident**

```json
{
  "id": "5b0c3f2e-8c1a-4a57-9a0e-3f1c2d4e5f60",
  "flagKey": "new_payment_flow",
  "status": "open",
  "observedErrorRate": 0.41,
  "baselineErrorRate": 0.01,
  "threshold": 0.03,
  "exposedPercentage": 25,
  "exposedUsers": 312,
  "sampleSize": 88,
  "reason": "Canary error rate 41.0% exceeded threshold 3.0% for 2 consecutive checks",
  "firstBreachAt": "2026-09-24T10:02:10Z",
  "rolledBackAt": "2026-09-24T10:02:15Z",
  "resolvedAt": null
}
```

`status`: `open` | `resolved`. `exposedUsers` may be `null` until task S13 is done.

**EvaluationResult**

```json
{
  "flagKey": "new_payment_flow",
  "variant": "new",
  "reason": "IN_ROLLOUT",
  "bucket": 1834,
  "rolloutPercentage": 25,
  "flagVersion": 7
}
```

`bucket` is `-1` when it was not computed. The `reason` values are listed in [9.1](#91-evaluation-order-first-match-wins).

**ChaosConfig**

```json
{
  "active": true,
  "errorRate": 0.4,
  "latencyMs": 0,
  "latencyRate": 0,
  "durationSec": 120,
  "activeUntil": "2026-09-24T10:04:00Z"
}
```

When chaos is off: `"active": false` and `"activeUntil": null`.

### 8.3 Platform admin endpoints (`http://localhost:8080/api/v1`)

| Method and path | Request body | Success response |
|---|---|---|
| `GET /flags` | none | `{ "flags": [Flag] }` |
| `POST /flags` | `{ "key", "name", "description"? }` | `201` Flag (status `draft`, 0%, `enabled: false`) |
| `GET /flags/{key}` | none | Flag |
| `PATCH /flags/{key}` | `{ "name"?, "description"? }` | Flag |
| `PUT /flags/{key}/conditions` | `{ "conditions": [Condition] }` | Flag |
| `PUT /flags/{key}/overrides` | `{ "include": [userId], "exclude": [userId] }` | Flag |
| `PUT /flags/{key}/guardrail` | `{ "enabled", "errorRateThreshold", "minSamples", "consecutiveBreaches" }` | Flag |
| `POST /flags/{key}/rollout/start` | none | Flag |
| `POST /flags/{key}/rollout/advance` | none | Flag |
| `POST /flags/{key}/rollout/set` | `{ "percentage": 25 }` | Flag |
| `POST /flags/{key}/rollout/pause` | none | Flag |
| `POST /flags/{key}/rollout/resume` | none | Flag |
| `POST /flags/{key}/rollback` | `{ "reason": "..." }` | Flag |
| `POST /flags/{key}/kill` | none | Flag |
| `GET /flags/{key}/health` | none | Health |
| `GET /flags/{key}/metrics?range=5m\|15m\|30m` (default `5m`) | none | Metrics |
| `GET /flags/{key}/events?limit=50` (max 200) | none | `{ "events": [Event] }`, newest first |
| `GET /incidents?status=open\|resolved` (default: all) | none | `{ "incidents": [Incident] }`, newest first |
| `GET /incidents/{id}` | none | Incident |
| `POST /incidents/{id}/resolve` | none | Incident |
| `POST /playground/evaluate` | `{ "flagKey", "context" }` | EvaluationResult (no exposure tracking, not counted in metrics) |
| `GET /stream?token=...` | none | SSE stream ([8.5](#85-live-events-sse)) |

Validation:

- `key` must match `^[a-z0-9_]{3,64}$` and be unique (duplicate → `409 ALREADY_EXISTS`).
- `name`: 1–100 characters.
- `rollout/set` `percentage`: greater than 0 and at most 100.
- `errorRateThreshold`: greater than 0 and less than 1. `minSamples`: 1–10000. `consecutiveBreaches`: 1–10.
- Invalid values → `422 VALIDATION_FAILED`. Actions not allowed by [9.4](#94-rollout-state-transitions) → `409 INVALID_TRANSITION`.

### 8.4 SDK endpoint (`http://localhost:8080/sdk/v1`)

`POST /evaluate` with header `X-API-Key`:

```json
{
  "flagKey": "new_payment_flow",
  "context": { "userId": "u_aarav", "country": "India", "plan": "premium", "betaUser": true }
}
```

Returns an EvaluationResult. An unknown flag returns `200` with `"variant": "off"` and `"reason": "FLAG_NOT_FOUND"`.

### 8.5 Live events (SSE)

`GET /api/v1/stream?token=<ADMIN_TOKEN>` responds with `Content-Type: text/event-stream`:

```text
event: flag
data: {Flag JSON}

event: rollout
data: {Event JSON}

event: health
data: {Health JSON}

event: incident
data: {Incident JSON}
```

- `flag` and `rollout` are sent after every successful flag change, whether by an admin or the guardian.
- `health` is sent after every guardian check of a monitored flag.
- `incident` is sent when an incident opens and when it is resolved.
- A heartbeat comment line `: ping` is sent every 15 seconds.

### 8.6 QuickCart server (`http://localhost:4000`)

| Method and path | Request body | Success response |
|---|---|---|
| `GET /healthz` | none | `{ "status": "ok" }` |
| `GET /api/products` | none | `{ "products": [{ "id", "name", "price", "category" }] }` (at least 8 food items, prices in INR) |
| `GET /api/personas` | none | `{ "personas": [Persona] }` |
| `POST /api/pay` | PayRequest | PayResponse |
| `GET /internal/chaos` | none | ChaosConfig |
| `POST /internal/chaos` | `{ "errorRate", "latencyMs"?, "latencyRate"?, "durationSec"? }` | ChaosConfig |
| `DELETE /internal/chaos` | none | ChaosConfig (inactive) |
| `GET /metrics` | none | Prometheus text format |

Chaos input limits: `errorRate` and `latencyRate` 0–1, `latencyMs` 0–5000 (default 0), `durationSec` 10–600 (default 120). Invalid input → `400` in the standard error format.

**Persona** shape: `{ "userId", "name", "country", "plan", "betaUser" }`. `GET /api/personas` returns exactly these:

| userId | name | country | plan | betaUser |
|---|---|---|---|---|
| `u_demo_canary` | Demo Canary | India | premium | true |
| `u_aarav` | Aarav | India | premium | true |
| `u_diya` | Diya | India | free | true |
| `u_rohan` | Rohan | India | free | false |
| `u_emma` | Emma | US | premium | false |
| `u_liam` | Liam | US | free | true |
| `u_olivia` | Olivia | UK | premium | true |
| `u_noah` | Noah | UK | free | false |

**PayRequest**

```json
{
  "user": { "userId": "u_aarav", "country": "India", "plan": "premium", "betaUser": true },
  "items": [{ "productId": "p1", "qty": 2 }],
  "amount": 298
}
```

A missing `user.userId`, empty `items` or `amount <= 0` → `400 BAD_REQUEST` in the standard error format.

**PayResponse**, success (`200`):

```json
{
  "orderId": "ord_8f3k2",
  "status": "confirmed",
  "flow": "new",
  "evaluation": { "variant": "new", "reason": "IN_ROLLOUT" },
  "durationMs": 84
}
```

**PayResponse**, payment failure (`500`):

```json
{
  "status": "failed",
  "flow": "new",
  "error": { "code": "GATEWAY_TIMEOUT", "message": "Simulated payment failure" },
  "evaluation": { "variant": "new", "reason": "IN_ROLLOUT" },
  "durationMs": 1203
}
```

`flow` is always `"old"` or `"new"`. `evaluation.reason` can also be `PLATFORM_UNAVAILABLE` (see [9.6](#96-quickcart-server-behaviour)).

### 8.7 Prometheus metrics (exact names; the guardian depends on them)

QuickCart server exposes:

| Metric | Type | Labels |
|---|---|---|
| `quickcart_payment_requests_total` | counter | `flow` = `old`\|`new`, `outcome` = `success`\|`error` |
| `quickcart_payment_duration_seconds` | histogram, buckets `0.05, 0.1, 0.25, 0.5, 1, 2, 5` | `flow` = `old`\|`new` |

All four `flow` × `outcome` combinations are initialised to 0 at startup. **Never add user-level labels** such as `userId` or `country`.

Platform exposes:

| Metric | Type | Labels |
|---|---|---|
| `ff_evaluations_total` | counter | `flag`, `variant`, `reason` |
| `ff_rollbacks_total` | counter | `flag` |

PromQL used by the guardian and the charts (30-second window). These are stored as the default guardrail queries when a flag is created:

```promql
# canary error rate
sum(rate(quickcart_payment_requests_total{flow="new",outcome="error"}[30s]))
  / sum(rate(quickcart_payment_requests_total{flow="new"}[30s]))

# baseline error rate
sum(rate(quickcart_payment_requests_total{flow="old",outcome="error"}[30s]))
  / sum(rate(quickcart_payment_requests_total{flow="old"}[30s]))

# canary samples in the window
sum(increase(quickcart_payment_requests_total{flow="new"}[30s]))

# requests per second, per flow
sum(rate(quickcart_payment_requests_total{flow="new"}[30s]))
sum(rate(quickcart_payment_requests_total{flow="old"}[30s]))
```

---

## 9. Core logic specification

### 9.1 Evaluation order (first match wins)

| # | Check | Variant served | `reason` |
|---|---|---|---|
| 1 | Flag does not exist | `off` | `FLAG_NOT_FOUND` |
| 2 | `status` is `draft` | control | `NOT_STARTED` |
| 3 | `enabled` is `false` | control | `KILL_SWITCH` |
| 4 | `status` is `rolled_back` | control | `ROLLED_BACK` |
| 5 | `userId` is in the exclude list | control | `OVERRIDE_EXCLUDE` |
| 6 | `userId` is in the include list | treatment | `OVERRIDE_INCLUDE` |
| 7 | Any condition does not match | control | `NOT_ELIGIBLE` |
| 8 | Context has no `userId` | control | `NO_BUCKET_KEY` |
| 9 | `bucket < round(rolloutPercentage × 100)` | treatment | `IN_ROLLOUT` |
| 10 | Otherwise | control | `OUTSIDE_ROLLOUT` |

- Client-only reason: the QuickCart server uses `PLATFORM_UNAVAILABLE` when it cannot reach the platform, and serves control.
- `paused` and `completed` flags evaluate normally at their current percentage.
- **Safety rule: when in doubt, serve control (the stable version).**

### 9.2 Percentage bucketing

```go
// Bucket returns a number in [0, 9999]: 0.01% granularity.
func Bucket(flagKey, salt, userID string) int {
    sum := sha256.Sum256([]byte(flagKey + ":" + salt + ":" + userID))
    return int(binary.BigEndian.Uint32(sum[:4]) % 10000)
}

func InRollout(bucket int, pct float64) bool {
    return bucket < int(math.Round(pct*100))
}
```

Required properties, tested in S5:

- **Deterministic:** the same user always gets the same bucket.
- **Monotonic:** a user who is in at 10% is still in at 25%.
- **Independent per flag:** each flag has its own random `salt`.
- **Even:** 100,000 random user IDs at 25% land between 24.5% and 25.5%.

### 9.3 Targeting operators

- `eq` / `neq`: compare with `values[0]`. Strings compare case-insensitively, booleans accept `true` or `"true"`, numbers compare as float64.
- `in` / `not_in`: the value is (or is not) in `values`, using the same comparison rules.
- `gt` / `lt`: numeric comparison with `values[0]`. Non-numeric values never match.
- `exists`: the attribute is present in the context.
- **A missing attribute never matches**, for every operator except `exists`. This includes `not_in` (fail closed).
- All conditions are combined with AND. No conditions means everyone is eligible.

### 9.4 Rollout state transitions

| Action | Allowed from | Result |
|---|---|---|
| `start` | `draft`, `rolled_back` | `enabled=true`, `status=rolling_out`, percentage = first step, exposure counter reset |
| `advance` | `rolling_out` | percentage = next step above the current one; reaching 100 → `completed` |
| `set` | `rolling_out`, `paused` | percentage = given value (status unchanged); 100 → `completed` |
| `pause` | `rolling_out` | `paused` (percentage frozen, still monitored) |
| `resume` | `paused` | `rolling_out` |
| `rollback` | `rolling_out`, `paused`, `completed` | `status=rolled_back`, percentage = 0 |
| `kill` | any | `enabled=false`, `status=rolled_back`, percentage = 0 |

Event types: `start` → `started`; `advance` and `set` → `step_changed` (or `completed` when reaching 100); `pause` → `paused`; `resume` → `resumed`; `rollback` → `rolled_back`; `kill` → `killed`.

Every successful flag change (including conditions, overrides and guardrail edits) happens in this order:

1. One PostgreSQL transaction: update the flag with `version = version + 1`, insert a `rollout_events` row, insert an `audit_logs` row.
2. Update the in-memory evaluation snapshot.
3. Redis `SET ff:flag:{key}` and `PUBLISH ff:updates`.
4. Send SSE `flag` and `rollout` events.

### 9.5 Guardian (automatic rollback)

Every 5 seconds, for each flag whose `status` is `rolling_out` or `paused` and whose guardrail is `enabled`:

1. Query the canary sample count. If it is below `minSamples`: health is `INSUFFICIENT_DATA`, the breach count stays unchanged, and this flag is done for this tick.
2. Query the canary error rate. If Prometheus fails or the result is empty or `NaN`, skip this tick. **Never roll back on missing data.**
3. If the rate is above `errorRateThreshold`, increase `breachCount` (record `firstBreachAt` on the first breach). Otherwise reset `breachCount` to 0.
4. If `breachCount >= consecutiveBreaches`, roll back:
   - In one transaction with an optimistic version check (`WHERE key = $1 AND version = $2`): set `rollout_percentage = 0`, `status = 'rolled_back'`, `version = version + 1`; insert a `rolled_back` event with actor `system:guardian` and the reason text; insert the incident; insert an audit row. On a version conflict, reload the flag and re-check on the next tick.
   - Then update the snapshot, Redis and SSE (`flag`, `rollout`, `incident`), and increment `ff_rollbacks_total`.
5. Health status: `BREACHED` when rolling back, `WARNING` when `0 < breachCount < consecutiveBreaches`, otherwise `HEALTHY`. Write it to Redis `ff:health:{key}` (TTL 60 s) and send an SSE `health` event.
6. After a rollback, the guardian stops monitoring that flag. **It never re-rolls out on its own**; a human must press start.

`GET /flags/{key}/health` returns `NOT_MONITORED` when no health record exists in Redis.

Incident reason text: `Canary error rate {rate}% exceeded threshold {threshold}% for {n} consecutive checks`, with percentages shown to one decimal place.

### 9.6 QuickCart server behaviour

- `POST /api/pay`: validate the request → evaluate `new_payment_flow` through `flagClient.js` → if `variant === "new"` run `payment/v2.js`, otherwise run `payment/legacy.js` → record metrics → respond.
- **flagClient:** 50 ms timeout; caches each user's result for 1 second; on any error or timeout returns `{ "variant": "old", "reason": "PLATFORM_UNAVAILABLE" }`. The shop must keep working when the platform is down.
- **Legacy payment:** waits a random 50–150 ms and fails 1% of the time with `GATEWAY_ERROR`. This is the realistic baseline.
- **v2 payment:** waits a random 30–100 ms, then applies chaos: adds `latencyMs` of delay with probability `latencyRate`, and fails with `GATEWAY_TIMEOUT` with probability `errorRate`. With chaos off, v2 never fails.
- Chaos config lives in memory, applies **only** to v2, and switches off automatically after `durationSec`.

### 9.7 Load generator

- Command: `go run . -target http://localhost:4000 -rps 30 -users 5000 -duration 10m -seed 42`
- Users `u00001` to `u05000` are generated deterministically from the seed: country India 60%, US 25%, UK 15%; plan premium 30%; `betaUser` 20%.
- Fetches products from `GET /api/products` at startup. Each request uses a random user and 1–3 random products, and calls `POST /api/pay`.
- Prints a summary every 5 seconds: sent, succeeded, failed, and counts per `flow`.
- **Traffic math:** detection needs at least 20 canary requests per 30-second window, so at 5% exposure you need at least 14 requests per second in total. Use 30 for the demo.

### 9.8 Constants

| Name | Value |
|---|---|
| Prometheus scrape interval | 5 s |
| PromQL window | 30 s |
| Guardian tick | 5 s |
| Health record TTL in Redis | 60 s |
| Default threshold / minSamples / consecutiveBreaches | 0.03 / 20 / 2 |
| Default rollout steps | 5, 10, 25, 50, 100 |
| flagClient timeout / cache | 50 ms / 1 s |
| Redis reconciler interval | 30 s |
| SSE heartbeat | 15 s |
| Dashboard polling (fallback) | 5 s |
| Prometheus HTTP client timeout | 2 s |

### 9.9 Redis keys and snapshot (platform only)

| Key | Type | Content |
|---|---|---|
| `ff:flag:{key}` | string | Full compiled flag JSON, including `salt`, conditions and overrides |
| `ff:flags` | set | All flag keys |
| `ff:updates` | pub/sub channel | `{"key":"new_payment_flow","version":7}` after each change |
| `ff:health:{key}` | hash, TTL 60 s | Health fields |
| `ff:exposure:{key}` | HyperLogLog | userIds served the treatment since the last `start` |

- Evaluation never queries PostgreSQL or Redis per request. It reads an in-memory snapshot (`atomic.Pointer`). The only exception is the fire-and-forget exposure `PFADD` (S13), which must never block the response.
- At startup, load the snapshot from Redis, falling back to PostgreSQL.
- A subscriber reloads a flag when `ff:updates` fires. A reconciler reloads everything from PostgreSQL every 30 seconds.
- If Redis is down, keep serving the last snapshot and log a warning.

### 9.10 Database schema (`infra/migrations/0001_init.sql`)

<details>
<summary>Full SQL (click to expand)</summary>

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE flags (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                TEXT UNIQUE NOT NULL CHECK (key ~ '^[a-z0-9_]{3,64}$'),
  name               TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  enabled            BOOLEAN NOT NULL DEFAULT false,
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','rolling_out','paused','completed','rolled_back')),
  control_variant    TEXT NOT NULL DEFAULT 'old',
  treatment_variant  TEXT NOT NULL DEFAULT 'new',
  bucket_by          TEXT NOT NULL DEFAULT 'userId',
  salt               TEXT NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  rollout_percentage NUMERIC(5,2) NOT NULL DEFAULT 0
                     CHECK (rollout_percentage BETWEEN 0 AND 100),
  rollout_steps      NUMERIC(5,2)[] NOT NULL DEFAULT '{5,10,25,50,100}',
  version            INT NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE targeting_conditions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id       UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  sort_order    INT NOT NULL DEFAULT 0,
  attribute     TEXT NOT NULL,
  operator      TEXT NOT NULL CHECK (operator IN ('eq','neq','in','not_in','gt','lt','exists')),
  match_values  JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE flag_overrides (
  flag_id  UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('include','exclude')),
  PRIMARY KEY (flag_id, user_id)
);

CREATE TABLE guardrails (
  flag_id               UUID PRIMARY KEY REFERENCES flags(id) ON DELETE CASCADE,
  enabled               BOOLEAN NOT NULL DEFAULT true,
  error_rate_threshold  NUMERIC(6,4) NOT NULL DEFAULT 0.03,
  min_samples           INT NOT NULL DEFAULT 20,
  consecutive_breaches  INT NOT NULL DEFAULT 2,
  canary_error_query    TEXT NOT NULL,
  baseline_error_query  TEXT NOT NULL,
  canary_samples_query  TEXT NOT NULL
);

CREATE TABLE rollout_events (
  id               BIGSERIAL PRIMARY KEY,
  flag_id          UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  from_percentage  NUMERIC(5,2),
  to_percentage    NUMERIC(5,2),
  actor            TEXT NOT NULL,
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rollout_events_flag_time ON rollout_events (flag_id, created_at DESC);

CREATE TABLE incidents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id              UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  observed_error_rate  NUMERIC(6,4) NOT NULL,
  baseline_error_rate  NUMERIC(6,4),
  threshold            NUMERIC(6,4) NOT NULL,
  exposed_percentage   NUMERIC(5,2) NOT NULL,
  exposed_users        INT,
  sample_size          INT NOT NULL,
  reason               TEXT NOT NULL,
  first_breach_at      TIMESTAMPTZ NOT NULL,
  rolled_back_at       TIMESTAMPTZ NOT NULL,
  resolved_at          TIMESTAMPTZ
);
CREATE INDEX idx_incidents_flag_time ON incidents (flag_id, rolled_back_at DESC);

CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  actor         TEXT NOT NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  before_state  JSONB,
  after_state   JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

</details>

When a flag is created, its `guardrails` row gets the defaults above and the three PromQL queries from [8.7](#87-prometheus-metrics-exact-names-the-guardian-depends-on-them).

---

## 10. Task board

- Satvik has **S0–S14** and Krish has **K0–K14**: 15 tasks each, of similar size.
- Every task gets one GitHub Issue, one branch and one PR (see [section 7](#7-team-rules-git-commits-prs)).
- Hours assume a 24-hour hackathon. If yours is longer, keep the same order and give Phases 3 and 4 more time.
- Each task has a **Goal**, the **Files** it may create or change, and a **Done when** test. An agent's scope is exactly these three things.

### Phase 0: setup (hour 0–1)

**Both, first:** read this README together, create the GitHub Issues and Project board, and run the `git config` setup ([section 7](#7-team-rules-git-commits-prs)).

#### S0: Repository and infrastructure (Satvik)
- **Goal:** create the repo skeleton and the local infrastructure.
- **Files:** `.gitignore`, `.env.example`, `docker-compose.yml`, `infra/prometheus/prometheus.yml`, empty folders from [section 4](#4-repository-structure) (with `.gitkeep`).
- **Details:** compose runs `postgres:16-alpine` (user, password and database all `flagguard`; mounts `./infra/migrations` to `/docker-entrypoint-initdb.d`), `redis:7-alpine`, and Prometheus pinned to a specific version tag (not `latest`), scraping every 5 s with the targets and `extra_hosts` setting from [section 5](#5-local-environment).
- **Done when:** `docker compose up -d` starts all three containers and the Prometheus UI opens at http://localhost:9090.

#### K0: App scaffolds (Krish)
- **Goal:** create the three JavaScript apps.
- **Files:** `dashboard/` (Vite React TS, Tailwind, React Router, TanStack Query), `quickcart/web/` (Vite React TS, Tailwind, React Router, dev port 5174), `quickcart/server/` (Express with ES modules, `cors`, `GET /healthz`, `npm run dev` using `node --watch`).
- **Done when:** all three start with `npm run dev`, and `npm run build` passes for both web apps.

### Phase 1: foundations (hours 1–7)

#### S1: Database schema (Satvik)
- **Goal:** create every table from [9.10](#910-database-schema-inframigrations0001_initsql) exactly.
- **Files:** `infra/migrations/0001_init.sql`
- **Done when:** after a database reset, `psql` lists all 7 tables.

#### S2: Platform skeleton (Satvik)
- **Goal:** a runnable Go server: config from environment with the [section 5](#5-local-environment) defaults, pgx connection pool, chi router, CORS, admin bearer-token auth, SDK key auth, the contract error format, `GET /healthz`, `GET /metrics`, graceful shutdown.
- **Files:** `platform/go.mod`, `platform/cmd/server/main.go`, `platform/internal/config/config.go`, `platform/internal/db/postgres.go`, `platform/internal/httpapi/router.go`, `platform/internal/httpapi/middleware.go`, `platform/internal/httpapi/errors.go`
- **Done when:** `curl localhost:8080/healthz` returns `{"status":"ok"}`, and `curl localhost:8080/api/v1/flags` without a token returns `401` in the contract error format.

#### S3: Flags CRUD (Satvik)
- **Goal:** `GET /flags`, `POST /flags`, `GET /flags/{key}` and `PATCH /flags/{key}` per [8.3](#83-platform-admin-endpoints-httplocalhost8080apiv1), with validation. Creating a flag also creates its guardrail row (defaults plus the PromQL from [8.7](#87-prometheus-metrics-exact-names-the-guardian-depends-on-them)), a `created` event and an audit row. Until S11 is done, `healthStatus` is always `NOT_MONITORED`.
- **Files:** `platform/internal/models/flag.go`, `platform/internal/flags/repository.go`, `platform/internal/flags/service.go`, `platform/internal/httpapi/handlers_flags.go`, `platform/internal/audit/events.go`, `platform/internal/audit/auditlog.go`
- **Done when:** create, list, get and patch work in Postman with the exact Flag shape; a duplicate key returns `409`; an invalid key returns `422`.

#### S4: Rollout transitions (Satvik)
- **Goal:** `start`, `advance`, `set`, `pause`, `resume`, `rollback` and `kill` per [9.4](#94-rollout-state-transitions), plus `GET /flags/{key}/events`.
- **Files:** `platform/internal/rollout/transitions.go`, `platform/internal/rollout/transitions_test.go`, `platform/internal/models/event.go`, `platform/internal/httpapi/handlers_rollout.go`, changes in `platform/internal/flags/service.go` and `repository.go`
- **Done when:** unit tests cover every allowed and every forbidden transition; each action bumps `version` and writes exactly one event and one audit row; the events endpoint lists newest first.

#### K1: API layer and mocks (Krish)
- **Goal:** a typed client for every endpoint in [8.3](#83-platform-admin-endpoints-httplocalhost8080apiv1). Types match [8.2](#82-objects) exactly. The client sends the bearer token from env, parses the contract error format, and returns fixture data when `VITE_USE_MOCKS=true`.
- **Files:** `dashboard/src/api/client.ts`, `dashboard/src/api/types.ts`, `dashboard/src/api/flags.ts`, `dashboard/src/api/incidents.ts`, `dashboard/src/mocks/fixtures.ts`
- **Done when:** `npm run build` passes, and switching `VITE_USE_MOCKS` requires no code changes.

#### K2: Layout and flags list (Krish)
- **Goal:** sidebar layout (Flags, Incidents, Playground), routing, and a flags table with key, name, status badge, rollout %, health status (as text for now) and last updated. Clicking a row opens the flag page.
- **Files:** `dashboard/src/App.tsx`, `dashboard/src/components/Layout.tsx`, `dashboard/src/components/StatusBadge.tsx`, `dashboard/src/pages/FlagsList.tsx`, `dashboard/src/hooks/useFlags.ts`
- **Done when:** the list works with mocks and shows loading, empty and error states.

#### K3: Create flag, flag page and rollout controls (Krish)
- **Goal:** a create-flag form (key, name, description, using the key rule from [8.3](#83-platform-admin-endpoints-httplocalhost8080apiv1)); a flag page showing its configuration; and `RolloutRing` showing the current % with step buttons 5/10/25/50/100 (`rollout/set`), Start, Advance, Pause/Resume, Rollback (asks for a reason) and Kill (confirmation dialog). Buttons are disabled when [9.4](#94-rollout-state-transitions) does not allow the action.
- **Files:** `dashboard/src/pages/CreateFlag.tsx`, `dashboard/src/pages/FlagDetail.tsx`, `dashboard/src/components/RolloutRing.tsx`, `dashboard/src/hooks/useFlag.ts`
- **Done when:** every button calls the right endpoint, the page updates after each action, and API errors are shown as messages.

#### K4: QuickCart products and cart (Krish)
- **Goal:** `GET /api/products` (at least 8 food items, INR prices) and `GET /api/personas` (the 8 personas from [8.6](#86-quickcart-server-httplocalhost4000)); a product grid; a cart in React context (add, remove, change quantity, total).
- **Files:** `quickcart/server/src/index.js`, `quickcart/server/src/config.js`, `quickcart/server/src/data/products.js`, `quickcart/server/src/data/personas.js`, `quickcart/server/src/routes/products.js`, `quickcart/server/src/routes/personas.js`, `quickcart/web/src/App.tsx`, `quickcart/web/src/api.ts`, `quickcart/web/src/cart.tsx`, `quickcart/web/src/pages/Products.tsx`, `quickcart/web/src/pages/Cart.tsx`
- **Done when:** products load from the server and cart totals stay correct across page navigation.

> **Checkpoint A (about hour 7, together, 15 minutes):** with mocks off, the dashboard creates `new_payment_flow`, moves it 5 → 10 → 25, pauses, resumes and rolls back, and every step appears in the events list.

### Phase 2: evaluation and the demo app (hours 7–13)

#### S5: Targeting and bucketing (Satvik)
- **Goal:** operators per [9.3](#93-targeting-operators) and bucketing per [9.2](#92-percentage-bucketing).
- **Files:** `platform/internal/targeting/match.go`, `platform/internal/targeting/match_test.go`, `platform/internal/rollout/bucket.go`, `platform/internal/rollout/bucket_test.go`
- **Done when:** table-driven tests pass for every operator (including missing attributes and mixed types) and for all four bucketing properties.

#### S6: Evaluator and evaluate endpoints (Satvik)
- **Goal:** evaluation order per [9.1](#91-evaluation-order-first-match-wins); `POST /sdk/v1/evaluate` and `POST /api/v1/playground/evaluate`; an in-memory snapshot loaded from PostgreSQL at startup and updated after every flag write; the `ff_evaluations_total` metric.
- **Files:** `platform/internal/evaluation/evaluator.go`, `platform/internal/evaluation/evaluator_test.go`, `platform/internal/evaluation/reasons.go`, `platform/internal/evaluation/snapshot.go`, `platform/internal/httpapi/handlers_eval.go`, changes in `platform/internal/flags/service.go`
- **Done when:** there is a test for every reason code, and right after a `rollout/set` call the very next evaluation uses the new percentage.

#### S7: Conditions, overrides and guardrail endpoints (Satvik)
- **Goal:** `PUT /conditions`, `PUT /overrides` and `PUT /guardrail` per [8.3](#83-platform-admin-endpoints-httplocalhost8080apiv1), with validation. Each writes an event and an audit row and bumps `version`.
- **Files:** `platform/internal/httpapi/handlers_targeting.go`, changes in `platform/internal/flags/repository.go` and `service.go`
- **Done when:** `GET /flags/{key}` reflects the changes, an unknown operator returns `422`, and evaluation results change accordingly.

#### S8: Redis sync (Satvik)
- **Goal:** everything in [9.9](#99-redis-keys-and-snapshot-platform-only): write-through after each commit, pub/sub refresh, startup load, 30-second reconciler, surviving a Redis outage.
- **Files:** `platform/internal/cache/redis.go`, `platform/internal/cache/pubsub.go`, `platform/internal/cache/reconciler.go`
- **Done when:** `redis-cli GET ff:flag:new_payment_flow` shows the latest version after each change, and stopping the Redis container does not break `/sdk/v1/evaluate`.

#### K5: QuickCart payments and metrics (Krish)
- **Goal:** `POST /api/pay` per [8.6](#86-quickcart-server-httplocalhost4000) (always the old flow until K6); both payment modules per [9.6](#96-quickcart-server-behaviour); metrics exactly per [8.7](#87-prometheus-metrics-exact-names-the-guardian-depends-on-them), initialised to 0; `GET /metrics`.
- **Files:** `quickcart/server/src/routes/pay.js`, `quickcart/server/src/payment/legacy.js`, `quickcart/server/src/payment/v2.js`, `quickcart/server/src/metrics.js`
- **Done when:** payments via `curl` succeed; `/metrics` shows all four `flow` × `outcome` series; Prometheus at :9090 finds `quickcart_payment_requests_total`.

#### K6: Flag client and chaos (Krish)
- **Goal:** the flag client per [9.6](#96-quickcart-server-behaviour) (50 ms timeout, 1 s cache, fallback to old); `/api/pay` picks the flow from the evaluation; the chaos endpoints per [8.6](#86-quickcart-server-httplocalhost4000), applied only to v2 and auto-expiring; CORS allows the dashboard origin.
- **Files:** `quickcart/server/src/flagClient.js`, `quickcart/server/src/chaos.js`, `quickcart/server/src/routes/chaos.js`, changes in `quickcart/server/src/routes/pay.js`
- **Done when:** with the platform stopped, payments still succeed through the old flow; with chaos `errorRate: 0.5`, about half of new-flow payments return `500` and the metrics show `outcome="error"`.

#### K7: QuickCart checkout (Krish)
- **Goal:** a persona switcher in the header (from `/api/personas`); checkout calls `POST /api/pay` as the selected persona; the confirmation page shows the order id and a `PaymentBadge` reading "Classic payment" (old) or "New payment · canary" (new); a failure screen shows the error and the flow.
- **Files:** `quickcart/web/src/pages/Checkout.tsx`, `quickcart/web/src/pages/Confirmation.tsx`, `quickcart/web/src/components/PersonaSwitcher.tsx`, `quickcart/web/src/components/PaymentBadge.tsx`
- **Done when:** at 25% rollout with `u_demo_canary` in the include list, switching personas shows both flows.

#### K8: Targeting editors and playground (Krish)
- **Goal:** `ConditionsEditor` (rows of attribute, operator dropdown with the [8.2](#82-objects) operators, and values: comma-separated for `in`/`not_in`, true/false for booleans), saved with `PUT /conditions`; `OverridesEditor` (include and exclude userId lists); a Playground page (pick a flag, fill in context fields, see variant, reason and bucket).
- **Files:** `dashboard/src/components/ConditionsEditor.tsx`, `dashboard/src/components/OverridesEditor.tsx`, `dashboard/src/pages/Playground.tsx`, changes in `dashboard/src/pages/FlagDetail.tsx`
- **Done when:** after saving `country in [India]`, a US user shows `NOT_ELIGIBLE` in the Playground.

> **Checkpoint B (about hour 13):** setting 25% in the dashboard makes QuickCart serve both flows across personas, and Prometheus shows both `flow="old"` and `flow="new"` series.

### Phase 3: monitoring and rollback (hours 13–19)

#### S9: Load generator (Satvik)
- **Goal:** everything in [9.7](#97-load-generator).
- **Files:** `loadgen/go.mod`, `loadgen/main.go`, `loadgen/users.go`
- **Done when:** `go run . -rps 30` holds about 30 requests per second for 10 minutes and prints a summary every 5 seconds.

#### S10: Prometheus client and chart data (Satvik)
- **Goal:** `Scalar(query)` and `Range(query, range, step)` helpers (2 s timeout; empty or `NaN` results mean "no value"), and `GET /flags/{key}/metrics` returning the four series from [8.2](#82-objects).
- **Files:** `platform/internal/monitoring/prometheus.go`, `platform/internal/httpapi/handlers_metrics.go`
- **Done when:** with the load generator running, the endpoint returns non-empty series for 5m, 15m and 30m.

#### S11: Guardian, rollback and incidents (Satvik)
- **Goal:** the guardian per [9.5](#95-guardian-automatic-rollback); `GET /flags/{key}/health`; Flag `healthStatus` read from Redis; the incident endpoints from [8.3](#83-platform-admin-endpoints-httplocalhost8080apiv1); the `ff_rollbacks_total` metric.
- **Files:** `platform/internal/guardian/guardian.go`, `platform/internal/guardian/health.go`, `platform/internal/guardian/rollback.go`, `platform/internal/audit/incidents.go`, `platform/internal/models/incident.go`, `platform/internal/models/health.go`, `platform/internal/httpapi/handlers_incidents.go`
- **Done when:** load generator at 30 req/s + 25% rollout + chaos `errorRate: 0.4` → rollback within 30 seconds, an incident is created, and evaluations return `ROLLED_BACK`. With chaos off, no rollback happens during 10 minutes.

#### S12: Live event stream (Satvik)
- **Goal:** `GET /api/v1/stream` per [8.5](#85-live-events-sse), supporting several clients at once, with heartbeat; events published from every flag write and every guardian check.
- **Files:** `platform/internal/stream/sse.go`, changes in `platform/internal/flags/service.go` and `platform/internal/guardian/*.go` to publish events
- **Done when:** `curl -N "localhost:8080/api/v1/stream?token=dev-admin-token"` prints events live while you click around in the dashboard.

#### K9: Guardrail form and health badge (Krish)
- **Goal:** `GuardrailForm` (enabled toggle; threshold entered as a percentage and sent as a fraction; min samples; consecutive breaches), saved with `PUT /guardrail`; `HealthBadge` coloured by status, with the rates in a tooltip; polls `/health` every 5 seconds.
- **Files:** `dashboard/src/components/GuardrailForm.tsx`, `dashboard/src/components/HealthBadge.tsx`, changes in `dashboard/src/pages/FlagDetail.tsx` and `dashboard/src/pages/FlagsList.tsx`
- **Done when:** saving the form updates the flag, and the badge changes colour as health changes.

#### K10: Charts (Krish)
- **Goal:** Recharts line charts from `/metrics`: canary vs baseline error rate (shown as %) with a dashed threshold line, and requests per second for new vs old; range selector 5m/15m/30m; refresh every 5 seconds.
- **Files:** `dashboard/src/components/ErrorRateChart.tsx`, `dashboard/src/components/TrafficChart.tsx`, `dashboard/src/hooks/useMetrics.ts`, changes in `dashboard/src/pages/FlagDetail.tsx`
- **Done when:** with the load generator and chaos running, the canary line visibly crosses the threshold line.

#### K11: Live updates and timeline (Krish)
- **Goal:** one `EventSource` connection (token in the query string, automatic reconnect) that updates the TanStack Query cache on `flag`, `health` and `incident` events; `EventTimeline` listing events newest first with type, % change, actor and reason, with guardian actions highlighted.
- **Files:** `dashboard/src/hooks/useEventStream.ts`, `dashboard/src/components/EventTimeline.tsx`, changes in `dashboard/src/pages/FlagDetail.tsx` and `dashboard/src/App.tsx`
- **Done when:** two browser tabs stay in sync without refreshing.

#### K12: Incidents and chaos panel (Krish)
- **Goal:** `IncidentCard` (observed vs threshold, baseline, exposed %, protected % = 100 − exposed %, exposed users, time to rollback = `rolledBackAt − firstBreachAt`, resolve button); a red `IncidentBanner` on the flag page while an incident is open; `ChaosPanel` (error-rate slider, latency, duration, Start/Stop) calling QuickCart's `/internal/chaos` and showing the active state with a countdown.
- **Files:** `dashboard/src/pages/Incidents.tsx`, `dashboard/src/components/IncidentCard.tsx`, `dashboard/src/components/IncidentBanner.tsx`, `dashboard/src/components/ChaosPanel.tsx`, `dashboard/src/api/chaos.ts`, changes in `dashboard/src/pages/FlagDetail.tsx`
- **Done when:** the whole demo in [section 14](#14-demo-script) can be run from the dashboard alone.

> **Checkpoint C (about hour 19):** run the full demo story end to end, twice.

### Phase 4: hardening, polish and demo (hours 19–24)

#### S13: Exposure tracking and hardening (Satvik)
- **Goal:** fire-and-forget `PFADD ff:exposure:{key}` whenever the SDK endpoint serves the treatment; reset the counter on `start`; store `PFCOUNT` in `incident.exposedUsers`; handle Prometheus down, `NaN` results, version conflicts and Redis down without crashing; add the platform `Dockerfile`.
- **Files:** `platform/internal/evaluation/evaluator.go`, `platform/internal/evaluation/snapshot.go`, `platform/internal/guardian/rollback.go`, `platform/internal/flags/service.go`, `platform/Dockerfile`
- **Done when:** incidents show `exposedUsers`, and stopping Prometheus never crashes the platform or triggers a rollback.

#### S14: Seed script and architecture doc (Satvik)
- **Goal:** `seed.sh` creates `new_payment_flow` through the API with `curl` (no conditions, default guardrail, `u_demo_canary` in the include list); `architecture.md` explains the components, data flows and design decisions (why Redis, why hashing, why fail-to-control, why polling Prometheus).
- **Files:** `scripts/seed.sh`, `docs/architecture.md`
- **Done when:** fresh clone → `docker compose up -d` → start all apps → `./scripts/seed.sh` → ready to demo.

#### K13: UI polish and Dockerfiles (Krish)
- **Goal:** consistent colours, loading/error/empty states everywhere, toasts after actions, confirmation dialogs for destructive actions, responsive layout. **Styling and UX only; no new features.**
- **Files:** existing files under `dashboard/src/` and `quickcart/web/src/`, `dashboard/Dockerfile`, `quickcart/web/Dockerfile`, `quickcart/server/Dockerfile`
- **Done when:** no browser console errors, and `npm run build` and `npm run lint` pass for both web apps.

#### K14: Demo script and presentation (Krish)
- **Goal:** a step-by-step demo script with timings and exact clicks (based on [section 14](#14-demo-script)), screenshots and a short GIF, and slides for the pitch.
- **Files:** `docs/demo-script.md`, `docs/images/*`
- **Done when:** someone new can run the whole demo using only the script.

**Both, last 2 hours:** rehearse the demo 3 times. Code freeze 1 hour before submission.

---

## 11. Definition of done

A task is done only when all of these are true:

1. Everything in the task's **Done when** works.
2. The checks pass:
   - Satvik, in `platform/` and `loadgen/`: `gofmt -l .` prints nothing, and `go vet ./...`, `go build ./...` and `go test ./...` pass.
   - Krish, in `dashboard/` and `quickcart/web/`: `npm run build` and `npm run lint` pass. In `quickcart/server/`: `npm run dev` starts without errors and `curl localhost:4000/healthz` works.
3. The contract and the agent rules ([section 6](#6-rules-for-ai-agents)) were respected.
4. No secrets and no debug leftovers (spammy `console.log`, commented-out code, stray files).
5. The PR was reviewed by the other person, merged **without squashing**, and its issue is closed.

## 12. Coding conventions

### Go (`platform/`, `loadgen/`)

- Format with `gofmt`. One responsibility per package, as laid out in [section 4](#4-repository-structure).
- Handlers only parse, validate and call services. SQL lives only in repositories. Business rules live in services and in `rollout`, `targeting` and `evaluation`.
- Pass `context.Context` as the first parameter of any I/O function. Wrap errors with `fmt.Errorf("doing x: %w", err)`. Never `panic` while handling a request.
- Log with `log/slog` in JSON format; no `fmt.Println` logging.
- JSON struct tags are camelCase and match [section 8](#8-api-contract-frozen).
- Tests are table-driven and use only the standard `testing` package.

### TypeScript and React (`dashboard/`, `quickcart/web/`)

- Function components and hooks; one component per file; PascalCase file names.
- All HTTP calls go through `src/api/` (dashboard) or `src/api.ts` (QuickCart web). Components never call `fetch` directly.
- Types come from `src/api/types.ts` and match [8.2](#82-objects) exactly. Avoid `any`.
- Server data uses TanStack Query (dashboard); local UI state uses `useState` or context. No Redux or Zustand.
- Style with Tailwind classes only. No other UI or CSS libraries.
- Read config from `import.meta.env`, with the [section 5](#5-local-environment) defaults.

### Node (`quickcart/server/`)

- ES modules and Express. Config from environment, with the [section 5](#5-local-environment) defaults.
- All platform calls go through `flagClient.js`, all metrics through `metrics.js`, and all chaos logic through `chaos.js`.
- No database: data lives in `src/data/`.

## 13. Stretch goals and out of scope

**Stretch goals.** Build these only after Checkpoint C passes, only if both agree, and only after adding them to this README as new tasks:

- Automatic promotion to the next step after N healthy minutes
- A latency (p95) guardrail
- A "previous step" rollback mode instead of rolling back to 0%
- A Discord or Slack webhook when a rollback happens
- A Grafana dashboard
- Multi-variant flags (A/B/C)

**Out of scope. Never build these:** real payment gateways, user signup/login or roles, multiple organisations or environments, Kubernetes or cloud deployment, ORMs, splitting the platform into microservices, GraphQL, WebSockets (we use SSE), mobile apps, or anything that needs a paid service.

## 14. Demo script

**Setup:** `docker compose up -d` → start the platform, dashboard, QuickCart server and QuickCart web → `./scripts/seed.sh` → `cd loadgen && go run . -rps 30`.

1. Dashboard: `new_payment_flow` is at 0%. The charts show about 1% baseline errors on the old flow.
2. Click **Start** (5%), then **10%**, then **25%**. The timeline records each step.
3. QuickCart: pay as `u_demo_canary` → "New payment · canary". Pay as other personas → some get "Classic payment".
4. Chaos panel: set the error rate to 40% and click **Start**.
5. The canary line crosses the 3% threshold. Health turns `WARNING`, then `BREACHED`.
6. Within about 30 seconds, the guardian rolls the flag back to 0% and the red incident banner appears.
7. QuickCart: `u_demo_canary` gets "Classic payment" again.
8. Open the incident: only 25% of traffic was exposed, 75% was fully protected, and the rollback was automatic.
9. Stop chaos, resolve the incident, and click **Start** again. The same first 5% of users get the new flow, because bucketing is deterministic.

**One-line pitch:** a bad release reaches only a small, controlled slice of users, and the platform detects it and rolls it back automatically before everyone else is affected.