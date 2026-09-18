import { apiFetch } from "../../lib/api-client";
import type { Note } from "../../types/models";

export function listNotes(basicToken: string): Promise<Note[]> {
  return apiFetch<Note[]>("/note", { basicToken });
}

export interface CreateNoteInput {
  content: string;
  section?: string;
}

export function createNote(basicToken: string, input: CreateNoteInput): Promise<Note> {
  return apiFetch<Note>("/note", { method: "POST", body: input, basicToken });
}

export interface UpdateNoteInput {
  content?: string;
  section?: string | null;
}

export function updateNote(basicToken: string, id: number, input: UpdateNoteInput): Promise<Note> {
  return apiFetch<Note>(`/note/${id}`, { method: "PUT", body: input, basicToken });
}

export function deleteNote(basicToken: string, id: number): Promise<void> {
  return apiFetch<void>(`/note/${id}`, { method: "DELETE", basicToken });
}
