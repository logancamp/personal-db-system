import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { useMe, useUsers } from "../../features/users/hooks";
import {
  getDraft,
  isOptimistic,
  messageKey,
  setDraft as persistDraft,
  useConversation,
  useConversationPeers,
  useForgetPeer,
  useIsSending,
  useMarkReadOnOpen,
  useRunWindow,
  useSendMessage,
  useUnread,
  useUnreadCount,
} from "../../features/messages/hooks";
import {
  Button,
  EmptyState,
  ErrorNotice,
  IconButton,
  Input,
  PageHeader,
  Segmented,
  Spinner,
  UnreadBadge,
} from "../../components/ui";
import { CloseIcon, SearchIcon, SendIcon } from "../../components/icons";
import { MessageBubble, WorkingIndicator } from "../../components/MessageBubble";
import { ActionEvents } from "../../features/history/ActionRail";
import { ForeignMessageNotice } from "../../features/messages/ForeignMessageNotice";
import { ApiError } from "../../lib/api-client";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const [activePeer, setActivePeer] = useState<string | null>(null);

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col">
      <PageHeader title="Messages" />

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          <PeerRail activePeer={activePeer} onSelect={setActivePeer} />
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          {activePeer ? (
            <PersonConversation key={activePeer} peer={activePeer} />
          ) : (
            <EmptyState>Pick someone to start messaging.</EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}

function PeerRail({
  activePeer,
  onSelect,
}: {
  activePeer: string | null;
  onSelect: (u: string) => void;
}) {
  const { username: self } = useAuth();
  const [query, setQuery] = useState("");
  const { peers, isLoading: peersLoading } = useConversationPeers();
  const forgetPeer = useForgetPeer();
  const { data: allUsers, isLoading: usersLoading, error: usersError } = useUsers();
  const { data: unread } = useUnread();

  const unreadByPeer = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of unread?.conversations ?? []) {
      map.set(c.username, (map.get(c.username) ?? 0) + c.count);
    }
    return map;
  }, [unread]);

  const searching = query.trim().length > 0;

  const searchResults = useMemo(() => {
    if (!searching || !allUsers) return [];
    const q = query.trim().toLowerCase();
    return allUsers.filter((u) => u.username !== self && u.username.toLowerCase().includes(q));
  }, [allUsers, query, searching, self]);

  return (
    <>
      <div className="shrink-0 border-b border-line p-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {searching ? (
          <>
            {usersLoading && (
              <div className="p-3">
                <Spinner />
              </div>
            )}
            {usersError && (
              <div className="p-3">
                <ErrorNotice
                  message={
                    usersError instanceof ApiError ? usersError.message : "Failed to load users."
                  }
                />
              </div>
            )}
            {!usersLoading && searchResults.length === 0 && (
              <p className="px-3 py-4 text-sm text-ink-muted">No matching users.</p>
            )}
            <ul>
              {searchResults.map((u) => (
                <li key={u.username}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(u.username);
                      setQuery("");
                    }}
                    className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-raised"
                  >
                    {u.username}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 className="sticky top-0 border-b border-line bg-surface/90 px-3 py-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase backdrop-blur">
              Conversations
            </h2>
            {peersLoading && (
              <div className="p-3">
                <Spinner />
              </div>
            )}
            {!peersLoading && peers.length === 0 && (
              <p className="px-3 py-4 text-sm text-ink-muted">
                No conversations yet — search a username above to start one.
              </p>
            )}
            <ul>
              {peers.map((p) => (
                <li
                  key={p.username}
                  className={`group flex items-center border-b border-line/60 ${
                    activePeer === p.username ? "bg-accent-soft" : "hover:bg-raised"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(p.username)}
                    className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-3 py-2 text-left"
                  >
                    <span
                      className={`text-sm font-medium ${
                        activePeer === p.username ? "text-accent-strong" : "text-ink"
                      }`}
                    >
                      {p.username}
                    </span>
                    {p.preview && (
                      <span className="w-full truncate text-xs text-ink-muted">{p.preview}</span>
                    )}
                  </button>
                  <UnreadBadge count={unreadByPeer.get(p.username) ?? 0} />
                  <IconButton
                    size="sm"
                    aria-label={`Remove ${p.username} from conversations`}
                    title="Remove from this list"
                    className="mr-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => {
                      forgetPeer(p.username);
                      if (activePeer === p.username) onSelect("");
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function PersonConversation({ peer }: { peer: string }) {
  const { data: me } = useMe();
  const { data: allUsers } = useUsers();
  const directUnread = useUnreadCount(peer, "PERSON");
  const chatUnread = useUnreadCount(peer, "ASSISTANT");
  const peerAutoReply = !!allUsers?.find((u) => u.username === peer)?.autoReplyEnabled;
  const myAutoReply = !!me?.autoReplyEnabled;
  const chatVisible = peerAutoReply || myAutoReply;

  const [tab, setTab] = useState<"direct" | "chat">("direct");

  useEffect(() => {
    if (!chatVisible && tab === "chat") setTab("direct");
  }, [chatVisible, tab]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="truncate text-sm font-semibold tracking-tight">
          {tab === "direct" ? peer : `${peer}'s assistant`}
        </h2>
        {chatVisible && (
          <Segmented
            label="Thread"
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              {
                value: "direct",
                label: (
                  <>
                    <span className="truncate">{peer}</span>
                    <UnreadBadge
                      count={directUnread}
                      tone={tab === "direct" ? "inverse" : "solid"}
                    />
                  </>
                ),
                title: "Plain message to the person",
              },
              {
                value: "chat",
                label: (
                  <>
                    <span>Chat</span>
                    <UnreadBadge count={chatUnread} tone={tab === "chat" ? "inverse" : "solid"} />
                  </>
                ),
                title: `Addressed to ${peer}'s assistant`,
              },
            ]}
          />
        )}
      </header>

      {tab === "direct" || !chatVisible ? (
        <Thread peer={peer} />
      ) : (
        <AgentChat peer={peer} canSend={peerAutoReply} />
      )}
    </div>
  );
}

function Thread({ peer }: { peer: string }) {
  const { thread, foreignSenders, isLoading, error } = useConversation(peer, "PERSON");
  useMarkReadOnOpen(peer, "PERSON");
  const send = useSendMessage();
  const [draft, setDraftState] = useState(() => getDraft(peer, "PERSON"));
  const { username: self } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread.length]);

  function setDraft(value: string) {
    setDraftState(value);
    persistDraft(peer, "PERSON", value);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading && <Spinner />}
        {error && (
          <ErrorNotice message={error instanceof ApiError ? error.message : "Failed to load messages."} />
        )}
        {!isLoading && !error && thread.length === 0 && (
          <EmptyState>No messages yet — say hello.</EmptyState>
        )}
        <ForeignMessageNotice senders={foreignSenders} />
        <ul className="flex flex-col gap-3">
          {thread.map((m) => (
            <MessageBubble
              key={messageKey(m)}
              message={m}
              isOwn={m.from.username === self}
              pending={isOptimistic(m)}
            />
          ))}
        </ul>
        <div ref={bottomRef} />
      </div>

      <form
        className="shrink-0 border-t border-line px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          send.mutate({ to: { username: peer }, msg: draft.trim(), target: "PERSON" });
          setDraft("");
        }}
      >
        <div className="flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…" />
          <Button type="submit" disabled={send.isPending || !draft.trim()} aria-label="Send">
            <SendIcon />
          </Button>
        </div>
        {send.isError && (
          <div className="mt-2">
            <ErrorNotice
              message={send.error instanceof ApiError ? send.error.message : "Failed to send message."}
            />
          </div>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          Goes straight to {peer}. Nothing here reaches an assistant or gets filed — use the Chat
          tab for that.
        </p>
      </form>
    </div>
  );
}

