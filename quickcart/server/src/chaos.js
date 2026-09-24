let config = inactiveConfig();
let expiresAtMs = null;

function inactiveConfig() {
  return {
    active: false,
    errorRate: 0,
    latencyMs: 0,
    latencyRate: 0,
    durationSec: 120,
    activeUntil: null,
  };
}

function refreshExpiration() {
  if (expiresAtMs !== null && Date.now() >= expiresAtMs) {
    config = inactiveConfig();
    expiresAtMs = null;
  }
}

export function getChaosConfig() {
  refreshExpiration();
  return { ...config };
}

export function startChaos(input) {
  const durationSec = input.durationSec ?? 120;
  expiresAtMs = Date.now() + durationSec * 1000;
  config = {
    active: true,
    errorRate: input.errorRate,
    latencyMs: input.latencyMs ?? 0,
    latencyRate: input.latencyRate ?? 0,
    durationSec,
    activeUntil: new Date(expiresAtMs).toISOString(),
  };
  return getChaosConfig();
}

export function stopChaos() {
  config = inactiveConfig();
  expiresAtMs = null;
  return { ...config };
}

export async function applyChaos() {
  const current = getChaosConfig();
  if (!current.active) return;

  if (current.latencyMs > 0 && Math.random() < current.latencyRate) {
    await new Promise((resolve) => setTimeout(resolve, current.latencyMs));
  }
  if (Math.random() < current.errorRate) {
    const error = new Error("Simulated payment failure");
    error.code = "GATEWAY_TIMEOUT";
    throw error;
  }
}
