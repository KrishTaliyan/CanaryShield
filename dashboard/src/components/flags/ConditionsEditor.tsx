import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Filter, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { setConditions } from "../../api/flags";
import type { Condition, ConditionOperator } from "../../api/types";
import { useToast } from "../../hooks/useAppContext";
import {
  compileConditions,
  describeConditions,
  isListOperator,
  knownAttributes,
  operatorLabels,
  operators,
  toDrafts,
  type ConditionDraft,
} from "../../lib/targeting";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Card, { CardHeader } from "../ui/Card";
import IconButton from "../ui/IconButton";
import InfoTip from "../ui/InfoTip";

const fieldClass = "well h-10 w-full px-3 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent";

interface ConditionsFieldsProps {
  drafts: ConditionDraft[];
  onChange: (drafts: ConditionDraft[]) => void;
}

/** Editable list of targeting conditions (controlled). */
export function ConditionsFields({ drafts, onChange }: ConditionsFieldsProps) {
  const listId = useId();

  function update(index: number, change: Partial<ConditionDraft>) {
    onChange(drafts.map((draft, row) => {
      if (row !== index) return draft;
      const next = { ...draft, ...change };
      // betaUser is a boolean: keep a valid value when switching to it.
      if (next.attribute === "betaUser" && !isListOperator(next.operator) && next.operator !== "exists" && next.value !== "true" && next.value !== "false") {
        next.value = "true";
      }
      return next;
    }));
  }

  return (
    <div className="space-y-3">
      <datalist id={listId}>
        {knownAttributes.map((attribute) => <option key={attribute} value={attribute} />)}
      </datalist>
      {drafts.length === 0 ? (
        <div className="well flex flex-col items-center gap-1 px-4 py-6 text-center">
          <p className="text-sm font-medium text-ink">No conditions: every user is eligible</p>
          <p className="text-[13px] text-ink-muted">Add a condition to limit the rollout to, say, one country or plan.</p>
        </div>
      ) : (
        drafts.map((draft, index) => {
          const valueId = `${listId}-value-${index}`;
          return (
            <div key={index} className="rounded-control border border-line/80 bg-surface-2/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{index === 0 ? "If" : "And"}</span>
                <IconButton
                  label={`Remove condition ${index + 1}`}
                  icon={<Trash2 size={15} />}
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange(drafts.filter((_, row) => row !== index))}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor={`${listId}-attr-${index}`}>Attribute</label>
                  <input
                    id={`${listId}-attr-${index}`}
                    list={listId}
                    value={draft.attribute}
                    onChange={(event) => update(index, { attribute: event.target.value })}
                    placeholder="country"
                    autoComplete="off"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor={`${listId}-op-${index}`}>Operator</label>
                  <select
                    id={`${listId}-op-${index}`}
                    value={draft.operator}
                    onChange={(event) => update(index, { operator: event.target.value as ConditionOperator })}
                    className={fieldClass}
                  >
                    {operators.map((operator) => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor={valueId}>Value</label>
                  {draft.operator === "exists" ? (
                    <p className="flex h-10 items-center text-sm text-ink-subtle">No value needed</p>
                  ) : draft.attribute === "betaUser" && !isListOperator(draft.operator) ? (
                    <select id={valueId} value={draft.value === "false" ? "false" : "true"} onChange={(event) => update(index, { value: event.target.value })} className={fieldClass}>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      id={valueId}
                      value={draft.value}
                      onChange={(event) => update(index, { value: event.target.value })}
                      placeholder={isListOperator(draft.operator) ? "India, US" : "India"}
                      inputMode={draft.operator === "gt" || draft.operator === "lt" ? "decimal" : undefined}
                      className={fieldClass}
                    />
                  )}
                </div>
              </div>
              {isListOperator(draft.operator) && <p className="mt-1.5 text-xs text-ink-subtle">Separate values with commas.</p>}
            </div>
          );
        })
      )}
      <Button
        variant="secondary"
        size="sm"
        icon={<Plus size={15} />}
        onClick={() => onChange([...drafts, { attribute: "country", operator: "eq", value: "" }])}
      >
        Add condition
      </Button>
    </div>
  );
}

/** Targeting conditions of an existing flag, saved with PUT /conditions. */
export default function ConditionsEditor({ flagKey, conditions }: { flagKey: string; conditions: Condition[] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState(() => toDrafts(conditions));
  const [validationError, setValidationError] = useState<string | null>(null);
  const saved = useMemo(() => JSON.stringify(toDrafts(conditions)), [conditions]);
  const dirty = JSON.stringify(drafts) !== saved;

  const mutation = useMutation({
    mutationFn: (value: Condition[]) => setConditions(flagKey, value),
    onSuccess: async (flag) => {
      toast({ tone: "success", title: "Targeting saved", description: describeConditions(flag.conditions) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flags"] }),
        queryClient.invalidateQueries({ queryKey: ["events", flagKey] }),
      ]);
    },
    onError: (error) => toast({ tone: "error", title: "Could not save targeting", description: error.message }),
  });

  useEffect(() => setDrafts(toDrafts(conditions)), [conditions]);

  function save() {
    try {
      const compiled = compileConditions(drafts);
      setValidationError(null);
      mutation.mutate(compiled);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Conditions are invalid.");
    }
  }

  let preview = "";
  try {
    preview = describeConditions(compileConditions(drafts));
  } catch {
    preview = "Finish the conditions to see who is eligible.";
  }

  return (
    <Card>
      <CardHeader
        icon={<Filter size={18} />}
        title={<span className="inline-flex items-center gap-1.5">Targeting conditions <InfoTip term="targeting" /></span>}
        description="Only users matching every condition are eligible for the rollout percentage."
      />
      <ConditionsFields
        drafts={drafts}
        onChange={(next) => {
          setDrafts(next);
          setValidationError(null);
        }}
      />
      <div className="mt-4 rounded-control bg-surface-2 px-3 py-2.5 text-[13px] text-ink-muted">
        <span className="font-semibold text-ink">Eligible: </span>{preview}
      </div>
      {validationError && <Alert tone="danger" title={validationError} className="mt-3" />}
      {mutation.error && <Alert tone="danger" title="Save failed" className="mt-3">{mutation.error.message}</Alert>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={save} loading={mutation.isPending} disabled={!dirty}>Save targeting</Button>
        <Button variant="ghost" icon={<RotateCcw size={15} />} disabled={!dirty || mutation.isPending} onClick={() => setDrafts(toDrafts(conditions))}>Discard changes</Button>
        {dirty && <span className="text-xs font-medium text-warning">Unsaved changes</span>}
      </div>
    </Card>
  );
}
