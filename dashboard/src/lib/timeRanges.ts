import type { MetricsRange } from "../api/types";

/** Chart ranges the platform's metrics endpoint supports. */
export const timeRanges: Array<{ value: MetricsRange; label: string; title: string }> = [
  { value: "5m", label: "5m", title: "Last 5 minutes, 5-second resolution" },
  { value: "15m", label: "15m", title: "Last 15 minutes, 15-second resolution" },
  { value: "30m", label: "30m", title: "Last 30 minutes, 30-second resolution" },
  { value: "1h", label: "1h", title: "Last hour, 1-minute resolution" },
  { value: "6h", label: "6h", title: "Last 6 hours, 6-minute resolution" },
  { value: "24h", label: "24h", title: "Last 24 hours, 24-minute resolution" },
];
