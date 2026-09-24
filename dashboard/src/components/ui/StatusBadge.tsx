import type { FlagStatus, HealthStatus } from "../../api/types";
import { flagStatusConfig, healthConfig } from "../../lib/status";
import Badge from "./Badge";

/** Lifecycle status of a flag (draft → rolling out → completed / rolled back). */
export function FlagStatusBadge({ status }: { status: FlagStatus }) {
  const config = flagStatusConfig[status];
  const Icon = config.icon;
  return <Badge tone={config.tone} icon={<Icon size={13} aria-hidden="true" />} title={config.description}>{config.label}</Badge>;
}

/** Guardian health status as a colored dot plus words. */
export function HealthIndicator({ status, size = "sm", live }: { status: HealthStatus; size?: "sm" | "md"; live?: boolean }) {
  const config = healthConfig[status];
  return (
    <Badge tone={config.tone} dot pulse={live && (status === "BREACHED" || status === "WARNING")} size={size} title={config.description}>
      {config.label}
    </Badge>
  );
}
