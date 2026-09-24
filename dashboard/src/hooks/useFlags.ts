import { useQuery } from "@tanstack/react-query";
import { listFlags } from "../api/flags";
import { usePollingFallback } from "./useEventStream";

export function useFlags() {
  const refetchInterval = usePollingFallback();
  return useQuery({ queryKey: ["flags"], queryFn: listFlags, refetchInterval });
}
