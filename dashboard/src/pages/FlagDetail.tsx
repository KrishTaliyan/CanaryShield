import { Link, useParams } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import RolloutRing from "../components/RolloutRing";
import ConditionsEditor from "../components/ConditionsEditor";
import OverridesEditor from "../components/OverridesEditor";
import { useFlag, useFlagActions } from "../hooks/useFlag";

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function FlagDetail() {
  const { key = "" } = useParams();
  const flagQuery = useFlag(key);
  const actions = useFlagActions(key);

  if (flagQuery.isPending) {
    return <main className="mx-auto max-w-6xl p-5 md:p-8" aria-busy="true">Loading flag…</main>;
  }
  if (flagQuery.isError) {
    return (
      <main className="mx-auto max-w-6xl p-5 md:p-8">
        <Link className="text-sm font-medium text-emerald-800 hover:underline" to="/">Back to flags</Link>
        <p className="mt-5 text-sm text-red-800" role="alert">{flagQuery.error.message}</p>
        <button className="mt-3 rounded border border-neutral-300 px-3 py-2 text-sm" onClick={() => void flagQuery.refetch()} type="button">Retry</button>
      </main>
    );
  }

  const flag = flagQuery.data;
  return (
    <main className="mx-auto max-w-6xl p-5 md:p-8">
      <Link className="text-sm font-medium text-emerald-800 hover:underline" to="/">Back to flags</Link>
      <header className="mb-6 mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-neutral-950">{flag.name}</h1>
            <StatusBadge status={flag.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-neutral-600">{flag.key}</p>
          {flag.description && <p className="mt-3 max-w-2xl text-sm text-neutral-700">{flag.description}</p>}
        </div>
      </header>

      <RolloutRing
        error={actions.error?.message ?? null}
        flag={flag}
        isPending={actions.isPending}
        onAction={actions.runAction}
      />

      <section className="mt-8" aria-labelledby="configuration-heading">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="configuration-heading" className="text-lg font-semibold text-neutral-950">Configuration</h2>
          <span className="text-xs text-neutral-500">Version {flag.version}</span>
        </div>
        <dl className="grid grid-cols-1 border-y border-neutral-200 bg-white sm:grid-cols-2 lg:grid-cols-3">
          <div className="border-b border-neutral-200 p-4 sm:border-r">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Enabled</dt>
            <dd className="mt-1 text-sm text-neutral-900">{flag.enabled ? "Yes" : "No"}</dd>
          </div>
          <div className="border-b border-neutral-200 p-4 lg:border-r">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Variants</dt>
            <dd className="mt-1 text-sm text-neutral-900">{flag.controlVariant} → {flag.treatmentVariant}</dd>
          </div>
          <div className="border-b border-neutral-200 p-4 sm:border-r lg:border-r-0">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Health</dt>
            <dd className="mt-1 text-sm text-neutral-900">{flag.healthStatus}</dd>
          </div>
          <div className="border-b border-neutral-200 p-4 lg:border-r">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Rollout steps</dt>
            <dd className="mt-1 text-sm tabular-nums text-neutral-900">{flag.rolloutSteps.map((step) => `${step}%`).join(", ")}</dd>
          </div>
          <div className="border-b border-neutral-200 p-4 sm:border-r">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Conditions</dt>
            <dd className="mt-1 text-sm text-neutral-900">
              {flag.conditions.length ? flag.conditions.map((condition) => `${condition.attribute} ${condition.operator} ${condition.values.join(", ")}`).join(" AND ") : "None"}
            </dd>
          </div>
          <div className="border-b border-neutral-200 p-4">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Guardrail</dt>
            <dd className="mt-1 text-sm text-neutral-900">
              {flag.guardrail.enabled
                ? `${(flag.guardrail.errorRateThreshold * 100).toFixed(1)}% · ${flag.guardrail.minSamples} samples · ${flag.guardrail.consecutiveBreaches} breaches`
                : "Disabled"}
            </dd>
          </div>
          <div className="border-b border-neutral-200 p-4 sm:border-r lg:border-b-0">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Included users</dt>
            <dd className="mt-1 break-words text-sm text-neutral-900">{flag.overrides.include.length ? flag.overrides.include.join(", ") : "None"}</dd>
          </div>
          <div className="border-b border-neutral-200 p-4 lg:border-b-0 lg:border-r">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Excluded users</dt>
            <dd className="mt-1 break-words text-sm text-neutral-900">{flag.overrides.exclude.length ? flag.overrides.exclude.join(", ") : "None"}</dd>
          </div>
          <div className="p-4">
            <dt className="text-xs font-semibold uppercase text-neutral-500">Last updated</dt>
            <dd className="mt-1 text-sm text-neutral-900">{formatTimestamp(flag.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-8 space-y-8">
        <ConditionsEditor flagKey={flag.key} conditions={flag.conditions} />
        <OverridesEditor flagKey={flag.key} overrides={flag.overrides} />
      </div>
    </main>
  );
}
