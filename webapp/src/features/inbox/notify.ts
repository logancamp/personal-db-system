import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const cache = new Map<string, boolean>();

function storageKey(username: string | null) {
  return `inbox.notifySender:${username ?? "anon"}`;
}

function read(username: string | null): boolean {
  const key = storageKey(username);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  let value = false;
  try {
    value = localStorage.getItem(key) === "1";
  } catch {
    value = false;
  }
  cache.set(key, value);
  return value;
}

export function useNotifySender(username: string | null): [boolean, (next: boolean) => void] {
  const enabled = useSyncExternalStore(
    useCallback((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }, []),
    () => read(username),
    () => false,
  );

  const set = useCallback(
    (next: boolean) => {
      const key = storageKey(username);
      cache.set(key, next);
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // storage unavailable; the in-memory value still applies
      }
      for (const listener of listeners) listener();
    },
    [username],
  );

  return [enabled, set];
}

export type InboxAction = "done" | "filed" | "deleted";

export function notificationText(action: InboxAction, label: string): string {
  const title = label.length > 80 ? `${label.slice(0, 80)}…` : label;
  switch (action) {
    case "done":
      return `Done: “${title}”`;
    case "filed":
      return `Got it, filed: “${title}”`;
    case "deleted":
      return `Removed from my inbox: “${title}”`;
  }
}
