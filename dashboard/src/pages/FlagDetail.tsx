import {
  Activity as ActivityIcon,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Gauge,
  HeartPulse,
  LineChart,
  Pencil,
  Rocket,
  Settings2,
  ShieldAlert,
  Siren,
  Target,
  TestTubeDiagonal,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import type { Flag, Health, Incident } from "../api/types";
import ActivityFeed from "../components/activity/ActivityFeed";
import ConditionsEditor from "../components/flags/ConditionsEditor";
import EditFlagDialog from "../components/flags/EditFlagDialog";
import GuardrailForm from "../components/flags/GuardrailForm";
import OverridesEditor from "../components/flags/OverridesEditor";
import RolloutControl from "../components/flags/RolloutControl";
import CanaryCharts, { ErrorRateChart } from "../components/health/CanaryCharts";
import HealthScoreGauge from "../components/health/HealthScoreGauge";
import TrafficSplit from "../components/health/TrafficSplit";
import SeverityBadge from "../components/incidents/SeverityBadge";
import ReleasePipeline from "../components/pipeline/ReleasePipeline";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button, { ButtonLink } from "../components/ui/Button";
import Card, { CardHeader } from "../components/ui/Card";
import InfoTip from "../components/ui/InfoTip";
import MetricCard from "../components/ui/MetricCard";
import PageHeader from "../components/ui/PageHeader";
import { SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { FlagStatusBadge, HealthIndicator } from "../components/ui/StatusBadge";
import Tabs, { TabPanel } from "../components/ui/Tabs";
import Tooltip from "../components/ui/Tooltip";
import { usePreferences, useToast } from "../hooks/useAppContext";
import { useIncidents } from "../hooks/useData";
import { useFlag, useFlagEvents, useFlagHealth } from "../hooks/useFlag";
import { useMetrics } from "../hooks/useMetrics";
import { downloadFile, timestampForFile, toCsv } from "../lib/download";
import { actorLabel, eventConfig, percentageChange } from "../lib/events";
import { formatDateTime, formatDuration, formatNumber, formatRate, formatRelative, latest } from "../lib/format";
import { computeHealthScore } from "../lib/health";
import { deriveReleases, outcomeLabel, type ReleaseOutcome } from "../lib/releases";
import { healthConfig } from "../lib/status";
import { describeConditions, describeGuardrail } from "../lib/targeting";

type TabId = "overview" | "targeting" | "rollout" | "health" | "metrics" | "incidents" | "activity";
const tabIds: TabId[] = ["overview", "targeting", "rollout", "health", "metrics", "incidents", "activity"];

const outcomeTone: Record<ReleaseOutcome, "info" | "success" | "danger" | "warning"> = {
  in_progress: "info",
  completed: "success",
  auto_rolled_back: "danger",
  rolled_back: "warning",
  killed: "danger",
};

function CopyKey({ value }: { value: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip content={copied ? "Copied" : "Copy key"}>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              toast({ tone: "success", title: "Flag key copied", description: value });
              window.setTimeout(() => setCopied(false), 1500);
            },
            () => toast({ tone: "error", title: "Could not copy", description: "Your browser blocked clipboard access." }),
          );
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-0.5 font-mono text-[12.5px] text-ink-muted hover:text-ink"
      >
        {value}
        {copied ? <Check size={13} className="text-success" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      </button>
    </Tooltip>
  );
}

function GuardianReadings({ health, flag }: { health: Health | undefined; flag: Flag }) {
  const rows = [
    { label: "Canary error rate", value: formatRate(health?.canaryErrorRate), term: "canary" as const },
    { label: "Baseline error rate", value: formatRate(health?.baselineErrorRate), term: "baseline" as const },
    { label: "Threshold", value: formatRate(health?.threshold ?? flag.guardrail.errorRateThreshold, 1), term: "errorThreshold" as const },
    { label: "Canary samples (30 s)", value: health ? `${formatNumber(health.samples)} / ${flag.guardrail.minSamples} needed` : "—", term: "minSamples" as const },
    { label: "Breaches in a row", value: health ? `${health.breachCount} / ${flag.guardrail.consecutiveBreaches}` : "—", term: "consecutiveBreaches" as const },
  ];
  return (
    <Card>
      <CardHeader
        icon={<ShieldAlert size={18} />}
        title="Guardian readings"
        description={health?.checkedAt ? `Last check ${formatRelative(health.checkedAt)} · every 5 s` : "No check recorded yet"}
        actions={health && <HealthIndicator status={health.status} live size="md" />}
      />
      <dl className="divide-y divide-line/70">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
            <dt className="inline-flex items-center gap-1.5 text-sm text-ink-muted">{row.label} <InfoTip term={row.term} /></dt>
            <dd className="text-sm font-semibold tabular text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      {health && <p className="mt-3 text-[13px] text-ink-muted">{healthConfig[health.status].description}</p>}
    </Card>
  );
}

function IncidentList({ incidents }: { incidents: Incident[] }) {
  return (
    <ul className="space-y-3">
      {incidents.map((incident) => (
        <li key={incident.id}>
          <Link to={`/incidents/${incident.id}`} className="surface block p-4 transition-all hover:-translate-y-0.5 hover:shadow-raised-lg">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge incident={incident} />
              <Badge tone={incident.status === "open" ? "danger" : "neutral"} dot={incident.status === "open"}>{incident.status === "open" ? "Open" : "Resolved"}</Badge>
              <span className="ml-auto text-xs tabular text-ink-subtle">{formatDateTime(incident.rolledBackAt)}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-ink">{incident.reason}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Canary errors {formatRate(incident.observedErrorRate)} vs {formatRate(incident.threshold, 1)} threshold · {incident.exposedPercentage}% exposed
              {incident.exposedUsers !== null && ` · ${formatNumber(incident.exposedUsers)} users`}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function FlagDetail() {
  const { key = "" } = useParams();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [preferences, updatePreferences] = usePreferences();
  const [editing, setEditing] = useState(false);

  const flagQuery = useFlag(key);
  const healthQuery = useFlagHealth(key);
  const metricsQuery = useMetrics(key, preferences.chartRange);
  const eventsQuery = useFlagEvents(key);
  const incidentsQuery = useIncidents();

  const requested = params.get("tab") as TabId | null;
  const tab: TabId = requested && tabIds.includes(requested) ? requested : "overview";
  const setTab = (value: TabId) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    return next;
  }, { replace: true });

  const flag = flagQuery.data;
  const events = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data]);
  const releases = useMemo(() => deriveReleases(events), [events]);
  const incidents = (incidentsQuery.data?.incidents ?? []).filter((incident) => incident.flagKey === key);
  const openIncident = incidents.find((incident) => incident.status === "open");
  const score = computeHealthScore(flag, healthQuery.data, metricsQuery.data);

  if (flagQuery.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonCard lines={2} />
        <div className="grid gap-4 md:grid-cols-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      </div>
    );
  }
  if (flagQuery.isError || !flag) {
    const notFound = flagQuery.error instanceof ApiError && flagQuery.error.status === 404;
    return (
      <ErrorState
        title={notFound ? `No flag called “${key}”` : "Could not load the flag"}
        message={notFound ? "It may have been mistyped. Check the key or pick a flag from the list." : flagQuery.error?.message}
        onRetry={notFound ? undefined : () => void flagQuery.refetch()}
        className="mt-10"
      />
    );
  }

  function exportActivity() {
    const csv = toCsv(
      ["id", "time", "event", "change", "actor", "reason"],
      events.map((event) => [event.id, event.createdAt, eventConfig[event.type]?.label ?? event.type, percentageChange(event) ?? "", actorLabel(event), event.reason ?? ""]),
    );
    downloadFile(`${key}-activity-${timestampForFile()}.csv`, csv, "text/csv");
    toast({ tone: "success", title: `Exported ${events.length} events` });
  }

  const canaryRps = latest(metricsQuery.data?.series.rpsNew);
  const baselineRps = latest(metricsQuery.data?.series.rpsOld);

  const tabs = [
    { value: "overview" as const, label: "Overview", icon: <Gauge size={15} /> },
    { value: "targeting" as const, label: "Targeting", icon: <Target size={15} /> },
    { value: "rollout" as const, label: "Rollout", icon: <Rocket size={15} /> },
    { value: "health" as const, label: "Health", icon: <HeartPulse size={15} />, badge: flag.healthStatus === "WARNING" || flag.healthStatus === "BREACHED" ? <span className="h-2 w-2 rounded-full bg-danger" aria-label="needs attention" /> : undefined },
    { value: "metrics" as const, label: "Metrics", icon: <LineChart size={15} /> },
    { value: "incidents" as const, label: "Incidents", icon: <Siren size={15} />, badge: incidents.length ? <Badge tone={openIncident ? "danger" : "neutral"}>{incidents.length}</Badge> : undefined },
    { value: "activity" as const, label: "Activity", icon: <ActivityIcon size={15} /> },
  ];

  return (
    <div>
      <Link to="/flags" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden="true" /> Feature flags
      </Link>
      <PageHeader
        eyebrow="Feature flag"
        title={flag.name}
        description={flag.description || undefined}
        meta={
          <>
            <CopyKey value={flag.key} />
            <FlagStatusBadge status={flag.status} />
            <HealthIndicator status={healthQuery.data?.status ?? flag.healthStatus} live />
            <span className="text-xs text-ink-subtle">v{flag.version} · updated {formatRelative(flag.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>Edit details</Button>
            <ButtonLink to={`/playground?flag=${encodeURIComponent(flag.key)}`} icon={<TestTubeDiagonal size={15} />}>Test in playground</ButtonLink>
            <ButtonLink to="/chaos" icon={<Zap size={15} />}>Chaos testing</ButtonLink>
          </>
        }
      />

      {openIncident && (
        <Alert
          tone="danger"
          title="The guardian rolled this flag back automatically"
          className="mb-5"
          icon={<ShieldAlert size={18} />}
          action={<ButtonLink to={`/incidents/${openIncident.id}`} size="sm" variant="danger">View incident</ButtonLink>}
        >
          {openIncident.reason}
        </Alert>
      )}

      <Tabs items={tabs} value={tab} onChange={setTab} label="Flag sections" idPrefix="flag" className="mb-5" />

      {tab === "overview" && (
        <TabPanel idPrefix="flag" value="overview" className="space-y-5">
          <ReleasePipeline flag={flag} health={healthQuery.data} metrics={metricsQuery.data} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Rollout" value={`${flag.rolloutPercentage}%`} icon={<Rocket size={18} />} explanation="Percentage of eligible traffic on the new version." context={flag.status === "draft" ? "Not started" : `Steps: ${flag.rolloutSteps.join(" · ")}%`} />
            <MetricCard
              label="Health score"
              value={score.score ?? "—"}
              unit={score.score !== null ? "/100" : undefined}
              icon={<HeartPulse size={18} />}
              status={{ tone: healthConfig[healthQuery.data?.status ?? flag.healthStatus].tone, label: healthConfig[healthQuery.data?.status ?? flag.healthStatus].label }}
              explanation="Derived 0–100 summary. Open the Health tab for the breakdown."
              context={score.summary}
            />
            <MetricCard
              label="Canary error rate"
              value={formatRate(healthQuery.data?.canaryErrorRate)}
              icon={<ShieldAlert size={18} />}
              loading={healthQuery.isPending}
              context={`Threshold ${formatRate(flag.guardrail.errorRateThreshold, 1)} · baseline ${formatRate(healthQuery.data?.baselineErrorRate)}`}
              explanation="Failed payments on the new version over the last 30 seconds."
            />
            <Card padding="md">
              <p className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">Measured traffic split <InfoTip text="Latest requests per second on each version, from Prometheus." /></p>
              <TrafficSplit canaryRps={canaryRps} baselineRps={baselineRps} rolloutPercentage={flag.rolloutPercentage} size={104} />
            </Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader icon={<Settings2 size={18} />} title="Configuration" actions={<Button size="sm" variant="ghost" onClick={() => setTab("targeting")}>Edit targeting</Button>} />
              <dl className="divide-y divide-line/70">
                {[
                  { label: "Enabled", value: flag.enabled ? "Yes" : "No (kill switch used)" },
                  { label: "Variants", value: `${flag.controlVariant} → ${flag.treatmentVariant}` },
                  { label: "Eligible users", value: describeConditions(flag.conditions) },
                  { label: "Always on", value: flag.overrides.include.length ? flag.overrides.include.join(", ") : "None" },
                  { label: "Always off", value: flag.overrides.exclude.length ? flag.overrides.exclude.join(", ") : "None" },
                  { label: "Guardrail", value: describeGuardrail(flag.guardrail) },
                  { label: "Created", value: formatDateTime(flag.createdAt) },
                  { label: "Last updated", value: formatDateTime(flag.updatedAt) },
                ].map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
                    <dt className="w-32 shrink-0 text-sm text-ink-muted">{row.label}</dt>
                    <dd className="min-w-0 break-words text-sm text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card>
              <CardHeader icon={<ActivityIcon size={18} />} title="Recent activity" actions={<Button size="sm" variant="ghost" onClick={() => setTab("activity")}>Full history</Button>} />
              {eventsQuery.isPending ? <SkeletonCard className="shadow-none" lines={4} /> : events.length === 0 ? (
                <EmptyState compact title="No activity yet" />
              ) : (
                <ActivityFeed events={events.slice(0, 5)} compact />
              )}
            </Card>
          </div>
        </TabPanel>
      )}

      {tab === "targeting" && (
        <TabPanel idPrefix="flag" value="targeting" className="space-y-5">
          <Alert tone="info" title="How a user is evaluated">
            Excluded users always get the stable version, then included users get the new one. Everyone else must match the
            conditions, and then falls inside or outside the rollout percentage by a stable bucket from their user ID.
          </Alert>
          <ConditionsEditor flagKey={flag.key} conditions={flag.conditions} />
          <OverridesEditor flagKey={flag.key} overrides={flag.overrides} />
        </TabPanel>
      )}

      {tab === "rollout" && (
        <TabPanel idPrefix="flag" value="rollout" className="space-y-5">
          <RolloutControl flag={flag} />
          <Card>
            <CardHeader icon={<Rocket size={18} />} title="Rollout history" description="Each start of a rollout until it completed, was rolled back or killed. Rebuilt from the activity log." />
            {eventsQuery.isPending ? <SkeletonCard className="shadow-none" /> : releases.length === 0 ? (
              <EmptyState compact title="No rollouts yet" description="Start a rollout to create the first entry." />
            ) : (
              <ul className="divide-y divide-line/70">
                {releases.map((release) => (
                  <li key={release.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <Badge tone={outcomeTone[release.outcome]} dot={release.outcome === "in_progress"} pulse={release.outcome === "in_progress"}>{outcomeLabel[release.outcome]}</Badge>
                    <span className="text-sm tabular text-ink">Peak {release.peakPercentage}%</span>
                    <span className="text-sm tabular text-ink-muted">
                      {formatDateTime(release.startedAt)} · {release.endedAt ? formatDuration(Date.parse(release.endedAt) - Date.parse(release.startedAt)) : "running"}
                    </span>
                    {release.endReason && <span className="w-full truncate text-xs text-ink-muted" title={release.endReason}>{release.endReason}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>
      )}

      {tab === "health" && (
        <TabPanel idPrefix="flag" value="health" className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Card className="flex flex-col items-center justify-center">
              <HealthScoreGauge health={score} />
            </Card>
            <GuardianReadings health={healthQuery.data} flag={flag} />
          </div>
          <ErrorRateChart
            metrics={metricsQuery.data}
            loading={metricsQuery.isPending}
            error={metricsQuery.isError && !metricsQuery.data ? metricsQuery.error.message : null}
            onRetry={() => void metricsQuery.refetch()}
          />
          <GuardrailForm flagKey={flag.key} guardrail={flag.guardrail} />
        </TabPanel>
      )}

      {tab === "metrics" && (
        <TabPanel idPrefix="flag" value="metrics">
          <CanaryCharts flagKey={flag.key} range={preferences.chartRange} onRangeChange={(chartRange) => updatePreferences({ chartRange })} />
        </TabPanel>
      )}

      {tab === "incidents" && (
        <TabPanel idPrefix="flag" value="incidents">
          {incidentsQuery.isPending ? <SkeletonCard /> : incidentsQuery.isError ? (
            <ErrorState message={incidentsQuery.error.message} onRetry={() => void incidentsQuery.refetch()} />
          ) : incidents.length === 0 ? (
            <EmptyState icon={<Siren size={22} />} title="No incidents for this flag" description="The guardian has never rolled it back automatically." />
          ) : (
            <IncidentList incidents={incidents} />
          )}
        </TabPanel>
      )}

      {tab === "activity" && (
        <TabPanel idPrefix="flag" value="activity">
          <Card>
            <CardHeader
              icon={<ActivityIcon size={18} />}
              title="Activity"
              description="Every change to this flag, newest first. Guardian actions are highlighted."
              actions={<Button size="sm" icon={<Download size={15} />} onClick={exportActivity} disabled={events.length === 0}>Export CSV</Button>}
            />
            {eventsQuery.isPending ? <SkeletonCard className="shadow-none" lines={5} /> : eventsQuery.isError ? (
              <ErrorState compact message={eventsQuery.error.message} onRetry={() => void eventsQuery.refetch()} />
            ) : events.length === 0 ? (
              <EmptyState compact title="No activity yet" />
            ) : (
              <>
                <ActivityFeed events={events} />
                {events.length >= 50 && <p className="mt-4 text-xs text-ink-subtle">Showing the latest 50 events. The full log is on the Activity page.</p>}
              </>
            )}
          </Card>
        </TabPanel>
      )}

      <EditFlagDialog flag={flag} open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}
