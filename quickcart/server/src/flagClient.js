const platformUrl = (process.env.PLATFORM_URL || "http://localhost:8080").replace(/\/$/, "");
const sdkApiKey = process.env.SDK_API_KEY || "dev-sdk-key";
const cacheDurationMs = 1000;
const requestTimeoutMs = 50;
const evaluations = new Map();

function stableResult() {
  return { variant: "old", reason: "PLATFORM_UNAVAILABLE", rolloutPercentage: null };
}

function rolloutOf(result) {
  return typeof result.rolloutPercentage === "number" ? result.rolloutPercentage : null;
}

function pruneExpired(now) {
  for (const [key, entry] of evaluations) {
    if (entry.expiresAt <= now) evaluations.delete(key);
  }
}

// warmUpFlagClient opens the first connection to the platform at startup, so
// the first real evaluation does not spend its 50 ms budget on setup. It hits
// /healthz because an evaluation would count in metrics and exposure.
export async function warmUpFlagClient() {
  try {
    await fetch(`${platformUrl}/healthz`, { signal: AbortSignal.timeout(2000) });
  } catch {
    // The platform may start later; evaluations fall back to the old flow.
  }
}

export async function evaluateFlag(flagKey, context) {
  const now = Date.now();
  pruneExpired(now);
  const cacheKey = `${flagKey}:${context.userId}`;
  const cached = evaluations.get(cacheKey);
  if (cached && cached.expiresAt > now) return { ...cached.value };

  let value = stableResult();
  try {
    const response = await fetch(`${platformUrl}/sdk/v1/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": sdkApiKey,
      },
      body: JSON.stringify({ flagKey, context }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (response.ok) {
      const result = await response.json();
      if (["old", "new"].includes(result.variant) && typeof result.reason === "string") {
        value = { variant: result.variant, reason: result.reason, rolloutPercentage: rolloutOf(result) };
      } else if (result.variant === "off" && typeof result.reason === "string") {
        value = { variant: "old", reason: result.reason, rolloutPercentage: rolloutOf(result) };
      }
    }
  } catch {
    value = stableResult();
  }

  evaluations.set(cacheKey, { value, expiresAt: Date.now() + cacheDurationMs });
  return { ...value };
}
