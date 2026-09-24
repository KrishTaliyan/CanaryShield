import { apiRequest } from "./client";
import type {
  Condition,
  CreateFlagRequest,
  Event,
  Flag,
  GuardrailRequest,
  Health,
  Metrics,
  MetricsRange,
  Overrides,
  PatchFlagRequest,
  PlaygroundEvaluationRequest,
  EvaluationResult,
} from "./types";

export function listFlags() {
  return apiRequest<{ flags: Flag[] }>("/flags");
}

export function createFlag(input: CreateFlagRequest) {
  return apiRequest<Flag>("/flags", { method: "POST", body: JSON.stringify(input) });
}

export function getFlag(key: string) {
  return apiRequest<Flag>(`/flags/${encodeURIComponent(key)}`);
}

export function patchFlag(key: string, input: PatchFlagRequest) {
  return apiRequest<Flag>(`/flags/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function setConditions(key: string, conditions: Condition[]) {
  return apiRequest<Flag>(`/flags/${encodeURIComponent(key)}/conditions`, {
    method: "PUT",
    body: JSON.stringify({ conditions }),
  });
}

export function setOverrides(key: string, overrides: Overrides) {
  return apiRequest<Flag>(`/flags/${encodeURIComponent(key)}/overrides`, {
    method: "PUT",
    body: JSON.stringify(overrides),
  });
}

export function setGuardrail(key: string, guardrail: GuardrailRequest) {
  return apiRequest<Flag>(`/flags/${encodeURIComponent(key)}/guardrail`, {
    method: "PUT",
    body: JSON.stringify(guardrail),
  });
}

function rolloutAction(key: string, action: string) {
  return apiRequest<Flag>(`/flags/${encodeURIComponent(key)}/rollout/${action}`, { method: "POST" });
}

export function startRollout(key: string) {
  return rolloutAction(key, "start");
}

export function advanceRollout(key: string) {
  return rolloutAction(key, "advance");
}

export function setRolloutPercentage(key: string, percentage: number) {
  return apiRequest<Flag>(`/flags/${encodeURIComponent(key)}/rollout/set`, {
    method: "POST",
    body: JSON.stringify({ percentage }),
  });
}

export function pauseRollout(key: string) {
  return rolloutAction(key, "pause");
}

export function resumeRollout(key: string) {
  return rolloutAction(key, "resume");
}

export function rollbackFlag(key: string, reason: string) {
  return apiRequest<Flag>(`/flags/${encodeURIComponent(key)}/rollback`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function killFlag(key: string) {
  return apiRequest<Flag>(`/flags/${encodeURIComponent(key)}/kill`, { method: "POST" });
}

export function getFlagHealth(key: string) {
  return apiRequest<Health>(`/flags/${encodeURIComponent(key)}/health`);
}

export function getFlagMetrics(key: string, range: MetricsRange = "5m") {
  return apiRequest<Metrics>(`/flags/${encodeURIComponent(key)}/metrics?range=${range}`);
}

export function getFlagEvents(key: string, limit = 50) {
  return apiRequest<{ events: Event[] }>(`/flags/${encodeURIComponent(key)}/events?limit=${limit}`);
}

export function evaluateInPlayground(input: PlaygroundEvaluationRequest) {
  return apiRequest<EvaluationResult>("/playground/evaluate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
