import Checkout from "./Checkout";

function CheckPill({ label, passed }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        passed
          ? "bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/30"
          : "bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/30"
      }`}
    >
      {label}
    </span>
  );
}

function DemoApp({ users, selectedUser, setSelectedUserId, evaluation, config, impact }) {
  return (
    <main className="flex h-full flex-col gap-5 rounded-xl border border-gray-700 bg-gray-800/80 p-5 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
            User View
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">E-commerce Checkout</h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            The customer sees the old or new checkout based on flag state, city or
            user-type targeting, rollout ring, and deterministic bucket.
          </p>
        </div>

        <label className="min-w-64">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            Simulated Shopper
          </span>
          <select
            value={selectedUser.id}
            onChange={(event) => setSelectedUserId(Number(event.target.value))}
            className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} - {user.city} - {user.type} - ID {user.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-gray-700 bg-gray-950/70 p-4 shadow-lg">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">User ID</p>
              <p className="mt-1 text-xl font-black text-white">{selectedUser.id}</p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">City</p>
              <p className="mt-1 text-xl font-black text-white">{selectedUser.city}</p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Type</p>
              <p className="mt-1 text-xl font-black capitalize text-white">
                {selectedUser.type}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Bucket</p>
              <p className="mt-1 text-xl font-black text-white">
                {evaluation.bucket ?? selectedUser.id % 100}
                <span className="text-sm text-gray-500"> / 100</span>
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <CheckPill label="Kill Switch" passed={evaluation.checks.killSwitch} />
            <CheckPill label="Cohort" passed={evaluation.checks.cohort} />
            <CheckPill label="Ring" passed={evaluation.checks.ring} />
            <CheckPill label="Rollout" passed={evaluation.checks.rollout} />
          </div>

          <div
            className={`mb-4 rounded-xl border p-4 ${
              evaluation.allowed
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                : "border-rose-400/40 bg-rose-500/10 text-rose-100"
            }`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-bold">
                {evaluation.allowed ? "Feature Enabled for You" : "Stable UI Served"}
              </p>
              <p className="text-sm opacity-80">{evaluation.reason}</p>
            </div>
          </div>

          <Checkout showNewUi={evaluation.allowed} user={selectedUser} />
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-xl border border-gray-700 bg-gray-950/70 p-4 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
              Flag Response
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">enabled</span>
                <span className={config.enabled ? "text-emerald-300" : "text-rose-300"}>
                  {String(config.enabled)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">rollout</span>
                <span className="text-white">{config.rolloutPercentage}%</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">cohort</span>
                <span className="text-white">{config.cohortTarget || "all"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">ring</span>
                <span className="text-white">Ring {config.activeRing}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-950/70 p-4 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
              Blast Radius
            </p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-800">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  config.enabled ? "bg-emerald-300" : "bg-gray-600"
                }`}
                style={{ width: `${Math.min(100, (impact.impacted / 1200) * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-gray-400">
              {impact.impacted.toLocaleString()} impacted from a simulated live
              traffic window.
            </p>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-950/70 p-4 shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
              Decision Trace
            </p>
            <ol className="mt-4 space-y-3 text-sm text-gray-300">
              <li>1. Kill switch must be enabled.</li>
              <li>2. City or user type must match the cohort target.</li>
              <li>3. User ring must be within the selected rollout ring.</li>
              <li>4. Bucket must be below the rollout percentage.</li>
            </ol>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default DemoApp;
