import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import * as api from "./api";

export function useInboxItems() {
  const { basicToken } = useAuth();
  return useQuery({
    queryKey: ["inbox", "items"],
    queryFn: () => api.getInboxItems(basicToken!),
    enabled: !!basicToken,
  });
}

export function useInboxSummary(enabled: boolean) {
  const { basicToken } = useAuth();
  return useQuery({
    queryKey: ["inbox", "summary"],
    queryFn: () => api.getInboxSummary(basicToken!),
    enabled: !!basicToken && enabled,
    staleTime: Infinity,
  });
}
