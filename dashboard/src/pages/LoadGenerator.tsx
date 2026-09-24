import { Check, Copy, Gauge, Terminal, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card, { CardHeader } from "../components/ui/Card";
import ChartContainer from "../components/ui/ChartContainer";
import { Field, Input } from "../components/ui/Field";
import MetricCard from "../components/ui/MetricCard";
import PageHeader from "../components/ui/PageHeader";
import SegmentedControl from "../components/ui/SegmentedControl";
import { useToast } from "../hooks/useAppContext";
import { useLiveTraffic } from "../hooks/useData";
import { useChartColors } from "../hooks/useUi";
import { quickcartUrl } from "../api/quickcart";
import { formatClock, formatNumber, formatRate, formatRps } from "../lib/format";

type Shell = "powershell" | "bash";

function tooltipStyle(colors: ReturnType<typeof useChartColors>) {
  return {
    contentStyle: { background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 12, fontSize: 12.5, color: colors.text },
    labelStyle: { color: colors.text, fontWeight: 600 },
  };
}

export default function LoadGenerator() {
  const toast = useToast();
  const colors = useChartColors();
  const traffic = useLiveTraffic();
  const [rps, setRps] = useState("30");
  const [users, setUsers] = useState("5000");
  const [minutes, setMinutes] = useState("30");
  const [shell, setShell] = useState<Shell>("powershell");
  const [copied, setCopied] = useState(false);

  const last = traffic.samples[traffic.samples.length - 1];
  const total = last ? last.rpsNew + last.rpsOld : null;
  const receiving = total !== null && total > 0.05;
  const counters = traffic.counters;
  const allTime = counters ? counters.oldSuccess + counters.oldError + counters.newSuccess + counters.newError : null;

  const rows = useMemo(() => traffic.samples.map((sample) => ({
    time: sample.at / 1000,
    canary: sample.rpsNew,
    baseline: sample.rpsOld,
    canaryErrors: sample.errorRateNew === null ? undefined : sample.errorRateNew * 100,
    baselineErrors: sample.errorRateOld === null ? undefined : sample.errorRateOld * 100,
  })), [traffic.samples]);

  const valid = Number(rps) > 0 && Number(rps) <= 1000 && Number.isInteger(Number(users)) && Number(users) > 0 && Number(minutes) > 0;
  const args = `-target ${quickcartUrl} -rps ${rps || "30"} -users ${users || "5000"} -duration ${minutes || "30"}m`;
  const command = shell === "powershell" ? `cd loadgen; go run . ${args}` : `cd loadgen && go run . ${args}`;

  function copy() {
    void navigator.clipboard?.writeText(command).then(
      () => {
        setCopied(true);
        toast({ tone: "success", title: "Command copied", description: "Paste it in a terminal at the repository root." });
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => toast({ tone: "error", title: "Could not copy", description: "Your browser blocked clipboard access. Select the text instead." }),
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Load generator"
        description="Simulated shoppers give the guardian enough canary traffic to judge. This page shows the traffic QuickCart is actually receiving and the command that produces it."
        meta={
          traffic.error
            ? <Badge tone="danger" dot>QuickCart unreachable</Badge>
            : receiving
              ? <Badge tone="success" dot pulse>Receiving traffic</Badge>
              : <Badge tone="neutral" dot>{last ? "No traffic right now" : "Measuring…"}</Badge>
        }
      />

      <Alert tone="info" title="Start and stop the load generator from a terminal" icon={<Terminal size={18} />}>
        It is a separate Go program on your machine. A web page cannot start processes, so there is no start button here.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Payment traffic" value={total === null ? "—" : formatRps(total).replace(" req/s", "")} unit={total === null ? undefined : "req/s"} icon={<Gauge size={18} />} loading={traffic.isPending} context="Sampled from QuickCart's counters every 5 s" />
        <MetricCard label="Canary share" value={last && total ? `${Math.round((last.rpsNew / total) * 100)}%` : "—"} loading={traffic.isPending} context={last ? `${formatRps(last.rpsNew)} on the new flow` : undefined} explanation="Share of payments that went through the new payment flow in the last 5 seconds." />
        <MetricCard label="Canary errors" value={formatRate(last?.errorRateNew)} loading={traffic.isPending} status={last?.errorRateNew != null && last.errorRateNew > 0.03 ? { tone: "danger", label: "High" } : undefined} context={`Stable flow ${formatRate(last?.errorRateOld)}`} />
        <MetricCard label="Payments since start" value={allTime === null ? "—" : formatNumber(allTime)} loading={traffic.isPending} context="Since the QuickCart server last restarted" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartContainer
          title="Requests per second"
          subtitle="Since this page opened (up to 5 minutes)"
          legend={[{ label: "Canary (new flow)", color: colors.canary, swatch: true }, { label: "Baseline (stable flow)", color: colors.baseline, swatch: true }]}
          loading={traffic.isPending}
          error={traffic.error && rows.length === 0 ? traffic.error.message : null}
          empty={rows.length === 0}
          emptyMessage="Waiting for two readings, 5 seconds apart."
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tickFormatter={(value: number) => formatClock(value)} tick={{ fontSize: 11, fill: colors.axis }} stroke={colors.grid} minTickGap={48} />
              <YAxis tick={{ fontSize: 11, fill: colors.axis }} stroke={colors.grid} width={36} />
              <Tooltip {...tooltipStyle(colors)} labelFormatter={(value) => formatClock(Number(value))} formatter={(value) => `${Number(value).toFixed(1)} req/s`} />
              <Area type="monotone" dataKey="baseline" name="Baseline" stackId="1" stroke={colors.baseline} fill={colors.baseline} fillOpacity={0.25} isAnimationActive={false} />
              <Area type="monotone" dataKey="canary" name="Canary" stackId="1" stroke={colors.canary} fill={colors.canary} fillOpacity={0.35} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
        <ChartContainer
          title="Error rate"
          subtitle="Share of failed payments per 5-second sample"
          legend={[{ label: "Canary (new flow)", color: colors.canary }, { label: "Baseline (stable flow)", color: colors.baseline, dashed: true }]}
          loading={traffic.isPending}
          error={traffic.error && rows.length === 0 ? traffic.error.message : null}
          empty={rows.length === 0}
          emptyMessage="Waiting for two readings, 5 seconds apart."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tickFormatter={(value: number) => formatClock(value)} tick={{ fontSize: 11, fill: colors.axis }} stroke={colors.grid} minTickGap={48} />
              <YAxis tickFormatter={(value: number) => `${value}%`} tick={{ fontSize: 11, fill: colors.axis }} stroke={colors.grid} width={44} />
              <Tooltip {...tooltipStyle(colors)} labelFormatter={(value) => formatClock(Number(value))} formatter={(value) => `${Number(value).toFixed(2)}%`} />
              <Line dataKey="baselineErrors" name="Baseline" stroke={colors.baseline} strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
              <Line dataKey="canaryErrors" name="Canary" stroke={colors.canary} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      <Card>
        <CardHeader icon={<Terminal size={18} />} title="Run the load generator" description="Adjust the settings, copy the command and run it from the repository root. Stop it with Ctrl+C." />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Requests per second" hint="30 is plenty for the demo.">
            {(props) => <Input {...props} inputMode="decimal" value={rps} onChange={(event) => setRps(event.target.value)} />}
          </Field>
          <Field label="Simulated users" hint="Distinct shoppers to rotate through.">
            {(props) => <Input {...props} inputMode="numeric" value={users} onChange={(event) => setUsers(event.target.value)} />}
          </Field>
          <Field label="Duration (minutes)">
            {(props) => <Input {...props} inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} />}
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl size="sm" label="Shell" value={shell} onChange={setShell} options={[{ value: "powershell", label: "PowerShell" }, { value: "bash", label: "Bash / macOS" }]} />
          <Button size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copy} disabled={!valid}>{copied ? "Copied" : "Copy command"}</Button>
        </div>
        <pre className="well mt-3 overflow-x-auto p-4 font-mono text-[13px] text-ink">{command}</pre>
        {!valid && <p className="mt-2 flex items-center gap-1.5 text-sm text-danger"><TriangleAlert size={14} aria-hidden="true" /> Enter positive numbers (at most 1,000 requests per second).</p>}
        <p className="mt-3 text-xs text-ink-subtle">Needs Go installed. On Windows, if “go” is not recognised, use the full path: “C:\Program Files\Go\bin\go.exe”.</p>
      </Card>
    </div>
  );
}
