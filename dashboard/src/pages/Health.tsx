import { ArrowRight, HeartPulse, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { Flag } from "../api/types";
import CanaryCharts from "../components/health/CanaryCharts";
import HealthScoreGauge from "../components/health/HealthScoreGauge";
import { ButtonLink } from "../components/ui/Button";
import Card, { CardHeader } from "../components/ui/Card";
import { Select } from "../components/ui/Field";
import PageHeader, { SectionHeader } from "../components/ui/PageHeader";
import { SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { FlagStatusBadge, HealthIndicator } from "../components/ui/StatusBadge";
import { usePreferences } from "../hooks/useAppContext";
import { pickPrimaryFlag } from "../hooks/useData";
import { useFlagHealth } from "../hooks/useFlag";
import { useFlags } from "../hooks/useFlags";
import { useMetrics } from "../hooks/useMetrics";
import { isActive } from "../lib/flagActions";
import { formatRate, formatRelative } from "../lib/format";
import { computeHealthScore } from "../lib/health";

function FlagHealthCard({ flag }: { flag: Flag }) {
  const health = useFlagHealth(flag.key);
  const metrics = useMetrics(flag.key, "5m");
  const score = computeHealthScore(flag, health.data, metrics.data);
  const data = health.data;

  return (
    <Card className="flex flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/flags/${flag.key}?tab=health`} className="font-semibold text-ink hover:text-accent">{flag.name}</Link>
          <p className="truncate font-mono text-xs text-ink-subtle">{flag.key} · {flag.rolloutPercentage}%</p>
        </div>
        <FlagStatusBadge status={flag.status} />
      </div>
      {health.isPending ? <SkeletonCard className="shadow-none" /> : (
        <>
          <HealthScoreGauge health={score} size="sm" />
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="well px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Canary</dt>
              <dd className={`font-semibold tabular ${data?.canaryErrorRate != null && data.canaryErrorRate > data.threshold ? "text-danger" : "text-ink"}`}>{formatRate(data?.canaryErrorRate)}</dd>
            </div>
            <div className="well px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Baseline</dt>
              <dd className="font-semibold tabular text-ink">{formatRate(data?.baselineErrorRate)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-subtle">
            {data && <HealthIndicator status={data.status} live />}
            <span>{data?.checkedAt ? `Checked ${formatRelative(data.checkedAt)}` : "Not checked yet"}</span>
          </div>
        </>
      )}
    </Card>
  );
}

export default function Health() {
  const flagsQuery = useFlags();
  const [preferences, updatePreferences] = usePreferences();
  const flags = flagsQuery.data?.flags ?? [];
  const active = flags.filter(isActive);
  const [selected, setSelected] = useState<string>("");
  const focus = flags.find((flag) => flag.key === selected) ?? pickPrimaryFlag(flags);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canary health"
        description="How each canary compares with the stable version, and how close it is to an automatic rollback."
        actions={<ButtonLink to="/incidents" iconRight={<ArrowRight size={15} />}>Incidents</ButtonLink>}
      />

      {flagsQuery.isError ? (
        <ErrorState title="Could not load flags" message={flagsQuery.error.message} onRetry={() => void flagsQuery.refetch()} />
      ) : flagsQuery.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><SkeletonCard lines={5} /><SkeletonCard lines={5} /><SkeletonCard lines={5} /></div>
      ) : (
        <>
          <section aria-labelledby="monitored-heading">
            <SectionHeader id="monitored-heading" title="Monitored now" description="Flags rolling out or paused. The guardian checks each one every 5 seconds." />
            {active.length === 0 ? (
              <EmptyState
                icon={<HeartPulse size={22} />}
                title="No canaries to monitor"
                description="Health is measured while a rollout is in progress. Start one to see live scores."
                action={<ButtonLink to="/rollouts" size="sm">Go to rollouts</ButtonLink>}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {active.map((flag) => <FlagHealthCard key={flag.key} flag={flag} />)}
              </div>
            )}
          </section>

          {focus && (
            <section aria-labelledby="charts-heading">
              <SectionHeader
                id="charts-heading"
                title="Canary vs baseline"
                description="Solid lines are the canary (new version); dashed lines are the baseline (stable)."
                actions={
                  <label className="flex items-center gap-2 text-sm text-ink-muted">
                    Flag
                    <Select value={focus.key} onChange={(event) => setSelected(event.target.value)} className="h-9 w-56">
                      {flags.map((flag) => <option key={flag.key} value={flag.key}>{flag.name} ({flag.key})</option>)}
                    </Select>
                  </label>
                }
              />
              <CanaryCharts flagKey={focus.key} range={preferences.chartRange} onRangeChange={(chartRange) => updatePreferences({ chartRange })} charts={["errors", "latency", "success", "traffic"]} />
            </section>
          )}

          <Card>
            <CardHeader icon={<ShieldCheck size={18} />} title="How the guardian decides" />
            <ol className="grid gap-3 text-sm text-ink-muted md:grid-cols-2 xl:grid-cols-4">
              {[
                { title: "1. Measure", body: "Every 5 seconds it asks Prometheus for the canary and baseline error rate over the last 30 seconds." },
                { title: "2. Wait for data", body: "Below the flag's minimum sample count it reports “Collecting data” and never acts." },
                { title: "3. Count breaches", body: "Each check above the threshold is a breach. A healthy check resets the count." },
                { title: "4. Roll back", body: "After the configured breaches in a row it rolls back to 0%, opens an incident and alerts this dashboard." },
              ].map((item) => (
                <li key={item.title} className="rounded-control bg-surface-2/70 p-3">
                  <p className="mb-1 font-semibold text-ink">{item.title}</p>
                  {item.body}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-ink-subtle">
              The 0–100 health score is a summary for people. The guardian uses only the error-rate threshold. CPU and memory saturation are not measured: QuickCart does not export them.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
