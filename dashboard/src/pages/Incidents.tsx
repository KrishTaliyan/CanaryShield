import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listIncidents } from "../api/incidents";
import IncidentCard from "../components/IncidentCard";
import { usePollingFallback } from "../hooks/useEventStream";

type Filter = "all" | "open" | "resolved";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

export default function Incidents() {
  const [filter, setFilter] = useState<Filter>("all");
  const refetchInterval = usePollingFallback();
  const incidentsQuery = useQuery({
    queryKey: ["incidents", filter],
    queryFn: () => listIncidents(filter === "all" ? undefined : filter),
    refetchInterval,
  });
  const incidents = incidentsQuery.data?.incidents ?? [];
  const openCount = incidents.filter((incident) => incident.status === "open").length;

  return (
    <main className="mx-auto max-w-6xl p-5 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-950">Incidents</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Automatic rollbacks by the guardian{incidentsQuery.isSuccess && filter === "all" ? ` · ${openCount} open` : ""}
          </p>
        </div>
        <div aria-label="Filter incidents" className="inline-flex rounded border border-neutral-300 bg-white p-0.5" role="group">
          {filters.map((item) => (
            <button
              key={item.value}
              aria-pressed={filter === item.value}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                filter === item.value ? "bg-emerald-800 text-white" : "text-neutral-700 hover:bg-neutral-100"
              }`}
              onClick={() => setFilter(item.value)}
              type="button"
            >{item.label}</button>
          ))}
        </div>
      </div>

      {incidentsQuery.isError ? (
        <section className="border-y border-red-200 bg-red-50 px-4 py-5" role="alert">
          <p className="text-sm font-medium text-red-900">Could not load incidents</p>
          <p className="mt-1 text-sm text-red-800">{incidentsQuery.error.message}</p>
          <button
            className="mt-3 rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-100"
            onClick={() => void incidentsQuery.refetch()}
            type="button"
          >Retry</button>
        </section>
      ) : incidentsQuery.isPending ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading incidents">
          {[0, 1].map((row) => <div key={row} className="h-40 animate-pulse border-y border-neutral-200 bg-white" />)}
        </div>
      ) : incidents.length === 0 ? (
        <div className="border-y border-neutral-200 bg-white py-12 text-center">
          <p className="text-sm font-medium text-neutral-900">No incidents</p>
          <p className="mt-1 text-sm text-neutral-600">
            {filter === "all" ? "The guardian has not rolled anything back." : `No ${filter} incidents.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} />)}
        </div>
      )}
    </main>
  );
}
