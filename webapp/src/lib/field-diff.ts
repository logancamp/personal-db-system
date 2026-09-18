export interface FieldMismatch {
  field: string;
  requested: string;
  stored: string;
}

export type FieldKind = "text" | "boolean" | "date";

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  return String(value);
}

function normalizeText(value: unknown): string | null {
  return value === undefined || value === null || value === "" ? null : String(value);
}

function sameInstant(requested: string, stored: string): boolean {
  const parse = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00` : value);
  const a = parse(requested);
  const b = parse(stored);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return requested === stored;
  return a.getTime() === b.getTime();
}

function matches(kind: FieldKind, requested: unknown, stored: unknown): boolean {
  switch (kind) {
    case "boolean":
      return stored === requested;
    case "date":
      if (requested === "") return stored === null || stored === "";
      return typeof stored === "string" && typeof requested === "string" && sameInstant(requested, stored);
    case "text":
      return normalizeText(stored) === normalizeText(requested);
  }
}

// A 200 response doesn't prove the write took effect; compare what came back with what was sent.
export function diffWrite(
  sent: Record<string, unknown>,
  stored: Record<string, unknown>,
  kinds: Record<string, FieldKind>,
): FieldMismatch[] {
  const mismatches: FieldMismatch[] = [];
  for (const [field, kind] of Object.entries(kinds)) {
    const requested = sent[field];
    if (requested === undefined || requested === null) continue;
    if (matches(kind, requested, stored[field])) continue;
    mismatches.push({
      field,
      requested: display(requested),
      stored: display(stored[field]),
    });
  }
  return mismatches;
}
