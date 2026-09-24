import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getFlagMetrics } from "../api/flags";

export type MetricsRange = "5m" | "15m" | "30m";

export const metricsRanges: MetricsRange[] = ["5m", "15m", "30m"];

const refreshMs = 5000;

/** Chart data for a flag, refreshed every 5 seconds. */
export function useMetrics(key: string, range: MetricsRange) {
  return useQuery({
    queryKey: ["metrics", key, range],
    queryFn: () => getFlagMetrics(key, range),
    enabled: Boolean(key),
    refetchInterval: refreshMs,
    placeholderData: keepPreviousData,
  });
}
