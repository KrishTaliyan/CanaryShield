import type { Condition, ConditionOperator, Guardrail } from "../api/types";
import { formatRate } from "./format";

export interface ConditionDraft {
  attribute: string;
  operator: ConditionOperator;
  value: string;
}

export const operatorLabels: Record<ConditionOperator, string> = {
  eq: "equals",
  neq: "does not equal",
  in: "is one of",
  not_in: "is not one of",
  gt: "is greater than",
  lt: "is less than",
  exists: "is present",
};

export const operators = Object.keys(operatorLabels) as ConditionOperator[];

/** Attributes QuickCart sends with every evaluation. Others work too. */
export const knownAttributes = ["country", "plan", "betaUser", "userId"];

export const isListOperator = (operator: ConditionOperator) => operator === "in" || operator === "not_in";

export function toDrafts(conditions: Condition[]): ConditionDraft[] {
  return conditions.map((condition) => ({
    attribute: condition.attribute,
    operator: condition.operator,
    value: condition.values.map(String).join(", "),
  }));
}

/** Validates drafts and converts them to the API shape; throws with a readable message. */
export function compileConditions(drafts: ConditionDraft[]): Condition[] {
  return drafts.map((draft, index) => {
    const attribute = draft.attribute.trim();
    const value = draft.value.trim();
    if (!attribute) throw new Error(`Condition ${index + 1} needs an attribute.`);
    if (draft.operator === "exists") return { attribute, operator: draft.operator, values: [] };

    const rawValues = isListOperator(draft.operator) ? draft.value.split(",").map((part) => part.trim()) : [value];
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
      if (numbers.some((number) => !Number.isFinite(number))) {
        throw new Error(`Condition ${index + 1} needs a numeric value.`);
      }
      values = numbers;
    } else {
      values = rawValues;
    }
    return { attribute, operator: draft.operator, values };
  });
}

export function describeCondition(condition: Condition) {
  if (condition.operator === "exists") return `${condition.attribute} is present`;
  return `${condition.attribute} ${operatorLabels[condition.operator]} ${condition.values.map(String).join(", ")}`;
}

export function describeConditions(conditions: Condition[]) {
  return conditions.length === 0 ? "Everyone is eligible" : conditions.map(describeCondition).join(" AND ");
}

/** Splits pasted or typed user IDs on commas, spaces and new lines. */
export function parseUserIds(value: string) {
  return value.split(/[\s,]+/).map((userId) => userId.trim()).filter(Boolean);
}

export interface GuardrailDraft {
  enabled: boolean;
  thresholdPercent: string;
  minSamples: string;
  consecutiveBreaches: string;
}

/** Platform defaults (infra/migrations/0001_init.sql). */
export const defaultGuardrail: Guardrail = { enabled: true, errorRateThreshold: 0.03, minSamples: 20, consecutiveBreaches: 2 };

export function toGuardrailDraft(guardrail: Guardrail): GuardrailDraft {
  return {
    enabled: guardrail.enabled,
    thresholdPercent: String(Math.round(guardrail.errorRateThreshold * 10000) / 100),
    minSamples: String(guardrail.minSamples),
    consecutiveBreaches: String(guardrail.consecutiveBreaches),
  };
}

export function compileGuardrail(draft: GuardrailDraft): Guardrail {
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

export function describeGuardrail(guardrail: Guardrail) {
  if (!guardrail.enabled) return "Off: no automatic rollback";
  return `Roll back above ${formatRate(guardrail.errorRateThreshold, 1)} errors · ${guardrail.minSamples} samples · ${guardrail.consecutiveBreaches} checks in a row`;
}

export function sameGuardrail(a: Guardrail, b: Guardrail) {
  return a.enabled === b.enabled
    && a.errorRateThreshold === b.errorRateThreshold
    && a.minSamples === b.minSamples
    && a.consecutiveBreaches === b.consecutiveBreaches;
}
