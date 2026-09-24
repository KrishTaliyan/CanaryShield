import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bot, CheckCircle2, Clock, ExternalLink, Flag as FlagIcon, Percent, ShieldAlert, ShieldCheck, Siren, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { getIncident } from "../api/incidents";
import type { MetricsRange } from "../api/types";
import { ErrorRateChart } from "../components/health/CanaryCharts";
import ResolveDialog from "../components/incidents/ResolveDialog";
import SeverityBadge from "../components/incidents/SeverityBadge";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button, { ButtonLink } from "../components/ui/Button";
import Card, { CardHeader } from "../components/ui/Card";
import MetricCard from "../components/ui/MetricCard";
import PageHeader from "../components/ui/PageHeader";
import { SkeletonCard } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/States";
import Timeline, { type TimelineItem } from "../components/ui/Timeline";
import { usePollingFallback } from "../hooks/useEventStream";
import { useFlagEvents } from "../hooks/useFlag";
import { useMetrics } from "../hooks/useMetrics";
import { actorLabel, eventConfig, percentageChange } from "../lib/events";
import { formatDateTime, formatDuration, formatNumber, formatRate } from "../lib/format";
import { incidentDuration, incidentSeverity } from "../lib/severity";
import { timeRanges } from "../lib/timeRanges";

