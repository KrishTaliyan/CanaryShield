import type {
  ChaosConfig,
  Condition,
  Event,
  EventType,
  Flag,
  Guardrail,
  Incident,
  Overrides,
} from "../api/types";

export class MockApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MockApiError";
  }
}

const now = "2026-09-24T10:00:00Z";
const flags: Flag[] = [
  {
    key: "new_payment_flow",
    name: "New payment flow",
    description: "Payment v2 released as a canary",
    enabled: true,
    status: "rolling_out",
    controlVariant: "old",
    treatmentVariant: "new",
    rolloutPercentage: 25,
    rolloutSteps: [5, 10, 25, 50, 100],
    conditions: [],
    overrides: { include: ["u_demo_canary"], exclude: [] },
    guardrail: {
      enabled: true,
      errorRateThreshold: 0.03,
      minSamples: 20,
      consecutiveBreaches: 2,
    },
    healthStatus: "WARNING",
    version: 7,
    createdAt: "2026-09-24T09:00:00Z",
    updatedAt: now,
  },
];

const events: Event[] = [
  {
    id: 42,
    flagKey: "new_payment_flow",
    type: "step_changed",
    fromPercentage: 10,
    toPercentage: 25,
    actor: "admin",
    reason: null,
    createdAt: now,
  },
  {
    id: 41,
    flagKey: "new_payment_flow",
    type: "step_changed",
    fromPercentage: 5,
    toPercentage: 10,
    actor: "admin",
    reason: null,
    createdAt: "2026-09-24T09:30:00Z",
  },
  {
    id: 40,
    flagKey: "new_payment_flow",
    type: "started",
    fromPercentage: 0,
    toPercentage: 5,
    actor: "admin",
    reason: null,
    createdAt: "2026-09-24T09:15:00Z",
  },
];

const incidents: Incident[] = [
  {
    id: "5b0c3f2e-8c1a-4a57-9a0e-3f1c2d4e5f60",
    flagKey: "new_payment_flow",
    status: "open",
    observedErrorRate: 0.41,
    baselineErrorRate: 0.01,
    threshold: 0.03,
    exposedPercentage: 25,
    exposedUsers: 312,
    sampleSize: 88,
    reason: "Canary error rate 41.0% exceeded threshold 3.0% for 2 consecutive checks",
    firstBreachAt: "2026-09-24T10:02:10Z",
    rolledBackAt: "2026-09-24T10:02:15Z",
    resolvedAt: null,
  },
];

const healthByFlag = new Map<string, {
  flagKey: string;
  status: Flag["healthStatus"];
  canaryErrorRate: number | null;
  baselineErrorRate: number | null;
  samples: number;
  breachCount: number;
  threshold: number;
  checkedAt: string | null;
}>([["new_payment_flow", {
  flagKey: "new_payment_flow",
  status: "WARNING",
  canaryErrorRate: 0.12,
  baselineErrorRate: 0.01,
  samples: 64,
  breachCount: 1,
  threshold: 0.03,
  checkedAt: "2026-09-24T10:00:05Z",
}]]);

let nextEventId = 43;

let chaos: ChaosConfig = inactiveChaos();

function inactiveChaos(): ChaosConfig {
  return { active: false, errorRate: 0, latencyMs: 0, latencyRate: 0, durationSec: 120, activeUntil: null };
}

// mockMetricSeries returns points ending now, so charts look live in mock mode.
function mockMetricSeries(rangeSeconds: number, stepSeconds: number, base: number, wobble: number) {
  const end = Math.floor(Date.now() / 1000 / stepSeconds) * stepSeconds;
  const points: Array<[number, number]> = [];
  for (let t = end - rangeSeconds; t <= end; t += stepSeconds) {
    points.push([t, Math.max(0, base + wobble * Math.sin(t / 37))]);
  }
  return points;
}