function AgentChat({ peer, canSend }: { peer: string; canSend: boolean }) {
  const { thread, foreignSenders, isLoading, error } = useConversation(peer, "ASSISTANT");
  useMarkReadOnOpen(peer, "ASSISTANT");
  const send = useSendMessage();
  const isSending = useIsSending(peer, "ASSISTANT");
  const runWindow = useRunWindow(peer, "ASSISTANT");
  const [draft, setDraftState] = useState(() => getDraft(peer, "ASSISTANT"));
  const { username: self } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread.length, isSending]);

  function setDraft(value: string) {
    setDraftState(value);
    persistDraft(peer, "ASSISTANT", value);
  }

  const quickPrompts = [
    { label: "Add a todo", prompt: "Please add a todo: " },
    { label: "Save a note", prompt: "Please save a note: " },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-3">
        {canSend ? (
          <div className="rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-accent-strong">
            <p className="font-medium">This runs on your account, not {peer}'s.</p>
            <p className="mt-0.5">
              Your API key pays for it, and the request is processed under your credentials —{" "}
              {peer} is only the destination. What it files lands in their Inbox tagged with your
              name.
            </p>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            {peer} has auto-reply off, so their assistant can't answer — this thread is read-only
            for now. It still shows anything they sent to <em>your</em> assistant.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading && <Spinner />}
        {error && (
          <ErrorNotice message={error instanceof ApiError ? error.message : "Failed to load messages."} />
        )}
        {!isLoading && !error && thread.length === 0 && !isSending && (
          <EmptyState>No requests yet.</EmptyState>
        )}
        <ForeignMessageNotice senders={foreignSenders} />
        <ul className="flex flex-col gap-3">
          {thread.map((m) => (
            <MessageBubble
              key={messageKey(m)}
              message={m}
              isOwn={m.from.username === self}
              pending={isOptimistic(m)}
            />
          ))}
          {isSending && <WorkingIndicator label="Sending…" />}
        </ul>
        <ActionEvents runWindow={runWindow} live={isSending} />
        <div ref={bottomRef} />
      </div>

      {canSend && (
        <>
          <div className="flex shrink-0 flex-wrap gap-2 px-4 pb-2">
            {quickPrompts.map((qp) => (
              <button
                key={qp.label}
                type="button"
                onClick={() => setDraft(qp.prompt)}
                className="rounded-full border border-accent/40 px-3 py-1 text-xs font-medium text-accent-strong transition-colors hover:bg-accent-soft"
              >
                {qp.label}
              </button>
            ))}
          </div>

          <form
            className="shrink-0 border-t border-line px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              send.mutate({ to: { username: peer }, msg: draft.trim(), target: "ASSISTANT" });
              setDraft("");
            }}
          >
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Ask ${peer}'s assistant…`}
              />
              <Button type="submit" disabled={isSending || !draft.trim()} aria-label="Send">
                <SendIcon />
              </Button>
            </div>
            {send.isError && (
              <div className="mt-2">
                <ErrorNotice
                  message={
                    send.error instanceof ApiError ? send.error.message : "Failed to send message."
                  }
                />
              </div>
            )}
            <p className="mt-2 text-xs text-ink-muted">
              Their assistant's confirmation arrives as its own message here, shortly after it
              files something.
            </p>
          </form>
        </>
      )}
    </div>
  );
}
