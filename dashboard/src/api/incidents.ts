import { apiRequest } from "./client";
import type { Incident } from "./types";

export function listIncidents(status?: "open" | "resolved") {
  const query = status ? `?status=${status}` : "";
  return apiRequest<{ incidents: Incident[] }>(`/incidents${query}`);
}

export function getIncident(id: string) {
  return apiRequest<Incident>(`/incidents/${encodeURIComponent(id)}`);
}

export function resolveIncident(id: string) {
  return apiRequest<Incident>(`/incidents/${encodeURIComponent(id)}/resolve`, { method: "POST" });
}
