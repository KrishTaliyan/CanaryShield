import { useQueryClient } from "@tanstack/react-query";
import { CirclePause, CirclePlay, Download, FileJson, FileSpreadsheet, Flag as FlagIcon, Plus, Power, Undo2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { killFlag, pauseRollout, resumeRollout, rollbackFlag } from "../api/flags";
import type { Flag, FlagStatus, HealthStatus } from "../api/types";
import RolloutProgress from "../components/flags/RolloutProgress";
import Button, { ButtonLink } from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import DataTable, { type Column } from "../components/ui/DataTable";
import Dropdown from "../components/ui/Dropdown";
import FilterBar from "../components/ui/FilterBar";
import MultiSelect from "../components/ui/MultiSelect";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import { EmptyState, ErrorState } from "../components/ui/States";
import { FlagStatusBadge, HealthIndicator } from "../components/ui/StatusBadge";
import Tooltip from "../components/ui/Tooltip";
import { useToast } from "../hooks/useAppContext";
import { useFlags } from "../hooks/useFlags";
import { buttonClass } from "../lib/button";
import { downloadFile, timestampForFile, toCsv } from "../lib/download";
import { allowedActions } from "../lib/flagActions";
import { formatDateTime, formatRate, formatRelative } from "../lib/format";
import { flagStatusConfig, healthConfig } from "../lib/status";
import { describeConditions } from "../lib/targeting";

type BulkKind = "pause" | "resume" | "rollback" | "kill";

const bulk: Record<BulkKind, { verb: string; applies: (flag: Flag) => boolean; run: (flag: Flag, reason: string) => Promise<Flag>; after: (flag: Flag) => string }> = {
  pause: { verb: "Pause", applies: (flag) => flag.status === "rolling_out", run: (flag) => pauseRollout(flag.key), after: (flag) => `paused at ${flag.rolloutPercentage}%` },
  resume: { verb: "Resume", applies: (flag) => flag.status === "paused", run: (flag) => resumeRollout(flag.key), after: (flag) => `rolling out at ${flag.rolloutPercentage}%` },
  rollback: { verb: "Roll back", applies: (flag) => allowedActions(flag).rollback, run: (flag, reason) => rollbackFlag(flag.key, reason), after: () => "0%, stable version" },
  kill: { verb: "Kill", applies: () => true, run: (flag) => killFlag(flag.key), after: () => "off for everyone" },
};

const statusOptions = (Object.keys(flagStatusConfig) as FlagStatus[]).map((value) => ({ value, label: flagStatusConfig[value].label }));
const healthOptions = (Object.keys(healthConfig) as HealthStatus[]).map((value) => ({ value, label: healthConfig[value].label }));
const pageSize = 20;

export default function FlagsList() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const flagsQuery = useFlags();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkKind, setBulkKind] = useState<BulkKind | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const search = params.get("q") ?? "";
  const statusParam = params.get("status") ?? "";
  const healthParam = params.get("health") ?? "";
  const statuses = useMemo(() => statusParam.split(",").filter(Boolean) as FlagStatus[], [statusParam]);
  const healths = useMemo(() => healthParam.split(",").filter(Boolean) as HealthStatus[], [healthParam]);

  function setParam(key: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
    setPage(1);
  }

  const flags = useMemo(() => flagsQuery.data?.flags ?? [], [flagsQuery.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return flags.filter((flag) => {
      if (term && !`${flag.key} ${flag.name} ${flag.description}`.toLowerCase().includes(term)) return false;
      if (statuses.length && !statuses.includes(flag.status)) return false;
      if (healths.length && !healths.includes(flag.healthStatus)) return false;
      return true;
    });
  }, [flags, search, statuses, healths]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selectedFlags = flags.filter((flag) => selected.includes(flag.key));
  const filtersActive = Boolean(search || statuses.length || healths.length);

  const columns: Column<Flag>[] = [
    {
      id: "flag",
      header: "Flag",
      sortValue: (flag) => flag.name.toLowerCase(),
      cell: (flag) => (
        <div className="min-w-0 max-w-[340px]">
          <Link to={`/flags/${encodeURIComponent(flag.key)}`} className="font-semibold text-ink hover:text-accent">{flag.name}</Link>
          <p className="truncate font-mono text-xs text-ink-subtle">{flag.key}</p>
          {flag.description && <p className="mt-0.5 truncate text-xs text-ink-muted" title={flag.description}>{flag.description}</p>}
        </div>
      ),
    },
    { id: "status", header: "Status", sortValue: (flag) => flag.status, cell: (flag) => <FlagStatusBadge status={flag.status} /> },
    {
      id: "rollout",
      header: "Rollout",
      sortValue: (flag) => flag.rolloutPercentage,
      width: "180px",
      cell: (flag) => (
        <div className="flex items-center gap-2.5">
          <RolloutProgress flag={flag} className="w-24" />
          <span className="w-11 text-right text-sm font-semibold tabular text-ink">{flag.rolloutPercentage}%</span>
        </div>
      ),
    },
    { id: "health", header: "Health", sortValue: (flag) => flag.healthStatus, cell: (flag) => <HealthIndicator status={flag.healthStatus} live /> },
    {
      id: "guardrail",
      header: "Guardrail",
      sortValue: (flag) => (flag.guardrail.enabled ? flag.guardrail.errorRateThreshold : 1),
      cell: (flag) => flag.guardrail.enabled
        ? <span className="text-sm tabular text-ink-muted">≤ {formatRate(flag.guardrail.errorRateThreshold, 1)} errors</span>
        : <span className="text-sm font-medium text-warning">Off</span>,
    },
    {
      id: "targeting",
      header: "Targeting",
      cell: (flag) => (
        <Tooltip content={describeConditions(flag.conditions)}>
          <span className="text-sm text-ink-muted" tabIndex={0}>
            {flag.conditions.length === 0 ? "Everyone" : `${flag.conditions.length} condition${flag.conditions.length === 1 ? "" : "s"}`}
            {flag.overrides.include.length + flag.overrides.exclude.length > 0 && ` · ${flag.overrides.include.length + flag.overrides.exclude.length} overrides`}
          </span>
        </Tooltip>
      ),
    },
    {
      id: "updated",
      header: "Updated",
      sortValue: (flag) => Date.parse(flag.updatedAt),
      cell: (flag) => (
        <Tooltip content={formatDateTime(flag.updatedAt, true)}>
          <span className="whitespace-nowrap text-sm tabular text-ink-muted" tabIndex={0}>{formatRelative(flag.updatedAt)} · v{flag.version}</span>
        </Tooltip>
      ),
    },
  ];

  function exportAs(kind: "csv" | "json") {
    const stamp = timestampForFile();
    if (kind === "json") {
      downloadFile(`canaryshield-flags-${stamp}.json`, JSON.stringify(filtered, null, 2), "application/json");
    } else {
      const csv = toCsv(
        ["key", "name", "status", "enabled", "rolloutPercentage", "healthStatus", "guardrailEnabled", "errorRateThreshold", "minSamples", "consecutiveBreaches", "conditions", "includedUsers", "excludedUsers", "version", "updatedAt"],
        filtered.map((flag) => [
          flag.key, flag.name, flag.status, flag.enabled, flag.rolloutPercentage, flag.healthStatus,
          flag.guardrail.enabled, flag.guardrail.errorRateThreshold, flag.guardrail.minSamples, flag.guardrail.consecutiveBreaches,
          describeConditions(flag.conditions), flag.overrides.include.join(" "), flag.overrides.exclude.join(" "), flag.version, flag.updatedAt,
        ]),
      );
      downloadFile(`canaryshield-flags-${stamp}.csv`, csv, "text/csv");
    }
    toast({ tone: "success", title: `Exported ${filtered.length} flag${filtered.length === 1 ? "" : "s"}`, description: `Saved as ${kind.toUpperCase()} to your downloads.` });
  }

  const config = bulkKind ? bulk[bulkKind] : null;
  const applicable = config ? selectedFlags.filter(config.applies) : [];
  const skipped = config ? selectedFlags.length - applicable.length : 0;

  async function runBulk(reason: string) {
    if (!config || !bulkKind) return;
    setBulkBusy(true);
    setBulkError(null);
    const failures: string[] = [];
    for (const flag of applicable) {
      try {
        await config.run(flag, reason);
      } catch (error) {
        failures.push(`${flag.key}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["flags"] }),
      queryClient.invalidateQueries({ queryKey: ["events"] }),
    ]);
    setBulkBusy(false);
    const done = applicable.length - failures.length;
    if (failures.length === 0) {
      toast({ tone: bulkKind === "rollback" || bulkKind === "kill" ? "warning" : "success", title: `${config.verb}: ${done} flag${done === 1 ? "" : "s"} updated` });
      setBulkKind(null);
      setSelected([]);
    } else {
      setBulkError(failures.join("\n"));
      toast({ tone: "error", title: `${failures.length} of ${applicable.length} failed`, description: failures[0] });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Feature flags"
        description="Every flag, where its rollout stands and whether the canary is healthy."
        meta={flagsQuery.data && <span>{flags.length} flag{flags.length === 1 ? "" : "s"} · {flags.filter((flag) => flag.status === "rolling_out").length} rolling out</span>}
        actions={
          <>
            <Dropdown
              label="Export"
              items={[
                { id: "csv", label: "Export as CSV", description: "Spreadsheet, one row per flag", icon: <FileSpreadsheet size={15} />, onSelect: () => exportAs("csv"), disabled: filtered.length === 0, disabledReason: "No flags to export" },
                { id: "json", label: "Export as JSON", description: "Full flag configuration", icon: <FileJson size={15} />, onSelect: () => exportAs("json"), disabled: filtered.length === 0, disabledReason: "No flags to export" },
              ]}
              trigger={(props) => (
                <button {...props} type="button" className={buttonClass("secondary", "md")} disabled={!flagsQuery.data}>
                  <Download size={16} aria-hidden="true" /> Export
                </button>
              )}
            />
            <ButtonLink to="/flags/new" variant="primary" icon={<Plus size={16} />}>Create flag</ButtonLink>
          </>
        }
      />

      <FilterBar
        active={filtersActive}
        onClear={() => {
          setParams(new URLSearchParams(), { replace: true });
          setPage(1);
        }}
        summary={flagsQuery.data && filtersActive ? `${filtered.length} of ${flags.length} flags match` : undefined}
      >
        <SearchInput label="Search flags" placeholder="Search by name, key or description" value={search} onChange={(value) => setParam("q", value)} className="w-full sm:w-72" />
        <MultiSelect label="Status" options={statusOptions} selected={statuses} onChange={(value) => setParam("status", value.join(","))} />
        <MultiSelect label="Health" options={healthOptions} selected={healths} onChange={(value) => setParam("health", value.join(","))} />
      </FilterBar>

      {selected.length > 0 && (
        <div className="sticky top-[72px] z-10 flex flex-wrap items-center gap-2 rounded-card border border-accent/30 bg-surface-2/95 px-4 py-3 shadow-float backdrop-blur animate-rise-in" role="region" aria-label="Bulk actions">
          <span className="mr-2 text-sm font-semibold text-ink">{selected.length} selected</span>
          <Button size="sm" icon={<CirclePause size={15} />} onClick={() => setBulkKind("pause")} disabled={!selectedFlags.some(bulk.pause.applies)}>Pause</Button>
          <Button size="sm" icon={<CirclePlay size={15} />} onClick={() => setBulkKind("resume")} disabled={!selectedFlags.some(bulk.resume.applies)}>Resume</Button>
          <Button size="sm" variant="danger-soft" icon={<Undo2 size={15} />} onClick={() => setBulkKind("rollback")} disabled={!selectedFlags.some(bulk.rollback.applies)}>Roll back</Button>
          <Button size="sm" variant="danger-soft" icon={<Power size={15} />} onClick={() => setBulkKind("kill")}>Kill</Button>
          <Button size="sm" variant="ghost" icon={<X size={15} />} onClick={() => setSelected([])} className="ml-auto">Clear selection</Button>
        </div>
      )}

      {flagsQuery.isError ? (
        <ErrorState title="Could not load flags" message={flagsQuery.error.message} onRetry={() => void flagsQuery.refetch()} retrying={flagsQuery.isFetching} />
      ) : (
        <>
          <DataTable
            caption="Feature flags"
            columns={columns}
            rows={paged}
            getRowId={(flag) => flag.key}
            loading={flagsQuery.isPending}
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
            onRowClick={(flag) => navigate(`/flags/${encodeURIComponent(flag.key)}`)}
            rowTone={(flag) => (flag.healthStatus === "BREACHED" ? "danger" : flag.healthStatus === "WARNING" ? "warning" : undefined)}
            defaultSort={{ id: "updated", dir: "desc" }}
            minWidth={980}
            renderMobile={(flag) => (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/flags/${encodeURIComponent(flag.key)}`} className="font-semibold text-ink">{flag.name}</Link>
                    <p className="truncate font-mono text-xs text-ink-subtle">{flag.key}</p>
                  </div>
                  <input
                    type="checkbox"
                    aria-label={`Select ${flag.key}`}
                    checked={selected.includes(flag.key)}
                    onChange={() => setSelected((current) => (current.includes(flag.key) ? current.filter((key) => key !== flag.key) : [...current, flag.key]))}
                    className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <FlagStatusBadge status={flag.status} />
                  <HealthIndicator status={flag.healthStatus} live />
                </div>
                <div className="flex items-center gap-3">
                  <RolloutProgress flag={flag} className="flex-1" />
                  <span className="text-sm font-semibold tabular text-ink">{flag.rolloutPercentage}%</span>
                </div>
                <p className="text-xs text-ink-subtle">Updated {formatRelative(flag.updatedAt)} · v{flag.version}</p>
              </div>
            )}
            empty={
              flags.length === 0 ? (
                <EmptyState
                  icon={<FlagIcon size={22} />}
                  title="No flags yet"
                  description="Create a flag to start a controlled, monitored rollout."
                  action={<ButtonLink to="/flags/new" variant="primary" icon={<Plus size={16} />}>Create your first flag</ButtonLink>}
                />
              ) : (
                <EmptyState
                  icon={<FlagIcon size={22} />}
                  title="No flags match these filters"
                  description="Try a different search or clear the filters."
                  action={<Button onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear filters</Button>}
                />
              )
            }
          />
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
        </>
      )}

      {config && bulkKind && (
        <ConfirmDialog
          open
          onClose={() => !bulkBusy && setBulkKind(null)}
          title={`${config.verb} ${applicable.length} flag${applicable.length === 1 ? "" : "s"}?`}
          tone={bulkKind === "pause" || bulkKind === "resume" ? "warning" : "danger"}
          current={{ label: "Selected", value: `${selectedFlags.length} flag${selectedFlags.length === 1 ? "" : "s"}` }}
          after={{ label: "Will change", value: `${applicable.length} flag${applicable.length === 1 ? "" : "s"}`, hint: skipped ? `${skipped} skipped: action not allowed in their status` : undefined }}
          impact={
            <ul className="space-y-1">
              {applicable.map((flag) => (
                <li key={flag.key} className="flex flex-wrap justify-between gap-2">
                  <span className="font-mono text-ink">{flag.key}</span>
                  <span className="tabular">{flag.rolloutPercentage}% → {config.after(flag)}</span>
                </li>
              ))}
            </ul>
          }
          reason={bulkKind === "rollback" ? { label: "Reason for rollback", placeholder: "Saved in each flag's activity log", required: true } : undefined}
          requireText={bulkKind === "kill" ? "KILL" : undefined}
          confirmLabel={`${config.verb} ${applicable.length}`}
          onConfirm={runBulk}
          busy={bulkBusy}
          error={bulkError}
        />
      )}
    </div>
  );
}
