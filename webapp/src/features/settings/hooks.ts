import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import { ME_QUERY_KEY } from "../users/hooks";
import type { AiExecutionMode, LlmProvider } from "../../types/models";
import * as api from "./api";

export function useSetLlmKey() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: LlmProvider; apiKey: string }) =>
      api.setLlmKey(basicToken!, provider, apiKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}

export function useDeleteLlmKey() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: LlmProvider) => api.deleteLlmKey(basicToken!, provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}

export function useSetProvider() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: LlmProvider) => api.setProvider(basicToken!, provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}

export function useSetInboxProvider() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: LlmProvider) => api.setInboxProvider(basicToken!, provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}

export function useSetAiMode() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mode, localLlmAddress }: { mode: AiExecutionMode; localLlmAddress?: string }) =>
      api.setAiMode(basicToken!, mode, localLlmAddress),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}

export function useSetAutoReply() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => api.setAutoReply(basicToken!, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}
