import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { setGuardrail } from "../api/flags";
import type { Guardrail } from "../api/types";
import type { LayoutContext } from "./Layout";

interface GuardrailFormProps {
  flagKey: string;
  guardrail: Guardrail;
}

interface GuardrailDraft {
  enabled: boolean;
  thresholdPercent: string;
  minSamples: string;
  consecutiveBreaches: string;
}

const inputClass = "w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

function toDraft(guardrail: Guardrail): GuardrailDraft {
  return {
    enabled: guardrail.enabled,
    thresholdPercent: String(Math.round(guardrail.errorRateThreshold * 10000) / 100),
    minSamples: String(guardrail.minSamples),
    consecutiveBreaches: String(guardrail.consecutiveBreaches),
  };
}

function compile(draft: GuardrailDraft): Guardrail {
  const percent = Number(draft.thresholdPercent);
  const minSamples = Number(draft.minSamples);
  const consecutiveBreaches = Number(draft.consecutiveBreaches);
  if (!draft.thresholdPercent.trim() || !Number.isFinite(percent) || percent <= 0 || percent >= 100) {
    throw new Error("Error-rate threshold must be more than 0% and less than 100%.");
  }
  if (!Number.isInteger(minSamples) || minSamples < 1 || minSamples > 10000) {
    throw new Error("Minimum samples must be a whole number from 1 to 10,000.");
  }
  if (!Number.isInteger(consecutiveBreaches) || consecutiveBreaches < 1 || consecutiveBreaches > 10) {
    throw new Error("Consecutive breaches must be a whole number from 1 to 10.");
  }
  return {
    enabled: draft.enabled,
    // Entered as a percentage, sent as a fraction (README 8.1).
    errorRateThreshold: Math.round(percent * 100) / 10000,
    minSamples,
    consecutiveBreaches,
  };
}

export default function GuardrailForm({ flagKey, guardrail }: GuardrailFormProps) {
  const { notify } = useOutletContext<LayoutContext>();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => toDraft(guardrail));
  const [validationError, setValidationError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (value: Guardrail) => setGuardrail(flagKey, value),
    onSuccess: async () => {
      notify("Guardrail saved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flags"] }),
        queryClient.invalidateQueries({ queryKey: ["events", flagKey] }),
        queryClient.invalidateQueries({ queryKey: ["health", flagKey] }),
      ]);
    },
  });

  useEffect(() => {
    setDraft(toDraft(guardrail));
  }, [guardrail]);

  function update(change: Partial<GuardrailDraft>) {
    setDraft((current) => ({ ...current, ...change }));
    setValidationError(null);
    mutation.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      mutation.mutate(compile(draft));
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Check the guardrail values.");
    }
  }

  const error = validationError ?? mutation.error?.message ?? null;

  return (
    <section aria-labelledby="guardrail-heading" className="border-y border-neutral-200 bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-950" id="guardrail-heading">Guardrail</h2>
        <p className="text-sm text-neutral-600">Roll back automatically when the canary error rate stays above the threshold.</p>
      </div>
      <form className="mt-4" onSubmit={submit}>
        <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-neutral-800">
          <input
            checked={draft.enabled}
            className="peer sr-only"
            onChange={(event) => update({ enabled: event.target.checked })}
            role="switch"
            type="checkbox"
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-11 rounded-full bg-neutral-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-emerald-700 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300"
          />
          Automatic rollback {draft.enabled ? "on" : "off"}
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="guardrail-threshold">Error-rate threshold (%)</label>
            <input
              className={inputClass}
              id="guardrail-threshold"
              inputMode="decimal"
              onChange={(event) => update({ thresholdPercent: event.target.value })}
              value={draft.thresholdPercent}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="guardrail-samples">Minimum samples</label>
            <input
              className={inputClass}
              id="guardrail-samples"
              inputMode="numeric"
              onChange={(event) => update({ minSamples: event.target.value })}
              value={draft.minSamples}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-800" htmlFor="guardrail-breaches">Consecutive breaches</label>
            <input
              className={inputClass}
              id="guardrail-breaches"
              inputMode="numeric"
              onChange={(event) => update({ consecutiveBreaches: event.target.value })}
              value={draft.consecutiveBreaches}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-800" role="alert">{error}</p>}
        <button
          className="mt-4 rounded bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={mutation.isPending}
          type="submit"
        >{mutation.isPending ? "Saving…" : "Save guardrail"}</button>
      </form>
    </section>
  );
}
