import type { Incident } from "../api/types";

export type Severity = "critical" | "high" | "medium" | "low";

export const severityRank: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/**
 * Incidents carry no severity of their own, so it is derived from how far the
 * canary error rate went past the threshold and how much traffic was exposed.
 */
export function incidentSeverity(incident: Incident): { level: Severity; reason: string } {
  const ratio = incident.threshold > 0 ? incident.observedErrorRate / incident.threshold : 0;
  const times = `${ratio.toFixed(1)}× the threshold`;
  if (ratio >= 10 || incident.exposedPercentage >= 50) {
    return { level: "critical", reason: `Error rate ${times} with ${incident.exposedPercentage}% of traffic exposed.` };
  }
  if (ratio >= 4 || incident.exposedPercentage >= 25) {
    return { level: "high", reason: `Error rate ${times} with ${incident.exposedPercentage}% of traffic exposed.` };
  }
  if (ratio >= 2) {
    return { level: "medium", reason: `Error rate ${times}; exposure was limited to ${incident.exposedPercentage}%.` };
  }
  return { level: "low", reason: `Error rate just past the threshold (${times}) at ${incident.exposedPercentage}% exposure.` };
}

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Milliseconds the incident lasted (first breach → resolve), or until now if open. */
export function incidentDuration(incident: Incident, now = Date.now()) {
  const start = Date.parse(incident.firstBreachAt);
  const end = incident.resolvedAt ? Date.parse(incident.resolvedAt) : now;
  return end - start;
}
