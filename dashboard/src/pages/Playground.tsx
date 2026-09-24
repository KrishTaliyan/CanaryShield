import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { evaluateInPlayground } from "../api/flags";
import type { EvaluationResult } from "../api/types";
import { useFlags } from "../hooks/useFlags";

export default function Playground() {
  const flagsQuery = useFlags();
  const [flagKey, setFlagKey] = useState("");
  const [userId, setUserId] = useState("u_playground");
  const [country, setCountry] = useState("India");
  const [plan, setPlan] = useState<"free" | "premium">("free");
  const [betaUser, setBetaUser] = useState(false);
  const evaluation = useMutation({ mutationFn: evaluateInPlayground });

  useEffect(() => {
    const flags = flagsQuery.data?.flags ?? [];
    if (flags.length > 0 && !flags.some((flag) => flag.key === flagKey)) setFlagKey(flags[0].key);
  }, [flagKey, flagsQuery.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    evaluation.mutate({
      flagKey,
      context: {
        userId: userId.trim(),
        country: country.trim(),
        plan,
        betaUser,
      },
    });
  }

  const result: EvaluationResult | undefined = evaluation.data;
  return (
    <main className="mx-auto max-w-5xl p-5 md:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-950">Evaluation playground</h1>
      </header>

      {flagsQuery.isPending ? (
        <p className="text-sm text-neutral-600" aria-busy="true">Loading flags…</p>
      ) : flagsQuery.isError ? (
        <p className="text-sm text-red-800" role="alert">{flagsQuery.error.message}</p>
      ) : flagsQuery.data.flags.length === 0 ? (
        <p className="border-y border-neutral-200 py-8 text-sm text-neutral-600">No flags available.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="playground-flag">Flag</label>
              <select className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm" id="playground-flag" onChange={(event) => { setFlagKey(event.target.value); evaluation.reset(); }} value={flagKey}>
                {flagsQuery.data.flags.map((flag) => <option key={flag.key} value={flag.key}>{flag.name} ({flag.key})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="playground-user">User ID</label>
              <input className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm" id="playground-user" onChange={(event) => setUserId(event.target.value)} value={userId} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="playground-country">Country</label>
              <input className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm" id="playground-country" onChange={(event) => setCountry(event.target.value)} value={country} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="playground-plan">Plan</label>
              <select className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm" id="playground-plan" onChange={(event) => setPlan(event.target.value as "free" | "premium")} value={plan}>
                <option value="free">free</option>
                <option value="premium">premium</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-800">
              <input checked={betaUser} className="h-4 w-4 accent-emerald-800" onChange={(event) => setBetaUser(event.target.checked)} type="checkbox" />
              Beta user
            </label>
            {evaluation.error && <p className="text-sm text-red-800" role="alert">{evaluation.error.message}</p>}
            <button className="rounded bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50" disabled={evaluation.isPending || !flagKey} type="submit">
              {evaluation.isPending ? "Evaluating…" : "Evaluate"}
            </button>
          </form>

          <section aria-labelledby="result-heading" className="border-y border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-neutral-950" id="result-heading">Result</h2>
            {result ? (
              <dl className="mt-4 divide-y divide-neutral-200">
                <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-neutral-600">Variant</dt><dd className="font-semibold text-neutral-950">{result.variant}</dd></div>
                <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-neutral-600">Reason</dt><dd className="break-all text-right font-mono text-neutral-900">{result.reason}</dd></div>
                <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-neutral-600">Bucket</dt><dd className="tabular-nums text-neutral-900">{result.bucket}</dd></div>
                <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-neutral-600">Rollout</dt><dd className="tabular-nums text-neutral-900">{result.rolloutPercentage}%</dd></div>
                <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-neutral-600">Flag version</dt><dd className="tabular-nums text-neutral-900">{result.flagVersion}</dd></div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-neutral-600">No evaluation yet.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
