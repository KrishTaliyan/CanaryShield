import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricPoint, Metrics } from "../api/types";

interface Row {
  time: number;
  rpsNew?: number;
  rpsOld?: number;
}

function formatChartTime(seconds: number) {
  return new Date(seconds * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function toRows(rpsNew: MetricPoint[], rpsOld: MetricPoint[]): Row[] {
  const rows = new Map<number, Row>();
  for (const [time, value] of rpsNew) rows.set(time, { ...rows.get(time), time, rpsNew: value });
  for (const [time, value] of rpsOld) rows.set(time, { ...rows.get(time), time, rpsOld: value });
  return [...rows.values()].sort((a, b) => a.time - b.time);
}

/** Requests per second served by the new and old payment flows. */
export default function TrafficChart({ metrics }: { metrics: Metrics }) {
  const rows = toRows(metrics.series.rpsNew, metrics.series.rpsOld);

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-sm font-medium text-neutral-800">Traffic (requests per second)</figcaption>
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
              <YAxis domain={[0, "auto"]} tick={{ fontSize: 11 }} width={44} />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(1)} req/s`}
                labelFormatter={(label) => formatChartTime(Number(label))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="rpsNew" name="New flow" stroke="#0369a1" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="rpsOld" name="Old flow" stroke="#047857" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
