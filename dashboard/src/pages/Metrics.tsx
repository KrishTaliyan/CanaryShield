import { LineChart } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import CanaryCharts from "../components/health/CanaryCharts";
import TrafficSplit from "../components/health/TrafficSplit";
import Card, { CardHeader } from "../components/ui/Card";
import { Select } from "../components/ui/Field";
import MetricCard from "../components/ui/MetricCard";
import PageHeader from "../components/ui/PageHeader";
import { SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { FlagStatusBadge } from "../components/ui/StatusBadge";
import { usePreferences } from "../hooks/useAppContext";
import { pickPrimaryFlag } from "../hooks/useData";
import { useFlags } from "../hooks/useFlags";
import { useMetrics } from "../hooks/useMetrics";
import { formatLatency, formatRate, formatRps, latest } from "../lib/format";

export default function Metrics() {
  const flagsQuery = useFlags();
  const [preferences, updatePreferences] = usePreferences();
  const [params, setParams] = useSearchParams();
  const flags = flagsQuery.data?.flags ?? [];
  const flag = flags.find((item) => item.key === params.get("flag")) ?? pickPrimaryFlag(flags);
  const metrics = useMetrics(flag?.key, preferences.chartRange);
  const series = metrics.data?.series;

  const canaryError = latest(series?.canaryErrorRate);
  const baselineError = latest(series?.baselineErrorRate);
  const canaryLatency = latest(series?.latencyP95New);
  const baselineLatency = latest(series?.latencyP95Old);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Metrics"
        description="Error rate, latency and traffic of the new version against the stable one, straight from Prometheus."
        actions={
          flags.length > 0 && flag ? (
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              Flag
              <Select
                value={flag.key}
                onChange={(event) => setParams({ flag: event.target.value }, { replace: true })}
                className="h-10 w-64"
              >
                {flags.map((item) => <option key={item.key} value={item.key}>{item.name} ({item.key})</option>)}
              </Select>
            </label>
          ) : undefined
        }
      />

      {flagsQuery.isError ? (
        <ErrorState title="Could not load flags" message={flagsQuery.error.message} onRetry={() => void flagsQuery.refetch()} />
      ) : flagsQuery.isPending ? (
        <SkeletonCard lines={6} />
      ) : !flag ? (
        <EmptyState icon={<LineChart size={22} />} title="No flags yet" description="Metrics appear once a flag is rolled out and receives traffic." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            Showing <span className="font-semibold text-ink">{flag.name}</span> <FlagStatusBadge status={flag.status} /> at {flag.rolloutPercentage}% rollout
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Canary error rate" value={formatRate(canaryError)} loading={metrics.isPending} context={`Baseline ${formatRate(baselineError)} · threshold ${formatRate(flag.guardrail.errorRateThreshold, 1)}`} status={canaryError !== null ? (canaryError > flag.guardrail.errorRateThreshold ? { tone: "danger", label: "Above threshold" } : { tone: "success", label: "Within threshold" }) : undefined} />
            <MetricCard label="Canary p95 latency" value={formatLatency(canaryLatency)} loading={metrics.isPending} context={`Baseline ${formatLatency(baselineLatency)}`} explanation="95% of canary payments finished faster than this." />
            <MetricCard label="Canary traffic" value={formatRps(latest(series?.rpsNew))} loading={metrics.isPending} context={`Baseline ${formatRps(latest(series?.rpsOld))}`} />
            <Card padding="md">
              <CardHeader title="Measured split" className="mb-2" />
              <TrafficSplit canaryRps={latest(series?.rpsNew)} baselineRps={latest(series?.rpsOld)} rolloutPercentage={flag.rolloutPercentage} size={96} />
            </Card>
          </div>
          <CanaryCharts flagKey={flag.key} range={preferences.chartRange} onRangeChange={(chartRange) => updatePreferences({ chartRange })} />
          <p className="text-xs text-ink-subtle">
            Latest values are the most recent point in the selected range. Resolution: {metrics.data ? `${metrics.data.stepSeconds} s per point` : "—"}. Charts refresh every 5 seconds.
          </p>
        </>
      )}
    </div>
  );
}
