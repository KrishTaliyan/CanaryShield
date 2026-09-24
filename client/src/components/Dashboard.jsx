import { rings } from "../lib/featureEvaluation";
import SliderControl from "./SliderControl";
import Toggle from "./Toggle";

function MetricCard({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-950/70 p-4 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function Dashboard({
  enabled,
  setEnabled,
  rolloutPercentage,
  setRolloutPercentage,
  cohortTarget,
  setCohortTarget,
  activeRing,
  setActiveRing,
  impact,
  liveTraffic,
  errorSpike,
  onSimulateErrorSpike,
  onAutoRollback,
}) {
  return (
    <aside className="flex h-full flex-col gap-5 rounded-xl border border-gray-700 bg-gray-800/80 p-5 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Control Plane
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">CanaryShield</h1>
          <p className="mt-2 max-w-md text-sm text-gray-400">
            Dynamic feature flags and canary deployment controls for checkout
            releases with blast radius limits.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
            enabled
              ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30"
              : "bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      <Toggle
        checked={enabled}
        onChange={setEnabled}
        label="Kill Switch"
        description="Force every customer back to the stable checkout."
      />

      <SliderControl value={rolloutPercentage} onChange={setRolloutPercentage} />

      <label className="rounded-xl border border-gray-700 bg-gray-950/70 p-4 shadow-lg">
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
          Cohort Target
        </span>
        <input
          value={cohortTarget}
          onChange={(event) => setCohortTarget(event.target.value)}
          placeholder="Delhi, beta, internal, or all"
          className="mt-3 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
        />
        <p className="mt-2 text-xs text-gray-500">
          Matches city or user type. Try Delhi, beta, internal, general, or all.
        </p>
      </label>

      <section className="rounded-xl border border-gray-700 bg-gray-950/70 p-4 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
              Rollout Rings
            </p>
            <p className="text-xs text-gray-500">Select the widest audience allowed.</p>
          </div>
          <span className="text-xs font-semibold text-cyan-200">
            Up to Ring {activeRing}
          </span>
        </div>

        <div className="grid gap-3">
          {rings.map((ring) => {
            const isActive = ring.id <= activeRing;
            return (
              <button
                type="button"
                key={ring.id}
                onClick={() => setActiveRing(ring.id)}
                className={`rounded-xl border p-3 text-left transition duration-300 ${
                  isActive
                    ? "border-emerald-400/40 bg-emerald-400/10"
                    : "border-gray-700 bg-gray-900/80 hover:border-gray-500"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-white">{ring.name}</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      isActive ? "bg-emerald-300 text-gray-950" : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {isActive ? "Active" : "Held"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
                  <span>{ring.audience}</span>
                  <span>Budget {ring.budget}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Live Traffic" value={liveTraffic.toLocaleString()} tone="text-cyan-200" />
        <MetricCard
          label="Users Impacted"
          value={impact.impacted.toLocaleString()}
          tone={enabled ? "text-emerald-300" : "text-gray-500"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSimulateErrorSpike}
          className={`rounded-xl border px-4 py-3 text-sm font-bold transition duration-300 ${
            errorSpike
              ? "border-rose-300 bg-rose-500 text-white shadow-lg shadow-rose-950/40"
              : "border-amber-300/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
          }`}
        >
          Simulate Error Spike
        </button>
        <button
          type="button"
          onClick={onAutoRollback}
          className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-100 transition duration-300 hover:bg-rose-500/20"
        >
          Auto Rollback
        </button>
      </div>

      {errorSpike ? (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          Checkout errors breached the blast radius guardrail. The feature was
          disabled and traffic is back on the old UI.
        </div>
      ) : null}
    </aside>
  );
}

export default Dashboard;
