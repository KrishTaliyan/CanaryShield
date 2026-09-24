import { AlertOctagon, AlertTriangle, CircleAlert, Info } from "lucide-react";
import type { Incident } from "../../api/types";
import { incidentSeverity, severityLabel, type Severity } from "../../lib/severity";
import Badge, { type Tone } from "../ui/Badge";

const tone: Record<Severity, Tone> = { critical: "danger", high: "danger", medium: "warning", low: "info" };
const icon: Record<Severity, typeof Info> = { critical: AlertOctagon, high: AlertTriangle, medium: CircleAlert, low: Info };

/** Derived incident severity; the reason is in the tooltip. */
export default function SeverityBadge({ incident, size = "sm" }: { incident: Incident; size?: "sm" | "md" }) {
  const severity = incidentSeverity(incident);
  const Icon = icon[severity.level];
  return (
    <Badge
      tone={tone[severity.level]}
      variant={severity.level === "critical" ? "solid" : "soft"}
      size={size}
      icon={<Icon size={13} aria-hidden="true" />}
      title={`${severityLabel[severity.level]} severity (derived): ${severity.reason}`}
    >
      {severityLabel[severity.level]}
    </Badge>
  );
}
