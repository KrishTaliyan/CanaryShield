import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useFlags } from "../hooks/useFlags";
import StatusBadge from "../components/StatusBadge";

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function FlagsList() {
  const navigate = useNavigate();
  const flagsQuery = useFlags();

  return (
    <main className="mx-auto max-w-6xl p-5 md:p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-950">Feature flags</h1>
          <p className="mt-1 text-sm text-neutral-600">{flagsQuery.data?.flags.length ?? 0} flags</p>
        </div>
      </div>

      {flagsQuery.isError ? (
        <section className="border-y border-red-200 bg-red-50 px-4 py-5" role="alert">
          <p className="text-sm font-medium text-red-900">Could not load flags</p>
          <p className="mt-1 text-sm text-red-800">
            {flagsQuery.error instanceof ApiError ? flagsQuery.error.message : "Check the platform connection and try again."}
          </p>
          <button
            type="button"
            onClick={() => void flagsQuery.refetch()}
            className="mt-3 rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-100"
          >
            Retry
          </button>
        </section>
      ) : flagsQuery.isPending ? (
        <div className="divide-y divide-neutral-200 border-y border-neutral-200" aria-busy="true" aria-label="Loading flags">
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid grid-cols-2 gap-4 py-5 md:grid-cols-5">
              {[0, 1, 2, 3, 4].map((cell) => (
                <div key={cell} className="h-4 animate-pulse rounded bg-neutral-200" />
              ))}
            </div>
          ))}
        </div>
      ) : flagsQuery.data.flags.length === 0 ? (
        <div className="border-y border-neutral-200 py-12 text-center">
          <p className="text-sm font-medium text-neutral-900">No flags yet</p>
          <p className="mt-1 text-sm text-neutral-600">Create a flag to begin a controlled rollout.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border-y border-neutral-200 bg-white">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-medium uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Flag</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Rollout</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {flagsQuery.data.flags.map((flag) => (
                <tr
                  key={flag.key}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${flag.name}`}
                  onClick={() => navigate(`/flags/${encodeURIComponent(flag.key)}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") navigate(`/flags/${encodeURIComponent(flag.key)}`);
                  }}
                  className="cursor-pointer hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-700"
                >
                  <td className="px-4 py-4">
                    <span className="block font-medium text-neutral-900">{flag.name}</span>
                    <span className="mt-1 block font-mono text-xs text-neutral-500">{flag.key}</span>
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={flag.status} /></td>
                  <td className="px-4 py-4 text-right tabular-nums">{flag.rolloutPercentage}%</td>
                  <td className="px-4 py-4 text-neutral-700">{flag.healthStatus}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-neutral-600">{formatUpdatedAt(flag.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
