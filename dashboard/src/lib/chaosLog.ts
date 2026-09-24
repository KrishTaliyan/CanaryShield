import type { ChaosConfig } from "../api/types";
import { storage } from "./storage";

/**
 * QuickCart keeps no chaos history, so experiments started or stopped from
 * this dashboard are recorded in this browser only.
 */
export interface ChaosLogEntry {
  id: string;
  action: "started" | "stopped";
  at: string;
  errorRate: number;
  latencyMs: number;
  latencyRate: number;
  durationSec: number;
}

const key = "canaryshield.chaos-log";
const limit = 50;
const listeners = new Set<() => void>();
let entries: ChaosLogEntry[] = storage.get<ChaosLogEntry[]>(key, []);

export const chaosLog = {
  get: () => entries,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  record(action: ChaosLogEntry["action"], config: ChaosConfig | { errorRate: number; latencyMs: number; latencyRate: number; durationSec: number }) {
    const entry: ChaosLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      at: new Date().toISOString(),
      errorRate: config.errorRate,
      latencyMs: config.latencyMs,
      latencyRate: config.latencyRate,
      durationSec: config.durationSec,
    };
    entries = [entry, ...entries].slice(0, limit);
    storage.set(key, entries);
    listeners.forEach((listener) => listener());
  },
  clear() {
    entries = [];
    storage.set(key, entries);
    listeners.forEach((listener) => listener());
  },
};
