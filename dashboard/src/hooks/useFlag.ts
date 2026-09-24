import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  advanceRollout,
  getFlag,
  getFlagEvents,
  getFlagHealth,
  killFlag,
  pauseRollout,
  resumeRollout,
  rollbackFlag,
  setRolloutPercentage,
  startRollout,
} from "../api/flags";
import { usePollingFallback } from "./useEventStream";

const healthPollMs = 5000;

export type FlagAction =
  | { type: "rollout"; action: "start" | "advance" | "pause" | "resume" }
  | { type: "set"; percentage: number }
  | { type: "rollback"; reason: string }
  | { type: "kill" };

export function useFlag(key: string) {
  const refetchInterval = usePollingFallback();
  return useQuery({
    queryKey: ["flags", key],
    queryFn: () => getFlag(key),
    enabled: Boolean(key),
    refetchInterval,
  });
}

/** The guardian's latest health record, polled every 5 seconds. */
export function useFlagHealth(key: string) {
  return useQuery({
    queryKey: ["health", key],
    queryFn: () => getFlagHealth(key),
    enabled: Boolean(key),
    refetchInterval: healthPollMs,
  });
}

/** The flag's rollout history, newest first. */
export function useFlagEvents(key: string) {
  const refetchInterval = usePollingFallback();
  return useQuery({
    queryKey: ["events", key],
    queryFn: () => getFlagEvents(key),
    enabled: Boolean(key),
    refetchInterval,
  });
}

export function useFlagActions(key: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (action: FlagAction) => {
      switch (action.type) {
        case "set":
          return setRolloutPercentage(key, action.percentage);
        case "rollback":
          return rollbackFlag(key, action.reason);
        case "kill":
          return killFlag(key);
        case "rollout":
          switch (action.action) {
            case "start":
              return startRollout(key);
            case "advance":
              return advanceRollout(key);
            case "pause":
              return pauseRollout(key);
            case "resume":
              return resumeRollout(key);
          }
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flags"] }),
        queryClient.invalidateQueries({ queryKey: ["events", key] }),
      ]);
    },
  });

  return {
    runAction: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
