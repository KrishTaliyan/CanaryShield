const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const dateTimeSeconds = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium" });
const timeOnly = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const timeShort = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" });
const numberFmt = new Intl.NumberFormat("en-IN");

/** A percentage stored as 0–100, e.g. 25 → "25%". */
export function formatPercent(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits).replace(/\.0+$/, "")}%`;
}

/** A rate stored as 0–1, e.g. 0.0042 → "0.42%". */
export function formatRate(rate: number | null | undefined, digits = 2) {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return numberFmt.format(value);
}

export function formatRps(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} req/s`;
}

/** A latency in seconds, e.g. 0.182 → "182 ms". */
export function formatLatency(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const ms = seconds * 1000;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatDuration(milliseconds: number | null | undefined) {
  if (milliseconds === null || milliseconds === undefined || !Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 ? `${minutes} min ${seconds % 60} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`;
}

export function formatDateTime(value: string | null | undefined, withSeconds = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return (withSeconds ? dateTimeSeconds : dateTime).format(date);
}

export function formatClock(value: string | number | null | undefined, withSeconds = true) {
  if (value === null || value === undefined) return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return (withSeconds ? timeOnly : timeShort).format(date);
}

/** "just now", "4 min ago", "3 h ago", "2 d ago". */
export function formatRelative(value: string | null | undefined, now = Date.now()) {
  if (!value) return "—";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** mm:ss for countdowns. */
export function formatCountdown(milliseconds: number) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Latest value of a [unixSeconds, value] series. */
export function latest(series: Array<[number, number]> | undefined): number | null {
  if (!series || series.length === 0) return null;
  return series[series.length - 1][1];
}
