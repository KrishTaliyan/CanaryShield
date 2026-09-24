import { Activity as ActivityIcon, Download } from "lucide-react";
import { useMemo, useState } from "react";
import type { Event, EventType } from "../api/types";
import ActivityFeed from "../components/activity/ActivityFeed";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import FilterBar from "../components/ui/FilterBar";
import MultiSelect from "../components/ui/MultiSelect";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import SegmentedControl from "../components/ui/SegmentedControl";
import { SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { useToast } from "../hooks/useAppContext";
import { useAllEvents } from "../hooks/useData";
import { useFlags } from "../hooks/useFlags";
import { downloadFile, timestampForFile, toCsv } from "../lib/download";
import { actorLabel, eventConfig, eventTypes, percentageChange } from "../lib/events";

type Actor = "all" | "admin" | "guardian";
type Period = "24h" | "7d" | "30d" | "all";
const periodMs: Record<Period, number> = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, all: Infinity };
const pageSize = 50;
const dayFormat = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return dayFormat.format(date);
}

export default function Activity() {
  const toast = useToast();
  const flagsQuery = useFlags();
  const activity = useAllEvents(flagsQuery.data?.flags, 200);
  const [search, setSearch] = useState("");
  const [flagKeys, setFlagKeys] = useState<string[]>([]);
  const [types, setTypes] = useState<EventType[]>([]);
  const [actor, setActor] = useState<Actor>("all");
  const [period, setPeriod] = useState<Period>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const since = Date.now() - periodMs[period];
    return activity.events.filter((event) => {
      if (flagKeys.length && !flagKeys.includes(event.flagKey)) return false;
      if (types.length && !types.includes(event.type)) return false;
      if (actor === "admin" && event.actor !== "admin") return false;
      if (actor === "guardian" && event.actor !== "system:guardian") return false;
      if (Date.parse(event.createdAt) < since) return false;
      if (term && !`${event.flagKey} ${event.reason ?? ""} ${eventConfig[event.type]?.label ?? event.type}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [activity.events, search, flagKeys, types, actor, period]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const groups = useMemo(() => {
    const result: Array<{ day: string; events: Event[] }> = [];
    for (const event of paged) {
      const day = dayLabel(event.createdAt);
      const last = result[result.length - 1];
      if (last && last.day === day) last.events.push(event);
      else result.push({ day, events: [event] });
    }
    return result;
  }, [paged]);

  const active = Boolean(search || flagKeys.length || types.length || actor !== "all" || period !== "all");
  const reset = () => {
    setSearch("");
    setFlagKeys([]);
    setTypes([]);
    setActor("all");
    setPeriod("all");
    setPage(1);
  };

  function exportCsv() {
    const csv = toCsv(
      ["id", "time", "flag", "event", "change", "actor", "reason"],
      filtered.map((event) => [event.id, event.createdAt, event.flagKey, eventConfig[event.type]?.label ?? event.type, percentageChange(event) ?? "", actorLabel(event), event.reason ?? ""]),
    );
    downloadFile(`canaryshield-audit-log-${timestampForFile()}.csv`, csv, "text/csv");
    toast({ tone: "success", title: `Exported ${filtered.length} events` });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity"
        description="The audit log: every change to every flag, by an admin or by the guardian, newest first."
        meta={activity.events.length > 0 && (
          <span className="text-xs text-ink-subtle">
            {activity.events.length} events · {activity.events.filter((event) => event.actor === "system:guardian").length} by the guardian
          </span>
        )}
        actions={<Button icon={<Download size={16} />} onClick={exportCsv} disabled={filtered.length === 0}>Export CSV</Button>}
      />

      <FilterBar active={active} onClear={reset} summary={activity.events.length ? `${filtered.length} of ${activity.events.length}` : undefined}>
        <SearchInput label="Search activity" placeholder="Flag, event or reason" value={search} onChange={(value) => { setSearch(value); setPage(1); }} className="w-full sm:w-64" />
        <MultiSelect label="Flag" options={(flagsQuery.data?.flags ?? []).map((flag) => ({ value: flag.key, label: flag.key }))} selected={flagKeys} onChange={(value) => { setFlagKeys(value); setPage(1); }} />
        <MultiSelect label="Event" options={eventTypes.map((type) => ({ value: type, label: eventConfig[type].label }))} selected={types} onChange={(value) => { setTypes(value); setPage(1); }} />
        <SegmentedControl size="sm" label="Actor" value={actor} onChange={(value) => { setActor(value); setPage(1); }} options={[{ value: "all", label: "Everyone" }, { value: "admin", label: "Admin" }, { value: "guardian", label: "Guardian" }]} />
        <SegmentedControl size="sm" label="Period" value={period} onChange={(value) => { setPeriod(value); setPage(1); }} options={[{ value: "24h", label: "24h" }, { value: "7d", label: "7d" }, { value: "30d", label: "30d" }, { value: "all", label: "All" }]} />
      </FilterBar>

      {activity.error ? (
        <ErrorState title="Could not load activity" message={activity.error.message} onRetry={activity.refetch} />
      ) : activity.isPending ? (
        <SkeletonCard lines={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon size={22} />}
          title={activity.events.length ? "No activity matches" : "No activity yet"}
          description={activity.events.length ? "Try a wider period or clear the filters." : "Creating or changing a flag adds an entry here."}
          action={active ? <Button onClick={reset}>Clear filters</Button> : undefined}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.day} aria-label={group.day}>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">{group.day}</h2>
              <Card>
                <ActivityFeed events={group.events} showFlag />
              </Card>
            </section>
          ))}
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
        </div>
      )}
      <p className="text-xs text-ink-subtle">The platform records rollout and configuration changes per flag; this log shows the latest 200 per flag.</p>
    </div>
  );
}
