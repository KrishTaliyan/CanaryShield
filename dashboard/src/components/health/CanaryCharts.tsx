import { useMemo, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricPoint, Metrics, MetricsRange } from "../../api/types";
import { useMetrics } from "../../hooks/useMetrics";
import { useChartColors } from "../../hooks/useUi";
import { cn } from "../../lib/cn";
import { formatClock } from "../../lib/format";
import ChartContainer from "../ui/ChartContainer";
import TimeRangePicker from "../ui/TimeRangePicker";

type ChartKind = "errors" | "latency" | "traffic" | "success";

interface Row {
  time: number;
  canary?: number;
  baseline?: number;
}

function merge(canary: MetricPoint[] | undefined, baseline: MetricPoint[] | undefined, transform: (value: number) => number): Row[] {
  const rows = new Map<number, Row>();
  for (const [time, value] of canary ?? []) rows.set(time, { ...rows.get(time), time, canary: transform(value) });
  for (const [time, value] of baseline ?? []) rows.set(time, { ...rows.get(time), time, baseline: transform(value) });
  return [...rows.values()].sort((a, b) => a.time - b.time);
}

function tickFormatter(rangeSeconds: number) {
  return (seconds: number) => formatClock(seconds, rangeSeconds < 3600);
}

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
}

function ChartTooltip({ active, payload, label, unit, digits = 2 }: { active?: boolean; payload?: TooltipEntry[]; label?: number; unit: string; digits?: number }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-control border border-line bg-surface-2 px-3 py-2 text-[12.5px] shadow-float">
      <p className="mb-1 font-semibold tabular text-ink">{formatClock(label ?? 0)}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center justify-between gap-4 text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
            {entry.name}
          </span>
          <span className="font-semibold tabular text-ink">
            {typeof entry.value === "number" ? `${entry.value.toFixed(digits)}${unit}` : "—"}
          </span>
        </p>
      ))}
    </div>
  );
}

interface ChartProps {
  metrics: Metrics | undefined;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  height?: number;
  actions?: ReactNode;
  className?: string;
}

const emptyMessage = "No payment traffic in this range. Run the load generator to produce some.";

