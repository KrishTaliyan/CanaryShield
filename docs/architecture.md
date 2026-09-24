# FlagGuard architecture

FlagGuard releases a new feature to a small, controlled slice of users, watches
that slice's health in Prometheus, and rolls the feature back automatically when
its error rate crosses a threshold. This document explains how the pieces fit
together and why they are built the way they are. The API contract and exact
rules live in the README (sections 8 and 9); this document does not repeat them.

## Components

```text
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

| Component | Role |
|---|---|
| Platform API (`platform/`) | Owns flags, rollout state, targeting and evaluation. Runs the guardian and the live event stream. |
| PostgreSQL | Source of truth: flags, conditions, overrides, guardrails, rollout events, incidents, audit log. |
| Redis | Compiled flag cache, change notifications (pub/sub), guardian health records and exposure counters. |
| Prometheus | Scrapes QuickCart's payment metrics every 5 s; the guardian and the charts query it. |
| QuickCart server | The demo shop. Asks the platform which payment flow each user gets and exports metrics per flow. |
| Dashboard | Operator UI: rollout controls, targeting, health, charts, incidents, chaos panel. |
| Load generator (`loadgen/`) | Simulated shoppers so there is enough canary traffic to judge. |

### Platform packages

| Package | Responsibility |
|---|---|
| `httpapi` | Routing, auth, the contract error format. Handlers only parse, validate and call services. |
| `flags` | Flag use cases. Every change runs in one transaction, then updates the snapshot, Redis and SSE. |
| `rollout` | The rollout state machine and percentage bucketing. Pure functions. |
| `targeting` | Condition operators. Pure functions. |
| `evaluation` | The in-memory snapshot and the evaluation order. Never touches PostgreSQL or Redis per request. |
| `cache` | Every Redis key: write-through, pub/sub subscriber, startup load, reconciler, health, exposure. |
| `monitoring` | Prometheus HTTP client and chart series. |
| `guardian` | The 5-second health loop, automatic rollback and incidents. |
| `audit` | SQL for rollout events, incidents and the audit log. |
| `stream` | Server-Sent Events hub. |

## Data flows

### A flag change

Every change (an admin action or a guardian rollback) follows the same four
steps, in this order:

1. **PostgreSQL transaction.** Lock the flag row, apply the change, bump
   `version`, insert exactly one rollout event and one audit row. Commit.
2. **Snapshot.** Swap the updated flag into this process's in-memory snapshot,
   so the very next evaluation uses it.
3. **Redis.** `SET ff:flag:{key}`, `SADD ff:flags`, `PUBLISH ff:updates` in one
   `MULTI/EXEC`. Other platform instances reload the flag when they receive the
   message.
4. **SSE.** Broadcast `flag` and `rollout` events to every connected dashboard.

If Redis is down, steps 1, 2 and 4 still happen; the write-through failure is
logged and the reconciler repairs Redis later.

### An evaluation

`POST /sdk/v1/evaluate` reads only the in-memory snapshot, which is an
`atomic.Pointer` to an immutable map: reads never take a lock and never do I/O.
The only side effect is exposure tracking: when the treatment is served, the
user ID is put on a buffered queue that a background goroutine flushes to the
`ff:exposure:{key}` HyperLogLog every 500 ms. If the queue is full the exposure
is dropped; the response is never slowed down.

The snapshot is filled at startup from Redis (falling back to PostgreSQL), kept
fresh by local writes and `ff:updates`, and fully reloaded from PostgreSQL by a
reconciler every 30 seconds. The snapshot keeps the newer version of a flag, so
a slow reload can never undo a fresher write.

### The guardian loop

Every 5 seconds, for each flag that is rolling out or paused with its guardrail
enabled:

1. Query the canary sample count. Below `minSamples`, report
   `INSUFFICIENT_DATA` and stop.
2. Query the canary error rate. If Prometheus fails or returns nothing or `NaN`,
   skip this tick.
3. Count consecutive checks above the threshold.
4. At `consecutiveBreaches`, roll back: one transaction with a version check
   sets the flag to `rolled_back` at 0% and inserts the incident, the event and
   the audit row. Then the usual snapshot, Redis and SSE steps run, plus an
   `incident` event.
5. Store the health record in Redis (`ff:health:{key}`, 60 s TTL) and broadcast
   a `health` event.

After a rollback the flag is no longer `rolling_out`, so the guardian stops
watching it. It never rolls a flag out again on its own; a human must press
Start.

### Live updates

The dashboard opens one `EventSource` to `GET /api/v1/stream?token=...`. The hub
keeps a small buffer per client; a client that falls too far behind is
disconnected rather than allowed to slow everyone down, and `EventSource`
reconnects automatically. A `: ping` comment every 15 seconds keeps idle
connections open.

## Design decisions

### Why PostgreSQL is the source of truth and Redis is only a cache

Flag changes must never be lost and must be auditable, so they live in
PostgreSQL with the event and audit rows written in the same transaction.
Redis holds nothing that cannot be rebuilt: compiled flags are rewritten by the
reconciler, health records expire after 60 seconds, and exposure counts are
approximate by design.

### Why Redis at all

Evaluation sits on the payment path, so it must be fast and must not depend on
the database. Each platform instance evaluates from memory, and Redis gives
instances a cheap way to hear about changes (`ff:updates`) and to start quickly
from a compiled copy of every flag. If Redis goes down, instances keep serving
their last snapshot and the reconciler keeps it in sync with PostgreSQL.

### Why deterministic hashing for rollout

A user's bucket is `sha256(flagKey:salt:userId) mod 10000`. This gives:

- **Stickiness without storage.** The same user always gets the same answer,
  with no per-user state to store or look up.
- **Monotonic rollouts.** A user inside 10% is still inside at 25%, so raising
  the percentage only adds users; nobody flips back and forth.
- **Independent flags.** Each flag has its own random salt, so the same unlucky
  users are not in every canary.
- **Fine granularity.** 10,000 buckets give 0.01% steps and an even split
  (100,000 users at 25% land within 24.5–25.5%).

It also makes the demo's last step work: after a rollback and a new Start, the
same first 5% of users get the new flow again.

### Why fail to control

Every uncertain case serves the control (stable) variant: an unknown flag, a
draft, a killed or rolled-back flag, a user who fails targeting or has no user
ID, and, in QuickCart, a platform that does not answer within 50 ms. A missing
attribute never matches a condition, even `not_in`. The cost of wrongly serving
the old flow is a delayed feature; the cost of wrongly serving the new flow is
an outage for users who were never meant to see it.

The guardian applies the same rule in reverse: it never rolls back on missing
data. Prometheus being down, an empty result or a `NaN` skips the tick instead
of triggering a rollback.

### Why the guardian polls Prometheus

- **Decoupled.** QuickCart only exports standard counters; it needs no
  knowledge of flags or guardrails, so any app in any language can be guarded.
- **Rates over windows.** A 30-second `rate()` window smooths single failures,
  and requiring two consecutive breaches filters out one-off spikes. Together
  with a minimum sample count, this avoids rolling back on noise.
- **Bounded detection time.** A 5-second scrape plus a 5-second tick means a
  real problem is caught and rolled back in roughly 15–30 seconds.
- **Simple and testable.** One loop, three PromQL queries per flag, no alert
  pipeline to configure.

Pushing alerts from Alertmanager would react slightly faster but adds a
component, a webhook and a second source of truth for thresholds.

### Why optimistic version checks for the guardian

An admin can change a flag while the guardian is deciding to roll it back. The
guardian's rollback only succeeds if the flag is still at the version it
checked (`WHERE key = $1 AND version = $2`). On a conflict it reloads the flag
and re-checks on the next tick, so it never undoes a newer human decision based
on stale data.

### Why Server-Sent Events

Updates only flow from the server to the dashboard, which is exactly what SSE
does, over plain HTTP, with automatic reconnection built into the browser.
WebSockets would add a protocol and a library for no benefit.

## Failure modes

| Failure | What happens |
|---|---|
| Redis down | Evaluation continues from memory. Admin changes still commit; write-through is logged and skipped. Flag health reads as `NOT_MONITORED` until Redis returns. The reconciler repairs Redis within 30 s of recovery. |
| Prometheus down | The guardian skips ticks and never rolls back. Chart requests return `500 INTERNAL`. |
| Platform down | QuickCart's flag client times out after 50 ms and serves the old flow (`PLATFORM_UNAVAILABLE`); the shop keeps working. |
| Concurrent admin change and rollback | The version check rejects the stale rollback; the guardian re-checks on the next tick. |
| Slow dashboard client | It is disconnected and reconnects; other clients are unaffected. |

## Key constants

Scrape interval 5 s, PromQL window 30 s, guardian tick 5 s, health TTL 60 s,
default guardrail 3% / 20 samples / 2 consecutive breaches, default steps
5 → 10 → 25 → 50 → 100%, flag client timeout 50 ms with a 1 s cache,
reconciler 30 s, SSE heartbeat 15 s, Prometheus client timeout 2 s.
