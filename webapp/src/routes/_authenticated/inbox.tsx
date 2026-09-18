import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useInboxItems, useInboxSummary } from "../../features/inbox/hooks";
import { useDeleteTodo, useUpdateTodo } from "../../features/todos/hooks";
import { useDeleteNote, useUpdateNote } from "../../features/notes/hooks";
import { useIsSending, useSendMessage } from "../../features/messages/hooks";
import { notificationText, useNotifySender, type InboxAction } from "../../features/inbox/notify";
import { useAuth } from "../../lib/auth-context";
import { HistoryPanel } from "../../features/history/HistoryPanel";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  IconButton,
  Input,
  PageHeader,
  Spinner,
  Toggle,
} from "../../components/ui";
import { CheckIcon, CloseIcon, SendIcon, TrashIcon } from "../../components/icons";
import { confirmDialog } from "../../components/ConfirmDialog";
import { ApiError } from "../../lib/api-client";
import type { Note, Todo } from "../../types/models";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: InboxPage,
});

type InboxEntry =
  | { kind: "todo"; id: number; todo: Todo }
  | { kind: "note"; id: number; note: Note };

function entryKey(entry: InboxEntry): string {
  return `${entry.kind}-${entry.id}`;
}

function entryLabel(entry: InboxEntry): string {
  return entry.kind === "todo" ? entry.todo.title : entry.note.content;
}

function entryFiledBy(entry: InboxEntry): string | null {
  const item = entry.kind === "todo" ? entry.todo : entry.note;
  return item.createdVia === "ON_BEHALF_AGENT" ? item.createdByUsername : null;
}

