import {
  CheckCircle2,
  CirclePause,
  CirclePlay,
  FilePlus2,
  Filter,
  Pencil,
  Power,
  ShieldCheck,
  TrendingUp,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Event, EventType } from "../api/types";
import type { Tone } from "../components/ui/Badge";

export const eventConfig: Record<EventType, { label: string; icon: LucideIcon; tone: Tone }> = {
  created: { label: "Flag created", icon: FilePlus2, tone: "primary" },
  updated: { label: "Details updated", icon: Pencil, tone: "neutral" },
  conditions_changed: { label: "Targeting conditions changed", icon: Filter, tone: "neutral" },
  overrides_changed: { label: "User overrides changed", icon: Users, tone: "neutral" },
  guardrail_changed: { label: "Guardrail changed", icon: ShieldCheck, tone: "neutral" },
  started: { label: "Rollout started", icon: CirclePlay, tone: "info" },
  step_changed: { label: "Rollout percentage changed", icon: TrendingUp, tone: "accent" },
  paused: { label: "Rollout paused", icon: CirclePause, tone: "warning" },
  resumed: { label: "Rollout resumed", icon: CirclePlay, tone: "info" },
  completed: { label: "Rollout completed", icon: CheckCircle2, tone: "success" },
  rolled_back: { label: "Rolled back", icon: Undo2, tone: "danger" },
  killed: { label: "Kill switch used", icon: Power, tone: "danger" },
};

export const eventTypes = Object.keys(eventConfig) as EventType[];

/** "5% → 25%", "at 25%", or null when the event did not touch the percentage. */
export function percentageChange(event: Event) {
  if (event.fromPercentage === null || event.toPercentage === null) return null;
  if (event.fromPercentage === event.toPercentage) return `at ${event.toPercentage}%`;
  return `${event.fromPercentage}% → ${event.toPercentage}%`;
}

export function actorLabel(event: Event) {
  return event.actor === "system:guardian" ? "Guardian (automatic)" : "Admin";
}
