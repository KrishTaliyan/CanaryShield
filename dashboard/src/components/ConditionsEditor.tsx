import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setConditions } from "../api/flags";
import type { Condition, ConditionOperator } from "../api/types";

interface ConditionDraft {
  attribute: string;
  operator: ConditionOperator;
  value: string;
}

interface ConditionsEditorProps {
  flagKey: string;
  conditions: Condition[];
}

const operators: ConditionOperator[] = ["eq", "neq", "in", "not_in", "gt", "lt", "exists"];
const inputClass = "w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

function toDrafts(conditions: Condition[]): ConditionDraft[] {
  return conditions.map((condition) => ({
    attribute: condition.attribute,
    operator: condition.operator,
    value: condition.values.map(String).join(", "),
  }));
}

function compileConditions(drafts: ConditionDraft[]): Condition[] {
  return drafts.map((draft, index) => {
    const attribute = draft.attribute.trim();
    const value = draft.value.trim();
    if (!attribute) throw new Error(`Condition ${index + 1} needs an attribute.`);
    if (draft.operator === "exists") return { attribute, operator: draft.operator, values: [] };

    const rawValues = draft.operator === "in" || draft.operator === "not_in"
      ? draft.value.split(",").map((part) => part.trim())
      : [value];
    if (rawValues.length === 0 || rawValues.some((part) => !part)) {
      throw new Error(`Condition ${index + 1} needs a value.`);
    }

    let values: Array<string | number | boolean>;
    if (attribute === "betaUser") {
      if (rawValues.some((part) => part !== "true" && part !== "false")) {
        throw new Error(`Condition ${index + 1} must use true or false for betaUser.`);
      }
      values = rawValues.map((part) => part === "true");
    } else if (draft.operator === "gt" || draft.operator === "lt") {
      const numbers = rawValues.map(Number);
      if (numbers.some((number, valueIndex) => !rawValues[valueIndex] || !Number.isFinite(number))) {
        throw new Error(`Condition ${index + 1} needs a numeric value.`);
      }
      values = numbers;
    } else {
      values = rawValues;
    }

    return { attribute, operator: draft.operator, values };
  });
}

export default function ConditionsEditor({ flagKey, conditions }: ConditionsEditorProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState(() => toDrafts(conditions));
  const [validationError, setValidationError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: Condition[] }) => setConditions(key, value),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flags", flagKey] }),
        queryClient.invalidateQueries({ queryKey: ["flags"] }),
      ]);
    },
  });

  useEffect(() => setDrafts(toDrafts(conditions)), [conditions]);

  function updateDraft(index: number, next: Partial<ConditionDraft>) {
    mutation.reset();
    setValidationError(null);
    setDrafts((current) => current.map((draft, row) => {
      if (row !== index) return draft;
      const updated = { ...draft, ...next };
      if (
        updated.attribute === "betaUser"
        && updated.operator !== "in"
        && updated.operator !== "not_in"
        && updated.operator !== "exists"
        && updated.value !== "true"
        && updated.value !== "false"
      ) updated.value = "true";
      return updated;
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      mutation.mutate({ key: flagKey, value: compileConditions(drafts) });
      setValidationError(null);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Conditions are invalid.");
    }
  }

  return (
    <section aria-labelledby="conditions-heading" className="border-y border-neutral-200 bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-950" id="conditions-heading">Conditions</h2>
        <button
          className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          onClick={() => {
            mutation.reset();
            setValidationError(null);
            setDrafts((current) => [...current, { attribute: "country", operator: "eq", value: "India" }]);
          }}
          type="button"
        >Add condition</button>
      </div>
      <form className="mt-4" onSubmit={submit}>
        {drafts.length === 0 ? (
          <p className="border-y border-neutral-200 py-4 text-sm text-neutral-600">No conditions</p>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft, index) => (
              <div className="grid grid-cols-1 items-end gap-3 border-b border-neutral-100 pb-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]" key={index}>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor={`condition-attribute-${index}`}>Attribute</label>
                  <input
                    className={inputClass}
                    id={`condition-attribute-${index}`}
                    onChange={(event) => updateDraft(index, { attribute: event.target.value })}
                    placeholder="country"
                    value={draft.attribute}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor={`condition-operator-${index}`}>Operator</label>
                  <select
                    className={inputClass}
                    id={`condition-operator-${index}`}
                    onChange={(event) => updateDraft(index, { operator: event.target.value as ConditionOperator })}
                    value={draft.operator}
                  >
                    {operators.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor={`condition-value-${index}`}>Value</label>
                  {draft.operator === "exists" ? (
                    <div className="py-2 text-sm text-neutral-500">Not required</div>
                  ) : draft.attribute === "betaUser" && draft.operator !== "in" && draft.operator !== "not_in" ? (
                    <select
                      className={inputClass}
                      id={`condition-value-${index}`}
                      onChange={(event) => updateDraft(index, { value: event.target.value })}
                      value={draft.value === "false" ? "false" : "true"}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      className={inputClass}
                      id={`condition-value-${index}`}
                      onChange={(event) => updateDraft(index, { value: event.target.value })}
                      placeholder={draft.operator === "in" || draft.operator === "not_in" ? "India, US" : "Value"}
                      type={draft.operator === "gt" || draft.operator === "lt" ? "number" : "text"}
                      value={draft.value}
                    />
                  )}
                </div>
                <button
                  aria-label={`Remove condition ${index + 1}`}
                  className="rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                  onClick={() => {
                    mutation.reset();
                    setValidationError(null);
                    setDrafts((current) => current.filter((_, row) => row !== index));
                  }}
                  type="button"
                >Remove</button>
              </div>
            ))}
          </div>
        )}
        {(validationError || mutation.error) && (
          <p className="mt-3 text-sm text-red-800" role="alert">{validationError || mutation.error?.message}</p>
        )}
        {mutation.isSuccess && <p className="mt-3 text-sm text-emerald-800" role="status">Conditions saved</p>}
        <button
          className="mt-4 rounded bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={mutation.isPending}
          type="submit"
        >{mutation.isPending ? "Saving…" : "Save conditions"}</button>
      </form>
    </section>
  );
}
