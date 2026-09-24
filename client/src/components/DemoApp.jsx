import NewCheckout from "./NewCheckout";
import OldCheckout from "./OldCheckout";
import { toApiResponse } from "../services/featureService";

function CheckBadge({ label, passed }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        passed
          ? "bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/30"
          : "bg-red-500/10 text-red-200 ring-1 ring-red-400/30"
      }`}
    >
      {label}
    </span>
  );
}

function DemoApp({ users, selectedUser, onUserChange, decision, config, blastRadius }) {
  const apiResponse = toApiResponse(config);

  return (
    <main className="flex h-full flex-col gap-4 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--panel))] p-4 shadow-xl">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-black text-emerald-400">QuickCart Preview</p>
            <span className="flex items-center gap-2 rounded-full bg-[rgb(var(--field))] px-3 py-1 text-xs font-bold text-[rgb(var(--muted))] ring-1 ring-[rgb(var(--line))]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              live
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-black text-[rgb(var(--text))]">Checkout Gate</h2>
        </div>

        <label className="w-full xl:w-80">
          <span className="text-xs font-bold uppercase text-[rgb(var(--muted))]">
            Preview User
          </span>
          <select
            value={selectedUser.id}
            onChange={(event) => onUserChange(Number(event.target.value))}
            className="mt-2 w-full rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--field))] px-4 py-3 text-sm text-[rgb(var(--text))] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/20"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} - {user.city} - {user.type} - ID {user.id}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--panel-2))] p-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--field))] p-3">
              <p className="text-xs uppercase text-[rgb(var(--muted))]">User</p>
              <p className="mt-1 font-black text-[rgb(var(--text))]">{selectedUser.name}</p>
            </div>
            <div className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--field))] p-3">
              <p className="text-xs uppercase text-[rgb(var(--muted))]">City</p>
              <p className="mt-1 font-black text-[rgb(var(--text))]">{selectedUser.city}</p>
            </div>
            <div className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--field))] p-3">
              <p className="text-xs uppercase text-[rgb(var(--muted))]">Type</p>
              <p className="mt-1 font-black capitalize text-[rgb(var(--text))]">{selectedUser.type}</p>
            </div>
            <div className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--field))] p-3">
              <p className="text-xs uppercase text-[rgb(var(--muted))]">Bucket</p>
              <p className="mt-1 font-black text-[rgb(var(--text))]">{decision.bucket}/100</p>
            </div>
          </div>

          <div
            className={`mb-4 rounded-xl border p-4 transition duration-300 ${
              decision.enabled
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                : "border-red-400/40 bg-red-500/10 text-red-100"
            }`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em]">
                  {decision.enabled ? "NEW UI" : "OLD UI"}
                </p>
                <p className="mt-1 text-xl font-black">
                  {decision.enabled ? "Feature Enabled" : "Stable Version"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CheckBadge label="kill" passed={decision.checks.killSwitch} />
                <CheckBadge label="city" passed={decision.checks.city} />
                <CheckBadge label="type" passed={decision.checks.userType} />
                <CheckBadge label="ring" passed={decision.checks.ring} />
                <CheckBadge label="rollout" passed={decision.checks.rollout} />
              </div>
            </div>
          </div>

          {decision.enabled ? (
            <NewCheckout key="new" user={selectedUser} />
          ) : (
            <OldCheckout key="old" user={selectedUser} />
          )}
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--panel-2))] p-4">
            <h3 className="text-sm font-bold text-[rgb(var(--text))]">SDK Response</h3>
            <pre className="mt-4 overflow-auto rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--field))] p-3 text-xs leading-6 text-[rgb(var(--muted))]">
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
          </div>

          <div className="rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--panel-2))] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[rgb(var(--text))]">Blast Radius</h3>
              <span className="text-xs font-bold text-[rgb(var(--muted))]">
                {blastRadius.impactedUsers.toLocaleString()} users
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[rgb(var(--track))]">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  config.enabled ? "bg-emerald-400" : "bg-gray-500"
                }`}
                style={{ width: `${Math.min(100, (blastRadius.impactedUsers / 1200) * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-[rgb(var(--muted))]">
              {blastRadius.eligibleUsersEstimate.toLocaleString()} eligible
            </p>
          </div>

          <div className="rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--panel-2))] p-4">
            <h3 className="text-sm font-bold text-[rgb(var(--text))]">Decision Trace</h3>
            <p className={`mt-3 text-sm font-black ${decision.enabled ? "text-emerald-400" : "text-red-400"}`}>
              {decision.reason || "NO_MATCH"}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default DemoApp;
