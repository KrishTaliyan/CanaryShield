import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { setGuardrail } from "../../api/flags";
import type { Guardrail } from "../../api/types";
import { useToast } from "../../hooks/useAppContext";
import { compileGuardrail, describeGuardrail, toGuardrailDraft, type GuardrailDraft } from "../../lib/targeting";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Card, { CardHeader } from "../ui/Card";
import InfoTip from "../ui/InfoTip";
import Toggle from "../ui/Toggle";

const fieldClass = "well h-10 w-full px-3 text-sm tabular text-ink outline-none focus:border-accent disabled:opacity-50";

/** Guardrail inputs (controlled), with a plain-language summary. */
export function GuardrailFields({ draft, onChange }: { draft: GuardrailDraft; onChange: (change: Partial<GuardrailDraft>) => void }) {
  const id = useId();
  const breaches = Number(draft.consecutiveBreaches);
  const secondsToRollback = Number.isInteger(breaches) && breaches > 0 ? breaches * 5 : null;

  return (
    <div className="space-y-4">
      <Toggle
        checked={draft.enabled}
        onChange={(enabled) => onChange({ enabled })}
        label="Automatic rollback"
        description={draft.enabled ? "The guardian rolls the flag back when the canary misbehaves." : "The guardian only reports health; it never rolls back."}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-threshold`} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink">
            Error threshold <InfoTip term="errorThreshold" />
          </label>
          <div className="relative">
            <input
              id={`${id}-threshold`}
              inputMode="decimal"
              value={draft.thresholdPercent}
              disabled={!draft.enabled}
              onChange={(event) => onChange({ thresholdPercent: event.target.value })}
              className={`${fieldClass} pr-8`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-subtle">%</span>
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-samples`} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink">
            Minimum samples <InfoTip term="minSamples" />
          </label>
          <input
            id={`${id}-samples`}
            inputMode="numeric"
            value={draft.minSamples}
            disabled={!draft.enabled}
            onChange={(event) => onChange({ minSamples: event.target.value })}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-breaches`} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink">
            Checks in a row <InfoTip term="consecutiveBreaches" />
          </label>
          <input
            id={`${id}-breaches`}
            inputMode="numeric"
            value={draft.consecutiveBreaches}
            disabled={!draft.enabled}
            onChange={(event) => onChange({ consecutiveBreaches: event.target.value })}
            className={fieldClass}
          />
        </div>
      </div>
      {draft.enabled && (
        <p className="rounded-control bg-surface-2 px-3 py-2.5 text-[13px] text-ink-muted">
          The guardian checks every 5 seconds. If the canary error rate is above {draft.thresholdPercent || "?"}% on{" "}
          {draft.consecutiveBreaches || "?"} check{breaches === 1 ? "" : "s"} in a row, each with at least {draft.minSamples || "?"} requests,
          it rolls back{secondsToRollback ? `, about ${secondsToRollback} seconds after the problem starts` : ""}.
        </p>
      )}
    </div>
  );
}

/** Guardrail of an existing flag, saved with PUT /guardrail. */
export default function GuardrailForm({ flagKey, guardrail }: { flagKey: string; guardrail: Guardrail }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => toGuardrailDraft(guardrail));
  const [validationError, setValidationError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toGuardrailDraft(guardrail));

  const mutation = useMutation({
    mutationFn: (value: Guardrail) => setGuardrail(flagKey, value),
    onSuccess: async (flag) => {
      toast({ tone: "success", title: "Guardrail saved", description: describeGuardrail(flag.guardrail) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flags"] }),
        queryClient.invalidateQueries({ queryKey: ["events", flagKey] }),
        queryClient.invalidateQueries({ queryKey: ["health", flagKey] }),
      ]);
    },
    onError: (error) => toast({ tone: "error", title: "Could not save guardrail", description: error.message }),
  });

  useEffect(() => setDraft(toGuardrailDraft(guardrail)), [guardrail]);

  function save() {
    try {
      const compiled = compileGuardrail(draft);
      setValidationError(null);
      mutation.mutate(compiled);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Check the guardrail values.");
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<ShieldCheck size={18} />}
        title={<span className="inline-flex items-center gap-1.5">Guardrail <InfoTip term="guardian" /></span>}
        description="When to roll back automatically."
      />
      <GuardrailFields
        draft={draft}
        onChange={(change) => {
          setDraft((current) => ({ ...current, ...change }));
          setValidationError(null);
        }}
      />
      {(validationError || mutation.error) && (
        <Alert tone="danger" title={validationError ?? "Save failed"} className="mt-3">{validationError ? undefined : mutation.error?.message}</Alert>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={save} loading={mutation.isPending} disabled={!dirty}>Save guardrail</Button>
        <Button variant="ghost" icon={<RotateCcw size={15} />} disabled={!dirty || mutation.isPending} onClick={() => setDraft(toGuardrailDraft(guardrail))}>Discard changes</Button>
        {dirty && <span className="text-xs font-medium text-warning">Unsaved changes</span>}
      </div>
    </Card>
  );
}
