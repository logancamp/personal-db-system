import { useSyncExternalStore } from "react";

export type WidgetId = "todos" | "notes" | "chat" | "inbox" | "history";

export const WIDGET_LABELS: Record<WidgetId, string> = {
  todos: "Todos",
  notes: "Notes",
  chat: "Chat",
  inbox: "Inbox",
  history: "History",
};

const DEFAULT_ORDER: WidgetId[] = ["chat", "todos", "notes", "inbox", "history"];

export interface HomeLayout {
  order: WidgetId[];
  hidden: WidgetId[];
}

const DEFAULT_LAYOUT: HomeLayout = { order: DEFAULT_ORDER, hidden: [] };

function storageKey(username: string | null) {
  return `home.layout:${username ?? "anon"}`;
}

function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === "string" && value in WIDGET_LABELS;
}

function normalize(raw: unknown): HomeLayout {
  const parsed = (raw ?? {}) as Partial<HomeLayout>;
  const storedOrder = Array.isArray(parsed.order) ? parsed.order.filter(isWidgetId) : [];
  const order = [...storedOrder, ...DEFAULT_ORDER.filter((id) => !storedOrder.includes(id))];
  const hidden = Array.isArray(parsed.hidden) ? parsed.hidden.filter(isWidgetId) : [];
  return { order, hidden };
}

const cache = new Map<string, HomeLayout>();
const listeners = new Set<() => void>();

function read(username: string | null): HomeLayout {
  const key = storageKey(username);
  const cached = cache.get(key);
  if (cached) return cached;
  let value = DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(key);
    value = normalize(raw ? JSON.parse(raw) : null);
  } catch {
    value = DEFAULT_LAYOUT;
  }
  cache.set(key, value);
  return value;
}

function write(username: string | null, next: HomeLayout) {
  const key = storageKey(username);
  cache.set(key, next);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // storage unavailable; the in-memory value still applies
  }
  for (const listener of listeners) listener();
}

export function useHomeLayout(username: string | null) {
  const layout = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => read(username),
    () => DEFAULT_LAYOUT,
  );

  return {
    layout,
    visible: layout.order.filter((id) => !layout.hidden.includes(id)),
    toggle(id: WidgetId) {
      const hidden = layout.hidden.includes(id)
        ? layout.hidden.filter((h) => h !== id)
        : [...layout.hidden, id];
      write(username, { ...layout, hidden });
    },
    move(id: WidgetId, direction: -1 | 1) {
      const order = [...layout.order];
      const from = order.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= order.length) return;
      [order[from], order[to]] = [order[to], order[from]];
      write(username, { ...layout, order });
    },
    reset() {
      write(username, DEFAULT_LAYOUT);
    },
  };
}
