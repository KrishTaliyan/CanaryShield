import { useMocks } from "../api/client";
import type { Tone } from "../components/ui/Badge";
import { useChaos, useIncidents, usePlatformHealth, useQuickCartHealth } from "./useData";
import { useStreamConnected } from "./useEventStream";
import { useFlags } from "./useFlags";

export interface SystemStatus {
  level: "operational" | "degraded" | "incident" | "down";
  tone: Tone;
  label: string;
  /** Human-readable reasons, most important first. */
  details: string[];
}

/** One summary of platform, QuickCart, live updates, incidents and canary health. */
export function useSystemStatus(): SystemStatus {
  const platform = usePlatformHealth();
  const quickcart = useQuickCartHealth();
  const streamConnected = useStreamConnected();
  const openIncidents = useIncidents("open");
  const chaos = useChaos();
  const flags = useFlags();

  const details: string[] = [];
  if (platform.isError) {
    return { level: "down", tone: "danger", label: "Platform unreachable", details: ["The platform API at :8080 is not responding."] };
  }

  const incidentCount = openIncidents.data?.incidents.length ?? 0;
  if (incidentCount > 0) details.push(`${incidentCount} open incident${incidentCount === 1 ? "" : "s"}`);
  const breached = flags.data?.flags.filter((flag) => flag.healthStatus === "BREACHED" || flag.healthStatus === "WARNING") ?? [];
  if (breached.length > 0) details.push(`${breached.length} canary${breached.length === 1 ? "" : "ies"} breaking the threshold`);
  if (chaos.data?.active) details.push("Chaos experiment running");
  if (quickcart.isError) details.push("QuickCart is unreachable");
  if (!useMocks && !streamConnected && platform.isSuccess) details.push("Live updates reconnecting");

  if (incidentCount > 0) return { level: "incident", tone: "danger", label: details[0], details };
  if (details.length > 0) return { level: "degraded", tone: "warning", label: details[0], details };
  return { level: "operational", tone: "success", label: "All systems operational", details: [] };
}
