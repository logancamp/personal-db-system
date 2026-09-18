import type { Todo } from "../../types/models";

// Positions are spaced apart so a drag is a single update; a batch renumber is the fallback.
export const GAP = 1000;

export type ReorderPlan =
  | { kind: "single"; id: number; sortOrder: number }
  | { kind: "batch"; positions: { id: number; sortOrder: number }[] };

export function planReorder(
  ordered: Todo[],
  dragId: number,
  targetId: number,
  before: boolean,
): ReorderPlan | null {
  if (dragId === targetId) return null;
  if (!ordered.some((t) => t.id === dragId)) return null;

  const without = ordered.filter((t) => t.id !== dragId);
  const targetIndex = without.findIndex((t) => t.id === targetId);
  if (targetIndex < 0) return null;

  const insertAt = before ? targetIndex : targetIndex + 1;
  const lower = without[insertAt - 1]?.sortOrder ?? null;
  const upper = without[insertAt]?.sortOrder ?? null;

  const renumber = (): ReorderPlan => {
    const next = [...without];
    next.splice(insertAt, 0, ordered.find((t) => t.id === dragId)!);
    return {
      kind: "batch",
      positions: next.map((todo, index) => ({ id: todo.id, sortOrder: (index + 1) * GAP })),
    };
  };

  if (lower === null && upper === null) return { kind: "single", id: dragId, sortOrder: GAP };

  if (lower === null) {
    if (upper! < 2) return renumber();
    return { kind: "single", id: dragId, sortOrder: Math.floor(upper! / 2) };
  }

  if (upper === null) return { kind: "single", id: dragId, sortOrder: lower + GAP };

  if (upper - lower < 2) return renumber();
  return { kind: "single", id: dragId, sortOrder: lower + Math.floor((upper - lower) / 2) };
}
