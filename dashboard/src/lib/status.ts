import { CheckCircle2, CircleDashed, CirclePause, CirclePlay, Undo2, type LucideIcon } from "lucide-react";
import type { Tone } from "../components/ui/Badge";
import type { FlagStatus, HealthStatus } from "../api/types";

export const flagStatusConfig: Record<FlagStatus, { label: string; tone: Tone; icon: LucideIcon; description: string }> = {
  draft: { label: "Draft", tone: "neutral", icon: CircleDashed, description: "Created but never rolled out. Everyone gets the stable version." },
  rolling_out: { label: "Rolling out", tone: "info", icon: CirclePlay, description: "Serving the new version to a percentage of users, watched by the guardian." },
  paused: { label: "Paused", tone: "warning", icon: CirclePause, description: "Percentage frozen; still monitored and still able to roll back." },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2, description: "Fully released to 100% of eligible users." },
  rolled_back: { label: "Rolled back", tone: "danger", icon: Undo2, description: "Back at 0%. Everyone gets the stable version until someone starts again." },
};

export const healthConfig: Record<HealthStatus, { label: string; tone: Tone; description: string }> = {
  HEALTHY: { label: "Healthy", tone: "success", description: "Canary error rate is under the threshold." },
  WARNING: { label: "Warning", tone: "warning", description: "The canary broke the threshold on at least one check." },
  BREACHED: { label: "Breached", tone: "danger", description: "The canary breached its guardrail and is being rolled back." },
  INSUFFICIENT_DATA: { label: "Collecting data", tone: "info", description: "Not enough canary traffic yet to judge health." },
  NOT_MONITORED: { label: "Not monitored", tone: "neutral", description: "The guardian is not watching this flag right now." },
};
