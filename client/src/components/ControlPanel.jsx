import CohortSelector from "./CohortSelector";
import SliderControl from "./SliderControl";
import ToggleSwitch from "./ToggleSwitch";
import { getRingByKey, rolloutRings } from "../services/featureService";

function StatTile({ label, value, tone = "text-[rgb(var(--text))]" }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--panel-2))] p-4">
      <p className="text-xs font-bold uppercase text-[rgb(var(--muted))]">{label}</p>
      <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function ControlPanel({
  config,
  theme,
  onThemeChange,
  onToggleFeature,
  onRolloutChange,
  onCityChange,
  onUserTypeChange,
  onRingChange,
  onTrafficChange,
  onSimulateErrorSpike,
  onAutoRollback,
  errorSpike,
  liveTraffic,
  blastRadius,
}) {
  const activeRing = getRingByKey(config.ring);

  return (
    <aside className="flex h-full flex-col gap-4 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--panel))] p-4 shadow-xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-cyan-400">CanaryShield</p>
          <h1 className="mt-1 text-2xl font-black text-[rgb(var(--text))]">Release Control</h1>
        </div>
        <div className="grid grid-cols-2 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--field))] p-1">
          {["dark", "light"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onThemeChange(option)}
              className={`rounded-md px-3 py-1 text-xs font-black capitalize ${
                theme === option
                  ? "bg-cyan-400 text-gray-950"
                  : "text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center justify-between rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--panel-2))] p-3">
        <span className="text-sm font-bold text-[rgb(var(--text))]">new_payment_flow</span>
        <span className={`rounded-md px-3 py-1 text-xs font-black ${config.enabled ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
          {config.enabled ? "LIVE" : "OFF"}
        </span>
      </div>

      <ToggleSwitch checked={config.enabled} onChange={onToggleFeature} />
      <SliderControl value={config.rollout} onChange={onRolloutChange} />

      <CohortSelector
        city={config.city}
        userType={config.type}
        onCityChange={onCityChange}
        onUserTypeChange={onUserTypeChange}
      />

      <section className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--panel-2))] p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[rgb(var(--text))]">Rollout Rings</h3>
            <p className="mt-1 text-xs text-[rgb(var(--muted))]">Audience cap</p>
          </div>
          <span className="text-xs font-bold text-cyan-400">{activeRing.name}</span>
        </div>

        <div className="grid gap-2">
          {rolloutRings.map((ring) => {
            const selected = config.ring === ring.key;
            const included = activeRing.id >= ring.id;

            return (
              <button
                key={ring.key}
                type="button"
                onClick={() => onRingChange(ring.key)}
                className={`rounded-lg border p-3 text-left transition duration-200 ${
                  selected
                    ? "border-emerald-400 bg-emerald-400/10"
                    : "border-[rgb(var(--line))] bg-[rgb(var(--field))] hover:border-cyan-400"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-[rgb(var(--text))]">
                    {ring.name} <span className="text-[rgb(var(--muted))]">({ring.label})</span>
                  </span>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${included ? "bg-emerald-400 text-gray-950" : "bg-[rgb(var(--track))] text-[rgb(var(--muted))]"}`}>
                    {included ? "Included" : "Held"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[rgb(var(--muted))]">{ring.audience}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Traffic" value={liveTraffic.toLocaleString()} tone="text-cyan-400" />
        <StatTile
          label="Impacted"
          value={blastRadius.impactedUsers.toLocaleString()}
          tone={config.enabled ? "text-emerald-400" : "text-[rgb(var(--muted))]"}
        />
      </div>

      <section className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--panel-2))] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[rgb(var(--text))]">Users Impacted</h3>
          <span className="text-xs font-black text-[rgb(var(--muted))]">
            {blastRadius.eligibleUsersEstimate.toLocaleString()} eligible
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[rgb(var(--track))]">
          <div
            className={`h-full rounded-full transition-all duration-700 ${config.enabled ? "bg-emerald-400" : "bg-gray-500"}`}
            style={{ width: `${Math.min(100, (blastRadius.impactedUsers / liveTraffic) * 100)}%` }}
          />
        </div>
      </section>

      <SliderControl
        label="Traffic"
        value={liveTraffic}
        min={1000}
        max={10000}
        suffix=""
        onChange={onTrafficChange}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSimulateErrorSpike}
          className={`rounded-xl border px-4 py-3 text-sm font-black transition duration-200 ${
            errorSpike
              ? "border-red-300 bg-red-500 text-white shadow-lg shadow-red-950/40"
              : "border-amber-400 bg-amber-400/10 text-amber-500 hover:bg-amber-400/20"
          }`}
        >
          Error Spike
        </button>
        <button
          type="button"
          onClick={onAutoRollback}
          className="rounded-xl border border-red-400 bg-red-500/10 px-4 py-3 text-sm font-black text-red-400 transition duration-200 hover:bg-red-500/20"
        >
          Rollback
        </button>
      </div>

      {errorSpike ? (
        <div className="rounded-xl border border-red-400 bg-red-500/10 p-4 text-sm font-semibold text-red-400">
          BREACHED - kill switch ready
        </div>
      ) : null}
    </aside>
  );
}

export default ControlPanel;
