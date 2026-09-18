import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from "../../features/notes/hooks";
import type { UpdateNoteInput } from "../../features/notes/api";
import { diffUpdateResult, type FieldMismatch } from "../../features/notes/verify";
import { HistoryPanel } from "../../features/history/HistoryPanel";
import {
  Badge,
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  IconButton,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from "../../components/ui";
import { CloseIcon, PlusIcon, SearchIcon, TrashIcon } from "../../components/icons";
import { confirmDialog } from "../../components/ConfirmDialog";
import { saveStatusLabel, useAutosaveRecord } from "../../lib/autosave";
import { ApiError } from "../../lib/api-client";
import type { Note } from "../../types/models";

const searchSchema = z.object({
  highlight: z.number().optional(),
});

export const Route = createFileRoute("/_authenticated/notes")({
  validateSearch: searchSchema,
  component: NotesPage,
});

function noteTitle(note: Note): string {
  const firstLine = note.content.split("\n").find((line) => line.trim() !== "");
  return firstLine?.trim() || "Untitled";
}

function NotesPage() {
  const { highlight } = Route.useSearch();
  const { data: notes, isLoading, error } = useNotes();
  const createNote = useCreateNote();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(highlight ?? null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...(notes ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (!needle) return sorted;
    return sorted.filter(
      (note) =>
        note.content.toLowerCase().includes(needle) ||
        (note.section ?? "").toLowerCase().includes(needle),
    );
  }, [notes, query]);

  const bySection = useMemo(() => {
    const groups = new Map<string, Note[]>();
    for (const note of filtered) {
      const key = note.section ?? "";
      groups.set(key, [...(groups.get(key) ?? []), note]);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === "Inbox") return -1;
      if (b === "Inbox") return 1;
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col">
      <PageHeader title="Notes" />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:flex">
          <div className="shrink-0 border-b border-line p-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {bySection.length === 0 && <EmptyState>Nothing matches.</EmptyState>}
            {bySection.map(([section, items]) => (
              <div key={section || "none"}>
                <h2 className="sticky top-0 border-b border-line bg-surface/90 px-3 py-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase backdrop-blur">
                  {section || "No section"}
                </h2>
                <ul>
                  {items.map((note) => (
                    <li key={note.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(note.id)}
                        className={`block w-full truncate px-3 py-1.5 text-left text-sm transition-colors ${
                          selectedId === note.id
                            ? "bg-accent-soft text-accent-strong"
                            : "text-ink hover:bg-raised"
                        }`}
                      >
                        {noteTitle(note)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col">
          <form
            className="mb-3 flex shrink-0 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              createNote.mutate({ content: draft.trim() });
              setDraft("");
            }}
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="New note…"
              rows={2}
              maxLength={2000}
            />
            <Button type="submit" disabled={createNote.isPending || !draft.trim()} className="self-start">
              <PlusIcon /> Add
            </Button>
          </form>

          {createNote.isError && (
            <div className="mb-3">
              <ErrorNotice
                message={
                  createNote.error instanceof ApiError
                    ? createNote.error.message
                    : "Failed to create note."
                }
              />
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {isLoading && <Spinner />}
            {error && (
              <ErrorNotice message={error instanceof ApiError ? error.message : "Failed to load notes."} />
            )}
            {!isLoading && !error && filtered.length === 0 && (
              <EmptyState>{query ? "Nothing matches." : "No notes yet."}</EmptyState>
            )}

            <div className="columns-1 gap-3 md:columns-2 2xl:columns-3">
              {filtered.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  selected={selectedId === note.id}
                  onSelect={() => setSelectedId(selectedId === note.id ? null : note.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteCard({
  note,
  selected,
  onSelect,
}: {
  note: Note;
  selected: boolean;
  onSelect: () => void;
}) {
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [showHistory, setShowHistory] = useState(false);
  const [mismatches, setMismatches] = useState<FieldMismatch[]>([]);
  const cardRef = useRef<HTMLElement>(null);

  const { values, bind, status, dirty } = useAutosaveRecord(
    { content: note.content, section: note.section ?? "" },
    async (patch) => {
      const body: UpdateNoteInput = {};
      if (patch.section !== undefined) body.section = patch.section;
      if (patch.content !== undefined && patch.content.trim() !== "") body.content = patch.content;
      if (Object.keys(body).length === 0) return;
      const stored = await updateNote.mutateAsync({ id: note.id, ...body });
      setMismatches(diffUpdateResult(body, stored));
    },
  );

  useEffect(() => {
    if (selected) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  const contentEmpty = values.content.trim() === "";

  return (
    <article
      ref={cardRef}
      className={`mb-3 break-inside-avoid rounded-2xl border bg-surface transition-colors ${
        selected ? "border-accent" : "border-line hover:border-line-strong"
      }`}
    >
      {!selected ? (
        <button type="button" onClick={onSelect} className="block w-full p-4 text-left">
          <p className="line-clamp-[12] text-sm whitespace-pre-wrap text-ink">{note.content}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            {note.section && <Badge>{note.section}</Badge>}
            {note.createdVia === "ON_BEHALF_AGENT" && note.createdByUsername && (
              <Badge tone="accent">@{note.createdByUsername}</Badge>
            )}
            <span className="ml-auto">{new Date(note.createdAt).toLocaleDateString()}</span>
          </div>
        </button>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              Editing
            </span>
            <IconButton aria-label="Close note" size="sm" onClick={onSelect}>
              <CloseIcon />
            </IconButton>
          </div>

          <Textarea
            {...bind("content")}
            rows={Math.min(16, Math.max(4, values.content.split("\n").length + 1))}
            maxLength={2000}
            aria-label="Content"
          />
          {contentEmpty && (
            <p className="text-xs text-danger">
              Content is required — the server rejects an empty one. Delete the note instead.
            </p>
          )}

          <Field label="Section">
            <Input {...bind("section")} placeholder="None" />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-muted" aria-live="polite">
              {saveStatusLabel(status, dirty) ?? "Changes save automatically"}
            </span>
            <Button variant="secondary" onClick={() => setShowHistory((s) => !s)}>
              {showHistory ? "Hide history" : "History"}
            </Button>
            <Button
              variant="danger"
              className="ml-auto"
              disabled={deleteNote.isPending}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "Delete this note?",
                  body: noteTitle(note),
                });
                if (ok) deleteNote.mutate(note.id);
              }}
            >
              <TrashIcon /> Delete
            </Button>
          </div>

          {updateNote.isError && (
            <ErrorNotice
              message={
                updateNote.error instanceof ApiError ? updateNote.error.message : "Failed to save."
              }
            />
          )}
          {mismatches.length > 0 && (
            <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger">
              <p className="font-medium">
                The server returned 200 but these fields came back different from what was sent:
              </p>
              <ul className="mt-1 space-y-0.5 font-mono">
                {mismatches.map((m) => (
                  <li key={m.field}>
                    {m.field}: sent {m.requested}, stored {m.stored}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-muted">
            <div>
              <dt className="font-medium text-ink">Created via</dt>
              <dd>{note.createdVia}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">From phone</dt>
              <dd>{note.createdByPhone ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Created</dt>
              <dd>{new Date(note.createdAt).toLocaleString()}</dd>
            </div>
            {note.createdVia === "ON_BEHALF_AGENT" && (
              <div>
                <dt className="font-medium text-ink">Filed by</dt>
                <dd>{note.createdByUsername ? `@${note.createdByUsername}` : "—"}</dd>
              </div>
            )}
          </dl>

          {showHistory && (
            <div className="border-t border-line pt-3">
              <HistoryPanel entityKind="note" id={note.id} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}