function fail(message: string, code: string, status: number): never {
  throw new MockApiError(message, code, status);
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function readBody(options: RequestInit): Record<string, unknown> {
  if (typeof options.body !== "string" || options.body.length === 0) return {};
  try {
    return JSON.parse(options.body) as Record<string, unknown>;
  } catch {
    fail("Request body must be valid JSON", "BAD_REQUEST", 400);
  }
}

function timestamp() {
  return new Date().toISOString();
}

function appendEvent(
  flag: Flag,
  type: EventType,
  fromPercentage: number | null,
  toPercentage: number | null,
  reason: string | null = null,
) {
  events.unshift({
    id: nextEventId++,
    flagKey: flag.key,
    type,
    fromPercentage,
    toPercentage,
    actor: "admin",
    reason,
    createdAt: timestamp(),
  });
}

function findFlag(key: string) {
  const flag = flags.find((item) => item.key === key);
  if (!flag) fail(`flag ${key} not found`, "NOT_FOUND", 404);
  return flag;
}

function updateFlag(flag: Flag, type: EventType, update: () => void, reason: string | null = null) {
  const before = flag.rolloutPercentage;
  update();
  flag.version += 1;
  flag.updatedAt = timestamp();
  appendEvent(flag, type, before, flag.rolloutPercentage, reason);
  return flag;
}

function validKey(key: string) {
  return /^[a-z0-9_]{3,64}$/.test(key);
}

function makeFlag(input: Record<string, unknown>): Flag {
  const key = String(input.key || "");
  const name = String(input.name || "");
  if (!validKey(key)) fail("key must match ^[a-z0-9_]{3,64}$", "VALIDATION_FAILED", 422);
  if (flags.some((flag) => flag.key === key)) fail("flag key already exists", "ALREADY_EXISTS", 409);
  if (name.length < 1 || name.length > 100) fail("name must be 1-100 characters", "VALIDATION_FAILED", 422);

  const flag: Flag = {
    key,
    name,
    description: String(input.description || ""),
    enabled: false,
    status: "draft",
    controlVariant: "old",
    treatmentVariant: "new",
    rolloutPercentage: 0,
    rolloutSteps: [5, 10, 25, 50, 100],
    conditions: [],
    overrides: { include: [], exclude: [] },
    guardrail: {
      enabled: true,
      errorRateThreshold: 0.03,
      minSamples: 20,
      consecutiveBreaches: 2,
    },
    healthStatus: "NOT_MONITORED",
    version: 1,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
  flags.push(flag);
  events.unshift({
    id: nextEventId++,
    flagKey: key,
    type: "created",
    fromPercentage: null,
    toPercentage: 0,
    actor: "admin",
    reason: null,
    createdAt: flag.createdAt,
  });
  return flag;
}

function normalizedNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function valuesEqual(actual: unknown, expected: unknown) {
  if (typeof actual === "boolean") {
    if (typeof expected === "boolean") return actual === expected;
    if (typeof expected === "string" && /^(true|false)$/i.test(expected)) {
      return actual === (expected.toLowerCase() === "true");
    }
    return false;
  }
  if (typeof actual === "number") {
    const expectedNumber = normalizedNumber(expected);
    return expectedNumber !== null && actual === expectedNumber;
  }
  if (typeof actual === "string") {
    return actual.toLowerCase() === String(expected).toLowerCase();
  }
  return actual === expected;
}

function conditionMatches(condition: Condition, context: Record<string, unknown>) {
  const exists = Object.prototype.hasOwnProperty.call(context, condition.attribute);
  if (condition.operator === "exists") return exists;
  if (!exists) return false;

  const actual = context[condition.attribute];
  const expected = condition.values[0];
  switch (condition.operator) {
    case "eq": return valuesEqual(actual, expected);
    case "neq": return !valuesEqual(actual, expected);
    case "in": return condition.values.some((value) => valuesEqual(actual, value));
    case "not_in": return !condition.values.some((value) => valuesEqual(actual, value));
    case "gt": {
      const left = normalizedNumber(actual);
      const right = normalizedNumber(expected);
      return left !== null && right !== null && left > right;
    }
    case "lt": {
      const left = normalizedNumber(actual);
      const right = normalizedNumber(expected);
      return left !== null && right !== null && left < right;
    }
    default: return false;
  }
}

function runRolloutAction(flag: Flag, action: string, body: Record<string, unknown>) {
  const before = flag.rolloutPercentage;

  switch (action) {
    case "start":
      if (flag.status !== "draft" && flag.status !== "rolled_back") {
        fail("cannot start a flag in its current state", "INVALID_TRANSITION", 409);
      }
      flag.enabled = true;
      flag.status = "rolling_out";
      flag.rolloutPercentage = flag.rolloutSteps[0] ?? 5;
      appendEvent(flag, "started", before, flag.rolloutPercentage);
      break;
    case "advance": {
      if (flag.status !== "rolling_out") fail("cannot advance a flag in its current state", "INVALID_TRANSITION", 409);
      const next = flag.rolloutSteps.find((step) => step > flag.rolloutPercentage);
      if (next === undefined) fail("there is no next rollout step", "INVALID_TRANSITION", 409);
      flag.rolloutPercentage = next;
      flag.status = next === 100 ? "completed" : "rolling_out";
      appendEvent(flag, next === 100 ? "completed" : "step_changed", before, next);
      break;
    }
    case "set": {
      if (flag.status !== "rolling_out" && flag.status !== "paused") {
        fail("cannot set rollout percentage in the current state", "INVALID_TRANSITION", 409);
      }
      const percentage = Number(body.percentage);
      if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
        fail("percentage must be greater than 0 and at most 100", "VALIDATION_FAILED", 422);
      }
      flag.rolloutPercentage = percentage;
      if (percentage === 100) flag.status = "completed";
      appendEvent(flag, percentage === 100 ? "completed" : "step_changed", before, percentage);
      break;
    }
    case "pause":
      if (flag.status !== "rolling_out") fail("cannot pause a flag in its current state", "INVALID_TRANSITION", 409);
      flag.status = "paused";
      appendEvent(flag, "paused", before, before);
      break;
    case "resume":
      if (flag.status !== "paused") fail("cannot resume a flag in its current state", "INVALID_TRANSITION", 409);
      flag.status = "rolling_out";
      appendEvent(flag, "resumed", before, before);
      break;
    case "rollback":
      if (!["rolling_out", "paused", "completed"].includes(flag.status)) {
        fail("cannot roll back a flag in its current state", "INVALID_TRANSITION", 409);
      }
      flag.status = "rolled_back";
      flag.rolloutPercentage = 0;
      appendEvent(flag, "rolled_back", before, 0, String(body.reason || ""));
      break;
    case "kill":
      flag.enabled = false;
      flag.status = "rolled_back";
      flag.rolloutPercentage = 0;
      appendEvent(flag, "killed", before, 0);
      break;
    default:
      fail("route not found", "NOT_FOUND", 404);
  }

  flag.version += 1;
  flag.updatedAt = timestamp();
  return flag;
}

function evaluate(flagKey: string, context: Record<string, unknown>) {
  const flag = flags.find((item) => item.key === flagKey);
  if (!flag) {
    return {
      flagKey,
      variant: "off" as const,
      reason: "FLAG_NOT_FOUND" as const,
      bucket: -1,
      rolloutPercentage: 0,
      flagVersion: 0,
    };
  }
  const control = { variant: flag.controlVariant as "old", bucket: -1 };
  const userId = typeof context.userId === "string" ? context.userId : "";
  let reason: "NOT_STARTED" | "KILL_SWITCH" | "ROLLED_BACK" | "OVERRIDE_EXCLUDE" | "OVERRIDE_INCLUDE" | "NOT_ELIGIBLE" | "NO_BUCKET_KEY" | "IN_ROLLOUT" | "OUTSIDE_ROLLOUT";
  let variant: "old" | "new" = control.variant;
  let bucket = -1;

  if (flag.status === "draft") reason = "NOT_STARTED";
  else if (!flag.enabled) reason = "KILL_SWITCH";
  else if (flag.status === "rolled_back") reason = "ROLLED_BACK";
  else if (flag.overrides.exclude.includes(userId)) reason = "OVERRIDE_EXCLUDE";
  else if (flag.overrides.include.includes(userId)) {
    reason = "OVERRIDE_INCLUDE";
    variant = "new";
  } else if (!flag.conditions.every((condition) => conditionMatches(condition, context))) reason = "NOT_ELIGIBLE";
  else if (!userId) reason = "NO_BUCKET_KEY";
  else {
    bucket = [...`${flag.key}:${userId}`].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 10000, 0);
    const cutoff = Math.round(flag.rolloutPercentage * 100);
    if (bucket < cutoff) {
      reason = "IN_ROLLOUT";
      variant = "new";
    } else reason = "OUTSIDE_ROLLOUT";
  }

  return { flagKey, variant, reason, bucket, rolloutPercentage: flag.rolloutPercentage, flagVersion: flag.version };
}

