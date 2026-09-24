import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricPoint, Metrics } from "../api/types";

interface Row {
  time: number;
  canary?: number;
  baseline?: number;
}

function toRows(canary: MetricPoint[], baseline: MetricPoint[]): Row[] {
  const rows = new Map<number, Row>();
  for (const [time, value] of canary) rows.set(time, { ...rows.get(time), time, canary: value * 100 });
  for (const [time, value] of baseline) rows.set(time, { ...rows.get(time), time, baseline: value * 100 });
  return [...rows.values()].sort((a, b) => a.time - b.time);
}

function formatChartTime(seconds: number) {
  return new Date(seconds * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Canary vs baseline error rate (as %) with the guardrail threshold as a dashed line. */
export default function ErrorRateChart({ metrics }: { metrics: Metrics }) {
  const rows = toRows(metrics.series.canaryErrorRate, metrics.series.baselineErrorRate);
  const thresholdPercent = metrics.threshold * 100;

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-sm font-medium text-neutral-800">Error rate</figcaption>
      {rows.length === 0 ? (
        <p className="flex h-60 items-center justify-center border border-dashed border-neutral-300 text-sm text-neutral-500">
          No payment traffic yet
        </p>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis dataKey="time" tickFormatter={formatChartTime} tick={{ fontSize: 11 }} minTickGap={40} />
              <YAxis
                domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, thresholdPercent * 1.5))]}
                tickFormatter={(value: number) => `${value}%`}
                tick={{ fontSize: 11 }}
                width={44}
              />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(2)}%`}
                labelFormatter={(label) => formatChartTime(Number(label))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                y={thresholdPercent}
                stroke="#d97706"
                strokeDasharray="6 4"
                label={{ value: `Threshold ${thresholdPercent.toFixed(1)}%`, position: "insideTopRight", fill: "#b45309", fontSize: 11 }}
              />
              <Line dataKey="canary" name="Canary (new)" stroke="#dc2626" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="baseline" name="Baseline (old)" stroke="#525252" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
