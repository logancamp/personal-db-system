import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useHistoryFeed } from "./hooks";
import { useAuth } from "../../lib/auth-context";
import { useUsers } from "../users/hooks";
import { isWithinRun, isWithinWindow, useRunWindows, type RunWindow } from "../messages/hooks";
import { EmptyState, ErrorNotice, Spinner } from "../../components/ui";
import { ApiError } from "../../lib/api-client";
import type { ChangeType, EntityKind, FeedRevision } from "../../types/models";

const CHANGE_LABEL: Record<ChangeType, string> = {
  ADD: "created",
  MOD: "edited",
  DEL: "deleted",
};

const CHANGE_STYLE: Record<ChangeType, string> = {
  ADD: "text-accent-strong",
  MOD: "text-ink",
  DEL: "text-danger",
};

const KIND_LABEL: Record<EntityKind, string> = {
  todo: "Todo",
  note: "Note",
  type: "Type",
  item: "Item",
};

export function revisionTitle(revision: FeedRevision): string {
  const state = revision.state;
  if (state) {
    for (const key of ["title", "customName", "name", "content"]) {
      const value = state[key];
      if (typeof value === "string" && value.trim()) {
        const firstLine = value.split("\n")[0].trim();
        return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
      }
    }
  }
  return `${KIND_LABEL[revision.entityKind]} #${revision.entityId}`;
}

export function revisionKey(revision: FeedRevision): string {
  return `${revision.entityKind}-${revision.entityId}-${revision.revisionId ?? revision.changedAt}`;
}

export function revisionSummary(revision: FeedRevision): string {
  return `${CHANGE_LABEL[revision.changeType]} ${KIND_LABEL[revision.entityKind].toLowerCase()} “${revisionTitle(revision)}”`;
}

