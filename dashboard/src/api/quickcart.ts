import { mockPaymentCounters, mockPersonas } from "../mocks/fixtures";
import { ApiError, useMocks } from "./client";
import type { Persona } from "./types";

export const quickcartUrl = (import.meta.env.VITE_QUICKCART_URL || "http://localhost:4000").replace(/\/$/, "");
export const quickcartWebUrl = (import.meta.env.VITE_QUICKCART_WEB_URL || "http://localhost:5174").replace(/\/$/, "");

/** Cumulative QuickCart payment counters, read from its Prometheus /metrics. */
export interface PaymentCounters {
  oldSuccess: number;
  oldError: number;
  newSuccess: number;
  newError: number;
  /** When the counters were read (ms since epoch). */
  readAt: number;
}

async function quickcartFetch(path: string): Promise<Response> {
  try {
    const response = await fetch(`${quickcartUrl}${path}`);
    if (!response.ok) throw new ApiError(`QuickCart returned ${response.status}.`, "INTERNAL", response.status);
    return response;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to reach QuickCart. Check that its server is running.", "INTERNAL", 0);
  }
}

export async function getPersonas(): Promise<Persona[]> {
  if (useMocks) return structuredClone(mockPersonas);
  const response = await quickcartFetch("/api/personas");
  const body = (await response.json()) as { personas?: Persona[] };
  return body.personas ?? [];
}

export async function getQuickCartHealth(): Promise<{ status: string }> {
  if (useMocks) return { status: "ok" };
  const response = await quickcartFetch("/healthz");
  return (await response.json()) as { status: string };
}

const counterLine = /^quickcart_payment_requests_total\{([^}]*)\}\s+([0-9.eE+-]+)/;

export async function getPaymentCounters(): Promise<PaymentCounters> {
  if (useMocks) return mockPaymentCounters();
  const response = await quickcartFetch("/metrics");
  const text = await response.text();
  const counters: PaymentCounters = { oldSuccess: 0, oldError: 0, newSuccess: 0, newError: 0, readAt: Date.now() };
  for (const line of text.split("\n")) {
    const match = counterLine.exec(line);
    if (!match) continue;
    const flow = /flow="(old|new)"/.exec(match[1])?.[1];
    const outcome = /outcome="(success|error)"/.exec(match[1])?.[1];
    const value = Number(match[2]);
    if (!flow || !outcome || !Number.isFinite(value)) continue;
    if (flow === "old" && outcome === "success") counters.oldSuccess = value;
    if (flow === "old" && outcome === "error") counters.oldError = value;
    if (flow === "new" && outcome === "success") counters.newSuccess = value;
    if (flow === "new" && outcome === "error") counters.newError = value;
  }
  return counters;
}
