import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { z } from "zod";
import {
  useCreateTodo,
  useDeleteTodo,
  useReorderTodo,
  useTodos,
  useUpdateTodo,
} from "../../features/todos/hooks";
import { planReorder } from "../../features/todos/order";
import type { UpdateTodoInput } from "../../features/todos/api";
import { diffUpdateResult, type FieldMismatch } from "../../features/todos/verify";
import { HistoryPanel } from "../../features/history/HistoryPanel";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorNotice,
  Field,
  IconButton,
  Input,
  PageHeader,
  Segmented,
  Spinner,
  Textarea,
} from "../../components/ui";
import { CloseIcon, FilterIcon, PlusIcon, SearchIcon, TrashIcon } from "../../components/icons";
import { saveStatusLabel, useAutosaveRecord } from "../../lib/autosave";
import { confirmDialog } from "../../components/ConfirmDialog";
import { ApiError } from "../../lib/api-client";
import type { Todo } from "../../types/models";

const searchSchema = z.object({
  highlight: z.number().optional(),
});

export const Route = createFileRoute("/_authenticated/todos")({
  validateSearch: searchSchema,
  component: TodosPage,
});

const DAYS_SHOWN = 14;

const DEFAULT_DUE_TIME = "09:00:00";

function parseLocal(value: string | null): Date | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dayFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function dayLabel(date: Date, offset: number): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function toDatetimeLocalInput(value: string | null): string {
  return value ? value.slice(0, 16) : "";
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function toApiDateTime(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

type DateBasis = "todoDate" | "dueAt";
type ViewMode = "calendar" | "all";

function basisValue(todo: Todo, basis: DateBasis): string | null {
  return basis === "todoDate" ? todo.todoDate : todo.dueAt;
}

function TodosPage() {
  const { highlight } = Route.useSearch();
  const { data: todos, isLoading, error } = useTodos();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const reorderTodo = useReorderTodo();

  const [view, setView] = useState<ViewMode>("calendar");
  const [basis, setBasis] = useState<DateBasis>("todoDate");
  const [showFilters, setShowFilters] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(highlight ?? null);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const sections = useMemo(() => {
    const found = new Set<string>();
    for (const todo of todos ?? []) if (todo.section) found.add(todo.section);
    return [...found].sort();
  }, [todos]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (todos ?? []).filter((todo) => {
      if (!showCompleted && todo.completed) return false;
      if (sectionFilter !== null && (todo.section ?? "") !== sectionFilter) return false;
      if (!needle) return true;
      return (
        todo.title.toLowerCase().includes(needle) ||
        (todo.notes ?? "").toLowerCase().includes(needle) ||
        (todo.section ?? "").toLowerCase().includes(needle)
      );
    });
  }, [todos, showCompleted, sectionFilter, query]);

  const selected = (todos ?? []).find((todo) => todo.id === selectedId) ?? null;

  function dropOnDay(todoId: number, key: string) {
    const todo = (todos ?? []).find((t) => t.id === todoId);
    if (!todo) return;
    if (basis === "todoDate") {
      updateTodo.mutate({ id: todoId, todoDate: key });
    } else {
      const time = todo.dueAt?.slice(11, 19) || DEFAULT_DUE_TIME;
      updateTodo.mutate({ id: todoId, dueAt: `${key}T${time}` });
    }
  }

  function dropOnUndated(todoId: number) {
    updateTodo.mutate(basis === "todoDate" ? { id: todoId, todoDate: "" } : { id: todoId, dueAt: "" });
  }

  function dropOnSection(todoId: number, section: string) {
    updateTodo.mutate({ id: todoId, section });
  }

  function dropOnRow(todoId: number, targetId: number, before: boolean) {
    const plan = planReorder(todos ?? [], todoId, targetId, before);
    if (plan) reorderTodo.mutate(plan);
  }

  const dnd: DragContext = {
    draggingId,
    onDragStart: setDraggingId,
    onDragEnd: () => setDraggingId(null),
    dropOnDay,
    dropOnUndated,
    dropOnSection,
    dropOnRow,
  };

  const duplicateGroups = useMemo(() => {
    const byTitle = new Map<string, Todo[]>();
    for (const t of todos ?? []) {
      const key = t.title.trim().toLowerCase();
      const group = byTitle.get(key);
      if (group) group.push(t);
      else byTitle.set(key, [t]);
    }
    return [...byTitle.values()].filter((g) => g.length > 1);
  }, [todos]);

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col">
      <PageHeader
        title="Todos"
        actions={
          <>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search todos…"
                className="w-56 pl-8"
                aria-label="Search todos"
              />
            </div>
            {view === "calendar" && (
              <Segmented
                label="Date shown"
                size="sm"
                value={basis}
                onChange={setBasis}
                options={[
                  { value: "todoDate", label: "Set date", title: "Group by todoDate" },
                  { value: "dueAt", label: "Due date", title: "Group by dueAt" },
                ]}
              />
            )}
            <Segmented
              label="View"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: "calendar", label: "Calendar" },
                { value: "all", label: "All" },
              ]}
            />
            <IconButton
              aria-label="Filters"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((s) => !s)}
              className={showFilters ? "bg-raised text-ink" : ""}
            >
              <FilterIcon />
            </IconButton>
          </>
        }
      />

      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-raised px-4 py-3 text-sm">
          <span className="text-ink-muted">Section:</span>
          <FilterChip active={sectionFilter === null} onClick={() => setSectionFilter(null)}>
            All
          </FilterChip>
          {sections.map((section) => (
            <FilterChip
              key={section}
              active={sectionFilter === section}
              onClick={() => setSectionFilter(sectionFilter === section ? null : section)}
            >
              {section}
            </FilterChip>
          ))}
          <FilterChip
            active={sectionFilter === ""}
            onClick={() => setSectionFilter(sectionFilter === "" ? null : "")}
          >
            No section
          </FilterChip>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 text-ink-muted">
              <Checkbox checked={showCompleted} onChange={setShowCompleted} label="Show completed" />
              <button type="button" onClick={() => setShowCompleted(!showCompleted)}>
                Show completed
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicateGroups.length > 0 && (
        <div className="mb-4 rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-xs text-danger">
          <p className="font-medium">
            Duplicate records detected — these are separate rows on the server, not a display
            glitch.
          </p>
          <ul className="mt-1 space-y-0.5">
            {duplicateGroups.map((g) => {
              const times = g.map((t) => new Date(t.createdAt).getTime());
              const spreadMs = Math.max(...times) - Math.min(...times);
              return (
                <li key={g[0].id} className="font-mono">
                  “{g[0].title}” — ids {g.map((t) => `#${t.id}`).join(", ")}, created{" "}
                  {(spreadMs / 1000).toFixed(1)}s apart
                </li>
              );
            })}
          </ul>
          <p className="mt-1 opacity-80">
            Rows sharing one id are already merged, so distinct ids mean the create ran more than
            once server-side. A few seconds apart points at the assistant's tool call being
            re-executed on retry.
          </p>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          <form
            className="flex shrink-0 gap-2 border-b border-line px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              createTodo.mutate({ title: title.trim() });
              setTitle("");
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New todo…" />
            <Button type="submit" disabled={createTodo.isPending || !title.trim()}>
              <PlusIcon /> Add
            </Button>
          </form>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {createTodo.isError && (
              <div className="px-4 pt-3">
                <ErrorNotice
                  message={
                    createTodo.error instanceof ApiError
                      ? createTodo.error.message
                      : "Failed to create todo."
                  }
                />
              </div>
            )}
            {(updateTodo.isError || reorderTodo.isError) && (
              <div className="px-4 pt-3">
                <ErrorNotice
                  message={
                    (updateTodo.error ?? reorderTodo.error) instanceof ApiError
                      ? (updateTodo.error ?? reorderTodo.error)!.message
                      : "That change didn't save."
                  }
                />
              </div>
            )}
            {isLoading && (
              <div className="px-4 py-4">
                <Spinner />
              </div>
            )}
            {error && (
              <div className="px-4 py-4">
                <ErrorNotice
                  message={error instanceof ApiError ? error.message : "Failed to load todos."}
                />
              </div>
            )}

            {!isLoading &&
              !error &&
              (view === "calendar" ? (
                <CalendarView
                  todos={filtered}
                  basis={basis}
                  selectedId={selectedId}
                  highlight={highlight}
                  onSelect={setSelectedId}
                  dnd={dnd}
                />
              ) : (
                <AllView
                  todos={filtered}
                  selectedId={selectedId}
                  highlight={highlight}
                  onSelect={setSelectedId}
                  dnd={dnd}
                />
              ))}
          </div>

          <p className="shrink-0 border-t border-line px-4 py-2 text-xs text-ink-muted">
            {view === "calendar"
              ? `Drag a todo onto a day to set its ${basis === "todoDate" ? "date" : "due date"}, or onto “No date” to clear it.`
              : "Drag between sections to refile, or within a section to reorder."}
          </p>
        </div>

        <div className="min-h-0 lg:overflow-y-auto">
          {selected ? (
            <DetailPanel key={selected.id} todo={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="rounded-2xl border border-line bg-surface">
              <EmptyState>Select a todo to see its details.</EmptyState>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-accent/40 bg-accent-soft text-accent-strong"
          : "border-line-strong text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

interface DragContext {
  draggingId: number | null;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  dropOnDay: (todoId: number, dayKey: string) => void;
  dropOnUndated: (todoId: number) => void;
  dropOnSection: (todoId: number, section: string) => void;
  dropOnRow: (todoId: number, targetId: number, before: boolean) => void;
}

const DRAG_MIME = "text/plain";

function readDragId(event: DragEvent, fallback: number | null): number | null {
  const raw = event.dataTransfer.getData(DRAG_MIME);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function DropGroup({
  onDrop,
  disabled = false,
  children,
}: {
  onDrop: (event: DragEvent) => void;
  disabled?: boolean;
  children: (isOver: boolean) => ReactNode;
}) {
  const [isOver, setIsOver] = useState(false);

  if (disabled) return <>{children(false)}</>;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setIsOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        onDrop(e);
      }}
    >
      {children(isOver)}
    </div>
  );
}

function CalendarView({
  todos,
  basis,
  selectedId,
  highlight,
  onSelect,
  dnd,
}: {
  todos: Todo[];
  basis: DateBasis;
  selectedId: number | null;
  highlight?: number;
  onSelect: (id: number) => void;
  dnd: DragContext;
}) {
  const todayKey = dayKey(startOfToday());
  const days = useMemo(() => {
    const start = dayFromKey(todayKey);
    return Array.from({ length: DAYS_SHOWN }, (_, offset) => addDays(start, offset));
  }, [todayKey]);

  const { byDay, overdue, later, undated } = useMemo(() => {
    const today = dayFromKey(todayKey);
    const buckets = new Map<string, Todo[]>();
    const overdueItems: Todo[] = [];
    const laterItems: Todo[] = [];
    const undatedItems: Todo[] = [];
    const windowEnd = addDays(today, DAYS_SHOWN);

    for (const todo of todos) {
      const date = parseLocal(basisValue(todo, basis));
      if (!date) {
        undatedItems.push(todo);
        continue;
      }
      const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (day < today) overdueItems.push(todo);
      else if (day >= windowEnd) laterItems.push(todo);
      else {
        const key = dayKey(day);
        buckets.set(key, [...(buckets.get(key) ?? []), todo]);
      }
    }

    const byTime = (a: Todo, b: Todo) =>
      (parseLocal(basisValue(a, basis))?.getTime() ?? 0) -
      (parseLocal(basisValue(b, basis))?.getTime() ?? 0);

    for (const [key, list] of buckets) buckets.set(key, [...list].sort(byTime));
    return {
      byDay: buckets,
      overdue: overdueItems.sort(byTime),
      later: laterItems.sort(byTime),
      undated: undatedItems,
    };
  }, [todos, basis, todayKey]);

  const rowProps = { selectedId, highlight, onSelect, dnd };

  return (
    <div>
      {overdue.length > 0 && (
        <Group title="Overdue" tone="danger" count={overdue.length}>
          {overdue.map((todo) => (
            <TodoRow key={todo.id} todo={todo} showDate basis={basis} {...rowProps} />
          ))}
        </Group>
      )}

      {days.map((date, offset) => {
        const key = dayKey(date);
        const items = byDay.get(key) ?? [];
        return (
          <DropGroup key={key} onDrop={(e) => {
            const id = readDragId(e, dnd.draggingId);
            if (id !== null) dnd.dropOnDay(id, key);
          }}>
            {(isOver) => (
              <Group
                title={dayLabel(date, offset)}
                meta={date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                count={items.length}
                highlighted={offset === 0}
                dropTarget={isOver}
              >
                {items.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-ink-muted/70">
                    {isOver ? "Drop to schedule here" : "Nothing scheduled"}
                  </p>
                ) : (
                  items.map((todo) => <TodoRow key={todo.id} todo={todo} {...rowProps} />)
                )}
              </Group>
            )}
          </DropGroup>
        );
      })}

      {later.length > 0 && (
        <Group title="Later" count={later.length}>
          {later.map((todo) => (
            <TodoRow key={todo.id} todo={todo} showDate basis={basis} {...rowProps} />
          ))}
        </Group>
      )}

      <DropGroup
        onDrop={(e) => {
          const id = readDragId(e, dnd.draggingId);
          if (id !== null) dnd.dropOnUndated(id);
        }}
      >
        {(isOver) => (
          <Group title="No date" count={undated.length} dropTarget={isOver}>
            {undated.length === 0 ? (
              <p className="px-4 py-2 text-xs text-ink-muted/70">
                {isOver ? "Drop to clear the date" : "Nothing undated"}
              </p>
            ) : (
              undated.map((todo) => <TodoRow key={todo.id} todo={todo} {...rowProps} />)
            )}
          </Group>
        )}
      </DropGroup>

      {todos.length === 0 && <EmptyState>Nothing here. Add a todo above.</EmptyState>}
    </div>
  );
}

function AllView({
  todos,
  selectedId,
  highlight,
  onSelect,
  dnd,
}: {
  todos: Todo[];
  selectedId: number | null;
  highlight?: number;
  onSelect: (id: number) => void;
  dnd: DragContext;
}) {
  const groups = useMemo(() => {
    const bySection = new Map<string, Todo[]>();
    for (const todo of todos) {
      const key = todo.section ?? "";
      bySection.set(key, [...(bySection.get(key) ?? []), todo]);
    }
    if (!bySection.has("")) bySection.set("", []);
    return [...bySection.entries()].sort(([a], [b]) => {
      if (a === "Inbox") return -1;
      if (b === "Inbox") return 1;
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b);
    });
  }, [todos]);

  if (todos.length === 0) return <EmptyState>Nothing here. Add a todo above.</EmptyState>;

  return (
    <div>
      {groups.map(([section, items]) => (
        <DropGroup
          key={section || "none"}
          onDrop={(e) => {
            const id = readDragId(e, dnd.draggingId);
            if (id !== null) dnd.dropOnSection(id, section);
          }}
        >
          {(isOver) => (
            <Group title={section || "No section"} count={items.length} dropTarget={isOver}>
              {items.length === 0 ? (
                <p className="px-4 py-2 text-xs text-ink-muted/70">
                  {isOver ? "Drop to remove its section" : "Empty"}
                </p>
              ) : (
                items.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    showDate
                    basis="todoDate"
                    reorderable
                    selectedId={selectedId}
                    highlight={highlight}
                    onSelect={onSelect}
                    dnd={dnd}
                  />
                ))
              )}
            </Group>
          )}
        </DropGroup>
      ))}
    </div>
  );
}

