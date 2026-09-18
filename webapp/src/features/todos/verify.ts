import { diffWrite, type FieldKind, type FieldMismatch } from "../../lib/field-diff";
import type { Todo } from "../../types/models";
import type { UpdateTodoInput } from "./api";

export type { FieldMismatch };

const TODO_FIELDS: Record<Exclude<keyof UpdateTodoInput, "sortOrder">, FieldKind> = {
  title: "text",
  completed: "boolean",
  notes: "text",
  section: "text",
  dueAt: "date",
  todoDate: "date",
};

export function diffUpdateResult(sent: UpdateTodoInput, stored: Todo): FieldMismatch[] {
  return diffWrite(
    sent as Record<string, unknown>,
    stored as unknown as Record<string, unknown>,
    TODO_FIELDS,
  );
}
