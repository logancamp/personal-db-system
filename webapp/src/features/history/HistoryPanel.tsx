import { useHistory } from "./hooks";
import { diffRevisionStates, formatDiffValue } from "./diff";
import type { ChangeType, EntityKind, Revision } from "../../types/models";
import { EmptyState, ErrorNotice, Spinner } from "../../components/ui";
import { ApiError } from "../../lib/api-client";

const CHANGE_LABEL: Record<ChangeType, string> = {
  ADD: "Created",
  MOD: "Edited",
  DEL: "Deleted",
};

const CHANGE_STYLE: Record<ChangeType, string> = {
  ADD: "text-accent-strong",
  MOD: "text-ink",
  DEL: "text-danger",
};

function revisionKey(rev: Revision, index: number): string {
  return typeof rev.revisionId === "number" ? String(rev.revisionId) : `${rev.changedAt}-${rev.changeType}-${index}`;
}

export function HistoryPanel({ entityKind, id }: { entityKind: EntityKind; id: number }) {
  const { data, isLoading, error } = useHistory(entityKind, id);

  if (isLoading) return <Spinner />;
  if (error) {
    return (
      <ErrorNotice
        message={
          error instanceof ApiError
            ?
              error.message
            : "Failed to load history."
        }
      />
    );
  }
  if (!data) return null;

  if (!data.historyEnabled) {
    return (
      <p className="text-sm text-ink-muted">
        History is turned off for your account — turn it on in Settings to start recording changes.
      </p>
    );
  }

  if (data.revisions.length === 0) {
    return <EmptyState>No recorded changes yet.</EmptyState>;
  }

  const chronological = [...data.revisions].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
  );
  const withDiffs = chronological.map((rev, i) => {
    const prevState = i > 0 ? chronological[i - 1].state : null;
    const diffs =
      rev.changeType === "DEL" ? diffRevisionStates(prevState, null) : diffRevisionStates(prevState, rev.state);
    return { rev, diffs };
  });

  return (
    <ul className="flex flex-col gap-2">
      {[...withDiffs].reverse().map(({ rev, diffs }, index) => (
        <li
          key={revisionKey(rev, index)}
          className="rounded-md border border-line px-3 py-2 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className={`font-medium ${CHANGE_STYLE[rev.changeType]}`}>{CHANGE_LABEL[rev.changeType]}</span>
            <span className="text-ink-muted">{new Date(rev.changedAt).toLocaleString()}</span>
          </div>
          <p className="mt-0.5 text-ink-muted">by {rev.changedBy}</p>
          {diffs.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5 font-mono">
              {diffs.map((d) => (
                <li key={d.field}>
                  <span className="text-ink-muted">{d.field}: </span>
                  {rev.changeType !== "ADD" && (
                    <span className="text-danger line-through">{formatDiffValue(d.before)} </span>
                  )}
                  {rev.changeType !== "DEL" && (
                    <span className="text-accent-strong">{formatDiffValue(d.after)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
