type Cleaner = () => void;

// Feature modules register cleanup here so login/logout can reset per-account state.
const cleaners = new Set<Cleaner>();

export function registerSessionCleaner(cleaner: Cleaner) {
  cleaners.add(cleaner);
  return () => cleaners.delete(cleaner);
}

export function resetSessionState() {
  for (const cleaner of cleaners) cleaner();
}
