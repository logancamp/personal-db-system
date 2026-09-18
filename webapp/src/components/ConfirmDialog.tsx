import { useCallback, useSyncExternalStore } from "react";
import { Button } from "./ui";

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

let pending: PendingConfirm | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  pending?.resolve(false);
  return new Promise<boolean>((resolve) => {
    pending = { ...options, resolve };
    emit();
  });
}

function settle(value: boolean) {
  pending?.resolve(value);
  pending = null;
  emit();
}

export function ConfirmDialogHost() {
  const current = useSyncExternalStore(
    useCallback((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }, []),
    () => pending,
    () => null,
  );

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Dismiss without deleting"
        onClick={() => settle(false)}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-panel"
        onKeyDown={(e) => {
          if (e.key === "Escape") settle(false);
          if (e.key === "Enter") settle(true);
        }}
      >
        <h2 className="text-base font-semibold tracking-tight text-ink">{current.title}</h2>
        {current.body && <p className="mt-2 text-sm text-ink-muted">{current.body}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => settle(false)}>
            {current.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={current.tone === "neutral" ? "primary" : "danger"}
            autoFocus
            onClick={() => settle(true)}
          >
            {current.confirmLabel ?? "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
