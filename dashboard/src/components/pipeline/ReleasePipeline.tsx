import { Activity, ChevronRight, Flag as FlagIcon, HeartPulse, Rocket, ShieldCheck, ShoppingCart, type LucideIcon } from "lucide-react";
import type { Flag, Health, Metrics } from "../../api/types";
import { useQuickCartHealth } from "../../hooks/useData";
import { cn } from "../../lib/cn";
import { formatRate, formatRps, latest } from "../../lib/format";
import { flagStatusConfig, healthConfig } from "../../lib/status";
import type { Tone } from "../ui/Badge";

interface Stage {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string;
  detail: string;
  tone: Tone;
}

const dot: Record<Tone, string> = {
  neutral: "bg-ink-subtle",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  primary: "bg-primary",
};

const ring: Record<Tone, string> = {
  neutral: "text-ink-muted",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  primary: "text-primary",
};

interface ReleasePipelineProps {
  flag: Flag;
  health?: Health;
  metrics?: Metrics;
  className?: string;
}

/** Where a release stands, left to right: flag → QuickCart → rollout → traffic → health → rollback. */
export default function ReleasePipeline({ flag, health, metrics, className }: ReleasePipelineProps) {
  const quickcart = useQuickCartHealth();
  const canaryRps = latest(metrics?.series.rpsNew);
  const status = health?.status ?? flag.healthStatus;
  const active = flag.status === "rolling_out" || flag.status === "paused";

  const stages: Stage[] = [
    {
      id: "flag",
      label: "Flag",
      icon: FlagIcon,
      value: flag.enabled ? "Enabled" : "Off",
      detail: `Version ${flag.version}`,
      tone: flag.enabled ? "success" : "neutral",
    },
    {
      id: "quickcart",
      label: "QuickCart",
      icon: ShoppingCart,
      value: quickcart.isError ? "Unreachable" : quickcart.isSuccess ? "Evaluating" : "Checking…",
      detail: quickcart.isError ? "Payments fall back to the stable flow" : "Asks the platform per payment",
      tone: quickcart.isError ? "danger" : quickcart.isSuccess ? "success" : "neutral",
    },
    {
      id: "rollout",
      label: "Rollout",
      icon: Rocket,
      value: `${flag.rolloutPercentage}%`,
      detail: flagStatusConfig[flag.status].label,
      tone: flagStatusConfig[flag.status].tone,
    },
    {
      id: "traffic",
      label: "Canary traffic",
      icon: Activity,
      value: canaryRps === null ? "—" : formatRps(canaryRps),
      detail: metrics ? (canaryRps && canaryRps > 0 ? "Measured by Prometheus" : "No canary requests") : "Waiting for metrics",
      tone: canaryRps && canaryRps > 0 ? "accent" : "neutral",
    },
    {
      id: "health",
      label: "Health",
      icon: HeartPulse,
      value: healthConfig[status].label,
      detail: health?.canaryErrorRate != null ? `Canary errors ${formatRate(health.canaryErrorRate)}` : healthConfig[status].description,
      tone: healthConfig[status].tone,
    },
    {
      id: "rollback",
      label: "Auto rollback",
      icon: ShieldCheck,
      value: flag.status === "rolled_back" ? "Rolled back" : !flag.guardrail.enabled ? "Disabled" : status === "BREACHED" ? "Triggered" : active ? "Armed" : "Standby",
      detail: flag.status === "rolled_back"
        ? "Everyone is on the stable version"
        : flag.guardrail.enabled ? `Above ${formatRate(flag.guardrail.errorRateThreshold, 1)} × ${flag.guardrail.consecutiveBreaches} checks` : "Guardian will not act",
      tone: flag.status === "rolled_back" ? "danger" : !flag.guardrail.enabled ? "warning" : status === "BREACHED" ? "danger" : active ? "success" : "neutral",
    },
  ];

  return (
    <ol className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6", className)} aria-label="Release pipeline">
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        return (
          <li key={stage.id} className="relative">
            <div className="surface flex h-full items-start gap-3 p-3.5">
              <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-2 shadow-raised-sm", ring[stage.tone])} aria-hidden="true">
                <Icon size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{index + 1}. {stage.label}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", dot[stage.tone])} aria-hidden="true" />
                  <span className="truncate">{stage.value}</span>
                </p>
                <p className="mt-0.5 text-xs leading-snug text-ink-muted">{stage.detail}</p>
              </div>
            </div>
            {index < stages.length - 1 && (
              <ChevronRight size={16} className="absolute -right-[13px] top-1/2 z-[1] hidden -translate-y-1/2 text-ink-subtle 2xl:block" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
