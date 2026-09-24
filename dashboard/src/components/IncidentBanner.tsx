import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listIncidents } from "../api/incidents";
import { usePollingFallback } from "../hooks/useEventStream";

/** Red banner shown on a flag's page while it has an open incident. */
export default function IncidentBanner({ flagKey }: { flagKey: string }) {
  const refetchInterval = usePollingFallback();
  const openQuery = useQuery({
    queryKey: ["incidents", "open"],
    queryFn: () => listIncidents("open"),
    refetchInterval,
  });
  const incident = openQuery.data?.incidents.find((item) => item.flagKey === flagKey);
  if (!incident) return null;

  return (
    <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded border border-red-700 bg-red-600 px-4 py-3 text-white shadow-sm" role="alert">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Automatic rollback — incident open</p>
        <p className="mt-0.5 text-sm text-red-50">{incident.reason}</p>
      </div>
      <Link className="shrink-0 rounded bg-white px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-50" to="/incidents">View incident</Link>
    </section>
  );
}
