import type { Flag } from "../api/types";
import type { FlagAction } from "../hooks/useFlag";

/** Toast title for a finished rollout action, from the flag the API returned. */
export function describeAction(action: FlagAction, flag: Flag) {
  switch (action.type) {
    case "set":
      return flag.status === "completed" ? "Rollout completed at 100%" : `Rollout set to ${flag.rolloutPercentage}%`;
    case "rollback":
      return "Flag rolled back to 0%";
    case "kill":
      return "Kill switch used: flag turned off";
    case "rollout":
      switch (action.action) {
        case "start":
          return `Rollout started at ${flag.rolloutPercentage}%`;
        case "advance":
          return flag.status === "completed" ? "Rollout completed at 100%" : `Rollout advanced to ${flag.rolloutPercentage}%`;
        case "pause":
          return "Rollout paused";
        case "resume":
          return "Rollout resumed";
      }
  }
}

/** Which actions the platform allows in each status (mirrors rollout/transitions.go). */
export function allowedActions(flag: Flag) {
  const nextStep = flag.rolloutSteps.find((step) => step > flag.rolloutPercentage) ?? null;
  return {
    start: flag.status === "draft" || flag.status === "rolled_back",
    advance: flag.status === "rolling_out" && nextStep !== null,
    nextStep,
    set: flag.status === "rolling_out" || flag.status === "paused",
    pause: flag.status === "rolling_out",
    resume: flag.status === "paused",
    rollback: flag.status === "rolling_out" || flag.status === "paused" || flag.status === "completed",
    kill: true,
  };
}

export function isActive(flag: Flag) {
  return flag.status === "rolling_out" || flag.status === "paused";
}