const rangeSeconds: Record<MetricsRange, number> = { "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "6h": 21600, "24h": 86400 };

/** Smallest chart range that still shows the incident, or null if it is older than 24 h. */
function rangeCovering(since: string): MetricsRange | null {
  const seconds = (Date.now() - Date.parse(since)) / 1000 + 120;
  return timeRanges.find((range) => rangeSeconds[range.value] >= seconds)?.value ?? null;
}

export default function IncidentDetail() {
  const { id = "" } = useParams();
  const refetchInterval = usePollingFallback();
  const [resolving, setResolving] = useState(false);
  const query = useQuery({ queryKey: ["incidents", "detail", id], queryFn: () => getIncident(id), refetchInterval, enabled: Boolean(id) });
  const incident = query.data;
  const events = useFlagEvents(incident?.flagKey ?? "");
  const range = incident ? rangeCovering(incident.firstBreachAt) : null;
  const metrics = useMetrics(range ? incident?.flagKey : undefined, range ?? "5m");

  const timeline = useMemo<TimelineItem[]>(() => {
    if (!incident) return [];
    const start = Date.parse(incident.firstBreachAt) - 30 * 60_000;
    const end = incident.resolvedAt ? Date.parse(incident.resolvedAt) + 60_000 : Date.now();
    const items: Array<TimelineItem & { at: number }> = [
      {
        id: "breach",
        at: Date.parse(incident.firstBreachAt),
        title: "First breached check",
        time: formatDateTime(incident.firstBreachAt, true),
        description: `Canary error rate went above the ${formatRate(incident.threshold, 1)} threshold.`,
        icon: <ShieldAlert size={15} />,
        tone: "warning",
      },
      {
        id: "rollback",
        at: Date.parse(incident.rolledBackAt),
        title: "Guardian rolled back automatically",
        time: formatDateTime(incident.rolledBackAt, true),
        description: incident.reason,
        icon: <Bot size={15} />,
        tone: "danger",
        highlight: true,
      },
    ];
    if (incident.resolvedAt) {
      items.push({ id: "resolved", at: Date.parse(incident.resolvedAt), title: "Incident resolved", time: formatDateTime(incident.resolvedAt, true), icon: <CheckCircle2 size={15} />, tone: "success" });
    }
    for (const event of events.data?.events ?? []) {
      const at = Date.parse(event.createdAt);
      if (at < start || at > end) continue;
      // The guardian's own rollback event duplicates the milestone above.
      if (event.type === "rolled_back" && event.actor === "system:guardian" && Math.abs(at - Date.parse(incident.rolledBackAt)) < 5000) continue;
      const config = eventConfig[event.type];
      const Icon = config?.icon ?? FlagIcon;
      items.push({
        id: `event-${event.id}`,
        at,
        title: `${config?.label ?? event.type}${percentageChange(event) ? ` · ${percentageChange(event)}` : ""}`,
        time: formatDateTime(event.createdAt, true),
        meta: actorLabel(event),
        description: event.reason ?? undefined,
        icon: <Icon size={15} />,
        tone: config?.tone ?? "neutral",
      });
    }
    return items.sort((a, b) => a.at - b.at);
  }, [incident, events.data]);

  if (query.isPending) {
    return <div className="space-y-4" aria-busy="true"><SkeletonCard lines={2} /><SkeletonCard lines={5} /></div>;
  }
  if (query.isError || !incident) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <ErrorState
        title={notFound ? "Incident not found" : "Could not load the incident"}
        message={notFound ? "It may have been removed, or the link is wrong." : query.error?.message}
        onRetry={notFound ? undefined : () => void query.refetch()}
        className="mt-10"
      />
    );
  }

  const severity = incidentSeverity(incident);
  const timeToRollback = Date.parse(incident.rolledBackAt) - Date.parse(incident.firstBreachAt);
  const open = incident.status === "open";

  return (
    <div className="space-y-5">
      <Link to="/incidents" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden="true" /> Incidents
      </Link>
      <PageHeader
        eyebrow={`Incident ${incident.id.slice(0, 8)}`}
        title={<>Automatic rollback of <span className="font-mono">{incident.flagKey}</span></>}
        meta={
          <>
            <SeverityBadge incident={incident} size="md" />
            <Badge tone={open ? "danger" : "neutral"} dot={open} pulse={open} size="md">{open ? "Open" : "Resolved"}</Badge>
            <span className="text-xs text-ink-subtle">{formatDateTime(incident.rolledBackAt)}</span>
          </>
        }
        actions={
          <>
            <ButtonLink to={`/flags/${incident.flagKey}?tab=rollout`} icon={<ExternalLink size={15} />}>Open flag</ButtonLink>
            {open && <Button variant="primary" icon={<CheckCircle2 size={16} />} onClick={() => setResolving(true)}>Resolve</Button>}
          </>
        }
      />

      <Alert tone={open ? "danger" : "info"} title="What happened" icon={<Siren size={18} />}>
        The canary error rate reached <strong>{formatRate(incident.observedErrorRate)}</strong> against a {formatRate(incident.threshold, 1)} threshold
        {incident.baselineErrorRate !== null && <> (the stable version was at {formatRate(incident.baselineErrorRate)})</>} while {incident.exposedPercentage}% of
        traffic was on the new version. The guardian rolled back {formatDuration(timeToRollback)} after the first breached check
        {incident.exposedUsers !== null && <>; {formatNumber(incident.exposedUsers)} users had been served the new version</>}.
        {open ? " The flag stays at 0% until someone starts a new rollout." : ""}
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Canary error rate" value={formatRate(incident.observedErrorRate)} icon={<ShieldAlert size={18} />} status={{ tone: "danger", label: `${(incident.observedErrorRate / Math.max(incident.threshold, 1e-9)).toFixed(1)}× threshold` }} context={`Threshold ${formatRate(incident.threshold, 1)} · baseline ${formatRate(incident.baselineErrorRate)}`} />
        <MetricCard label="Traffic exposed" value={`${incident.exposedPercentage}%`} icon={<Percent size={18} />} context={`${Math.max(0, 100 - incident.exposedPercentage)}% of traffic was never affected`} explanation="The rollout percentage when the guardian acted." />
        <MetricCard label="Users exposed" value={incident.exposedUsers === null ? "—" : formatNumber(incident.exposedUsers)} icon={<Users size={18} />} context={`${formatNumber(incident.sampleSize)} canary requests in the last check`} explanation="Distinct users served the new version since the rollout started." />
        <MetricCard label="Time to rollback" value={formatDuration(timeToRollback)} icon={<Clock size={18} />} context={open ? `Open for ${formatDuration(incidentDuration(incident))}` : `Resolved after ${formatDuration(incidentDuration(incident))}`} explanation="From the first breached check to the automatic rollback." />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader icon={<Clock size={18} />} title="Timeline" description="Incident milestones and changes to the flag around it, oldest first." />
          {events.isPending ? <SkeletonCard className="shadow-none" /> : <Timeline items={timeline} />}
        </Card>
        <div className="space-y-4">
          {range ? (
            <ErrorRateChart
              metrics={metrics.data}
              loading={metrics.isPending}
              error={metrics.isError && !metrics.data ? metrics.error.message : null}
              onRetry={() => void metrics.refetch()}
              actions={<Badge tone="neutral">Last {range}</Badge>}
            />
          ) : (
            <Alert tone="info" title="Chart not available">Metrics are kept for the last 24 hours. This incident is older.</Alert>
          )}
          <Card>
            <CardHeader icon={<ShieldCheck size={18} />} title="Severity (derived)" />
            <p className="text-sm text-ink-muted">{severity.reason}</p>
            <p className="mt-2 text-xs text-ink-subtle">
              The platform does not store a severity. It is derived from how far the error rate went past the threshold (10× critical, 4× high, 2× medium)
              and how much traffic was exposed (50% critical, 25% high).
            </p>
          </Card>
        </div>
      </div>

      <ResolveDialog incident={resolving ? incident : null} onClose={() => setResolving(false)} />
    </div>
  );
}
