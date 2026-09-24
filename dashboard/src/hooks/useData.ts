import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { getChaos, startChaos, stopChaos } from "../api/chaos";
import { getFlagEvents } from "../api/flags";
import { listIncidents } from "../api/incidents";
import { getPlatformHealth } from "../api/platform";
import { getPaymentCounters, getPersonas, getQuickCartHealth, type PaymentCounters } from "../api/quickcart";
import type { ChaosRequest, Event, Flag } from "../api/types";
import { chaosLog } from "../lib/chaosLog";
import { usePollingFallback } from "./useEventStream";

/** Incidents, optionally filtered; refreshed live via the stream. */
export function useIncidents(status?: "open" | "resolved") {
  const refetchInterval = usePollingFallback();
  return useQuery({
    queryKey: ["incidents", status ?? "all"],
    queryFn: () => listIncidents(status),
    refetchInterval,
  });
}

/** Rollout events of every flag, merged newest first. */
export function useAllEvents(flags: Flag[] | undefined, limit = 200) {
  const refetchInterval = usePollingFallback();
  const queries = useQueries({
    queries: (flags ?? []).map((flag) => ({
      queryKey: ["events", flag.key, limit],
      queryFn: () => getFlagEvents(flag.key, limit),
      refetchInterval,
    })),
  });

  const pending = queries.some((query) => query.isPending);
  const error = queries.find((query) => query.error)?.error ?? null;
  const dataStamp = queries.map((query) => query.dataUpdatedAt).join(",");
  const events = useMemo(() => {
    const merged: Event[] = [];
    for (const query of queries) merged.push(...(query.data?.events ?? []));
    return merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id);
    // dataStamp changes whenever any query's data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataStamp]);

  return {
    events,
    isPending: flags === undefined || pending,
    error,
    refetch: () => queries.forEach((query) => void query.refetch()),
  };
}

export function useChaos() {
  return useQuery({ queryKey: ["chaos"], queryFn: getChaos, refetchInterval: 5000, retry: 0 });
}

export function useChaosActions() {
  const queryClient = useQueryClient();
  const start = useMutation({
    mutationFn: (input: ChaosRequest) => startChaos(input),
    onSuccess: (config) => queryClient.setQueryData(["chaos"], config),
  });
  const stop = useMutation({
    mutationFn: stopChaos,
    onSuccess: (config) => queryClient.setQueryData(["chaos"], config),
  });
  return { start, stop };
}

export function usePlatformHealth() {
  return useQuery({ queryKey: ["service", "platform"], queryFn: getPlatformHealth, refetchInterval: 10000, retry: 0 });
}

export function useQuickCartHealth() {
  return useQuery({ queryKey: ["service", "quickcart"], queryFn: getQuickCartHealth, refetchInterval: 10000, retry: 0 });
}

export function usePersonas() {
  return useQuery({ queryKey: ["personas"], queryFn: getPersonas, staleTime: 5 * 60_000, retry: 1 });
}

export interface TrafficSample {
  at: number;
  rpsOld: number;
  rpsNew: number;
  errorRateOld: number | null;
  errorRateNew: number | null;
}

/**
 * Live payment traffic measured from QuickCart's own counters, sampled every
 * 5 seconds. Works without Prometheus; used by the load generator page.
 */
export function useLiveTraffic(intervalMs = 5000) {
  const counters = useQuery({ queryKey: ["quickcart-counters"], queryFn: getPaymentCounters, refetchInterval: intervalMs, retry: 0 });
  const previous = useRef<PaymentCounters | null>(null);
  const [samples, setSamples] = useState<TrafficSample[]>([]);

  useEffect(() => {
    const current = counters.data;
    if (!current) return;
    const last = previous.current;
    previous.current = current;
    if (!last || current.readAt <= last.readAt) return;
    const seconds = (current.readAt - last.readAt) / 1000;
    const oldCount = current.oldSuccess + current.oldError - (last.oldSuccess + last.oldError);
    const newCount = current.newSuccess + current.newError - (last.newSuccess + last.newError);
    // A counter going backwards means QuickCart restarted; skip that sample.
    if (oldCount < 0 || newCount < 0) return;
    const oldErrors = current.oldError - last.oldError;
    const newErrors = current.newError - last.newError;
    setSamples((list) => [
      ...list.slice(-59),
      {
        at: current.readAt,
        rpsOld: oldCount / seconds,
        rpsNew: newCount / seconds,
        errorRateOld: oldCount > 0 ? oldErrors / oldCount : null,
        errorRateNew: newCount > 0 ? newErrors / newCount : null,
      },
    ]);
  }, [counters.data]);

  return { samples, counters: counters.data, error: counters.error, isPending: counters.isPending };
}

/** Chaos experiments started or stopped from this browser (QuickCart keeps no history). */
export function useChaosLog() {
  return useSyncExternalStore(chaosLog.subscribe, chaosLog.get);
}

/** The flag users see first: an active rollout, else the demo flag, else the first flag. */
export function pickPrimaryFlag(flags: Flag[] | undefined): Flag | undefined {
  if (!flags || flags.length === 0) return undefined;
  return flags.find((flag) => flag.status === "rolling_out")
    ?? flags.find((flag) => flag.status === "paused")
    ?? flags.find((flag) => flag.key === "new_payment_flow")
    ?? flags[0];
}