function Group({
  title,
  meta,
  count,
  tone = "neutral",
  highlighted = false,
  dropTarget = false,
  children,
}: {
  title: string;
  meta?: string;
  count: number;
  tone?: "neutral" | "danger";
  highlighted?: boolean;
  dropTarget?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`border-b border-line last:border-b-0 ${
        dropTarget ? "bg-accent-soft/50 ring-1 ring-accent ring-inset" : ""
      }`}
    >
      <header
        className={`sticky top-0 z-10 flex items-baseline gap-2 border-b border-line px-4 py-1.5 backdrop-blur ${
          highlighted ? "bg-accent-soft/80" : "bg-surface/90"
        }`}
      >
        <h3
          className={`text-xs font-semibold tracking-wide uppercase ${
            tone === "danger" ? "text-danger" : highlighted ? "text-accent-strong" : "text-ink-muted"
          }`}
        >
          {title}
        </h3>
        {meta && <span className="text-xs text-ink-muted">{meta}</span>}
        {count > 0 && <span className="ml-auto text-xs text-ink-muted">{count}</span>}
      </header>
      {children}
    </section>
  );
}

function TodoRow({
  todo,
  selectedId,
  highlight,
  onSelect,
  dnd,
  showDate = false,
  basis = "todoDate",
  reorderable = false,
}: {
  todo: Todo;
  selectedId: number | null;
  highlight?: number;
  onSelect: (id: number) => void;
  dnd: DragContext;
  showDate?: boolean;
  basis?: DateBasis;
  reorderable?: boolean;
}) {
  const updateTodo = useUpdateTodo();
  const rowRef = useRef<HTMLDivElement>(null);
  const [insertion, setInsertion] = useState<"before" | "after" | null>(null);
  const isHighlighted = highlight !== undefined && todo.id === highlight;
  const isDragging = dnd.draggingId === todo.id;

  useEffect(() => {
    // Scroll to this row when opened from an Inbox link; on mount only.
    if (isHighlighted) rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const date = showDate ? parseLocal(basisValue(todo, basis)) : null;

  return (
    <div
      ref={rowRef}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, String(todo.id));
        e.dataTransfer.effectAllowed = "move";
        dnd.onDragStart(todo.id);
      }}
      onDragEnd={() => {
        setInsertion(null);
        dnd.onDragEnd();
      }}
      onDragOver={
        reorderable
          ? (e) => {
              if (dnd.draggingId === todo.id) return;
              e.preventDefault();
              e.stopPropagation();
              const box = e.currentTarget.getBoundingClientRect();
              setInsertion(e.clientY < box.top + box.height / 2 ? "before" : "after");
            }
          : undefined
      }
      onDragLeave={reorderable ? () => setInsertion(null) : undefined}
      onDrop={
        reorderable
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              const id = readDragId(e, dnd.draggingId);
              const box = e.currentTarget.getBoundingClientRect();
              const before = e.clientY < box.top + box.height / 2;
              setInsertion(null);
              dnd.onDragEnd();
              if (id !== null && id !== todo.id) dnd.dropOnRow(id, todo.id, before);
            }
          : undefined
      }
      className={`relative flex cursor-grab items-center gap-3 border-b border-line/60 px-4 py-2 last:border-b-0 active:cursor-grabbing ${
        selectedId === todo.id ? "bg-accent-soft" : "hover:bg-raised"
      } ${isDragging ? "opacity-40" : ""} ${
        insertion === "before" ? "shadow-[inset_0_2px_0_0_var(--accent)]" : ""
      } ${insertion === "after" ? "shadow-[inset_0_-2px_0_0_var(--accent)]" : ""}`}
    >
      <Checkbox
        checked={todo.completed}
        label={`Mark "${todo.title}" ${todo.completed ? "not done" : "done"}`}
        onChange={(next) => updateTodo.mutate({ id: todo.id, completed: next })}
      />
      <button
        type="button"
        onClick={() => onSelect(todo.id)}
        className="min-w-0 flex-1 truncate text-left text-sm"
      >
        <span className={todo.completed ? "text-ink-muted line-through" : ""}>{todo.title}</span>
      </button>
      {date && (
        <span className="shrink-0 text-xs text-ink-muted">
          {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      )}
      {todo.section && <Badge>{todo.section}</Badge>}
      {todo.createdVia === "ON_BEHALF_AGENT" && todo.createdByUsername && (
        <Badge tone="accent">@{todo.createdByUsername}</Badge>
      )}
    </div>
  );
}

