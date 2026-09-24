const platformUrl = (process.env.PLATFORM_URL || "http://localhost:8080").replace(/\/$/, "");
const sdkApiKey = process.env.SDK_API_KEY || "dev-sdk-key";
const cacheDurationMs = 1000;
const requestTimeoutMs = 50;
const evaluations = new Map();

function stableResult() {
  return { variant: "old", reason: "PLATFORM_UNAVAILABLE" };
}

function pruneExpired(now) {
  for (const [key, entry] of evaluations) {
    if (entry.expiresAt <= now) evaluations.delete(key);
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
        value = { variant: result.variant, reason: result.reason };
      } else if (result.variant === "off" && typeof result.reason === "string") {
        value = { variant: "old", reason: result.reason };
      }
    }
  } catch {
    value = stableResult();
  }

  evaluations.set(cacheKey, { value, expiresAt: Date.now() + cacheDurationMs });
  return { ...value };
}
