import type { MetricsRange } from "../api/types";
import { storage } from "./storage";

/** Settings that live in this browser only. */
export interface Preferences {
  chartRange: MetricsRange;
  sidebarCollapsed: boolean;
  toastOnGuardian: boolean;
  toastOnHealth: boolean;
  notifyOnReleases: boolean;
  chaosErrorPercent: number;
  chaosDurationSec: number;
  chaosLatencyMs: number;
}

export const defaultPreferences: Preferences = {
  chartRange: "15m",
  sidebarCollapsed: false,
  toastOnGuardian: true,
  toastOnHealth: true,
  notifyOnReleases: true,
  chaosErrorPercent: 40,
  chaosDurationSec: 120,
  chaosLatencyMs: 0,
};

const key = "canaryshield.preferences";
let current: Preferences = { ...defaultPreferences, ...storage.get<Partial<Preferences>>(key, {}) };
const listeners = new Set<() => void>();

export const preferencesStore = {
  get: () => current,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  update(change: Partial<Preferences>) {
    current = { ...current, ...change };
    storage.set(key, current);
    listeners.forEach((listener) => listener());
  },
  reset() {
    current = { ...defaultPreferences };
    storage.set(key, current);
    listeners.forEach((listener) => listener());
  },
};
