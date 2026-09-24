import { ApiError, platformUrl, useMocks } from "./client";

/** GET /healthz on the platform (no authentication). */
export async function getPlatformHealth(): Promise<{ status: string }> {
  if (useMocks) return { status: "ok" };
  try {
    const response = await fetch(`${platformUrl}/healthz`);
    if (!response.ok) throw new ApiError(`The platform returned ${response.status}.`, "INTERNAL", response.status);
    return (await response.json()) as { status: string };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to reach the platform API.", "INTERNAL", 0);
  }
}