/** Canary vs baseline error rate, with the guardrail threshold. */
export function ErrorRateChart({ metrics, loading, error, onRetry, height = 260, actions, className }: ChartProps) {
  const colors = useChartColors();
  const rows = useMemo(() => merge(metrics?.series.canaryErrorRate, metrics?.series.baselineErrorRate, (value) => value * 100), [metrics]);
  const threshold = (metrics?.threshold ?? 0) * 100;

  return (
    <ChartContainer
      title="Error rate"
      subtitle="Share of payments that failed, canary vs baseline"
      explanation="The guardian compares the canary (new version) error rate with the threshold every 5 seconds. The baseline is the stable version, for comparison."
      legend={[
        { label: "Canary (new version)", color: colors.canary },
        { label: "Baseline (stable)", color: colors.baseline, dashed: true },
        { label: `Rollback threshold ${threshold.toFixed(1)}%`, color: colors.threshold, dashed: true },
      ]}
      height={height}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={rows.length === 0}
      emptyMessage={emptyMessage}
      actions={actions}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tickFormatter={tickFormatter(metrics?.rangeSeconds ?? 300)} tick={{ fontSize: 11, fill: colors.axis }} stroke={colors.grid} minTickGap={48} />
          <YAxis
            domain={[0, (dataMax: number) => Math.max(1, Math.ceil(Math.max(dataMax, threshold * 1.5)))]}
            tickFormatter={(value: number) => `${value}%`}
            tick={{ fontSize: 11, fill: colors.axis }}
            stroke={colors.grid}
            width={44}
          />
          <Tooltip content={<ChartTooltip unit="%" />} />
          <ReferenceLine y={threshold} stroke={colors.threshold} strokeDasharray="6 4" strokeWidth={1.5} ifOverflow="extendDomain" />
          <Line dataKey="baseline" name="Baseline" stroke={colors.baseline} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
          <Line dataKey="canary" name="Canary" stroke={colors.canary} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

/** Success rate (1 − error rate) of each version. */
export function SuccessRateChart({ metrics, loading, error, onRetry, height = 260, actions, className }: ChartProps) {
  const colors = useChartColors();
  const rows = useMemo(() => merge(metrics?.series.canaryErrorRate, metrics?.series.baselineErrorRate, (value) => (1 - value) * 100), [metrics]);
  const lowest = rows.reduce((min, row) => Math.min(min, row.canary ?? 100, row.baseline ?? 100), 100);

  return (
    <ChartContainer
      title="Success rate"
      subtitle="Share of payments that completed"
      explanation="100% minus the error rate, for each version. Easier to read when both are close to perfect."
      legend={[
        { label: "Canary (new version)", color: colors.canary },
        { label: "Baseline (stable)", color: colors.baseline, dashed: true },
      ]}
      height={height}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={rows.length === 0}
      emptyMessage={emptyMessage}
      actions={actions}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tickFormatter={tickFormatter(metrics?.rangeSeconds ?? 300)} tick={{ fontSize: 11, fill: colors.axis }} stroke={colors.grid} minTickGap={48} />
          <YAxis
            domain={[Math.max(0, Math.floor(lowest - 5)), 100]}
            tickFormatter={(value: number) => `${value}%`}
            tick={{ fontSize: 11, fill: colors.axis }}
            stroke={colors.grid}
            width={44}
          />
          <Tooltip content={<ChartTooltip unit="%" />} />
          <Line dataKey="baseline" name="Baseline" stroke={colors.baseline} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
          <Line dataKey="canary" name="Canary" stroke={colors.canary} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

/** p95 payment latency of each version. */
export function LatencyChart({ metrics, loading, error, onRetry, height = 260, actions, className }: ChartProps) {
  const colors = useChartColors();
  const supported = metrics === undefined || metrics.series.latencyP95New !== undefined;
  const rows = useMemo(() => merge(metrics?.series.latencyP95New, metrics?.series.latencyP95Old, (value) => value * 1000), [metrics]);

  return (
    <ChartContainer
      title="Latency (p95)"
      subtitle="95% of payments finished faster than this"
      explanation="The 95th percentile of payment duration, from QuickCart's histogram in Prometheus. Chaos latency injection shows up here."
      legend={[
        { label: "Canary (new version)", color: colors.canary },
        { label: "Baseline (stable)", color: colors.baseline, dashed: true },
      ]}
      height={height}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={rows.length === 0}
      emptyMessage={supported ? emptyMessage : "This platform version does not report latency. Update the platform to see it."}
      actions={actions}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tickFormatter={tickFormatter(metrics?.rangeSeconds ?? 300)} tick={{ fontSize: 11, fill: colors.axis }} stroke={colors.grid} minTickGap={48} />
          <YAxis tickFormatter={(value: number) => `${Math.round(value)} ms`} tick={{ fontSize: 11, fill: colors.axis }} stroke={colors.grid} width={60} />
          <Tooltip content={<ChartTooltip unit=" ms" digits={0} />} />
          <Line dataKey="baseline" name="Baseline" stroke={colors.baseline} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
          <Line dataKey="canary" name="Canary" stroke={colors.canary} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

/** Requests per second on each version, stacked. */
export function TrafficChart({ metrics, loading, error, onRetry, height = 260, actions, className }: ChartProps) {
  const colors = useChartColors();
  const rows = useMemo(() => merge(metrics?.series.rpsNew, metrics?.series.rpsOld, (value) => value), [metrics]);
  const total = rows.reduce((sum, row) => sum + (row.canary ?? 0) + (row.baseline ?? 0), 0);

  return (
    <ChartContainer
      title="Traffic"
      subtitle="Payment requests per second on each version"
      explanation="How QuickCart's payment traffic is split between the new version (canary) and the stable one. The split follows the rollout percentage."
      legend={[
        { label: "Canary (new version)", color: colors.canary, swatch: true },
        { label: "Baseline (stable)", color: colors.baseline, swatch: true },
      ]}
      height={height}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={rows.length === 0 || total === 0}
      emptyMessage={emptyMessage}
      actions={actions}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tickFormatter={tickFormatter(metrics?.rangeSeconds ?? 300)} tick={{ fontSize: 11, fill: colors.axis }} stroke={colors.grid} minTickGap={48} />
          <YAxis tickFormatter={(value: number) => `${Math.round(value)}`} tick={{ fontSize: 11, fill: colors.axis }} stroke={colors.grid} width={36} />
          <Tooltip content={<ChartTooltip unit=" req/s" digits={1} />} />
          <Area type="monotone" dataKey="baseline" name="Baseline" stackId="rps" stroke={colors.baseline} fill={colors.baseline} fillOpacity={0.25} strokeWidth={1.5} isAnimationActive={false} />
          <Area type="monotone" dataKey="canary" name="Canary" stackId="rps" stroke={colors.canary} fill={colors.canary} fillOpacity={0.35} strokeWidth={1.5} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

interface CanaryChartsProps {
  flagKey: string;
  range: MetricsRange;
  onRangeChange: (range: MetricsRange) => void;
  charts?: ChartKind[];
  className?: string;
}

/** A flag's live canary charts with one shared time range. */
export default function CanaryCharts({ flagKey, range, onRangeChange, charts = ["errors", "latency", "traffic", "success"], className }: CanaryChartsProps) {
  const query = useMetrics(flagKey, range);
  const common = {
    metrics: query.data,
    loading: query.isPending,
    error: query.isError && !query.data ? `${query.error.message} Charts need Prometheus; retrying every 5 seconds.` : null,
    onRetry: () => void query.refetch(),
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-muted">
          Live from Prometheus, refreshed every 5 seconds.
          {query.isFetching && !query.isPending && <span className="ml-2 text-ink-subtle">Updating…</span>}
        </p>
        <TimeRangePicker value={range} onChange={onRangeChange} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {charts.includes("errors") && <ErrorRateChart {...common} />}
        {charts.includes("latency") && <LatencyChart {...common} />}
        {charts.includes("traffic") && <TrafficChart {...common} />}
        {charts.includes("success") && <SuccessRateChart {...common} />}
      </div>
    </div>
  );
}