export function entityLink(revision: FeedRevision) {
  switch (revision.entityKind) {
    case "todo":
      return { to: "/todos", search: { highlight: revision.entityId } } as const;
    case "note":
      return { to: "/notes", search: { highlight: revision.entityId } } as const;
    default:
      return { to: "/db" } as const;
  }
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function useMineFilter() {
  const { username } = useAuth();
  const { data: users } = useUsers();
  return useMemo(() => {
    const others = new Set((users ?? []).map((u) => u.username).filter((u) => u !== username));
    return (revision: FeedRevision) => !others.has(revision.changedBy);
  }, [users, username]);
}

export type RevisionScope = "chat" | "mine" | "all";

export function useScopedRevisions({
  scope = "all",
  runWindow,
  query = "",
  limit = 30,
  pollMs,
}: {
  scope?: RevisionScope;
  runWindow?: RunWindow | null;
  query?: string;
  limit?: number;
  pollMs?: number;
} = {}) {
  const feed = useHistoryFeed(limit, pollMs);
  const isMine = useMineFilter();
  const runWindows = useRunWindows();

  const revisions = useMemo(() => {
    let rows = feed.data?.pages.flatMap((page) => page.revisions) ?? [];
    if (scope === "mine") rows = rows.filter(isMine);
    if (scope === "chat") rows = rows.filter((r) => isWithinRun(r.revisionId, runWindows));
    if (runWindow) rows = rows.filter((r) => isWithinWindow(r.revisionId, runWindow));
    const needle = query.trim().toLowerCase();
    if (needle) {
      rows = rows.filter(
        (r) =>
          revisionTitle(r).toLowerCase().includes(needle) ||
          CHANGE_LABEL[r.changeType].includes(needle) ||
          r.changeType.toLowerCase().includes(needle) ||
          r.entityKind.toLowerCase().includes(needle) ||
          (r.changedBy ?? "").toLowerCase().includes(needle),
      );
    }
    return rows;
  }, [feed.data, scope, isMine, runWindows, runWindow, query]);

  return { feed, revisions };
}

export function ActionRail({
  selectedKey,
  onSelect,
  limit = 30,
  scope = "all",
  query = "",
  emptyMessage,
}: {
  selectedKey?: string | null;
  onSelect?: (revision: FeedRevision) => void;
  limit?: number;
  scope?: RevisionScope;
  query?: string;
  emptyMessage?: string;
}) {
  const { feed, revisions } = useScopedRevisions({ scope, query, limit });
  const historyEnabled = feed.data?.pages[0]?.historyEnabled ?? true;

  if (feed.isLoading) {
    return (
      <div className="p-4">
        <Spinner />
      </div>
    );
  }

  if (feed.error) {
    return (
      <div className="p-3">
        <ErrorNotice
          message={feed.error instanceof ApiError ? feed.error.message : "Failed to load history."}
        />
      </div>
    );
  }

  if (!historyEnabled) {
    return (
      <p className="px-3 py-4 text-sm text-ink-muted">
        History is turned off for your account — turn it on in Settings to start recording
        changes.
      </p>
    );
  }

  if (revisions.length === 0) {
    return <EmptyState>{query ? "Nothing matches." : (emptyMessage ?? "Nothing changed yet.")}</EmptyState>;
  }

  return (
    <div>
      <ul className="relative">
        {revisions.map((revision) => {
          const key = revisionKey(revision);
          const selected = selectedKey === key;
          const row = (
            <>
              <span aria-hidden="true" className="relative flex w-3 shrink-0 justify-center self-stretch">
                <span className="absolute inset-y-0 w-px bg-line" />
                <span
                  className={`relative mt-2 h-1.5 w-1.5 rounded-full ${
                    revision.changeType === "DEL" ? "bg-danger" : "bg-accent"
                  }`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{revisionTitle(revision)}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  <span className={CHANGE_STYLE[revision.changeType]}>
                    {CHANGE_LABEL[revision.changeType]}
                  </span>{" "}
                  {KIND_LABEL[revision.entityKind].toLowerCase()} · {timeLabel(revision.changedAt)}
                  {revision.changedBy && ` · ${revision.changedBy}`}
                </span>
              </span>
            </>
          );

          return (
            <li key={key}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(revision)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${
                    selected ? "bg-accent-soft" : "hover:bg-raised"
                  }`}
                >
                  {row}
                </button>
              ) : (
                <Link
                  {...entityLink(revision)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-raised"
                >
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {feed.hasNextPage && (
        <button
          type="button"
          onClick={() => feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
          className="w-full px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-50"
        >
          {feed.isFetchingNextPage ? "Loading…" : "Load older"}
        </button>
      )}
    </div>
  );
}

export function ActionEvents({
  runWindow,
  live,
  scope = "mine",
}: {
  runWindow: RunWindow | null;
  live: boolean;
  scope?: RevisionScope;
}) {
  const { revisions } = useScopedRevisions({
    scope,
    runWindow,
    limit: 30,
    pollMs: live ? 2000 : undefined,
  });

  const events = useMemo(() => {
    const byEntity = new Map<string, { revision: FeedRevision; writes: number }>();
    for (const revision of [...revisions].reverse()) {
      const key = `${revision.entityKind}-${revision.entityId}`;
      const existing = byEntity.get(key);
      if (existing) {
        existing.writes += 1;
        existing.revision = { ...existing.revision, state: revision.state ?? existing.revision.state };
      } else {
        byEntity.set(key, { revision, writes: 1 });
      }
    }
    return [...byEntity.values()];
  }, [revisions]);

  if (!runWindow || events.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {events.map(({ revision, writes }) => (
        <li key={revisionKey(revision)}>
          <Link
            {...entityLink(revision)}
            className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs text-accent-strong transition-colors hover:border-accent"
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                revision.changeType === "DEL" ? "bg-danger" : "bg-accent"
              }`}
            />
            <span className="min-w-0 flex-1 truncate">{revisionSummary(revision)}</span>
            {writes > 1 && (
              <span className="shrink-0 opacity-70" title={`${writes} writes during this run`}>
                ×{writes}
              </span>
            )}
            <span className="shrink-0 opacity-70">open</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
