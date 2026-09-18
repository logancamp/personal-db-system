export function ForeignMessageNotice({ senders }: { senders: string[] }) {
  if (senders.length === 0) return null;
  return (
    <div className="mb-3 rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger">
      <p className="font-medium">
        This thread's response included messages from{" "}
        {senders.map((s) => `@${s}`).join(", ")}, which don't belong to it.
      </p>
      <p className="mt-1 opacity-80">
        They've been filtered out of the view. Nothing was cached wrongly — the server
        returned them for this conversation, so this is worth reporting with the peer name
        and the target you were on.
      </p>
    </div>
  );
}