function InboxPage() {
  const { username } = useAuth();
  const { data: items, isLoading, error } = useInboxItems();
  const [summaryRequested, setSummaryRequested] = useState(false);
  const summary = useInboxSummary(summaryRequested);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [notifySender, setNotifySender] = useNotifySender(username);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);

  const entries: InboxEntry[] = [
    ...(items?.todos ?? []).map((todo): InboxEntry => ({ kind: "todo", id: todo.id, todo })),
    ...(items?.notes ?? []).map((note): InboxEntry => ({ kind: "note", id: note.id, note })),
  ];
  const selected = entries.find((entry) => entryKey(entry) === selectedKey) ?? null;

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col">
      <PageHeader
        title="Inbox"
        subtitle="Filed by other people's assistants — they can create here, and nowhere else."
        actions={
          <>
            <Toggle
              checked={notifySender}
              onChange={(next) => {
                setNotifySender(next);
                setNotice(null);
              }}
              label="Notify sender"
            />
            <Button
              variant="secondary"
              onClick={() => setSummaryRequested(true)}
              disabled={summary.isFetching}
            >
              {summary.isFetching ? "Summarizing…" : "AI Summary"}
            </Button>
          </>
        }
      />

      {notifySender && (
        <p className="mb-3 text-xs text-ink-muted">
          Marking done, filing or deleting an item sends a short message to whoever filed it.
          Opening one doesn't.
        </p>
      )}

      {notice && (
        <div
          className={`mb-3 rounded-xl border px-3 py-2 text-xs ${
            notice.tone === "ok"
              ? "border-accent/40 bg-accent-soft text-accent-strong"
              : "border-danger/40 bg-danger-soft text-danger"
          }`}
          role="status"
        >
          {notice.text}
        </div>
      )}

      {summaryRequested && (
        <Card className="mb-4">
          {summary.isFetching && <Spinner />}
          {summary.isError && (
            <ErrorNotice
              message={
                summary.error instanceof ApiError
                  ? summary.error.message
                  : "Summary failed — requires an LLM key set in Settings."
              }
            />
          )}
          {summary.data && (
            <>
              <p className="text-sm whitespace-pre-wrap">{summary.data.summary}</p>
              <p className="mt-2 text-xs text-ink-muted">{summary.data.itemCount} item(s)</p>
            </>
          )}
        </Card>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && (
              <div className="p-4">
                <Spinner />
              </div>
            )}
            {error && (
              <div className="p-4">
                <ErrorNotice
                  message={error instanceof ApiError ? error.message : "Failed to load inbox."}
                />
              </div>
            )}
            {!isLoading && !error && entries.length === 0 && <EmptyState>Inbox is empty.</EmptyState>}

            <ul>
              {entries.map((entry) => {
                const key = entryKey(entry);
                const filedBy = entryFiledBy(entry);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={`flex w-full items-center gap-3 border-b border-line/60 px-4 py-2.5 text-left transition-colors ${
                        selectedKey === key ? "bg-accent-soft" : "hover:bg-raised"
                      }`}
                    >
                      <Badge tone={entry.kind === "todo" ? "accent" : "neutral"}>
                        {entry.kind === "todo" ? "Todo" : "Note"}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-sm">{entryLabel(entry)}</span>
                      {filedBy && <span className="shrink-0 text-xs text-ink-muted">@{filedBy}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="min-h-0 lg:overflow-y-auto">
          {selected ? (
            <DetailPanel
              key={entryKey(selected)}
              entry={selected}
              notifySender={notifySender}
              onNotice={setNotice}
              onClose={() => setSelectedKey(null)}
            />
          ) : (
            <div className="rounded-2xl border border-line bg-surface">
              <EmptyState>Select an item to open, file, reply or delete it.</EmptyState>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  entry,
  notifySender,
  onNotice,
  onClose,
}: {
  entry: InboxEntry;
  notifySender: boolean;
  onNotice: (notice: { text: string; tone: "ok" | "warn" } | null) => void;
  onClose: () => void;
}) {
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const send = useSendMessage();

  const item = entry.kind === "todo" ? entry.todo : entry.note;
  const filedBy = entryFiledBy(entry);
  const isPending =
    updateTodo.isPending || deleteTodo.isPending || updateNote.isPending || deleteNote.isPending;
  const mutationError = updateTodo.error ?? deleteTodo.error ?? updateNote.error ?? deleteNote.error;

  function notify(action: InboxAction) {
    if (!notifySender || !filedBy) return;
    send
      .mutateAsync({
        to: { username: filedBy },
        msg: notificationText(action, entryLabel(entry)),
        target: "PERSON",
      })
      .then(() => onNotice({ text: `Told @${filedBy}.`, tone: "ok" }))
      .catch(() =>
        onNotice({
          text: `Done — but the message to @${filedBy} didn't send. The item was still updated.`,
          tone: "warn",
        }),
      );
  }

  function fileOut() {
    onNotice(null);
    const onSuccess = () => {
      notify("filed");
      onClose();
    };
    if (entry.kind === "todo") {
      updateTodo.mutate({ id: entry.id, section: "" }, { onSuccess });
    } else {
      updateNote.mutate({ id: entry.id, section: "" }, { onSuccess });
    }
  }

  function markDone() {
    onNotice(null);
    updateTodo.mutate({ id: entry.id, completed: true }, { onSuccess: () => notify("done") });
  }

  async function remove() {
    const ok = await confirmDialog({
      title: `Delete this ${entry.kind}?`,
      body: entryLabel(entry).slice(0, 140),
      confirmLabel: notifySender && filedBy ? `Delete and tell @${filedBy}` : "Delete",
    });
    if (!ok) return;
    onNotice(null);
    const onSuccess = () => {
      notify("deleted");
      onClose();
    };
    if (entry.kind === "todo") deleteTodo.mutate(entry.id, { onSuccess });
    else deleteNote.mutate(entry.id, { onSuccess });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-2">
        <Badge tone={entry.kind === "todo" ? "accent" : "neutral"}>
          {entry.kind === "todo" ? "Todo" : "Note"}
        </Badge>
        <p className="min-w-0 flex-1 text-sm font-medium whitespace-pre-wrap">
          {entryLabel(entry)}
        </p>
        <IconButton aria-label="Close details" size="sm" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>

      {entry.kind === "todo" && entry.todo.notes && (
        <p className="text-sm whitespace-pre-wrap text-ink-muted">{entry.todo.notes}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {entry.kind === "todo" ? (
          <Link
            to="/todos"
            search={{ highlight: entry.id }}
            className="inline-flex items-center rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-raised"
          >
            Open
          </Link>
        ) : (
          <Link
            to="/notes"
            search={{ highlight: entry.id }}
            className="inline-flex items-center rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-raised"
          >
            Open
          </Link>
        )}

        {entry.kind === "todo" && !entry.todo.completed && (
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={markDone}
          >
            <CheckIcon /> Mark done
          </Button>
        )}

        <Button variant="secondary" disabled={isPending} onClick={fileOut}>
          File out of Inbox
        </Button>

        <Button variant="danger" className="ml-auto" disabled={isPending} onClick={remove}>
          <TrashIcon /> Delete
        </Button>
      </div>

      {entry.kind === "todo" && entry.todo.completed && (
        <p className="text-xs text-accent-strong">Marked done.</p>
      )}

      {mutationError && (
        <ErrorNotice
          message={mutationError instanceof ApiError ? mutationError.message : "That didn't work."}
        />
      )}

      {filedBy ? (
        <ReplyBox peerUsername={filedBy} />
      ) : (
        <p className="border-t border-line pt-3 text-xs text-ink-muted">
          No sender recorded for this item, so there's nobody to reply to.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-muted">
        <div>
          <dt className="font-medium text-ink">Created via</dt>
          <dd>{item.createdVia}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">From phone</dt>
          <dd>{item.createdByPhone ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Created</dt>
          <dd>{new Date(item.createdAt).toLocaleString()}</dd>
        </div>
      </dl>

      <details className="border-t border-line pt-3">
        <summary className="cursor-pointer text-xs font-medium text-ink-muted">History</summary>
        <div className="mt-2">
          <HistoryPanel entityKind={entry.kind} id={entry.id} />
        </div>
      </details>
    </div>
  );
}

function ReplyBox({ peerUsername }: { peerUsername: string }) {
  const send = useSendMessage();
  const isSending = useIsSending(peerUsername, "PERSON");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    send.mutate(
      { to: { username: peerUsername }, msg: trimmed, target: "PERSON" },
      { onSuccess: () => setSent(true) },
    );
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-line pt-3">
      <label className="mb-1.5 block text-xs font-medium tracking-wide text-ink-muted uppercase">
        Reply to @{peerUsername}
      </label>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSent(false);
          }}
          placeholder="Message them directly…"
        />
        <Button type="submit" disabled={isSending || !text.trim()} aria-label="Send reply">
          <SendIcon />
        </Button>
      </div>
      {sent && !isSending && !send.isError && (
        <p className="mt-1.5 text-xs text-accent-strong">Sent.</p>
      )}
      {send.isError && (
        <div className="mt-2">
          <ErrorNotice
            message={send.error instanceof ApiError ? send.error.message : "Failed to send."}
          />
        </div>
      )}
    </form>
  );
}
