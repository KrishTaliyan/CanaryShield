import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  advanceRollout,
  getFlag,
  killFlag,
  pauseRollout,
  resumeRollout,
  rollbackFlag,
  setRolloutPercentage,
  startRollout,
} from "../api/flags";

export type FlagAction =
  | { type: "rollout"; action: "start" | "advance" | "pause" | "resume" }
  | { type: "set"; percentage: number }
  | { type: "rollback"; reason: string }
  | { type: "kill" };

export function useFlag(key: string) {
  return useQuery({
    queryKey: ["flags", key],
    queryFn: () => getFlag(key),
    enabled: Boolean(key),
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
        queryClient.invalidateQueries({ queryKey: ["flags", key] }),
        queryClient.invalidateQueries({ queryKey: ["flags"] }),
      ]);
    },
  });

  return {
    runAction: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
