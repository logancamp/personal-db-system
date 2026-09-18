export interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

export function diffRevisionStates(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): FieldDiff[] {
  const beforeObj = before ?? {};
  const afterObj = after ?? {};
  const fields = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  const diffs: FieldDiff[] = [];
  for (const field of fields) {
    const b = beforeObj[field];
    const a = afterObj[field];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diffs.push({ field, before: b, after: a });
    }
  }
  return diffs.sort((x, y) => x.field.localeCompare(y.field));
}

export function formatDiffValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
