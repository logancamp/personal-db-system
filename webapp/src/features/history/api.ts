import { apiFetch } from "../../lib/api-client";
import type {
  EntityKind,
  HistoryFeedResponse,
  HistoryResponse,
  HistorySettings,
  PurgeResult,
} from "../../types/models";

export function getHistory(basicToken: string, entityKind: EntityKind, id: number): Promise<HistoryResponse> {
  return apiFetch<HistoryResponse>(`/history/${entityKind}/${id}`, { basicToken });
}

export interface HistoryFeedParams {
  since?: string;
  cursor?: number;
  limit?: number;
}

export function getHistoryFeed(
  basicToken: string,
  params: HistoryFeedParams = {},
): Promise<HistoryFeedResponse> {
  const query = new URLSearchParams();
  if (params.since) query.set("since", params.since);
  if (params.cursor !== undefined) query.set("cursor", String(params.cursor));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  const suffix = query.size > 0 ? `?${query}` : "";
  return apiFetch<HistoryFeedResponse>(`/history${suffix}`, { basicToken });
}

export function setHistorySettings(basicToken: string, settings: HistorySettings): Promise<unknown> {
  return apiFetch("/users/me/history", { method: "PUT", body: settings, basicToken });
}

export function purgeAllHistory(basicToken: string): Promise<PurgeResult> {
  return apiFetch<PurgeResult>("/history/me", { method: "DELETE", basicToken });
}

export function purgeHistoryOlderThan(basicToken: string, days: number): Promise<PurgeResult> {
  return apiFetch<PurgeResult>(`/history/me/older-than/${days}`, { method: "DELETE", basicToken });
}
