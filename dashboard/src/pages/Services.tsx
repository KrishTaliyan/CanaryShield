import { useQuery } from "@tanstack/react-query";
import { Bot, Database, ExternalLink, Gauge, Radio, RefreshCw, Server, ShoppingBag, ShoppingCart, type LucideIcon } from "lucide-react";
import { platformUrl, useMocks } from "../api/client";
import { quickcartUrl, quickcartWebUrl } from "../api/quickcart";
import Badge, { type Tone } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader, { SectionHeader } from "../components/ui/PageHeader";
import { usePlatformHealth, useQuickCartHealth, pickPrimaryFlag } from "../hooks/useData";
import { useStreamConnected } from "../hooks/useEventStream";
import { useFlagHealth } from "../hooks/useFlag";
import { useFlags } from "../hooks/useFlags";
import { useMetrics } from "../hooks/useMetrics";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { useNow } from "../hooks/useUi";
import { formatRelative } from "../lib/format";

interface ServiceProps {
  name: string;
  role: string;
  icon: LucideIcon;
  endpoint?: string;
  status: { tone: Tone; label: string };
  detail: string;
  /** How the status is known. */
  source: string;
  checkedAt?: number;
  onRetry?: () => void;
  retrying?: boolean;
  href?: string;
}

function Service({ name, role, icon: Icon, endpoint, status, detail, source, checkedAt, onRetry, retrying, href }: ServiceProps) {
  const now = useNow(5000);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-2 text-accent shadow-raised-sm" aria-hidden="true"><Icon size={19} /></span>
          <div className="min-w-0">
            <h3 className="font-semibold text-ink">{name}</h3>
            <p className="text-[13px] text-ink-muted">{role}</p>
          </div>
        </div>
        <Badge tone={status.tone} dot pulse={status.tone === "danger"}>{status.label}</Badge>
      </div>
      <p className="text-sm text-ink-muted">{detail}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/70 pt-3 text-xs text-ink-subtle">
        {endpoint && <code className="font-mono text-ink-muted">{endpoint}</code>}
        <span>{source}</span>
        {checkedAt ? <span>· checked {formatRelative(new Date(checkedAt).toISOString(), now)}</span> : null}
        <span className="ml-auto flex gap-1">
          {href && <a href={href} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-semibold text-accent hover:bg-accent-soft">Open <ExternalLink size={12} aria-hidden="true" /></a>}
          {onRetry && <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={onRetry} loading={retrying}>Check</Button>}
        </span>
      </div>
    </Card>
  );
}

