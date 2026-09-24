import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getFlagMetrics } from "../api/flags";
import type { MetricsRange } from "../api/types";

const refreshMs = 5000;

/** Chart data for a flag, refreshed every 5 seconds. */
export function useMetrics(key: string | undefined, range: MetricsRange) {
  return useQuery({
    queryKey: ["metrics", key, range],
    queryFn: () => getFlagMetrics(key!, range),
    enabled: Boolean(key),
    refetchInterval: refreshMs,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}
