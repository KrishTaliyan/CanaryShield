import { Bot, Clock, History, OctagonX, Play, ShieldAlert, Sparkles, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import type { ChaosRequest } from "../api/types";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button, { ButtonLink } from "../components/ui/Button";
import Card, { CardHeader } from "../components/ui/Card";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import { ProgressBar } from "../components/ui/Progress";
import { SkeletonCard } from "../components/ui/Skeleton";
import Slider from "../components/ui/Slider";
import { EmptyState, ErrorState } from "../components/ui/States";
import { FlagStatusBadge, HealthIndicator } from "../components/ui/StatusBadge";
import { usePreferences, useToast } from "../hooks/useAppContext";
import { useChaos, useChaosActions, useChaosLog, useIncidents, useLiveTraffic } from "../hooks/useData";
import { useFlag, useFlagHealth } from "../hooks/useFlag";
import { useNow } from "../hooks/useUi";
import { chaosLog } from "../lib/chaosLog";
import { cn } from "../lib/cn";
import { formatCountdown, formatDateTime, formatDuration, formatRate, formatRelative, formatRps } from "../lib/format";

/** QuickCart's payment route evaluates this flag (quickcart/server/src/routes/pay.js). */
const chaosFlagKey = "new_payment_flow";

const presets = [
  { id: "demo", label: "Demo failure", description: "40% errors for 2 minutes", errorPercent: 40, latencyMs: 0, latencyPercent: 0, durationSec: 120 },
  { id: "mild", label: "Mild errors", description: "5% errors for 3 minutes", errorPercent: 5, latencyMs: 0, latencyPercent: 0, durationSec: 180 },
  { id: "latency", label: "Latency spike", description: "+800 ms on half of payments", errorPercent: 0, latencyMs: 800, latencyPercent: 50, durationSec: 120 },
];

function describe(config: { errorRate: number; latencyMs?: number; latencyRate?: number; durationSec?: number }) {
  const { errorRate, latencyMs = 0, latencyRate = 0, durationSec = 120 } = config;
  const parts = [];
  if (errorRate > 0) parts.push(`${Math.round(errorRate * 100)}% errors`);
  if (latencyMs > 0 && latencyRate > 0) parts.push(`+${latencyMs} ms on ${Math.round(latencyRate * 100)}%`);
  return `${parts.join(", ") || "No faults"} · ${formatDuration(durationSec * 1000)}`;
}

export default function Chaos() {
  const toast = useToast();
  const [preferences, updatePreferences] = usePreferences();
  const chaos = useChaos();
  const { start, stop } = useChaosActions();
  const log = useChaosLog();
  const flag = useFlag(chaosFlagKey);
  const health = useFlagHealth(chaosFlagKey);
  const incidents = useIncidents();
  const traffic = useLiveTraffic();

  const [errorPercent, setErrorPercent] = useState(preferences.chaosErrorPercent);
  const [latencyMs, setLatencyMs] = useState(preferences.chaosLatencyMs);
  const [latencyPercent, setLatencyPercent] = useState(preferences.chaosLatencyMs > 0 ? 50 : 0);
  const [durationSec, setDurationSec] = useState(preferences.chaosDurationSec);
  const [confirming, setConfirming] = useState(false);

  const config = chaos.data;
  const now = useNow(1000, Boolean(config?.active));
  const remaining = config?.active && config.activeUntil ? Date.parse(config.activeUntil) - now : 0;
  const active = Boolean(config?.active) && remaining > 0;
  const elapsed = config?.active ? config.durationSec * 1000 - remaining : 0;

  const request: ChaosRequest = { errorRate: errorPercent / 100, latencyMs, latencyRate: latencyPercent / 100, durationSec };
  const target = flag.data;
  const guardrail = target?.guardrail;
  const rolling = target?.status === "rolling_out" || target?.status === "paused";
  const lastSample = traffic.samples[traffic.samples.length - 1];
  const canaryPer30s = lastSample ? lastSample.rpsNew * 30 : null;
  const willBreach = Boolean(guardrail?.enabled && request.errorRate > (guardrail?.errorRateThreshold ?? 1));
  const noFaults = request.errorRate === 0 && (request.latencyMs === 0 || request.latencyRate === 0);
  const since = Date.now() - 60 * 60_000;
  const recentRollbacks = (incidents.data?.incidents ?? []).filter((incident) => Date.parse(incident.rolledBackAt) > since);

  function applyPreset(preset: (typeof presets)[number]) {
    setErrorPercent(preset.errorPercent);
    setLatencyMs(preset.latencyMs);
    setLatencyPercent(preset.latencyPercent);
    setDurationSec(preset.durationSec);
    toast({ tone: "info", title: `Preset “${preset.label}” loaded`, description: "Nothing starts until you confirm." });
  }

  async function confirmStart() {
    try {
      const result = await start.mutateAsync(request);
      chaosLog.record("started", result);
      updatePreferences({ chaosErrorPercent: errorPercent, chaosDurationSec: durationSec, chaosLatencyMs: latencyMs });
      setConfirming(false);
      toast({ tone: "warning", title: "Chaos experiment started", description: describe(result) });
    } catch (error) {
      toast({ tone: "error", title: "Could not start chaos", description: error instanceof Error ? error.message : undefined });
    }
  }

  async function emergencyStop() {
    const before = config;
    try {
      await stop.mutateAsync();
      if (before) chaosLog.record("stopped", before);
      toast({ tone: "success", title: "Chaos stopped", description: "QuickCart's new payment flow is back to normal." });
    } catch (error) {
      toast({ tone: "error", title: "Could not stop chaos", description: error instanceof Error ? error.message : undefined });
    }
  }

  const impact = (
    <div className="space-y-2">
      <p>
        For {formatDuration(durationSec * 1000)}, {errorPercent > 0 ? `${errorPercent}% of payments on QuickCart's new payment flow will fail` : "no payments will fail"}
        {latencyMs > 0 && latencyPercent > 0 ? `, and ${latencyPercent}% will be ${latencyMs} ms slower` : ""}. The stable flow is never affected.
      </p>
      {!target ? (
        flag.error instanceof ApiError && flag.error.status === 404
          ? <p>The flag <code className="font-mono">{chaosFlagKey}</code> does not exist, so no traffic uses the new flow. Run scripts/seed.sh to create it.</p>
          : <p className="text-warning">Could not load <code className="font-mono">{chaosFlagKey}</code>{flag.error ? `: ${flag.error.message}` : ""}. The guardian's reaction cannot be predicted until the platform answers.</p>
      ) : !rolling ? (
        <p className="text-warning">
          <code className="font-mono">{chaosFlagKey}</code> is {target.status.replace("_", " ")} at {target.rolloutPercentage}%. Almost no payments use the new flow, so the guardian has nothing to judge. Start a rollout first.
        </p>
      ) : !guardrail?.enabled ? (
        <p className="text-warning">The guardrail on {chaosFlagKey} is off, so the guardian will not roll it back. You will only see the errors in the charts.</p>
      ) : willBreach ? (
        <p>
          That is above the {formatRate(guardrail.errorRateThreshold, 1)} threshold. Once at least {guardrail.minSamples} canary payments arrive per 30 seconds, the guardian should roll{" "}
          {chaosFlagKey} back after {guardrail.consecutiveBreaches} failing checks, about {guardrail.consecutiveBreaches * 5} seconds, and open an incident.
        </p>
      ) : (
        <p>That stays at or below the {formatRate(guardrail.errorRateThreshold, 1)} threshold, so the guardian should not roll back.{latencyMs > 0 ? " Latency alone never triggers a rollback: the guardian watches errors only." : ""}</p>
      )}
      {rolling && canaryPer30s !== null && guardrail && canaryPer30s < guardrail.minSamples && (
        <p className="text-warning">
          Right now only about {Math.round(canaryPer30s)} canary payments arrive per 30 seconds ({formatRps(lastSample?.rpsNew)}); {guardrail.minSamples} are needed. <Link to="/load-generator" className="font-semibold underline">Run the load generator</Link> to produce enough traffic.
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Chaos testing"
        description="Deliberately break QuickCart's new payment flow to prove that the guardian catches it and rolls back on its own."
        meta={
          chaos.isError
            ? <Badge tone="danger" dot>QuickCart unreachable</Badge>
            : active
              ? <Badge tone="danger" variant="solid" dot pulse size="md">Experiment running</Badge>
              : <Badge tone="success" dot size="md">No experiment running</Badge>
        }
      />

      {chaos.isError && (
        <ErrorState title="Chaos controls unavailable" message={`${chaos.error.message} Chaos is injected by the QuickCart server on :4000.`} onRetry={() => void chaos.refetch()} retrying={chaos.isFetching} />
      )}

      {active && config && (
        <Card tone="danger" className="border-danger/40">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-control bg-danger text-on-danger shadow-raised-sm" aria-hidden="true">
                  <Zap size={20} />
                  <span className="absolute inset-0 animate-ping rounded-control bg-danger/40" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-ink">Chaos is running on the new payment flow</p>
                  <p className="text-sm text-ink-muted">{describe(config)}</p>
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 text-ink-muted"><Clock size={14} aria-hidden="true" /> Ends automatically in</span>
                  <span className="font-mono text-2xl font-semibold tabular text-ink" aria-live="off">{formatCountdown(remaining)}</span>
                </div>
                <ProgressBar value={elapsed} max={config.durationSec * 1000} tone="danger" size="md" label="Chaos experiment progress" />
              </div>
              <div className="flex flex-wrap items-center gap-3 rounded-control bg-surface/70 px-3 py-2.5 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-ink"><Bot size={15} aria-hidden="true" /> Guardian on {chaosFlagKey}</span>
                {health.data && <HealthIndicator status={health.data.status} live />}
                <span className="tabular text-ink-muted">canary errors {formatRate(health.data?.canaryErrorRate)}</span>
                {health.data && guardrail && <span className="tabular text-ink-muted">breaches {health.data.breachCount}/{guardrail.consecutiveBreaches}</span>}
                <Link to={`/flags/${chaosFlagKey}?tab=health`} className="ml-auto text-xs font-semibold text-accent hover:underline">Watch live</Link>
              </div>
            </div>
            <Button variant="danger" size="lg" icon={<OctagonX size={20} />} loading={stop.isPending} onClick={() => void emergencyStop()} className="h-14 px-7 text-base">
              Emergency stop
            </Button>
          </div>
        </Card>
      )}

      {!chaos.isError && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader icon={<Zap size={18} />} title={active ? "Next experiment" : "Configure the experiment"} description="Only QuickCart's new payment flow is affected. Limits come from QuickCart." />
            <div className="mb-5 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className="rounded-control border border-line bg-surface-2/70 px-3 py-2 text-left transition-all hover:-translate-y-px hover:border-accent/40">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Sparkles size={14} className="text-accent" aria-hidden="true" />{preset.label}</span>
                  <span className="block text-xs text-ink-muted">{preset.description}</span>
                </button>
              ))}
            </div>
            <div className="space-y-5">
              <Slider label="Error rate" value={errorPercent} onChange={setErrorPercent} min={0} max={100} step={5} format={(value) => `${value}%`} tone="danger" marks={guardrail ? [Math.round(guardrail.errorRateThreshold * 100)] : undefined} hint={guardrail ? `The ${chaosFlagKey} threshold is ${formatRate(guardrail.errorRateThreshold, 1)}.` : undefined} />
              <Slider label="Extra latency" value={latencyMs} onChange={setLatencyMs} min={0} max={5000} step={100} format={(value) => `${value} ms`} tone="warning" />
              <Slider label="Share of payments slowed" value={latencyPercent} onChange={setLatencyPercent} min={0} max={100} step={5} format={(value) => `${value}%`} tone="warning" disabled={latencyMs === 0} hint={latencyMs === 0 ? "Set extra latency first." : undefined} />
              <Slider label="Duration" value={durationSec} onChange={setDurationSec} min={10} max={600} step={10} format={(value) => formatDuration(value * 1000)} />
            </div>
          </Card>

          <Card className="flex flex-col">
            <CardHeader icon={<ShieldAlert size={18} />} title="What will happen" description="Worked out from the live flag, guardrail and traffic." />
            {flag.isPending && !flag.isError ? <SkeletonCard className="shadow-none" /> : (
              <div className="flex-1 space-y-4 text-sm text-ink-muted">
                {target && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-ink">{chaosFlagKey}</span>
                    <FlagStatusBadge status={target.status} />
                    <span className="tabular">{target.rolloutPercentage}% rollout</span>
                  </div>
                )}
                {impact}
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
              <Button variant="danger" icon={<Play size={16} />} onClick={() => setConfirming(true)} disabled={noFaults || start.isPending || chaos.isPending}>
                {active ? "Replace running experiment" : "Start experiment"}
              </Button>
              {!rolling && target && <ButtonLink to={`/flags/${chaosFlagKey}?tab=rollout`} variant="ghost">Start a rollout first</ButtonLink>}
              {noFaults && <span className="text-xs text-ink-subtle">Choose an error rate or latency.</span>}
            </div>
          </Card>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            icon={<History size={18} />}
            title="Audit trail"
            description="Experiments started or stopped from this browser. QuickCart itself keeps no chaos history."
            actions={log.length > 0 && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => { chaosLog.clear(); toast({ tone: "info", title: "Local chaos history cleared" }); }}>Clear</Button>}
          />
          {log.length === 0 ? (
            <EmptyState compact icon={<History size={20} />} title="No experiments recorded here yet" />
          ) : (
            <ul className="divide-y divide-line/70">
              {log.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Badge tone={entry.action === "started" ? "danger" : "success"}>{entry.action === "started" ? "Started" : "Stopped early"}</Badge>
                  <span className="text-sm text-ink">{describe(entry)}</span>
                  <span className="ml-auto text-xs tabular text-ink-subtle" title={formatDateTime(entry.at, true)}>{formatRelative(entry.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader
            icon={<Bot size={18} />}
            title="Guardian rollbacks in the last hour"
            description="Real incidents from the platform. Compare their times with the experiments on the left."
            actions={<ButtonLink to="/incidents" size="sm" variant="ghost">All incidents</ButtonLink>}
          />
          {incidents.isPending ? <SkeletonCard className="shadow-none" /> : recentRollbacks.length === 0 ? (
            <EmptyState compact icon={<ShieldAlert size={20} />} title="No automatic rollbacks in the last hour" />
          ) : (
            <ul className="divide-y divide-line/70">
              {recentRollbacks.map((incident) => (
                <li key={incident.id}>
                  <Link to={`/incidents/${incident.id}`} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:text-accent")}>
                    <span className="font-mono text-[13px] font-semibold text-ink">{incident.flagKey}</span>
                    <span className="text-sm tabular text-ink-muted">{formatRate(incident.observedErrorRate)} errors · rolled back in {formatDuration(Date.parse(incident.rolledBackAt) - Date.parse(incident.firstBreachAt))}</span>
                    <span className="ml-auto text-xs tabular text-ink-subtle">{formatRelative(incident.rolledBackAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Alert tone="warning" title="Use chaos only on your local demo">
        These faults hit every shopper on the new payment flow for the whole duration. There is no per-user targeting.
      </Alert>

      <ConfirmDialog
        open={confirming}
        onClose={() => !start.isPending && setConfirming(false)}
        title={active ? "Replace the running experiment?" : "Start a chaos experiment?"}
        tone="danger"
        current={{ label: "Now", value: active && config ? describe(config) : "Normal", hint: "New payment flow" }}
        after={{ label: "For the next " + formatDuration(durationSec * 1000), value: describe(request).split(" · ")[0] }}
        impact={impact}
        confirmLabel="Start experiment"
        onConfirm={() => void confirmStart()}
        busy={start.isPending}
        error={start.error?.message ?? null}
      />
    </div>
  );
}
