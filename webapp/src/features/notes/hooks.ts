import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import * as api from "./api";

function dedupeById<T extends { id: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  return rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

export function useNotes() {
  const { basicToken } = useAuth();
  return useQuery({
    queryKey: ["notes"],
    queryFn: () => api.listNotes(basicToken!),
    select: dedupeById,
    enabled: !!basicToken,
  });
}

export function useCreateNote() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateNoteInput) => api.createNote(basicToken!, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useUpdateNote() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number } & api.UpdateNoteInput) =>
      api.updateNote(basicToken!, id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useDeleteNote() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteNote(basicToken!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}
