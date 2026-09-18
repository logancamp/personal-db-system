import { diffWrite, type FieldKind, type FieldMismatch } from "../../lib/field-diff";
import type { Note } from "../../types/models";
import type { UpdateNoteInput } from "./api";

export type { FieldMismatch };

const NOTE_FIELDS: Record<keyof UpdateNoteInput, FieldKind> = {
  content: "text",
  section: "text",
};

export function diffUpdateResult(sent: UpdateNoteInput, stored: Note): FieldMismatch[] {
  return diffWrite(
    sent as Record<string, unknown>,
    stored as unknown as Record<string, unknown>,
    NOTE_FIELDS,
  );
}
