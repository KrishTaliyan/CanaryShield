import { Bot, Clock, Download, GitBranchPlus, ShieldAlert, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ActivityFeed from "../components/activity/ActivityFeed";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import DataTable, { type Column } from "../components/ui/DataTable";
import Drawer from "../components/ui/Drawer";
import FilterBar from "../components/ui/FilterBar";
import MetricCard from "../components/ui/MetricCard";
import MultiSelect from "../components/ui/MultiSelect";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import { EmptyState, ErrorState } from "../components/ui/States";
import { useToast } from "../hooks/useAppContext";
import { useAllEvents } from "../hooks/useData";
import { useFlags } from "../hooks/useFlags";
import { downloadFile, timestampForFile, toCsv } from "../lib/download";
import { formatDateTime, formatDuration, formatRelative } from "../lib/format";
import { deriveReleases, outcomeLabel, releaseSuccessRate, type Release, type ReleaseOutcome } from "../lib/releases";

const outcomeTone: Record<ReleaseOutcome, "info" | "success" | "danger" | "warning"> = {
  in_progress: "info",
  completed: "success",
  auto_rolled_back: "danger",
  rolled_back: "warning",
  killed: "danger",
};

const outcomeOptions = (Object.keys(outcomeLabel) as ReleaseOutcome[]).map((value) => ({ value, label: outcomeLabel[value] }));

function duration(release: Release, now = Date.now()) {
  return (release.endedAt ? Date.parse(release.endedAt) : now) - Date.parse(release.startedAt);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export default function Releases() {
  const toast = useToast();
  const flagsQuery = useFlags();
  const activity = useAllEvents(flagsQuery.data?.flags, 200);
  const releases = useMemo(() => deriveReleases(activity.events), [activity.events]);
  const [search, setSearch] = useState("");
  const [outcomes, setOutcomes] = useState<ReleaseOutcome[]>([]);
  const [open, setOpen] = useState<Release | null>(null);

  const filtered = releases.filter((release) => {
    if (search && !release.flagKey.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (outcomes.length && !outcomes.includes(release.outcome)) return false;
    return true;
  });

  const successRate = releaseSuccessRate(releases);
  const autoRollbacks = releases.filter((release) => release.outcome === "auto_rolled_back").length;
  const completedDurations = releases.filter((release) => release.outcome === "completed").map((release) => duration(release));
  const medianToComplete = median(completedDurations);

  const columns: Column<Release>[] = [
    {
      id: "flag",
      header: "Flag",
      sortValue: (release) => release.flagKey,
      cell: (release) => <Link to={`/flags/${release.flagKey}`} className="font-mono text-[13px] font-semibold text-ink hover:text-accent">{release.flagKey}</Link>,
    },
    { id: "outcome", header: "Outcome", sortValue: (release) => release.outcome, cell: (release) => <Badge tone={outcomeTone[release.outcome]} dot={release.outcome === "in_progress"} pulse={release.outcome === "in_progress"}>{outcomeLabel[release.outcome]}</Badge> },
    { id: "started", header: "Started", sortValue: (release) => Date.parse(release.startedAt), cell: (release) => <span className="whitespace-nowrap tabular text-ink-muted" title={formatDateTime(release.startedAt, true)}>{formatDateTime(release.startedAt)}</span> },
    { id: "duration", header: "Duration", sortValue: (release) => duration(release), cell: (release) => <span className="tabular text-ink-muted">{release.endedAt ? formatDuration(duration(release)) : `${formatDuration(duration(release))} so far`}</span> },
    { id: "peak", header: "Peak", align: "right", sortValue: (release) => release.peakPercentage, cell: (release) => <span className="font-semibold tabular text-ink">{release.peakPercentage}%</span> },
    {
      id: "reason",
      header: "Ended because",
      cell: (release) => (
        <span className="flex max-w-[320px] items-center gap-1.5 truncate text-[13px] text-ink-muted" title={release.endReason ?? undefined}>
          {release.outcome === "auto_rolled_back" && <Bot size={14} className="shrink-0 text-danger" aria-hidden="true" />}
          {release.endReason ?? (release.outcome === "completed" ? "Reached 100%" : release.outcome === "in_progress" ? "—" : "No reason given")}
        </span>
      ),
    },
    { id: "steps", header: "Changes", align: "right", sortValue: (release) => release.events.length, cell: (release) => <span className="tabular text-ink-muted">{release.events.length}</span> },
  ];

  function exportCsv() {
    const csv = toCsv(
      ["flag", "outcome", "startedAt", "endedAt", "durationSeconds", "peakPercentage", "endReason", "events"],
      filtered.map((release) => [release.flagKey, outcomeLabel[release.outcome], release.startedAt, release.endedAt ?? "", Math.round(duration(release) / 1000), release.peakPercentage, release.endReason ?? "", release.events.length]),
    );
    downloadFile(`canaryshield-releases-${timestampForFile()}.csv`, csv, "text/csv");
    toast({ tone: "success", title: `Exported ${filtered.length} releases` });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Releases"
        description="The history of every rollout: how far it got, how long it took and how it ended. Rebuilt from the platform's rollout events."
        actions={<Button icon={<Download size={16} />} onClick={exportCsv} disabled={filtered.length === 0}>Export CSV</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Rollouts" value={releases.length} icon={<GitBranchPlus size={18} />} loading={activity.isPending} context={`${releases.filter((release) => release.outcome === "in_progress").length} in progress`} />
        <MetricCard label="Success rate" value={successRate === null ? "—" : `${Math.round(successRate * 100)}%`} icon={<Trophy size={18} />} loading={activity.isPending} explanation="Finished rollouts that reached 100%, out of all finished rollouts." />
        <MetricCard label="Auto rollbacks" value={autoRollbacks} icon={<ShieldAlert size={18} />} loading={activity.isPending} status={autoRollbacks > 0 ? { tone: "danger", label: "Guardian acted" } : undefined} context="Rolled back by the guardian, not a person" />
        <MetricCard label="Median time to 100%" value={medianToComplete === null ? "—" : formatDuration(medianToComplete)} icon={<Clock size={18} />} loading={activity.isPending} context={completedDurations.length ? `Across ${completedDurations.length} completed rollouts` : "No completed rollouts yet"} />
      </div>

      <FilterBar active={Boolean(search || outcomes.length)} onClear={() => { setSearch(""); setOutcomes([]); }} summary={releases.length ? `${filtered.length} of ${releases.length}` : undefined}>
        <SearchInput label="Search by flag" value={search} onChange={setSearch} className="w-full sm:w-64" />
        <MultiSelect label="Outcome" options={outcomeOptions} selected={outcomes} onChange={setOutcomes} />
      </FilterBar>

      {activity.error ? (
        <ErrorState title="Could not load rollout events" message={activity.error.message} onRetry={activity.refetch} />
      ) : (
        <DataTable
          caption="Release history"
          columns={columns}
          rows={filtered}
          getRowId={(release) => release.id}
          loading={activity.isPending}
          onRowClick={setOpen}
          defaultSort={{ id: "started", dir: "desc" }}
          rowTone={(release) => (release.outcome === "auto_rolled_back" || release.outcome === "killed" ? "danger" : undefined)}
          renderMobile={(release) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[13px] font-semibold text-ink">{release.flagKey}</span>
                <Badge tone={outcomeTone[release.outcome]}>{outcomeLabel[release.outcome]}</Badge>
              </div>
              <p className="text-xs text-ink-muted">Started {formatRelative(release.startedAt)} · peak {release.peakPercentage}% · {formatDuration(duration(release))}</p>
              {release.endReason && <p className="truncate text-xs text-ink-muted">{release.endReason}</p>}
            </div>
          )}
          empty={
            <EmptyState
              icon={<GitBranchPlus size={22} />}
              title={releases.length ? "No releases match" : "No rollouts yet"}
              description={releases.length ? "Try a different filter." : "Start a rollout on any flag and it will appear here."}
            />
          }
        />
      )}
      {activity.events.length >= 200 && <p className="text-xs text-ink-subtle">Built from the latest 200 events per flag.</p>}

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${open.flagKey} rollout` : ""}
        description={open ? `${outcomeLabel[open.outcome]} · started ${formatDateTime(open.startedAt)}` : undefined}
      >
        {open && (
          <div className="space-y-4 p-5">
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div className="well px-2 py-3"><dt className="text-[11px] font-semibold uppercase text-ink-subtle">Peak</dt><dd className="mt-1 font-semibold tabular text-ink">{open.peakPercentage}%</dd></div>
              <div className="well px-2 py-3"><dt className="text-[11px] font-semibold uppercase text-ink-subtle">Duration</dt><dd className="mt-1 font-semibold tabular text-ink">{formatDuration(duration(open))}</dd></div>
              <div className="well px-2 py-3"><dt className="text-[11px] font-semibold uppercase text-ink-subtle">Changes</dt><dd className="mt-1 font-semibold tabular text-ink">{open.events.length}</dd></div>
            </dl>
            <ActivityFeed events={[...open.events].reverse()} />
            <Link to={`/flags/${open.flagKey}`} className="inline-flex text-sm font-semibold text-accent hover:underline">Open flag</Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}
