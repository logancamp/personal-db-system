import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useHistoryFeed } from "../../features/history/hooks";
import { diffRevisionStates, formatDiffValue } from "../../features/history/diff";
import {
  ActionRail,
  entityLink,
  revisionKey,
  revisionTitle,
} from "../../features/history/ActionRail";
import { Badge, EmptyState, ErrorNotice, Input, PageHeader, Spinner } from "../../components/ui";
import { SearchIcon } from "../../components/icons";
import { ApiError } from "../../lib/api-client";
import type { ChangeType, FeedRevision } from "../../types/models";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

const PAGE_SIZE = 50;

const CHANGE_LABEL: Record<ChangeType, string> = {
  ADD: "Created",
  MOD: "Edited",
  DEL: "Deleted",
};

function HistoryPage() {
  const feed = useHistoryFeed(PAGE_SIZE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const revisions = useMemo(
    () => feed.data?.pages.flatMap((page) => page.revisions) ?? [],
    [feed.data],
  );
  const historyEnabled = feed.data?.pages[0]?.historyEnabled ?? true;

  const selected = revisions.find((r) => revisionKey(r) === selectedKey) ?? null;

  const previous = useMemo(() => {
    if (!selected) return { state: null as Record<string, unknown> | null, known: false };
    const index = revisions.findIndex((r) => revisionKey(r) === revisionKey(selected));
    for (let i = index + 1; i < revisions.length; i += 1) {
      const candidate = revisions[i];
      if (
        candidate.entityKind === selected.entityKind &&
        candidate.entityId === selected.entityId
      ) {
        return { state: candidate.state, known: true };
      }
    }
    return { state: null, known: selected.changeType === "ADD" || !feed.hasNextPage };
  }, [selected, revisions, feed.hasNextPage]);

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col">
      <PageHeader
        title="History"
        subtitle="Every change you and your assistant have made"
        actions={
          <>
            {feed.isFetching && !feed.isFetchingNextPage && <Spinner />}
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles and operations…"
                aria-label="Search history"
                className="w-72 pl-8"
              />
            </div>
          </>
        }
      />

      {feed.error && (
        <div className="mb-4">
          <ErrorNotice
            message={feed.error instanceof ApiError ? feed.error.message : "Failed to load history."}
          />
        </div>
      )}

      {!historyEnabled && (
        <div className="mb-4 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-strong">
          History recording is off for your account, so nothing is being saved. Turn it on in{" "}
          <Link to="/settings" className="underline underline-offset-2">
            Settings
          </Link>
          .
        </div>
      )}

      {query.trim() !== "" && (
        <p className="mb-2 text-xs text-ink-muted">
          Searching the entries loaded so far — there is no server-side history search, so
          use “Load older” at the end of the list to widen the range.
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ActionRail
              limit={PAGE_SIZE}
              query={query}
              selectedKey={selectedKey}
              onSelect={(revision) => setSelectedKey(revisionKey(revision))}
            />
          </div>
        </div>

        <div className="min-h-0 lg:overflow-y-auto">
          {selected ? (
            <ChangesPanel revision={selected} previousState={previous.state} known={previous.known} />
          ) : (
            <div className="rounded-2xl border border-line bg-surface">
              <EmptyState>Select a change to see what it did.</EmptyState>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChangesPanel({
  revision,
  previousState,
  known,
}: {
  revision: FeedRevision;
  previousState: Record<string, unknown> | null;
  known: boolean;
}) {
  const after = revision.changeType === "DEL" ? null : revision.state;
  const diffs = diffRevisionStates(previousState, after);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={revision.changeType === "DEL" ? "danger" : "accent"}>
          {CHANGE_LABEL[revision.changeType]}
        </Badge>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
          {revisionTitle(revision)}
        </h2>
        {revision.changeType !== "DEL" && (
          <Link
            {...entityLink(revision)}
            className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium transition-colors hover:bg-raised"
          >
            Open
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-muted sm:grid-cols-4">
        <div>
          <dt className="font-medium text-ink">Entity</dt>
          <dd className="font-mono">
            {revision.entityKind} #{revision.entityId}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink">By</dt>
          <dd>{revision.changedBy || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">When</dt>
          <dd>{new Date(revision.changedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Revision</dt>
          <dd className="font-mono">{revision.revisionId ?? "—"}</dd>
        </div>
      </dl>

      <div className="border-t border-line pt-3">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Changes
        </h3>

        {!known && (
          <p className="mb-2 text-xs text-ink-muted">
            The previous revision of this item hasn't been loaded yet, so this shows the full
            state after the change rather than a field-by-field diff. Load older entries to
            fill it in.
          </p>
        )}

        {diffs.length === 0 ? (
          <p className="text-sm text-ink-muted">No field changes recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {diffs.map((d) => (
              <li key={d.field} className="flex flex-wrap gap-x-2">
                <span className="text-ink-muted">{d.field}:</span>
                {revision.changeType !== "ADD" && known && (
                  <span className="text-danger line-through">{formatDiffValue(d.before)}</span>
                )}
                {revision.changeType !== "DEL" && (
                  <span className="text-accent-strong">{formatDiffValue(d.after)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
