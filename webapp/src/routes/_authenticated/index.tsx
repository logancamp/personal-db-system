import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../../lib/auth-context";
import { useCreateTodo, useTodos, useUpdateTodo } from "../../features/todos/hooks";
import { useCreateNote, useNotes } from "../../features/notes/hooks";
import { useInboxItems } from "../../features/inbox/hooks";
import {
  getDraft,
  isOptimistic,
  messageKey,
  setDraft as persistDraft,
  useConversation,
  useIsSending,
  useSendMessage,
} from "../../features/messages/hooks";
import { MessageBubble, WorkingIndicator } from "../../components/MessageBubble";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorNotice,
  IconButton,
  Input,
  PageHeader,
  Spinner,
} from "../../components/ui";
import { ChevronDownIcon, CloseIcon, PlusIcon, SendIcon } from "../../components/icons";
import { ApiError } from "../../lib/api-client";
import { ActionRail } from "../../features/history/ActionRail";
import { useHomeLayout, WIDGET_LABELS, type WidgetId } from "../../features/home/layout";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const { username } = useAuth();
  const { layout, visible, toggle, move, reset } = useHomeLayout(username);
  const [editing, setEditing] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <PageHeader
        title={
          <>
            <span className="text-accent-strong">{username}</span>
            <span>'s DB</span>
          </>
        }
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        actions={
          <Button variant={editing ? "primary" : "secondary"} onClick={() => setEditing((e) => !e)}>
            {editing ? "Done" : "Customize"}
          </Button>
        }
      />

      {editing && (
        <div className="mb-4 rounded-2xl border border-line bg-raised px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-muted">Show:</span>
            {(Object.keys(WIDGET_LABELS) as WidgetId[]).map((id) => {
              const shown = !layout.hidden.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={shown}
                  onClick={() => toggle(id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    shown
                      ? "border-accent/40 bg-accent-soft text-accent-strong"
                      : "border-line-strong text-ink-muted hover:text-ink"
                  }`}
                >
                  {WIDGET_LABELS[id]}
                </button>
              );
            })}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={reset}>
              Reset
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            This arrangement is saved in this browser only — the server has nowhere to keep a
            dashboard layout, so it won't follow you to another device.
          </p>
        </div>
      )}

      <div className="columns-1 gap-4 lg:columns-2 2xl:columns-3">
        {visible.map((id) => (
          <WidgetFrame
            key={id}
            id={id}
            editing={editing}
            onMove={(direction) => move(id, direction)}
            onHide={() => toggle(id)}
          />
        ))}
      </div>
      {visible.length === 0 && (
        <EmptyState>Every widget is hidden. Use Customize to bring one back.</EmptyState>
      )}
    </div>
  );
}

function WidgetFrame({
  id,
  editing,
  onMove,
  onHide,
}: {
  id: WidgetId;
  editing: boolean;
  onMove: (direction: -1 | 1) => void;
  onHide: () => void;
}) {
  const widgets: Record<
    WidgetId,
    { to: "/todos" | "/notes" | "/chat" | "/inbox" | "/history"; body: ReactNode }
  > = {
    todos: { to: "/todos", body: <TodosWidget /> },
    notes: { to: "/notes", body: <NotesWidget /> },
    chat: { to: "/chat", body: <ChatWidget /> },
    inbox: { to: "/inbox", body: <InboxWidget /> },
    history: { to: "/history", body: <HistoryWidget /> },
  };
  const widget = widgets[id];

  return (
    <section className="mb-4 flex break-inside-avoid flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight">{WIDGET_LABELS[id]}</h2>
        <div className="ml-auto flex items-center gap-1">
          {editing ? (
            <>
              <IconButton size="sm" aria-label={`Move ${WIDGET_LABELS[id]} up`} onClick={() => onMove(-1)}>
                <ChevronDownIcon className="rotate-180" />
              </IconButton>
              <IconButton size="sm" aria-label={`Move ${WIDGET_LABELS[id]} down`} onClick={() => onMove(1)}>
                <ChevronDownIcon />
              </IconButton>
              <IconButton size="sm" aria-label={`Hide ${WIDGET_LABELS[id]}`} onClick={onHide}>
                <CloseIcon />
              </IconButton>
            </>
          ) : (
            <Link
              to={widget.to}
              className="rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              Open
            </Link>
          )}
        </div>
      </header>
      {widget.body}
    </section>
  );
}

function TodosWidget() {
  const { data: todos, isLoading, error } = useTodos();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const [title, setTitle] = useState("");

  const open = (todos ?? []).filter((t) => !t.completed).slice(0, 6);
  const remaining = (todos ?? []).filter((t) => !t.completed).length - open.length;

  return (
    <div className="flex flex-col">
      <form
        className="flex gap-2 border-b border-line px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          createTodo.mutate({ title: title.trim() });
          setTitle("");
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New todo…" />
        <Button type="submit" size="sm" disabled={createTodo.isPending || !title.trim()} aria-label="Add todo">
          <PlusIcon />
        </Button>
      </form>

      <div className="px-4 py-2">
        {isLoading && <Spinner className="my-3" />}
        {error && (
          <ErrorNotice message={error instanceof ApiError ? error.message : "Failed to load todos."} />
        )}
        {!isLoading && !error && open.length === 0 && <EmptyState>Nothing open. </EmptyState>}
        <ul className="divide-y divide-line">
          {open.map((todo) => (
            <li key={todo.id} className="flex items-center gap-3 py-2">
              <Checkbox
                checked={todo.completed}
                label={`Mark "${todo.title}" done`}
                onChange={(next) => updateTodo.mutate({ id: todo.id, completed: next })}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{todo.title}</span>
              {todo.section && <Badge>{todo.section}</Badge>}
            </li>
          ))}
        </ul>
        {remaining > 0 && (
          <Link to="/todos" className="block py-2 text-xs text-ink-muted hover:text-accent-strong">
            +{remaining} more
          </Link>
        )}
      </div>
    </div>
  );
}

function NotesWidget() {
  const { data: notes, isLoading, error } = useNotes();
  const createNote = useCreateNote();
  const [content, setContent] = useState("");

  const recent = [...(notes ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="flex flex-col">
      <form
        className="flex gap-2 border-b border-line px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!content.trim()) return;
          createNote.mutate({ content: content.trim() });
          setContent("");
        }}
      >
        <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="New note…" />
        <Button type="submit" size="sm" disabled={createNote.isPending || !content.trim()} aria-label="Add note">
          <PlusIcon />
        </Button>
      </form>

      <div className="px-4 py-3">
        {isLoading && <Spinner />}
        {error && (
          <ErrorNotice message={error instanceof ApiError ? error.message : "Failed to load notes."} />
        )}
        {!isLoading && !error && recent.length === 0 && <EmptyState>No notes yet.</EmptyState>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {recent.map((note) => (
            <li
              key={note.id}
              className="rounded-xl border border-line bg-raised px-3 py-2 text-sm break-words whitespace-pre-wrap"
            >
              <span className="line-clamp-4">{note.content}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function InboxWidget() {
  const { data, isLoading, error } = useInboxItems();
  const items = [
    ...(data?.todos ?? []).map((t) => ({ id: `todo-${t.id}`, label: t.title, kind: "Todo" as const })),
    ...(data?.notes ?? []).map((n) => ({ id: `note-${n.id}`, label: n.content, kind: "Note" as const })),
  ];

  return (
    <div className="px-4 py-3">
      {isLoading && <Spinner />}
      {error && (
        <ErrorNotice message={error instanceof ApiError ? error.message : "Failed to load inbox."} />
      )}
      {!isLoading && !error && items.length === 0 && <EmptyState>Inbox is empty.</EmptyState>}
      <ul className="divide-y divide-line">
        {items.slice(0, 6).map((item) => (
          <li key={item.id} className="flex items-center gap-2 py-2 text-sm">
            <Badge tone="accent">{item.kind}</Badge>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </li>
        ))}
      </ul>
      {items.length > 6 && (
        <Link to="/inbox" className="block py-2 text-xs text-ink-muted hover:text-accent-strong">
          +{items.length - 6} more
        </Link>
      )}
    </div>
  );
}

function HistoryWidget() {
  return (
    <div className="max-h-80 overflow-y-auto py-1">
      <ActionRail scope="mine" limit={12} />
    </div>
  );
}

function ChatWidget() {
  const { username } = useAuth();
  const { thread, isLoading, error } = useConversation(username ?? "", "ASSISTANT");
  const send = useSendMessage();
  const isSending = useIsSending(username ?? "", "ASSISTANT");
  const [draft, setDraftState] = useState(() => getDraft(username ?? "", "ASSISTANT"));
  const bottomRef = useRef<HTMLDivElement>(null);

  const recent = thread.slice(-6);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [recent.length, isSending]);

  function setDraft(value: string) {
    setDraftState(value);
    persistDraft(username ?? "", "ASSISTANT", value);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !username) return;
    send.mutate({ to: { username }, msg: trimmed, target: "ASSISTANT" });
    setDraft("");
  }

  return (
    <div className="flex flex-col">
      <div className="h-64 overflow-y-auto px-4 py-3">
        {isLoading && <Spinner />}
        {error && (
          <ErrorNotice message={error instanceof ApiError ? error.message : "Failed to load messages."} />
        )}
        {!isLoading && !error && recent.length === 0 && !isSending && (
          <EmptyState>Say hello — this is your assistant.</EmptyState>
        )}
        <ul className="flex flex-col gap-2.5">
          {recent.map((m) => (
            <MessageBubble key={messageKey(m)} message={m} isOwn={m.kind === "USER"} pending={isOptimistic(m)} />
          ))}
          {isSending && <WorkingIndicator />}
        </ul>
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-line px-4 py-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message your assistant…"
        />
        <Button type="submit" size="sm" disabled={isSending || !draft.trim()} aria-label="Send">
          <SendIcon />
        </Button>
      </form>

      {send.isError && (
        <div className="px-4 pb-3">
          <ErrorNotice
            message={
              send.error instanceof ApiError
                ? send.error.message
                : "The connection dropped before the reply came back. The assistant may have " +
                  "finished anyway — this thread has been refreshed from the server, so check " +
                  "above before resending."
            }
          />
        </div>
      )}
    </div>
  );
}