export default function Services() {
  const system = useSystemStatus();
  const platform = usePlatformHealth();
  const quickcart = useQuickCartHealth();
  const streamConnected = useStreamConnected();
  const flags = useFlags();
  const primary = pickPrimaryFlag(flags.data?.flags);
  const metrics = useMetrics(primary?.key, "5m");
  const active = flags.data?.flags.find((flag) => flag.status === "rolling_out" || flag.status === "paused");
  const guardianHealth = useFlagHealth(active?.key ?? "");
  const now = useNow(5000);
  const web = useQuery({
    queryKey: ["service", "quickcart-web"],
    // An opaque no-cors response still proves the dev server answered.
    queryFn: async () => {
      await fetch(quickcartWebUrl, { mode: "no-cors", cache: "no-store" });
      return true;
    },
    refetchInterval: 15000,
    retry: 0,
  });

  const lastCheck = guardianHealth.data?.checkedAt ? Date.parse(guardianHealth.data.checkedAt) : null;
  const guardianFresh = lastCheck !== null && now - lastCheck < 20_000;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="The parts of CanaryShield and whether each is working. Every status comes from a real check from this browser, or says how it was inferred."
        meta={<Badge tone={system.tone} dot size="md">{system.label}</Badge>}
      />
      {useMocks && <Badge tone="warning" size="md">Mock mode: VITE_USE_MOCKS=true, statuses below are simulated</Badge>}

      <section aria-labelledby="core-heading">
        <SectionHeader id="core-heading" title="Control plane" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Service
            name="Platform API"
            role="Flags, rollouts, evaluation and incidents (Go)"
            icon={Server}
            endpoint={`${platformUrl}/healthz`}
            status={platform.isError ? { tone: "danger", label: "Unreachable" } : platform.isSuccess ? { tone: "success", label: "Healthy" } : { tone: "neutral", label: "Checking" }}
            detail={platform.isError ? platform.error.message : "Responds to health checks. The dashboard cannot change flags without it."}
            source="Health check every 10 s"
            checkedAt={platform.dataUpdatedAt || platform.errorUpdatedAt}
            onRetry={() => void platform.refetch()}
            retrying={platform.isFetching}
          />
          <Service
            name="Live updates"
            role="Server-sent events from the platform"
            icon={Radio}
            endpoint={`${platformUrl}/api/v1/stream`}
            status={useMocks ? { tone: "neutral", label: "Off in mock mode" } : streamConnected ? { tone: "success", label: "Connected" } : { tone: "warning", label: "Reconnecting" }}
            detail={streamConnected ? "Flag changes, health and incidents arrive instantly." : "While disconnected, pages poll every 5 seconds instead."}
            source="EventSource connection state"
          />
          <Service
            name="Guardian"
            role="Checks canaries every 5 s and rolls back bad ones"
            icon={Bot}
            status={!active ? { tone: "neutral", label: "Idle" } : guardianFresh ? { tone: "success", label: "Checking" } : guardianHealth.isPending ? { tone: "neutral", label: "Checking" } : { tone: "warning", label: "No recent check" }}
            detail={!active
              ? "No rollout is active, so there is nothing to check. It runs inside the platform."
              : lastCheck ? `Last checked ${active.key} ${formatRelative(guardianHealth.data?.checkedAt ?? null, now)}.` : `Waiting for the first check of ${active.key}.`}
            source="Inferred from the latest health check time"
          />
          <Service
            name="Prometheus"
            role="Stores payment metrics the guardian reads"
            icon={Gauge}
            endpoint="localhost:9090"
            status={!primary ? { tone: "neutral", label: "Unknown" } : metrics.isError ? { tone: "danger", label: "Query failed" } : metrics.isSuccess ? { tone: "success", label: "Answering" } : { tone: "neutral", label: "Checking" }}
            detail={!primary ? "Create a flag to test a metrics query." : metrics.isError ? metrics.error.message : "Metric queries through the platform succeed."}
            source="Inferred from a metrics query via the platform"
            checkedAt={metrics.dataUpdatedAt || metrics.errorUpdatedAt || undefined}
            onRetry={primary ? () => void metrics.refetch() : undefined}
            retrying={metrics.isFetching}
          />
          <Service
            name="PostgreSQL"
            role="Flags, events and incidents"
            icon={Database}
            status={flags.isError ? { tone: "danger", label: "Unknown: platform failing" } : flags.isSuccess ? { tone: "success", label: "Reachable" } : { tone: "neutral", label: "Checking" }}
            detail="Not reachable from a browser. Listing flags succeeds only when the platform can read the database."
            source="Inferred from GET /flags"
          />
          <Service
            name="Redis"
            role="Flag cache, change broadcasts and exposed-user counts"
            icon={Database}
            status={{ tone: "neutral", label: "Not observable" }}
            detail="The platform does not report Redis health, and a browser cannot reach it. Check the platform logs or docker compose ps."
            source="No check available"
          />
        </div>
      </section>

      <section aria-labelledby="app-heading">
        <SectionHeader id="app-heading" title="Demo application" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Service
            name="QuickCart server"
            role="Shop API: payments, personas, chaos (Node)"
            icon={ShoppingCart}
            endpoint={`${quickcartUrl}/healthz`}
            status={quickcart.isError ? { tone: "danger", label: "Unreachable" } : quickcart.isSuccess ? { tone: "success", label: "Healthy" } : { tone: "neutral", label: "Checking" }}
            detail={quickcart.isError ? quickcart.error.message : "Evaluates new_payment_flow for every payment."}
            source="Health check every 10 s"
            checkedAt={quickcart.dataUpdatedAt || quickcart.errorUpdatedAt}
            onRetry={() => void quickcart.refetch()}
            retrying={quickcart.isFetching}
          />
          <Service
            name="QuickCart web shop"
            role="The storefront shoppers use (React)"
            icon={ShoppingBag}
            endpoint={quickcartWebUrl}
            status={web.isError ? { tone: "danger", label: "Unreachable" } : web.isSuccess ? { tone: "success", label: "Responding" } : { tone: "neutral", label: "Checking" }}
            detail={web.isError ? "The dev server is not running. Start it with npm run dev in quickcart/web." : "The dev server answers requests."}
            source="Page request every 15 s"
            checkedAt={web.dataUpdatedAt || web.errorUpdatedAt}
            onRetry={() => void web.refetch()}
            retrying={web.isFetching}
            href={quickcartWebUrl}
          />
        </div>
      </section>
    </div>
  );
}
