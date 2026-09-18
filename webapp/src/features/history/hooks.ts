import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import { ME_QUERY_KEY } from "../users/hooks";
import type { EntityKind, HistorySettings } from "../../types/models";
import * as api from "./api";

export function useHistoryFeed(limit = 50, pollMs?: number) {
  const { basicToken } = useAuth();
  return useInfiniteQuery({
    queryKey: ["history", "feed", limit],
    refetchInterval: pollMs ?? false,
    queryFn: ({ pageParam }) =>
      api.getHistoryFeed(basicToken!, { cursor: pageParam ?? undefined, limit }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!basicToken,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function useHistory(entityKind: EntityKind, id: number | null, enabled = true) {
  const { basicToken } = useAuth();
  return useQuery({
    queryKey: ["history", entityKind, id],
    queryFn: () => api.getHistory(basicToken!, entityKind, id!),
    enabled: !!basicToken && id !== null && enabled,
  });
}

export function useSetHistorySettings() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: HistorySettings) => api.setHistorySettings(basicToken!, settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}

export function usePurgeAllHistory() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.purgeAllHistory(basicToken!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });
}

export function usePurgeHistoryOlderThan() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days: number) => api.purgeHistoryOlderThan(basicToken!, days),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });
}
