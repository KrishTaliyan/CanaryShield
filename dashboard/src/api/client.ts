import { mockApiRequest, MockApiError } from "../mocks/fixtures";
import type { ApiErrorBody } from "./types";

const platformUrl = (import.meta.env.VITE_PLATFORM_URL || "http://localhost:8080").replace(/\/$/, "");
export const adminToken = import.meta.env.VITE_ADMIN_TOKEN || "dev-admin-token";
export const useMocks = import.meta.env.VITE_USE_MOCKS === "true";

export function eventStreamUrl() {
  return `${platformUrl}/api/v1/stream?token=${encodeURIComponent(adminToken)}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (useMocks) {
    try {
      return await mockApiRequest<T>(path, options);
    } catch (error) {
      if (error instanceof MockApiError) {
        throw new ApiError(error.message, error.code, error.status);
      }
      throw error;
    }
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${adminToken}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${platformUrl}/api/v1${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Unable to reach the platform API.", "INTERNAL", 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("The platform returned an invalid response.", "INTERNAL", response.status);
  }

  if (!response.ok) {
    const errorBody = payload as Partial<ApiErrorBody>;
    throw new ApiError(
      errorBody.error?.message || "The platform request failed.",
      errorBody.error?.code || "INTERNAL",
      response.status,
    );
  }

  return payload as T;
}
