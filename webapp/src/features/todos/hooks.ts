import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import type { ReorderPlan } from "./order";
import * as api from "./api";

function dedupeById<T extends { id: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  return rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

export function useTodos() {
  const { basicToken } = useAuth();
  return useQuery({
    queryKey: ["todos"],
    queryFn: () => api.listTodos(basicToken!),
    select: dedupeById,
    enabled: !!basicToken,
  });
}

export function useCreateTodo() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateTodoInput) => api.createTodo(basicToken!, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useUpdateTodo() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number } & api.UpdateTodoInput) =>
      api.updateTodo(basicToken!, id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useReorderTodo() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation<unknown, Error, ReorderPlan>({
    mutationFn: (plan) =>
      plan.kind === "single"
        ? api.updateTodo(basicToken!, plan.id, { sortOrder: plan.sortOrder })
        : api.setTodoPositions(basicToken!, plan.positions),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useDeleteTodo() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteTodo(basicToken!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
}