export async function mockApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const [pathname, queryString = ""] = path.split("?", 2);
  const body = readBody(options);
  let result: unknown;

  if (pathname === "/flags" && method === "GET") {
    result = { flags };
  } else if (pathname === "/flags" && method === "POST") {
    result = makeFlag(body);
  } else if (pathname === "/incidents" && method === "GET") {
    const status = new URLSearchParams(queryString).get("status");
    result = { incidents: status ? incidents.filter((incident) => incident.status === status) : incidents };
  } else if (pathname === "/playground/evaluate" && method === "POST") {
    result = evaluate(String(body.flagKey || ""), (body.context || {}) as Record<string, unknown>);
  } else {
    const incidentMatch = pathname.match(/^\/incidents\/([^/]+)(?:\/(resolve))?$/);
    if (incidentMatch) {
      const incident = incidents.find((item) => item.id === decodeURIComponent(incidentMatch[1]));
      if (!incident) fail("incident not found", "NOT_FOUND", 404);
      if (incidentMatch[2] === "resolve" && method === "POST") {
        incident.status = "resolved";
        incident.resolvedAt = timestamp();
      } else if (method !== "GET" || incidentMatch[2]) {
        fail("route not found", "NOT_FOUND", 404);
      }
      result = incident;
    } else {
      const flagMatch = pathname.match(/^\/flags\/([^/]+)(?:\/(.*))?$/);
      if (!flagMatch) fail("route not found", "NOT_FOUND", 404);
      const key = decodeURIComponent(flagMatch[1]);
      const suffix = flagMatch[2] || "";
      const flag = findFlag(key);

      if (!suffix && method === "GET") result = flag;
      else if (!suffix && method === "PATCH") {
        if (body.name !== undefined && (String(body.name).length < 1 || String(body.name).length > 100)) {
          fail("name must be 1-100 characters", "VALIDATION_FAILED", 422);
        }
        result = updateFlag(flag, "updated", () => {
          if (body.name !== undefined) flag.name = String(body.name);
          if (body.description !== undefined) flag.description = String(body.description);
        });
      } else if (suffix === "conditions" && method === "PUT") {
        const conditions = body.conditions;
        if (!Array.isArray(conditions)) fail("conditions must be an array", "VALIDATION_FAILED", 422);
        result = updateFlag(flag, "conditions_changed", () => {
          flag.conditions = conditions as Condition[];
        });
      } else if (suffix === "overrides" && method === "PUT") {
        result = updateFlag(flag, "overrides_changed", () => {
          flag.overrides = {
            include: Array.isArray(body.include) ? body.include.map(String) : [],
            exclude: Array.isArray(body.exclude) ? body.exclude.map(String) : [],
          } satisfies Overrides;
        });
      } else if (suffix === "guardrail" && method === "PUT") {
        const threshold = Number(body.errorRateThreshold);
        const minSamples = Number(body.minSamples);
        const consecutiveBreaches = Number(body.consecutiveBreaches);
        if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1 || !Number.isInteger(minSamples) || minSamples < 1 || minSamples > 10000 || !Number.isInteger(consecutiveBreaches) || consecutiveBreaches < 1 || consecutiveBreaches > 10) {
          fail("guardrail values are invalid", "VALIDATION_FAILED", 422);
        }
        result = updateFlag(flag, "guardrail_changed", () => {
          flag.guardrail = {
            enabled: Boolean(body.enabled),
            errorRateThreshold: threshold,
            minSamples,
            consecutiveBreaches,
          } satisfies Guardrail;
        });
      } else if (suffix === "health" && method === "GET") {
        result = healthByFlag.get(key) || {
          flagKey: key,
          status: "NOT_MONITORED",
          canaryErrorRate: null,
          baselineErrorRate: null,
          samples: 0,
          breachCount: 0,
          threshold: flag.guardrail.errorRateThreshold,
          checkedAt: null,
        };
      } else if (suffix === "metrics" && method === "GET") {
        const range = new URLSearchParams(queryString).get("range") || "5m";
        const rangeSeconds = range === "15m" ? 900 : range === "30m" ? 1800 : 300;
        const stepSeconds = rangeSeconds / 60;
        const share = flag.rolloutPercentage / 100;
        result = {
          flagKey: key,
          threshold: flag.guardrail.errorRateThreshold,
          rangeSeconds,
          stepSeconds,
          series: {
            canaryErrorRate: share > 0 ? mockMetricSeries(rangeSeconds, stepSeconds, 0.008, 0.006) : [],
            baselineErrorRate: mockMetricSeries(rangeSeconds, stepSeconds, 0.01, 0.003),
            rpsNew: share > 0 ? mockMetricSeries(rangeSeconds, stepSeconds, 30 * share, 0.6) : [],
            rpsOld: mockMetricSeries(rangeSeconds, stepSeconds, 30 * (1 - share), 0.8),
          },
        };
      } else if (suffix === "events" && method === "GET") {
        const requestedLimit = Number(new URLSearchParams(queryString).get("limit") || 50);
        const limit = Math.max(1, Math.min(200, Number.isFinite(requestedLimit) ? requestedLimit : 50));
        result = { events: events.filter((event) => event.flagKey === key).slice(0, limit) };
      } else if (suffix.startsWith("rollout/") && method === "POST") {
        result = runRolloutAction(flag, suffix.slice("rollout/".length), body);
      } else if (suffix === "rollback" && method === "POST") {
        result = runRolloutAction(flag, "rollback", body);
      } else if (suffix === "kill" && method === "POST") {
        result = runRolloutAction(flag, "kill", body);
      } else {
        fail("route not found", "NOT_FOUND", 404);
      }
    }
  }

  return copy(result) as T;
}

