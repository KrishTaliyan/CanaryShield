import {
  Activity as ActivityIcon,
  ArrowRight,
  CheckCircle2,
  Flag as FlagIcon,
  Gauge,
  HeartPulse,
  Plus,
  Rocket,
  ShieldAlert,
  Siren,
  TestTubeDiagonal,
  Trophy,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Flag, HealthStatus } from "../api/types";
import ActivityFeed from "../components/activity/ActivityFeed";
import RolloutProgress from "../components/flags/RolloutProgress";
import { ErrorRateChart } from "../components/health/CanaryCharts";
import HealthScoreGauge from "../components/health/HealthScoreGauge";
import SeverityBadge from "../components/incidents/SeverityBadge";
import ReleasePipeline from "../components/pipeline/ReleasePipeline";
import Alert from "../components/ui/Alert";
import { ButtonLink } from "../components/ui/Button";
import Card, { CardHeader } from "../components/ui/Card";
import MetricCard from "../components/ui/MetricCard";
import PageHeader from "../components/ui/PageHeader";
import { SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { FlagStatusBadge, HealthIndicator } from "../components/ui/StatusBadge";
import TimeRangePicker from "../components/ui/TimeRangePicker";
import { usePreferences } from "../hooks/useAppContext";
import { pickPrimaryFlag, useAllEvents, useChaos, useIncidents, useLiveTraffic, usePlatformHealth, useQuickCartHealth } from "../hooks/useData";
import { useFlagHealth } from "../hooks/useFlag";
import { useFlags } from "../hooks/useFlags";
import { useMetrics } from "../hooks/useMetrics";
import { isActive } from "../lib/flagActions";
import { formatNumber, formatRate, formatRelative, formatRps } from "../lib/format";
import { computeHealthScore } from "../lib/health";
import { deriveReleases, releaseSuccessRate } from "../lib/releases";
import { healthConfig } from "../lib/status";

const healthRank: Record<HealthStatus, number> = { BREACHED: 4, WARNING: 3, INSUFFICIENT_DATA: 2, HEALTHY: 1, NOT_MONITORED: 0 };

function worstHealth(flags: Flag[]): HealthStatus | null {
  const active = flags.filter(isActive);
  if (active.length === 0) return null;
  return active.reduce<HealthStatus>((worst, flag) => (healthRank[flag.healthStatus] > healthRank[worst] ? flag.healthStatus : worst), "NOT_MONITORED");
}

export default function Overview() {
  const [preferences, updatePreferences] = usePreferences();
  const flagsQuery = useFlags();
  const flags = flagsQuery.data?.flags;
  const openIncidents = useIncidents("open");
  const allIncidents = useIncidents();
  const activity = useAllEvents(flags, 200);
  const traffic = useLiveTraffic();
  const chaos = useChaos();
  const platform = usePlatformHealth();
  const quickcart = useQuickCartHealth();

  const primary = pickPrimaryFlag(flags);
  const primaryHealth = useFlagHealth(primary?.key ?? "");
  const primaryMetrics = useMetrics(primary?.key, preferences.chartRange);
  const score = computeHealthScore(primary, primaryHealth.data, primaryMetrics.data);

  const releases = useMemo(() => deriveReleases(activity.events), [activity.events]);
  const successRate = releaseSuccessRate(releases);
  const finished = releases.filter((release) => release.outcome !== "in_progress");

  const list = flags ?? [];
  const active = list.filter(isActive);
  const worst = worstHealth(list);
  const openCount = openIncidents.data?.incidents.length ?? 0;
  const lastSample = traffic.samples[traffic.samples.length - 1];
  const totalRps = lastSample ? lastSample.rpsNew + lastSample.rpsOld : null;
  const lastErrors = lastSample && totalRps && totalRps > 0
    ? ((lastSample.errorRateNew ?? 0) * lastSample.rpsNew + (lastSample.errorRateOld ?? 0) * lastSample.rpsOld) / totalRps
    : null;

  const attention: Array<{ id: string; tone: "danger" | "warning"; title: string; body: string; href: string; cta: string }> = [];
  for (const incident of openIncidents.data?.incidents ?? []) {
    attention.push({ id: `incident-${incident.id}`, tone: "danger", title: `Automatic rollback on ${incident.flagKey}`, body: incident.reason, href: `/incidents/${incident.id}`, cta: "View incident" });
  }
  for (const flag of active.filter((item) => item.healthStatus === "WARNING" || item.healthStatus === "BREACHED")) {
    attention.push({ id: `flag-${flag.key}`, tone: flag.healthStatus === "BREACHED" ? "danger" : "warning", title: `${flag.name} is ${healthConfig[flag.healthStatus].label.toLowerCase()}`, body: healthConfig[flag.healthStatus].description, href: `/flags/${flag.key}?tab=health`, cta: "Open health" });
  }
  if (chaos.data?.active) {
    attention.push({ id: "chaos", tone: "warning", title: "Chaos experiment running", body: `${Math.round(chaos.data.errorRate * 100)}% of new-flow payments are failing on purpose.`, href: "/chaos", cta: "Open chaos testing" });
  }
  if (platform.isError) attention.push({ id: "platform", tone: "danger", title: "Platform API unreachable", body: "Flags cannot be changed and QuickCart falls back to the stable flow.", href: "/services", cta: "Check services" });
  if (quickcart.isError) attention.push({ id: "quickcart", tone: "warning", title: "QuickCart server unreachable", body: "Live traffic and chaos controls are unavailable.", href: "/services", cta: "Check services" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Release overview"
        description="What is rolling out, how healthy it is, and what needs your attention."
        actions={
          <>
            <ButtonLink to="/playground" variant="secondary" icon={<TestTubeDiagonal size={16} />}>Playground</ButtonLink>
            <ButtonLink to="/flags/new" variant="primary" icon={<Plus size={16} />}>Create flag</ButtonLink>
          </>
        }
      />

      {flagsQuery.isError && (
        <ErrorState title="Could not load flags" message={flagsQuery.error.message} onRetry={() => void flagsQuery.refetch()} retrying={flagsQuery.isFetching} />
      )}

      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="Feature flags"
          icon={<FlagIcon size={18} />}
          value={flags ? list.length : "—"}
          loading={flagsQuery.isPending}
          context={flags ? `${list.filter((flag) => flag.status === "completed").length} completed · ${list.filter((flag) => flag.status === "draft").length} draft` : undefined}
          href="/flags"
        />
        <MetricCard
          label="Active rollouts"
          icon={<Rocket size={18} />}
          value={flags ? active.length : "—"}
          loading={flagsQuery.isPending}
          status={active.some((flag) => flag.status === "paused") ? { tone: "warning", label: `${active.filter((flag) => flag.status === "paused").length} paused` } : undefined}
          context={active.length ? active.map((flag) => `${flag.key} ${flag.rolloutPercentage}%`).join(" · ") : "Nothing rolling out"}
          explanation="Flags currently rolling out or paused. The guardian watches both."
          href="/rollouts"
        />
        <MetricCard
          label="Canary health"
          icon={<HeartPulse size={18} />}
          value={score.score ?? "—"}
          unit={score.score !== null ? "/100" : undefined}
          loading={flagsQuery.isPending}
          status={worst ? { tone: healthConfig[worst].tone, label: healthConfig[worst].label } : { tone: "neutral", label: "No active canary" }}
          context={primary && score.score !== null ? `Score for ${primary.key}` : "Start a rollout to see live health"}
          explanation="Health score of the main active rollout (derived from error rate, availability, latency and sample size). The badge shows the worst guardian status across active rollouts."
          href="/health"
        />
        <MetricCard
          label="Open incidents"
          icon={<Siren size={18} />}
          value={openIncidents.data ? openCount : "—"}
          loading={openIncidents.isPending}
          status={openIncidents.data ? (openCount > 0 ? { tone: "danger", label: "Needs review" } : { tone: "success", label: "All clear" }) : undefined}
          context={allIncidents.data ? `${allIncidents.data.incidents.length} automatic rollback${allIncidents.data.incidents.length === 1 ? "" : "s"} in total` : undefined}
          href="/incidents"
        />
        <MetricCard
          label="Release success"
          icon={<Trophy size={18} />}
          value={successRate === null ? "—" : `${Math.round(successRate * 100)}%`}
          loading={activity.isPending}
          context={finished.length ? `${finished.filter((release) => release.outcome === "completed").length} of ${finished.length} finished rollouts reached 100%` : "No finished rollouts yet"}
          explanation="Share of finished rollouts that completed rather than being rolled back or killed. Rebuilt from rollout events."
          href="/releases"
        />
        <MetricCard
          label="Payment traffic"
          icon={<Gauge size={18} />}
          value={totalRps === null ? "—" : formatRps(totalRps).replace(" req/s", "")}
          unit={totalRps === null ? undefined : "req/s"}
          loading={traffic.isPending}
          status={lastErrors !== null ? { tone: lastErrors > 0.03 ? "warning" : "success", label: `${formatRate(lastErrors)} errors` } : undefined}
          context={traffic.error ? "QuickCart unreachable" : lastSample ? `Canary ${formatRps(lastSample.rpsNew)} · stable ${formatRps(lastSample.rpsOld)}` : "Measuring… (needs two readings, 5 s apart)"}
          explanation="Measured from QuickCart's own payment counters every 5 seconds."
          href="/load-generator"
        />
      </section>

      {attention.length > 0 ? (
        <section aria-label="Needs attention" className="space-y-2">
          {attention.map((item) => (
            <Alert
              key={item.id}
              tone={item.tone}
              title={item.title}
              icon={item.tone === "danger" ? <ShieldAlert size={18} /> : <Zap size={18} />}
              action={<ButtonLink to={item.href} size="sm" variant={item.tone === "danger" ? "danger" : "secondary"}>{item.cta}</ButtonLink>}
            >
              {item.body}
            </Alert>
          ))}
        </section>
      ) : flags && openIncidents.data ? (
        <Alert tone="success" title="Nothing needs your attention" icon={<CheckCircle2 size={18} />}>
          No open incidents and every active canary is inside its guardrail.
        </Alert>
      ) : null}

      {primary && (
        <section aria-labelledby="primary-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">{isActive(primary) ? "Live canary" : "Featured flag"}</p>
              <h2 id="primary-heading" className="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
                <Link to={`/flags/${primary.key}`} className="hover:text-accent">{primary.name}</Link>
                <FlagStatusBadge status={primary.status} />
              </h2>
            </div>
            <TimeRangePicker value={preferences.chartRange} onChange={(chartRange) => updatePreferences({ chartRange })} />
          </div>
          <ReleasePipeline flag={primary} health={primaryHealth.data} metrics={primaryMetrics.data} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <ErrorRateChart
              metrics={primaryMetrics.data}
              loading={primaryMetrics.isPending}
              error={primaryMetrics.isError && !primaryMetrics.data ? primaryMetrics.error.message : null}
              onRetry={() => void primaryMetrics.refetch()}
              height={280}
            />
            <Card className="flex flex-col">
              <CardHeader title="Canary health score" description={`${primary.key} · updated every 5 s`} />
              <div className="flex flex-1 items-center justify-center">
                <HealthScoreGauge health={score} />
              </div>
              <ButtonLink to={`/flags/${primary.key}?tab=health`} variant="ghost" size="sm" className="mt-3 self-center" iconRight={<ArrowRight size={14} />}>
                Guardian details
              </ButtonLink>
            </Card>
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader
            icon={<Rocket size={18} />}
            title="Rollouts in progress"
            actions={<ButtonLink to="/rollouts" variant="ghost" size="sm" iconRight={<ArrowRight size={14} />}>View all</ButtonLink>}
          />
          {flagsQuery.isPending ? (
            <SkeletonCard className="shadow-none" />
          ) : active.length === 0 ? (
            <EmptyState
              compact
              icon={<Rocket size={20} />}
              title="No rollouts in progress"
              description="Start a rollout from a flag's page."
              action={<ButtonLink to="/flags" size="sm">Browse flags</ButtonLink>}
            />
          ) : (
            <ul className="space-y-3">
              {active.map((flag) => (
                <li key={flag.key}>
                  <Link to={`/flags/${flag.key}`} className="block rounded-control border border-line/70 bg-surface-2/50 p-3 transition-colors hover:border-accent/40">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{flag.name}</span>
                      <HealthIndicator status={flag.healthStatus} live />
                    </div>
                    <div className="flex items-center gap-3">
                      <RolloutProgress flag={flag} className="flex-1" />
                      <span className="text-sm font-semibold tabular text-ink">{flag.rolloutPercentage}%</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            icon={<ActivityIcon size={18} />}
            title="Recent activity"
            actions={<ButtonLink to="/activity" variant="ghost" size="sm" iconRight={<ArrowRight size={14} />}>View all</ButtonLink>}
          />
          {activity.isPending ? (
            <SkeletonCard className="shadow-none" lines={4} />
          ) : activity.error ? (
            <ErrorState compact message={activity.error.message} onRetry={activity.refetch} />
          ) : activity.events.length === 0 ? (
            <EmptyState compact icon={<ActivityIcon size={20} />} title="No activity yet" description="Changes to flags appear here." />
          ) : (
            <ActivityFeed events={activity.events.slice(0, 6)} showFlag compact />
          )}
        </Card>

        <Card>
          <CardHeader
            icon={<Siren size={18} />}
            title="Latest incidents"
            actions={<ButtonLink to="/incidents" variant="ghost" size="sm" iconRight={<ArrowRight size={14} />}>View all</ButtonLink>}
          />
          {allIncidents.isPending ? (
            <SkeletonCard className="shadow-none" />
          ) : allIncidents.isError ? (
            <ErrorState compact message={allIncidents.error.message} onRetry={() => void allIncidents.refetch()} />
          ) : allIncidents.data.incidents.length === 0 ? (
            <EmptyState compact icon={<CheckCircle2 size={20} />} title="No incidents" description="The guardian has not had to roll anything back." />
          ) : (
            <ul className="space-y-2">
              {allIncidents.data.incidents.slice(0, 4).map((incident) => (
                <li key={incident.id}>
                  <Link to={`/incidents/${incident.id}`} className="flex items-start gap-3 rounded-control border border-line/70 bg-surface-2/50 p-3 transition-colors hover:border-accent/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13px] font-semibold text-ink">{incident.flagKey}</span>
                        <SeverityBadge incident={incident} />
                        {incident.status === "open" && <span className="text-xs font-semibold text-danger">Open</span>}
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-muted" title={incident.reason}>{incident.reason}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular text-ink-subtle">{formatRelative(incident.rolledBackAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {allIncidents.data && allIncidents.data.incidents.length > 0 && (
            <p className="mt-3 text-xs text-ink-subtle">
              {formatNumber(allIncidents.data.incidents.reduce((sum, incident) => sum + (incident.exposedUsers ?? 0), 0))} users were exposed across all incidents before rollback.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
