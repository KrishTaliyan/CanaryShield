import { ArrowRight, CheckCircle2, CirclePause, Rocket, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Flag } from "../api/types";
import RolloutControl from "../components/flags/RolloutControl";
import Badge from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import Card from "../components/ui/Card";
import MetricCard from "../components/ui/MetricCard";
import PageHeader, { SectionHeader } from "../components/ui/PageHeader";
import { SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { FlagStatusBadge, HealthIndicator } from "../components/ui/StatusBadge";
import { useFlagHealth } from "../hooks/useFlag";
import { useFlags } from "../hooks/useFlags";
import { formatRate, formatRelative } from "../lib/format";

function ActiveRolloutCard({ flag }: { flag: Flag }) {
  const health = useFlagHealth(flag.key);
  const status = health.data?.status ?? flag.healthStatus;
  const canary = health.data?.canaryErrorRate ?? null;
  const threshold = flag.guardrail.errorRateThreshold;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/flags/${flag.key}`} className="text-base font-semibold text-ink hover:text-accent">{flag.name}</Link>
          <p className="font-mono text-xs text-ink-subtle">{flag.key}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FlagStatusBadge status={flag.status} />
          <HealthIndicator status={status} live />
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3 rounded-control bg-surface-2/70 p-3 text-center">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Canary errors</dt>
          <dd className={`mt-0.5 text-sm font-semibold tabular ${canary !== null && canary > threshold ? "text-danger" : "text-ink"}`}>{formatRate(canary)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Threshold</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular text-ink">{flag.guardrail.enabled ? formatRate(threshold, 1) : "Off"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Samples</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular text-ink">{health.data ? health.data.samples : "—"}</dd>
        </div>
      </dl>
      <RolloutControl flag={flag} compact />
      <div className="flex items-center justify-between border-t border-line/70 pt-3 text-xs text-ink-subtle">
        <span>Updated {formatRelative(flag.updatedAt)}</span>
        <Link to={`/flags/${flag.key}?tab=rollout`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
          Full controls <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}

export default function Rollouts() {
  const flagsQuery = useFlags();
  const flags = flagsQuery.data?.flags ?? [];
  const active = flags.filter((flag) => flag.status === "rolling_out" || flag.status === "paused");
  const ready = flags.filter((flag) => flag.status === "draft" || flag.status === "rolled_back");
  const completed = flags.filter((flag) => flag.status === "completed");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rollouts"
        description="Every rollout in progress with its live health, plus flags ready to start. Changes are confirmed before they apply."
        actions={<ButtonLink to="/releases" iconRight={<ArrowRight size={15} />}>Release history</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Rolling out" value={flags.filter((flag) => flag.status === "rolling_out").length} icon={<Rocket size={18} />} loading={flagsQuery.isPending} />
        <MetricCard label="Paused" value={flags.filter((flag) => flag.status === "paused").length} icon={<CirclePause size={18} />} loading={flagsQuery.isPending} explanation="Paused rollouts keep their percentage and are still watched by the guardian." />
        <MetricCard label="Ready to start" value={ready.length} icon={<Undo2 size={18} />} loading={flagsQuery.isPending} context="Drafts and rolled-back flags" />
        <MetricCard label="Completed" value={completed.length} icon={<CheckCircle2 size={18} />} loading={flagsQuery.isPending} context="Serving 100% of eligible users" />
      </div>

      {flagsQuery.isError ? (
        <ErrorState title="Could not load rollouts" message={flagsQuery.error.message} onRetry={() => void flagsQuery.refetch()} />
      ) : flagsQuery.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2"><SkeletonCard lines={5} /><SkeletonCard lines={5} /></div>
      ) : (
        <>
          <section aria-labelledby="active-heading">
            <SectionHeader id="active-heading" title="In progress" description="Advance, pause or roll back. The guardian rolls back on its own if a canary breaks its guardrail." />
            {active.length === 0 ? (
              <EmptyState icon={<Rocket size={22} />} title="No rollouts in progress" description="Start one below, or from a flag's page." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {active.map((flag) => <ActiveRolloutCard key={flag.key} flag={flag} />)}
              </div>
            )}
          </section>

          <section aria-labelledby="ready-heading">
            <SectionHeader id="ready-heading" title="Ready to start" description="Starting sends the first step of traffic to the new version." />
            {ready.length === 0 ? (
              <EmptyState compact title="Nothing waiting" description="Every flag is rolling out or complete." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ready.map((flag) => (
                  <Card key={flag.key} padding="sm" className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to={`/flags/${flag.key}`} className="font-semibold text-ink hover:text-accent">{flag.name}</Link>
                        <p className="truncate font-mono text-xs text-ink-subtle">{flag.key}</p>
                      </div>
                      <FlagStatusBadge status={flag.status} />
                    </div>
                    {!flag.enabled && <Badge tone="warning">Kill switch on: starting turns it back on</Badge>}
                    <RolloutControl flag={flag} compact />
                  </Card>
                ))}
              </div>
            )}
          </section>

          {completed.length > 0 && (
            <section aria-labelledby="completed-heading">
              <SectionHeader id="completed-heading" title="Completed" description="Fully released. You can still roll these back from the flag's page." />
              <ul className="surface divide-y divide-line/70 p-0">
                {completed.map((flag) => (
                  <li key={flag.key}>
                    <Link to={`/flags/${flag.key}?tab=rollout`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2/70">
                      <CheckCircle2 size={16} className="text-success" aria-hidden="true" />
                      <span className="font-medium text-ink">{flag.name}</span>
                      <span className="font-mono text-xs text-ink-subtle">{flag.key}</span>
                      <span className="ml-auto text-xs text-ink-subtle">Completed {formatRelative(flag.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
