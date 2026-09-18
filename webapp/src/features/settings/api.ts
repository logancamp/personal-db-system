import { apiFetch } from "../../lib/api-client";
import type { AiExecutionMode, LlmProvider } from "../../types/models";

export function setLlmKey(basicToken: string, provider: LlmProvider, apiKey: string) {
  return apiFetch("/users/me/llm-key", { method: "PUT", body: { provider, apiKey }, basicToken });
}

export function deleteLlmKey(basicToken: string, provider: LlmProvider) {
  return apiFetch(`/users/me/llm-key?provider=${provider}`, { method: "DELETE", basicToken });
}

export function setProvider(basicToken: string, provider: LlmProvider) {
  return apiFetch("/users/me/provider", { method: "PUT", body: { provider }, basicToken });
}

export function setAiMode(
  basicToken: string,
  mode: AiExecutionMode,
  localLlmAddress?: string,
) {
  return apiFetch("/users/me/ai-mode", {
    method: "PUT",
    body: { mode, localLlmAddress },
    basicToken,
  });
}

export function setInboxProvider(basicToken: string, provider: LlmProvider) {
  return apiFetch("/users/me/inbox-provider", { method: "PUT", body: { provider }, basicToken });
}

export function setAutoReply(basicToken: string, enabled: boolean) {
  return apiFetch("/users/me/auto-reply", { method: "PUT", body: { enabled }, basicToken });
}
