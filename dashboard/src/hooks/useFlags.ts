import { useQuery } from "@tanstack/react-query";
import { listFlags } from "../api/flags";

export function useFlags() {
  return useQuery({ queryKey: ["flags"], queryFn: listFlags });
}