export async function mockChaosRequest(options: RequestInit = {}): Promise<ChaosConfig> {
  const method = (options.method || "GET").toUpperCase();
  if (chaos.activeUntil && Date.parse(chaos.activeUntil) <= Date.now()) chaos = inactiveChaos();

  if (method === "POST") {
    const body = readBody(options);
    const errorRate = Number(body.errorRate);
    const latencyMs = Number(body.latencyMs ?? 0);
    const latencyRate = Number(body.latencyRate ?? 0);
    const durationSec = Number(body.durationSec ?? 120);
    if (
      !Number.isFinite(errorRate) || errorRate < 0 || errorRate > 1
      || !Number.isInteger(latencyMs) || latencyMs < 0 || latencyMs > 5000
      || !Number.isFinite(latencyRate) || latencyRate < 0 || latencyRate > 1
      || !Number.isInteger(durationSec) || durationSec < 10 || durationSec > 600
    ) {
      fail("Chaos values are outside the allowed range.", "BAD_REQUEST", 400);
    }
    chaos = {
      active: true,
      errorRate,
      latencyMs,
      latencyRate,
      durationSec,
      activeUntil: new Date(Date.now() + durationSec * 1000).toISOString(),
    };
  } else if (method === "DELETE") {
    chaos = inactiveChaos();
  }
  return copy(chaos);
}
