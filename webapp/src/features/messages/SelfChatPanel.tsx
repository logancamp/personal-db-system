import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../lib/auth-context";
import {
  getDraft,
  isOptimistic,
  messageKey,
  setDraft as persistDraft,
  useConversation,
  useIsSending,
  useMarkReadOnOpen,
  useRunWindow,
  useSendMessage,
} from "./hooks";
import { Button, EmptyState, ErrorNotice, Input, Spinner } from "../../components/ui";
import { SendIcon } from "../../components/icons";
import { MessageBubble, WorkingIndicator } from "../../components/MessageBubble";
import { ActionEvents } from "../history/ActionRail";
import { ForeignMessageNotice } from "./ForeignMessageNotice";
import { ApiError } from "../../lib/api-client";

export interface QuickPrompt {
  label: string;
  prompt: string;
}

export function SelfChatPanel({ quickPrompts }: { quickPrompts?: QuickPrompt[] }) {
  const { username } = useAuth();
  const { thread, foreignSenders, isLoading, error } = useConversation(username ?? "", "ASSISTANT");
  useMarkReadOnOpen(username ?? "", "ASSISTANT");
  const send = useSendMessage();
  const isSending = useIsSending(username ?? "", "ASSISTANT");
  const runWindow = useRunWindow(username ?? "", "ASSISTANT");
  const [draft, setDraftState] = useState(() => getDraft(username ?? "", "ASSISTANT"));

  function setDraft(value: string) {
    setDraftState(value);
    persistDraft(username ?? "", "ASSISTANT", value);
  }
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length, isSending]);

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !username) return;
    send.mutate({ to: { username }, msg: trimmed, target: "ASSISTANT" });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendText(draft);
    setDraft("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading && <Spinner />}
        {error && (
          <ErrorNotice message={error instanceof ApiError ? error.message : "Failed to load messages."} />
        )}
        {!isLoading && !error && thread.length === 0 && !isSending && (
          <EmptyState>Say hello — this is your assistant.</EmptyState>
        )}
        <ForeignMessageNotice senders={foreignSenders} />
        <ul className="flex flex-col gap-3">
          {thread.map((m) => (
            <MessageBubble
              key={messageKey(m)}
              message={m}
              isOwn={m.kind === "USER"}
              pending={isOptimistic(m)}
            />
          ))}
          {isSending && <WorkingIndicator />}
        </ul>

        <ActionEvents runWindow={runWindow} live={isSending} scope="chat" />
        <div ref={bottomRef} />
      </div>

      {quickPrompts && quickPrompts.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-2 px-4 pb-2">
          {quickPrompts.map((qp) => (
            <button
              key={qp.label}
              type="button"
              onClick={() => sendText(qp.prompt)}
              disabled={isSending}
              className="rounded-full border border-accent/40 px-3 py-1 text-xs font-medium text-accent-strong transition-colors hover:bg-accent-soft disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-line px-4 py-3">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message your assistant…"
          />
          <Button type="submit" aria-label="Send" disabled={isSending || !draft.trim()}>
            {isSending ? "Working…" : <SendIcon />}
          </Button>
        </div>

        {send.isError && (
          <div className="mt-2">
            <ErrorNotice
              message={
                send.error instanceof ApiError
                  ? send.error.message
                  : "The connection dropped before the reply came back. The assistant may " +
                    "have finished anyway — this thread has been refreshed from the server, " +
                    "so check above before resending."
              }
            />
          </div>
        )}

        <p className="mt-2 text-xs text-ink-muted">
          A reply can take a couple of seconds to about a minute — the request stays open for
          the whole run rather than polling for it.
        </p>
      </form>
    </div>
  );
}
