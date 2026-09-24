import type { EvaluationReason, EvaluationResult } from "../api/types";
import type { Tone } from "../components/ui/Badge";

/** Plain-language explanation of each evaluation reason (platform evaluation/evaluator.go order). */
export const reasonConfig: Record<EvaluationReason, { label: string; explanation: string; tone: Tone }> = {
  FLAG_NOT_FOUND: { label: "Flag not found", explanation: "No flag has this key, so the answer is “off”.", tone: "danger" },
  NOT_STARTED: { label: "Not started", explanation: "The flag is a draft. Nobody gets the new version until a rollout starts.", tone: "neutral" },
  KILL_SWITCH: { label: "Kill switch", explanation: "The kill switch is on, so the flag is off for everyone.", tone: "danger" },
  ROLLED_BACK: { label: "Rolled back", explanation: "The flag was rolled back. Everyone gets the stable version, include list too.", tone: "warning" },
  OVERRIDE_EXCLUDE: { label: "Excluded user", explanation: "This user is on the exclude list, so they always get the stable version.", tone: "warning" },
  OVERRIDE_INCLUDE: { label: "Included user", explanation: "This user is on the include list, so they always get the new version.", tone: "accent" },
  NOT_ELIGIBLE: { label: "Not eligible", explanation: "The user does not match the targeting conditions.", tone: "neutral" },
  NO_BUCKET_KEY: { label: "No user ID", explanation: "Without a user ID the platform cannot place the user in a bucket, so it serves the stable version.", tone: "warning" },
  IN_ROLLOUT: { label: "In rollout", explanation: "The user's bucket is below the rollout cutoff, so they get the new version.", tone: "success" },
  OUTSIDE_ROLLOUT: { label: "Outside rollout", explanation: "The user's bucket is at or above the rollout cutoff, so they get the stable version.", tone: "info" },
  PLATFORM_UNAVAILABLE: { label: "Platform unavailable", explanation: "The platform could not be reached; SDKs fall back to the stable version.", tone: "danger" },
};

export function variantLabel(variant: EvaluationResult["variant"]) {
  if (variant === "new") return "New version";
  if (variant === "old") return "Stable version";
  return "Off";
}

/** Bucket cutoff for a rollout percentage (rollout/bucket.go: bucket < round(pct × 100)). */
export function bucketCutoff(percentage: number) {
  return Math.round(percentage * 100);
}

/** Turns a typed attribute value into the JSON type the platform compares with. */
export function parseAttributeValue(raw: string): string | number | boolean {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value !== "" && Number.isFinite(Number(value))) return Number(value);
  return value;
}
