import { useEffect, useState } from "react";
import { copyText, extractRunRef } from "../lib/run-ref";
import type { Message, MessageKind } from "../types/models";

const KIND_LABEL: Record<Exclude<MessageKind, "USER">, string> = {
  ASSISTANT_REPLY: "Assistant",
  ON_BEHALF_CONFIRMATION: "Their assistant",
};

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function MessageBubble({
  message,
  isOwn,
  pending = false,
}: {
  message: Message;
  isOwn: boolean;
  pending?: boolean;
}) {
  const isAgent = message.kind !== "USER" || message.generatedByBot;
  const label = message.kind === "USER" ? null : KIND_LABEL[message.kind];
  const runRef = extractRunRef(message.msg);

  return (
    <li
      className={`flex max-w-[80%] flex-col gap-0.5 ${isOwn ? "self-end items-end" : "self-start items-start"}`}
    >
      <div
        className={`rounded-2xl px-3.5 py-2 text-sm ${
          isOwn
            ? "rounded-br-md bg-accent-strong text-on-accent"
            : "rounded-bl-md border border-line bg-raised text-ink"
        } ${isAgent ? "border-l-[3px] border-l-accent pl-3" : ""} ${pending ? "opacity-60" : ""}`}
      >
        {label && (
          <span className="mb-0.5 block text-[10px] font-semibold tracking-wide uppercase opacity-70">
            {label}
          </span>
        )}
        <span className="whitespace-pre-wrap">{message.msg}</span>
      </div>
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] text-ink-muted">
          {pending ? "Sending…" : timeOf(message.createdAt)}
        </span>
        {runRef && <RunRefChip runRef={runRef} at={message.createdAt} />}
      </div>
    </li>
  );
}

function RunRefChip({ runRef, at }: { runRef: string; at: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      title={`Copy the run reference for this failure (${new Date(at).toLocaleString()})`}
      onClick={async () => {
        if (await copyText(runRef)) setCopied(true);
      }}
      className="inline-flex items-center gap-1 rounded-full border border-line-strong px-1.5 py-0.5 font-mono text-[10px] text-ink-muted transition-colors hover:border-accent hover:text-accent-strong"
    >
      {copied ? "copied" : `ref ${runRef}`}
    </button>
  );
}

export function WorkingIndicator({ label = "Assistant is working…" }: { label?: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <li className="flex max-w-[80%] flex-col gap-1 self-start items-start">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-line border-l-[3px] border-l-accent bg-raised py-2 pr-3 pl-3 text-sm">
        <span className="flex gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
        </span>
        <span className="text-ink-muted">
          {label}
          {seconds >= 3 && <span className="ml-1 tabular-nums opacity-70">{seconds}s</span>}
        </span>
      </div>
      {seconds >= 8 && (
        <span className="px-1 text-[11px] text-ink-muted">
          Anything it already saved is done — check Todos or Notes. Still waiting on its
          reply.
        </span>
      )}
    </li>
  );
}
