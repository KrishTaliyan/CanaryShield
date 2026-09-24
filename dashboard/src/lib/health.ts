import type { Flag, Health, Metrics } from "../api/types";
import { formatLatency, formatRate, latest } from "./format";

export type HealthGrade = "healthy" | "watch" | "degraded" | "critical" | "not_monitored";

export interface HealthComponent {
  key: "errors" | "availability" | "latency" | "confidence" | "saturation";
  label: string;
  /** 0–100, or null when the signal is not available. */
  score: number | null;
  weight: number;
  detail: string;
}

export interface HealthScore {
  /** 0–100, or null when the flag is not monitored. */
  score: number | null;
  grade: HealthGrade;
  components: HealthComponent[];
  summary: string;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

/**
 * Derives a 0–100 canary health score from live guardian data and Prometheus
 * metrics. It is a summary for humans; the guardian itself only uses the
 * error-rate threshold. Components without data are left out and the rest
 * are re-weighted.
 */
export function computeHealthScore(flag: Flag | undefined, health: Health | undefined, metrics: Metrics | undefined): HealthScore {
  const monitored = health && health.status !== "NOT_MONITORED" && (flag?.status === "rolling_out" || flag?.status === "paused");
  if (!flag || !health || !monitored) {
    return {
      score: null,
      grade: "not_monitored",
      components: [],
      summary: flag?.status === "rolled_back"
        ? "The flag is rolled back, so there is no canary to score."
        : "The guardian is not monitoring this flag. Start a rollout to see live health.",
    };
  }

  const threshold = health.threshold || flag.guardrail.errorRateThreshold;
  const canaryError = health.canaryErrorRate ?? latest(metrics?.series.canaryErrorRate);
  const canaryLatency = latest(metrics?.series.latencyP95New);
  const baselineLatency = latest(metrics?.series.latencyP95Old);

  const components: HealthComponent[] = [
    {
      key: "errors",
      label: "Error rate",
      weight: 40,
      score: canaryError === null ? null : clamp(100 * (1 - canaryError / threshold)),
      detail: canaryError === null
        ? "No canary error rate yet."
        : `Canary ${formatRate(canaryError)} against a ${formatRate(threshold, 1)} threshold.`,
    },
    {
      key: "availability",
      label: "Availability",
      weight: 20,
      score: canaryError === null ? null : clamp(((1 - canaryError) - 0.95) / 0.05 * 100),
      detail: canaryError === null
        ? "No canary traffic yet."
        : `${formatRate(1 - canaryError)} of canary payments succeeded (95% or less scores 0).`,
    },
    {
      key: "latency",
      label: "Latency",
      weight: 20,
      score: canaryLatency === null || baselineLatency === null || baselineLatency <= 0
        ? null
        : clamp(100 - Math.max(0, canaryLatency / baselineLatency - 1.1) / 0.9 * 100),
      detail: canaryLatency === null || baselineLatency === null
        ? "No latency data yet."
        : `Canary p95 ${formatLatency(canaryLatency)} vs baseline ${formatLatency(baselineLatency)}.`,
    },
    {
      key: "confidence",
      label: "Traffic confidence",
      weight: 20,
      score: clamp((health.samples / Math.max(1, flag.guardrail.minSamples)) * 100),
      detail: `${health.samples} canary requests in the last 30 s; ${flag.guardrail.minSamples} needed to judge.`,
    },
    {
      key: "saturation",
      label: "Saturation",
      weight: 0,
      score: null,
      detail: "Not measured: QuickCart does not export CPU or memory metrics.",
    },
  ];

  const available = components.filter((component) => component.score !== null && component.weight > 0);
  const totalWeight = available.reduce((sum, component) => sum + component.weight, 0);
  let score = totalWeight === 0 ? null : Math.round(available.reduce((sum, component) => sum + (component.score ?? 0) * component.weight, 0) / totalWeight);

  if (health.status === "BREACHED" && score !== null) score = Math.min(score, 25);
  if (health.status === "WARNING" && score !== null) score = Math.min(score, 60);

  const grade: HealthGrade = score === null
    ? "watch"
    : health.status === "BREACHED" || score < 40
      ? "critical"
      : health.status === "WARNING" || score < 70
        ? "degraded"
        : score < 85
          ? "watch"
          : "healthy";

  const summary = health.status === "INSUFFICIENT_DATA"
    ? "Not enough canary traffic yet to judge health."
    : health.status === "BREACHED"
      ? "The canary breached its guardrail; the guardian is rolling it back."
      : health.status === "WARNING"
        ? `The canary broke the threshold on ${health.breachCount} check${health.breachCount === 1 ? "" : "s"}; one more and it rolls back.`
        : "The canary is performing within its guardrail.";

  return { score, grade, components, summary };
}

export const gradeLabel: Record<HealthGrade, string> = {
  healthy: "Healthy",
  watch: "Watch",
  degraded: "Degraded",
  critical: "Critical",
  not_monitored: "Not monitored",
};
