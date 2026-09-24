import type { Event } from "../api/types";

export type ReleaseOutcome = "in_progress" | "completed" | "auto_rolled_back" | "rolled_back" | "killed";

export interface Release {
  id: string;
  flagKey: string;
  startedAt: string;
  endedAt: string | null;
  outcome: ReleaseOutcome;
  /** Highest rollout percentage reached. */
  peakPercentage: number;
  /** Events from start to end, oldest first. */
  events: Event[];
  endReason: string | null;
}

/**
 * Rebuilds release history from rollout events: a release starts at a
 * "started" event and ends at "completed", "rolled_back" or "killed".
 */
export function deriveReleases(events: Event[]): Release[] {
  const byFlag = new Map<string, Event[]>();
  for (const event of events) {
    const list = byFlag.get(event.flagKey) ?? [];
    list.push(event);
    byFlag.set(event.flagKey, list);
  }

  const releases: Release[] = [];
  for (const [flagKey, flagEvents] of byFlag) {
    const ordered = [...flagEvents].sort((a, b) => a.id - b.id);
    let current: Release | null = null;
    for (const event of ordered) {
      if (event.type === "started") {
        if (current) releases.push(current);
        current = {
          id: `${flagKey}-${event.id}`,
          flagKey,
          startedAt: event.createdAt,
          endedAt: null,
          outcome: "in_progress",
          peakPercentage: event.toPercentage ?? 0,
          events: [event],
          endReason: null,
        };
        continue;
      }
      if (!current) continue;
      current.events.push(event);
      if (event.toPercentage !== null) current.peakPercentage = Math.max(current.peakPercentage, event.toPercentage);
      if (event.type === "completed") {
        current.outcome = "completed";
        current.endedAt = event.createdAt;
      } else if (event.type === "rolled_back" || event.type === "killed") {
        current.outcome = event.type === "killed"
          ? "killed"
          : event.actor === "system:guardian" ? "auto_rolled_back" : "rolled_back";
        current.endedAt = event.createdAt;
        current.endReason = event.reason;
        releases.push(current);
        current = null;
      }
    }
    if (current) releases.push(current);
  }
  return releases.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

/** Completed ÷ finished releases, or null when none has finished. */
export function releaseSuccessRate(releases: Release[]) {
  const finished = releases.filter((release) => release.outcome !== "in_progress");
  if (finished.length === 0) return null;
  return finished.filter((release) => release.outcome === "completed").length / finished.length;
}

export const outcomeLabel: Record<ReleaseOutcome, string> = {
  in_progress: "In progress",
  completed: "Completed",
  auto_rolled_back: "Auto rolled back",
  rolled_back: "Rolled back",
  killed: "Killed",
};
