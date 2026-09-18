import { apiFetch } from "../../lib/api-client";
import type { Todo } from "../../types/models";

export function listTodos(basicToken: string): Promise<Todo[]> {
  return apiFetch<Todo[]>("/todo", { basicToken });
}

export interface CreateTodoInput {
  title: string;
  notes?: string;
  section?: string;
  dueAt?: string;
  todoDate?: string;
}

export function createTodo(basicToken: string, input: CreateTodoInput): Promise<Todo> {
  return apiFetch<Todo>("/todo", { method: "POST", body: input, basicToken });
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
  notes?: string | null;
  section?: string | null;
  dueAt?: string | null;
  todoDate?: string | null;
  sortOrder?: number;
}

export function updateTodo(basicToken: string, id: number, input: UpdateTodoInput): Promise<Todo> {
  return apiFetch<Todo>(`/todo/${id}`, { method: "PUT", body: input, basicToken });
}

export interface TodoPosition {
  id: number;
  sortOrder: number;
}

export function setTodoPositions(
  basicToken: string,
  positions: TodoPosition[],
): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>("/todo/positions", {
    method: "PUT",
    body: positions,
    basicToken,
  });
}

export function deleteTodo(basicToken: string, id: number): Promise<void> {
  return apiFetch<void>(`/todo/${id}`, { method: "DELETE", basicToken });
}
