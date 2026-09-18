import { apiFetch } from "../../lib/api-client";
import type { Message, MessageTarget, SendMessageResult, UnreadSummary } from "../../types/models";

export function listReceivedMessages(basicToken: string): Promise<Message[]> {
  return apiFetch<Message[]>("/message", { basicToken });
}

export function getConversation(
  basicToken: string,
  withUsername: string,
  target?: MessageTarget,
): Promise<Message[]> {
  const query = target ? `?target=${target}` : "";
  return apiFetch<Message[]>(
    `/message/conversation/${encodeURIComponent(withUsername)}${query}`,
    { basicToken },
  );
}

export interface SendMessageInput {
  to: { username: string };
  msg: string;
  target: MessageTarget;
}

export function sendMessage(
  basicToken: string,
  input: SendMessageInput,
): Promise<SendMessageResult> {
  return apiFetch<SendMessageResult>("/message", { method: "POST", body: input, basicToken });
}

export function getUnread(basicToken: string): Promise<UnreadSummary> {
  return apiFetch<UnreadSummary>("/message/unread", { basicToken });
}

export function markConversationRead(
  basicToken: string,
  withUsername: string,
  target?: MessageTarget,
): Promise<{ markedRead: number }> {
  const query = target ? `?target=${target}` : "";
  return apiFetch<{ markedRead: number }>(
    `/message/conversation/${encodeURIComponent(withUsername)}/read${query}`,
    { method: "PUT", basicToken },
  );
}
