import { apiFetch } from "../../lib/api-client";
import type { InboxItems, InboxSummary } from "../../types/models";

export function getInboxItems(basicToken: string): Promise<InboxItems> {
  return apiFetch<InboxItems>("/inbox/items", { basicToken });
}

export function getInboxSummary(basicToken: string): Promise<InboxSummary> {
  return apiFetch<InboxSummary>("/inbox/summary", { basicToken });
}