function DetailPanel({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const [showHistory, setShowHistory] = useState(false);
  const [mismatches, setMismatches] = useState<FieldMismatch[]>([]);

  const remote = {
    title: todo.title,
    notes: todo.notes ?? "",
    section: todo.section ?? "",
    todoDate: toDateInput(todo.todoDate),
    dueAt: toDatetimeLocalInput(todo.dueAt),
  };

  const { values, bind, status, dirty } = useAutosaveRecord(remote, async (patch) => {
    const body: UpdateTodoInput = {};
    if (patch.title !== undefined) body.title = patch.title.trim();
    if (patch.notes !== undefined) body.notes = patch.notes;
    if (patch.section !== undefined) body.section = patch.section;
    if (patch.todoDate !== undefined) body.todoDate = patch.todoDate;
    if (patch.dueAt !== undefined) body.dueAt = patch.dueAt === "" ? "" : toApiDateTime(patch.dueAt);

    if (body.title !== undefined && body.title === "") delete body.title;
    if (Object.keys(body).length === 0) return;

    const stored = await updateTodo.mutateAsync({ id: todo.id, ...body });
    setMismatches(diffUpdateResult(body, stored));
  });

  const titleEmpty = values.title.trim() === "";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-2">
        <Checkbox
          checked={todo.completed}
          label={`Mark "${todo.title}" ${todo.completed ? "not done" : "done"}`}
          onChange={(next) => updateTodo.mutate({ id: todo.id, completed: next })}
          className="mt-2"
        />
        <input
          {...bind("title")}
          aria-label="Title"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-base font-semibold outline-none hover:border-line focus:border-accent"
        />
        <IconButton aria-label="Close details" size="sm" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>

      {titleEmpty && (
        <p className="text-xs text-danger">
          A title is required — the server rejects an empty one. Delete the todo instead.
        </p>
      )}

      <Field label="Notes">
        <Textarea {...bind("notes")} rows={4} maxLength={1000} />
      </Field>

      <div className="grid gap-3">
        <Field label="Section">
          <Input {...bind("section")} placeholder="None" />
        </Field>
        <Field label="Set date">
          <Input type="date" {...bind("todoDate")} />
        </Field>
        <Field label="Due at">
          <Input type="datetime-local" {...bind("dueAt")} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-muted" aria-live="polite">
          {saveStatusLabel(status, dirty) ?? "Changes save automatically"}
        </span>
        <Button variant="secondary" onClick={() => setShowHistory((s) => !s)}>
          {showHistory ? "Hide history" : "History"}
        </Button>
        <Button
          variant="danger"
          className="ml-auto"
          disabled={deleteTodo.isPending}
          onClick={async () => {
            const ok = await confirmDialog({
              title: "Delete this todo?",
              body: todo.title,
            });
            if (ok) deleteTodo.mutate(todo.id, { onSuccess: onClose });
          }}
        >
          <TrashIcon /> Delete
        </Button>
      </div>

      {updateTodo.isError && (
        <ErrorNotice
          message={
            updateTodo.error instanceof ApiError ? updateTodo.error.message : "Failed to save."
          }
        />
      )}

      {mismatches.length > 0 && (
        <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger">
          <p className="font-medium">
            The server returned 200 but these fields came back different from what was sent:
          </p>
          <ul className="mt-1 space-y-0.5 font-mono">
            {mismatches.map((m) => (
              <li key={m.field}>
                {m.field}: sent {m.requested}, stored {m.stored}
              </li>
            ))}
          </ul>
          <p className="mt-1 opacity-80">
            That's a server-side write that didn't take — worth reporting rather than retrying.
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-xs text-ink-muted">
        <MetaItem label="Created via" value={todo.createdVia} />
        <MetaItem label="From phone" value={todo.createdByPhone ?? "—"} />
        <MetaItem label="Created" value={new Date(todo.createdAt).toLocaleString()} />
        {todo.createdVia === "ON_BEHALF_AGENT" && (
          <MetaItem
            label="Filed by"
            value={todo.createdByUsername ? `@${todo.createdByUsername}` : "—"}
          />
        )}
      </dl>

      {showHistory && (
        <div className="border-t border-line pt-3">
          <HistoryPanel entityKind="todo" id={todo.id} />
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-ink">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
