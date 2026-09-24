/** Shopper-friendly explanations of CanaryShield's evaluation reasons. */
export const flowReasons: Record<string, string> = {
  IN_ROLLOUT: "You are in the group of shoppers trying the new payment flow.",
  OUTSIDE_ROLLOUT: "You are not in the rollout group yet, so you get the classic flow.",
  OVERRIDE_INCLUDE: "Your account is enrolled as a tester of the new flow.",
  OVERRIDE_EXCLUDE: "Your account is kept on the classic flow.",
  NOT_ELIGIBLE: "The new flow is not offered to your country or plan yet.",
  NO_BUCKET_KEY: "Without a shopper ID, checkout uses the classic flow.",
  NOT_STARTED: "The new payment flow has not started rolling out.",
  ROLLED_BACK: "The new flow was rolled back, so everyone uses the classic one.",
  KILL_SWITCH: "The new flow is switched off.",
  FLAG_NOT_FOUND: "No payment release is configured.",
  PLATFORM_UNAVAILABLE: "CanaryShield could not be reached, so checkout safely falls back to the classic flow.",
};

export function explainFlow(reason: string) {
  return flowReasons[reason] ?? `Decision: ${reason}.`;
}
