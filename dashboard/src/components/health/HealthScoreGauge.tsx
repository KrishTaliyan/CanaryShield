import { Calculator } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/cn";
import { gradeLabel, type HealthGrade, type HealthScore } from "../../lib/health";
import Badge, { type Tone } from "../ui/Badge";
import Button from "../ui/Button";
import InfoTip from "../ui/InfoTip";
import Modal from "../ui/Modal";

const gradeTone: Record<HealthGrade, Tone> = {
  healthy: "success",
  watch: "info",
  degraded: "warning",
  critical: "danger",
  not_monitored: "neutral",
};

const gradeColor: Record<HealthGrade, string> = {
  healthy: "rgb(var(--success))",
  watch: "rgb(var(--info))",
  degraded: "rgb(var(--warning))",
  critical: "rgb(var(--danger))",
  not_monitored: "rgb(var(--text-subtle))",
};

interface HealthScoreGaugeProps {
  health: HealthScore;
  size?: "sm" | "md";
  showBreakdown?: boolean;
  className?: string;
}

/** Half-circle 0–100 gauge for the derived canary health score, with an explanation. */
export default function HealthScoreGauge({ health, size = "md", showBreakdown = true, className }: HealthScoreGaugeProps) {
  const [open, setOpen] = useState(false);
  const width = size === "md" ? 220 : 150;
  const radius = 90;
  const length = Math.PI * radius;
  const value = health.score ?? 0;

  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <div className="relative" style={{ width, height: width * 0.6 }}>
        <svg viewBox="0 0 200 118" width={width} height={width * 0.59} role="img" aria-label={health.score === null ? "Health score not available" : `Health score ${health.score} out of 100, ${gradeLabel[health.grade]}`}>
          <path d="M 10 105 A 90 90 0 0 1 190 105" fill="none" strokeWidth="14" strokeLinecap="round" style={{ stroke: "rgb(var(--sunken))" }} />
          {health.score !== null && (
            <path
              d="M 10 105 A 90 90 0 0 1 190 105"
              fill="none"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={length}
              strokeDashoffset={length * (1 - value / 100)}
              style={{ stroke: gradeColor[health.grade], transition: "stroke-dashoffset 800ms var(--ease-soft), stroke 300ms" }}
            />
          )}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className={cn("font-semibold leading-none tracking-tight tabular text-ink", size === "md" ? "text-[40px]" : "text-[28px]")}>
            {health.score ?? "—"}
          </span>
          <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-subtle">of 100</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <Badge tone={gradeTone[health.grade]} dot>{gradeLabel[health.grade]}</Badge>
        <InfoTip term="healthScore" />
      </div>
      <p className="mt-2 max-w-[260px] text-[13px] text-ink-muted">{health.summary}</p>
      {showBreakdown && health.components.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-2" icon={<Calculator size={14} />} onClick={() => setOpen(true)}>
          How is this calculated?
        </Button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="How the health score is calculated" description="A 0–100 summary for people. The guardian itself decides rollbacks only from the error-rate threshold." size="lg">
        <ul className="space-y-3">
          {health.components.map((component) => (
            <li key={component.key} className="rounded-control border border-line/80 bg-surface-2/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">
                  {component.label}
                  <span className="ml-2 text-xs font-medium text-ink-subtle">{component.weight > 0 ? `weight ${component.weight}` : "not scored"}</span>
                </p>
                <span className="text-sm font-semibold tabular text-ink">{component.score === null ? "No data" : `${Math.round(component.score)} / 100`}</span>
              </div>
              {component.score !== null && (
                <div className="well mt-2 h-2 overflow-hidden rounded-full p-0">
                  <div
                    className={cn("h-full rounded-full", component.score >= 70 ? "bg-success" : component.score >= 40 ? "bg-warning" : "bg-danger")}
                    style={{ width: `${component.score}%` }}
                  />
                </div>
              )}
              <p className="mt-2 text-[13px] text-ink-muted">{component.detail}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1.5 text-[13px] text-ink-muted">
          <p>Components without data are left out and the others are re-weighted.</p>
          <p>The score is capped at 60 while the guardian reports <strong className="text-ink">Warning</strong> and at 25 when it reports <strong className="text-ink">Breached</strong>.</p>
        </div>
      </Modal>
    </div>
  );
}
