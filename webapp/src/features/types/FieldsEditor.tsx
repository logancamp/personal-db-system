import { useMemo, useState } from "react";
import { Button, IconButton, Input } from "../../components/ui";
import { PlusIcon, TrashIcon } from "../../components/icons";
import type { TypeItem } from "../../types/models";

export type FieldType = "text" | "number" | "boolean";

export interface FieldRow {
  id: number;
  name: string;
  value: string;
  type: FieldType;
}

let rowSeq = 0;
export function emptyRow(): FieldRow {
  rowSeq += 1;
  return { id: rowSeq, name: "", value: "", type: "text" };
}

export function knownFieldNames(items: TypeItem[] | undefined): string[] {
  const names = new Set<string>();
  for (const item of items ?? []) {
    for (const key of Object.keys(item.fields ?? {})) names.add(key);
  }
  return [...names].sort();
}

export function fieldsToRows(fields: Record<string, unknown> | null | undefined): FieldRow[] {
  return Object.entries(fields ?? {}).map(([name, value]) => {
    rowSeq += 1;
    const type: FieldType =
      typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "text";
    return {
      id: rowSeq,
      name,
      value:
        value === null || value === undefined
          ? ""
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value),
      type,
    };
  });
}

export function rowsToFields(rows: FieldRow[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    if (row.type === "number") {
      const parsed = Number(row.value);
      fields[name] = row.value.trim() === "" || Number.isNaN(parsed) ? null : parsed;
    } else if (row.type === "boolean") {
      fields[name] = row.value === "true";
    } else {
      fields[name] = row.value;
    }
  }
  return fields;
}

export function FieldsEditor({
  rows,
  onChange,
  suggestions,
}: {
  rows: FieldRow[];
  onChange: (rows: FieldRow[]) => void;
  suggestions: string[];
}) {
  const listId = useMemo(() => `field-names-${Math.abs(rows[0]?.id ?? 0)}`, [rows]);
  const [showRaw, setShowRaw] = useState(false);

  const update = (id: number, patch: Partial<FieldRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <div className="flex flex-col gap-2">
      <datalist id={listId}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {rows.length === 0 && (
        <p className="text-xs text-ink-muted">No fields — this item will just have a name.</p>
      )}

      {rows.map((row) => (
        <div key={row.id} className="rounded-xl border border-line bg-raised/60 p-2">
          <div className="flex items-center gap-2">
            <Input
              value={row.name}
              onChange={(e) => update(row.id, { name: e.target.value })}
              placeholder="Field name"
              list={listId}
              aria-label="Field name"
            />
            <IconButton
              size="sm"
              aria-label={`Remove field ${row.name || "row"}`}
              className="shrink-0 text-danger hover:bg-danger-soft"
              onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
            >
              <TrashIcon />
            </IconButton>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <select
              value={row.type}
              onChange={(e) => update(row.id, { type: e.target.value as FieldType, value: "" })}
              aria-label="Field type"
              className="shrink-0 rounded-lg border border-line-strong bg-surface px-2 py-2 text-sm text-ink"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Yes / no</option>
            </select>
            {row.type === "boolean" ? (
              <select
                value={row.value || "false"}
                onChange={(e) => update(row.id, { value: e.target.value })}
                aria-label="Field value"
                className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 py-2 text-sm text-ink"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <Input
                value={row.value}
                onChange={(e) => update(row.id, { value: e.target.value })}
                placeholder="Value"
                inputMode={row.type === "number" ? "decimal" : undefined}
                aria-label="Field value"
                className="min-w-0 flex-1"
              />
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...rows, emptyRow()])}>
          <PlusIcon /> Add field
        </Button>
        <button
          type="button"
          onClick={() => setShowRaw((s) => !s)}
          className="text-xs text-ink-muted underline-offset-2 hover:underline"
        >
          {showRaw ? "Hide" : "Show"} JSON
        </button>
      </div>

      {showRaw && (
        <pre className="overflow-x-auto rounded-lg border border-line bg-raised px-3 py-2 font-mono text-xs text-ink-muted">
          {JSON.stringify(rowsToFields(rows), null, 2)}
        </pre>
      )}
    </div>
  );
}
