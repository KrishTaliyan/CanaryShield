import { CheckCircle2, Clock, Siren, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Incident } from "../api/types";
import ResolveDialog from "../components/incidents/ResolveDialog";
import SeverityBadge from "../components/incidents/SeverityBadge";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import DataTable, { type Column } from "../components/ui/DataTable";
import FilterBar from "../components/ui/FilterBar";
import MetricCard from "../components/ui/MetricCard";
import MultiSelect from "../components/ui/MultiSelect";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import SegmentedControl from "../components/ui/SegmentedControl";
import { EmptyState, ErrorState } from "../components/ui/States";
import Tooltip from "../components/ui/Tooltip";
import { useIncidents } from "../hooks/useData";
import { formatDateTime, formatDuration, formatNumber, formatRate, formatRelative } from "../lib/format";
import { incidentSeverity, severityLabel, severityRank, type Severity } from "../lib/severity";

type StatusFilter = "all" | "open" | "resolved";
const severityOptions = (Object.keys(severityLabel) as Severity[]).map((value) => ({ value, label: severityLabel[value] }));

function timeToRollback(incident: Incident) {
  return Date.parse(incident.rolledBackAt) - Date.parse(incident.firstBreachAt);
}

export default function Incidents() {
  const navigate = useNavigate();
  const incidentsQuery = useIncidents();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [severities, setSeverities] = useState<Severity[]>([]);
  const [search, setSearch] = useState("");
  const [resolving, setResolving] = useState<Incident | null>(null);

  const incidents = useMemo(() => incidentsQuery.data?.incidents ?? [], [incidentsQuery.data]);
  const filtered = incidents.filter((incident) => {
    if (status !== "all" && incident.status !== status) return false;
    if (severities.length && !severities.includes(incidentSeverity(incident).level)) return false;
    if (search && !`${incident.flagKey} ${incident.reason}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const open = incidents.filter((incident) => incident.status === "open");
  const rollbackTimes = incidents.map(timeToRollback).filter((value) => Number.isFinite(value) && value >= 0);
  const meanRollback = rollbackTimes.length ? rollbackTimes.reduce((sum, value) => sum + value, 0) / rollbackTimes.length : null;
  const exposedUsers = incidents.reduce((sum, incident) => sum + (incident.exposedUsers ?? 0), 0);

  const columns: Column<Incident>[] = [
    { id: "severity", header: "Severity", sortValue: (incident) => severityRank[incidentSeverity(incident).level], cell: (incident) => <SeverityBadge incident={incident} /> },
    {
      id: "flag",
      header: "Flag",
      sortValue: (incident) => incident.flagKey,
      cell: (incident) => (
        <div className="min-w-0 max-w-[320px]">
          <Link to={`/incidents/${incident.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-accent">{incident.flagKey}</Link>
          <p className="truncate text-xs text-ink-muted" title={incident.reason}>{incident.reason}</p>
        </div>
      ),
    },
    { id: "status", header: "Status", sortValue: (incident) => incident.status, cell: (incident) => <Badge tone={incident.status === "open" ? "danger" : "neutral"} dot={incident.status === "open"} pulse={incident.status === "open"}>{incident.status === "open" ? "Open" : "Resolved"}</Badge> },
    {
      id: "errors",
      header: "Canary errors",
      align: "right",
      sortValue: (incident) => incident.observedErrorRate,
      cell: (incident) => (
        <Tooltip content={`Threshold ${formatRate(incident.threshold, 1)} · baseline ${formatRate(incident.baselineErrorRate)}`}>
          <span className="font-semibold tabular text-danger" tabIndex={0}>{formatRate(incident.observedErrorRate)}</span>
        </Tooltip>
      ),
    },
    { id: "exposed", header: "Exposed", align: "right", sortValue: (incident) => incident.exposedPercentage, cell: (incident) => <span className="whitespace-nowrap tabular text-ink">{incident.exposedPercentage}%{incident.exposedUsers !== null && <span className="text-ink-muted"> · {formatNumber(incident.exposedUsers)}</span>}</span> },
    { id: "ttr", header: "Time to rollback", align: "right", sortValue: timeToRollback, cell: (incident) => <span className="tabular text-ink-muted">{formatDuration(timeToRollback(incident))}</span> },
    { id: "when", header: "When", sortValue: (incident) => Date.parse(incident.rolledBackAt), cell: (incident) => <span className="whitespace-nowrap tabular text-ink-muted" title={formatDateTime(incident.rolledBackAt, true)}>{formatRelative(incident.rolledBackAt)}</span> },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (incident) => incident.status === "open" ? <Button size="sm" onClick={() => setResolving(incident)}>Resolve</Button> : null,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Incidents" description="Every automatic rollback by the guardian: what broke, how many users it reached and how fast it was stopped." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open" value={incidentsQuery.data ? open.length : "—"} icon={<Siren size={18} />} loading={incidentsQuery.isPending} status={incidentsQuery.data ? (open.length ? { tone: "danger", label: "Needs review" } : { tone: "success", label: "All clear" }) : undefined} />
        <MetricCard label="Resolved" value={incidentsQuery.data ? incidents.length - open.length : "—"} icon={<CheckCircle2 size={18} />} loading={incidentsQuery.isPending} />
        <MetricCard label="Mean time to rollback" value={meanRollback === null ? "—" : formatDuration(meanRollback)} icon={<Clock size={18} />} loading={incidentsQuery.isPending} explanation="From the first breached check to the automatic rollback." />
        <MetricCard label="Users exposed" value={incidentsQuery.data ? formatNumber(exposedUsers) : "—"} icon={<Users size={18} />} loading={incidentsQuery.isPending} explanation="Distinct users served the failing version before each rollback, summed." />
      </div>

      <FilterBar
        active={status !== "all" || severities.length > 0 || Boolean(search)}
        onClear={() => { setStatus("all"); setSeverities([]); setSearch(""); }}
        summary={incidents.length ? `${filtered.length} of ${incidents.length}` : undefined}
      >
        <SegmentedControl label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "All" }, { value: "open", label: `Open${open.length ? ` (${open.length})` : ""}` }, { value: "resolved", label: "Resolved" }]} />
        <MultiSelect label="Severity" options={severityOptions} selected={severities} onChange={setSeverities} />
        <SearchInput label="Search incidents" placeholder="Flag or reason" value={search} onChange={setSearch} className="w-full sm:w-64" />
      </FilterBar>

      {incidentsQuery.isError ? (
        <ErrorState title="Could not load incidents" message={incidentsQuery.error.message} onRetry={() => void incidentsQuery.refetch()} />
      ) : (
        <DataTable
          caption="Incidents"
          columns={columns}
          rows={filtered}
          getRowId={(incident) => incident.id}
          loading={incidentsQuery.isPending}
          onRowClick={(incident) => navigate(`/incidents/${incident.id}`)}
          rowTone={(incident) => (incident.status === "open" ? "danger" : undefined)}
          defaultSort={{ id: "when", dir: "desc" }}
          minWidth={1000}
          renderMobile={(incident) => (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge incident={incident} />
                <Badge tone={incident.status === "open" ? "danger" : "neutral"}>{incident.status === "open" ? "Open" : "Resolved"}</Badge>
                <span className="ml-auto text-xs text-ink-subtle">{formatRelative(incident.rolledBackAt)}</span>
              </div>
              <p className="font-mono text-[13px] font-semibold text-ink">{incident.flagKey}</p>
              <p className="text-xs text-ink-muted">{incident.reason}</p>
              <p className="text-xs tabular text-ink-muted">Errors {formatRate(incident.observedErrorRate)} · exposed {incident.exposedPercentage}% · rolled back in {formatDuration(timeToRollback(incident))}</p>
              {incident.status === "open" && <Button size="sm" onClick={() => setResolving(incident)}>Resolve</Button>}
            </div>
          )}
          empty={
            <EmptyState
              icon={<CheckCircle2 size={22} />}
              title={incidents.length ? "No incidents match" : "No incidents"}
              description={incidents.length ? "Try a different filter." : "The guardian has not had to roll anything back. Try Chaos testing to see it in action."}
            />
          }
        />
      )}

      <ResolveDialog incident={resolving} onClose={() => setResolving(null)} />
    </div>
  );
}
