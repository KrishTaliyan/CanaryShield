import { mockChaosRequest } from "../mocks/fixtures";
import { ApiError, useMocks } from "./client";
import type { ApiErrorBody, ChaosConfig, ChaosRequest } from "./types";

const quickcartUrl = (import.meta.env.VITE_QUICKCART_URL || "http://localhost:4000").replace(/\/$/, "");

async function chaosRequest(options: RequestInit = {}): Promise<ChaosConfig> {
  if (useMocks) return mockChaosRequest(options);

  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${quickcartUrl}/internal/chaos`, { ...options, headers });
  } catch {
    throw new ApiError("Unable to reach QuickCart. Check that its server is running.", "INTERNAL", 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("QuickCart returned an invalid response.", "INTERNAL", response.status);
  }

  if (!response.ok) {
    const errorBody = payload as Partial<ApiErrorBody>;
    throw new ApiError(
      errorBody.error?.message || "The chaos request failed.",
      errorBody.error?.code || "INTERNAL",
      response.status,
    );
  }
  return payload as ChaosConfig;
}

export function getChaos() {
  return chaosRequest();
}

export function startChaos(input: ChaosRequest) {
  return chaosRequest({ method: "POST", body: JSON.stringify(input) });
}

export function stopChaos() {
  return chaosRequest({ method: "DELETE" });
}
