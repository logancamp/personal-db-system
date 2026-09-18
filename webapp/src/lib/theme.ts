import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "theme.mode";

function isMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isMode(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

let mode: ThemeMode = readStoredMode();
const listeners = new Set<() => void>();

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(current: ThemeMode): "light" | "dark" {
  return current === "system" ? (prefersDark() ? "dark" : "light") : current;
}

function apply() {
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

function emit() {
  for (const listener of listeners) listener();
}

export function setThemeMode(next: ThemeMode) {
  mode = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage unavailable; the in-memory value still applies
  }
  apply();
  emit();
}

export function getThemeMode(): ThemeMode {
  return mode;
}

export function initTheme() {
  apply();
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    if (mode === "system") {
      apply();
      emit();
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): [ThemeMode, "light" | "dark", (next: ThemeMode) => void] {
  const current = useSyncExternalStore(
    subscribe,
    () => mode,
    () => "system" as ThemeMode,
  );
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolveTheme(mode),
    () => "light" as const,
  );
  return [current, resolved, setThemeMode];
}
