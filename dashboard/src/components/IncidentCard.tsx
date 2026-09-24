import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import { resolveIncident } from "../api/incidents";
import type { Incident } from "../api/types";
import type { LayoutContext } from "./Layout";

function percent(rate: number | null) {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

function formatDuration(milliseconds: number) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function Stat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-neutral-500">{label}</dt>
      <dd className={`mt-1 tabular-nums ${emphasis ? "text-xl font-semibold text-neutral-950" : "text-sm text-neutral-900"}`}>{value}</dd>
    </div>
  );
}

/** One automatic rollback: what broke, how many users it reached, and how fast it was stopped. */
export default function IncidentCard({ incident }: { incident: Incident }) {
  const { notify } = useOutletContext<LayoutContext>();
  const queryClient = useQueryClient();
  const resolve = useMutation({
    mutationFn: () => resolveIncident(incident.id),
    onSuccess: async () => {
      notify(`Incident on ${incident.flagKey} resolved`);
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (error) => notify(error.message, "error"),
  });

  const open = incident.status === "open";
  const protectedPercentage = Math.max(0, 100 - incident.exposedPercentage);
  const timeToRollback = Date.parse(incident.rolledBackAt) - Date.parse(incident.firstBreachAt);

  return (
    <article className={`border-y bg-white p-5 md:p-6 ${open ? "border-red-300" : "border-neutral-200"}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${open ? "bg-red-600 text-white" : "bg-neutral-100 text-neutral-700"}`}>
              {open ? "Open" : "Resolved"}
            </span>
            <Link className="font-mono text-sm font-medium text-emerald-800 hover:underline" to={`/flags/${encodeURIComponent(incident.flagKey)}`}>
              {incident.flagKey}
            </Link>
          </div>
          <p className="mt-2 text-sm font-medium text-neutral-900">{incident.reason}</p>
          <p className="mt-1 text-xs text-neutral-500">Rolled back automatically at {formatTime(incident.rolledBackAt)}</p>
        </div>
        {open && (
          <button
            className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate()}
            type="button"
          >{resolve.isPending ? "Resolving…" : "Resolve"}</button>
        )}
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Observed errors" value={percent(incident.observedErrorRate)} emphasis />
        <Stat label="Threshold" value={percent(incident.threshold)} />
        <Stat label="Baseline errors" value={percent(incident.baselineErrorRate)} />
        <Stat label="Exposed traffic" value={`${incident.exposedPercentage}%`} emphasis />
        <Stat label="Protected traffic" value={`${protectedPercentage}%`} emphasis />
        <Stat label="Time to rollback" value={formatDuration(timeToRollback)} emphasis />
        <Stat label="Exposed users" value={incident.exposedUsers === null ? "—" : incident.exposedUsers.toLocaleString("en-IN")} />
        <Stat label="Canary samples" value={incident.sampleSize.toLocaleString("en-IN")} />
        <Stat label="First breach" value={formatTime(incident.firstBreachAt)} />
        {incident.resolvedAt && <Stat label="Resolved" value={formatTime(incident.resolvedAt)} />}
      </dl>
    </article>
  );
}
