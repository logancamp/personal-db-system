import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutosaveResult<K extends string> {
  values: Record<K, string>;
  setValue: (key: K, value: string) => void;
  bind: (key: K) => {
    value: string;
    onChange: (event: { target: { value: string } }) => void;
    onFocus: () => void;
    onBlur: () => void;
  };
  flush: () => void;
  status: SaveStatus;
  dirty: boolean;
}

// Debounced autosave for an edit panel. Remote changes are adopted for fields the user
// hasn't touched (and isn't currently typing in), so a stale panel never writes old values back.
export function useAutosaveRecord<K extends string>(
  remote: Record<K, string>,
  save: (patch: Partial<Record<K, string>>) => Promise<unknown>,
  options: { delay?: number; enabled?: boolean } = {},
): AutosaveResult<K> {
  const { delay = 700, enabled = true } = options;

  const [values, setValues] = useState<Record<K, string>>(remote);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const lastRemote = useRef(remote);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const focusedKey = useRef<K | null>(null);

  const remoteKey = JSON.stringify(remote);

  useEffect(() => {
    const previous = lastRemote.current;
    lastRemote.current = remote;
    setValues((current) => {
      let changed = false;
      const next = { ...current };
      for (const key of Object.keys(remote) as K[]) {
        const remoteChanged = remote[key] !== previous[key];
        const untouched = current[key] === previous[key];
        if (remoteChanged && untouched && focusedKey.current !== key) {
          next[key] = remote[key];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteKey]);

  const commit = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const current = valuesRef.current;
    const patch: Partial<Record<K, string>> = {};
    for (const key of Object.keys(current) as K[]) {
      if (current[key] !== lastRemote.current[key]) patch[key] = current[key];
    }
    if (Object.keys(patch).length === 0) return;

    setStatus("saving");
    saveRef
      .current(patch)
      .then(() => setStatus("saved"))
      .catch(() => setStatus("error"));
  }, []);

  const setValue = useCallback(
    (key: K, value: string) => {
      setValues((current) => ({ ...current, [key]: value }));
      setStatus("idle");
      if (!enabled) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(commit, delay);
    },
    [commit, delay, enabled],
  );

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        const current = valuesRef.current;
        const patch: Partial<Record<K, string>> = {};
        for (const key of Object.keys(current) as K[]) {
          if (current[key] !== lastRemote.current[key]) patch[key] = current[key];
        }
        if (Object.keys(patch).length > 0) void saveRef.current(patch).catch(() => {});
      }
    };
  }, []);

  const bind = useCallback(
    (key: K) => ({
      value: valuesRef.current[key],
      onChange: (event: { target: { value: string } }) => setValue(key, event.target.value),
      onFocus: () => {
        focusedKey.current = key;
      },
      onBlur: () => {
        focusedKey.current = null;
        commit();
      },
    }),
    [setValue, commit],
  );

  const dirty = (Object.keys(values) as K[]).some((key) => values[key] !== lastRemote.current[key]);

  return { values, setValue, bind, flush: commit, status, dirty };
}

export function saveStatusLabel(status: SaveStatus, dirty: boolean): string | null {
  if (status === "saving") return "Saving…";
  if (status === "error") return "Save failed";
  if (dirty) return "Unsaved…";
  if (status === "saved") return "Saved";
  return null;
}
