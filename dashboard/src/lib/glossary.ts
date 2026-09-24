/** Short explanations of technical terms, shown in tooltips across the UI. */
export const glossary = {
  rollout: "Percentage of eligible traffic currently receiving the new version of this feature.",
  canary: "The new version, receiving a small, controlled share of traffic so problems surface early.",
  baseline: "The stable version everyone else uses. Canary metrics are compared against it.",
  errorThreshold: "Maximum acceptable canary error rate. Above it, the guardian counts a breach.",
  minSamples: "Canary requests needed in a 30-second window before the guardian will judge health.",
  consecutiveBreaches: "How many checks in a row must break the threshold before an automatic rollback.",
  guardian: "Background process that checks every monitored flag in Prometheus every 5 seconds and rolls back bad canaries.",
  healthScore: "A 0–100 summary of canary health, derived from live error rate, availability, latency and sample size.",
  blastRadius: "The share of users who could be affected if the new version fails.",
  killSwitch: "Turns the flag off for everyone immediately and resets the rollout to 0%.",
  bucket: "A stable number from 0 to 9999 derived from the user ID. Users below the rollout cutoff get the new version.",
  exposedUsers: "Distinct users who were served the new version since the rollout last started.",
  p95Latency: "95% of payments finished faster than this. A better signal of slowness than the average.",
  successRate: "Share of payments that completed without an error.",
  targeting: "Conditions a user must match before the rollout percentage applies.",
  overrides: "Users always forced onto (include) or off (exclude) the new version, regardless of rollout.",
  chaos: "Deliberately injected failures on QuickCart's new payment flow, to prove automatic rollback works.",
} as const;

export type GlossaryTerm = keyof typeof glossary;
