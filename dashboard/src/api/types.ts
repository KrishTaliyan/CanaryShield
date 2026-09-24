declare global {
  interface ImportMetaEnv {
    readonly VITE_PLATFORM_URL?: string;
    readonly VITE_ADMIN_TOKEN?: string;
    readonly VITE_QUICKCART_URL?: string;
    readonly VITE_QUICKCART_WEB_URL?: string;
    readonly VITE_USE_MOCKS?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export type FlagStatus = "draft" | "rolling_out" | "paused" | "completed" | "rolled_back";
export type HealthStatus = "HEALTHY" | "WARNING" | "BREACHED" | "INSUFFICIENT_DATA" | "NOT_MONITORED";
export type ConditionOperator = "eq" | "neq" | "in" | "not_in" | "gt" | "lt" | "exists";
export type EventType =
  | "created"
  | "updated"
  | "conditions_changed"
  | "overrides_changed"
  | "guardrail_changed"
  | "started"
  | "step_changed"
  | "paused"
  | "resumed"
  | "completed"
  | "rolled_back"
  | "killed";

export interface Condition {
  attribute: string;
  operator: ConditionOperator;
  values: Array<string | number | boolean>;
}

export interface Overrides {
  include: string[];
  exclude: string[];
}

export interface Guardrail {
  enabled: boolean;
  errorRateThreshold: number;
  minSamples: number;
  consecutiveBreaches: number;
}

export interface Flag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  status: FlagStatus;
  controlVariant: string;
  treatmentVariant: string;
  rolloutPercentage: number;
  rolloutSteps: number[];
  conditions: Condition[];
  overrides: Overrides;
  guardrail: Guardrail;
  healthStatus: HealthStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Health {
  flagKey: string;
  status: HealthStatus;
  canaryErrorRate: number | null;
  baselineErrorRate: number | null;
  samples: number;
  breachCount: number;
  threshold: number;
  checkedAt: string | null;
}

export type MetricPoint = [unixSeconds: number, value: number];

export type MetricsRange = "5m" | "15m" | "30m" | "1h" | "6h" | "24h";

export interface Metrics {
  flagKey: string;
  threshold: number;
  rangeSeconds: number;
  stepSeconds: number;
  series: {
    canaryErrorRate: MetricPoint[];
    baselineErrorRate: MetricPoint[];
    rpsNew: MetricPoint[];
    rpsOld: MetricPoint[];
    /** p95 payment latency in seconds; absent on platforms older than this dashboard. */
    latencyP95New?: MetricPoint[];
    latencyP95Old?: MetricPoint[];
  };
}

export interface Event {
  id: number;
  flagKey: string;
  type: EventType;
  fromPercentage: number | null;
  toPercentage: number | null;
  actor: "admin" | "system:guardian";
  reason: string | null;
  createdAt: string;
}

export interface Incident {
  id: string;
  flagKey: string;
  status: "open" | "resolved";
  observedErrorRate: number;
  baselineErrorRate: number | null;
  threshold: number;
  exposedPercentage: number;
  exposedUsers: number | null;
  sampleSize: number;
  reason: string;
  firstBreachAt: string;
  rolledBackAt: string;
  resolvedAt: string | null;
}

export type EvaluationReason =
  | "FLAG_NOT_FOUND"
  | "NOT_STARTED"
  | "KILL_SWITCH"
  | "ROLLED_BACK"
  | "OVERRIDE_EXCLUDE"
  | "OVERRIDE_INCLUDE"
  | "NOT_ELIGIBLE"
  | "NO_BUCKET_KEY"
  | "IN_ROLLOUT"
  | "OUTSIDE_ROLLOUT"
  | "PLATFORM_UNAVAILABLE";

export interface EvaluationResult {
  flagKey: string;
  variant: "off" | "old" | "new";
  reason: EvaluationReason;
  bucket: number;
  rolloutPercentage: number;
  flagVersion: number;
}

export interface ChaosConfig {
  active: boolean;
  errorRate: number;
  latencyMs: number;
  latencyRate: number;
  durationSec: number;
  activeUntil: string | null;
}

export interface ChaosRequest {
  errorRate: number;
  latencyMs?: number;
  latencyRate?: number;
  durationSec?: number;
}

export interface Persona {
  userId: string;
  name: string;
  country: string;
  plan: "free" | "premium";
  betaUser: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface CreateFlagRequest {
  key: string;
  name: string;
  description?: string;
}

export interface PatchFlagRequest {
  name?: string;
  description?: string;
}

export type GuardrailRequest = Guardrail;

export interface PlaygroundEvaluationRequest {
  flagKey: string;
  context: Record<string, unknown>;
}
