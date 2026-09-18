import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCreateItem,
  useCreateType,
  useDeleteItem,
  useDeleteType,
  useItems,
  useRenameType,
  useTypes,
  useUpdateItem,
} from "../../features/types/hooks";
import {
  emptyRow,
  FieldsEditor,
  fieldsToRows,
  knownFieldNames,
  rowsToFields,
  type FieldRow,
} from "../../features/types/FieldsEditor";
import { HistoryPanel } from "../../features/history/HistoryPanel";
import {
  Badge,
  Button,
  EmptyState,
  ErrorNotice,
  IconButton,
  Input,
  PageHeader,
  Spinner,
} from "../../components/ui";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "../../components/icons";
import { confirmDialog } from "../../components/ConfirmDialog";
import { saveStatusLabel, type SaveStatus } from "../../lib/autosave";
import { ApiError } from "../../lib/api-client";
import type { TypeDef, TypeItem } from "../../types/models";

export const Route = createFileRoute("/_authenticated/db")({
  component: DbPage,
});

const MAX_TABLE_COLUMNS = 6;

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function DbPage() {
  const { data: types, isLoading, error } = useTypes();
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");

  const { data: items } = useItems(selectedTypeId);
  const selectedType = (types ?? []).find((t) => t.id === selectedTypeId) ?? null;

  useEffect(() => {
    if (selectedTypeId === null && types && types.length > 0) setSelectedTypeId(types[0].id);
  }, [types, selectedTypeId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items ?? [];
    return (items ?? []).filter((item) => {
      if (item.customName.toLowerCase().includes(needle)) return true;
      return Object.entries(item.fields ?? {}).some(
        ([name, value]) =>
          name.toLowerCase().includes(needle) || formatValue(value).toLowerCase().includes(needle),
      );
    });
  }, [items, query]);

  const columns = useMemo(() => knownFieldNames(items), [items]);
  const visibleColumns = columns.slice(0, MAX_TABLE_COLUMNS);
  const hiddenColumnCount = columns.length - visibleColumns.length;

  const selectedItem = (items ?? []).find((i) => i.id === selectedItemId) ?? null;

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col">
      <PageHeader
        title="DB"
        subtitle="Your own types, and the items stored under them"
        actions={
          selectedType ? (
            <Button
              onClick={() => {
                setSelectedItemId(null);
                setCreating(true);
              }}
            >
              <PlusIcon /> New item
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNotice
            message={error instanceof ApiError ? error.message : "Failed to load types."}
          />
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        <TypeTree
          types={types}
          isLoading={isLoading}
          selectedTypeId={selectedTypeId}
          selectedItemId={selectedItemId}
          onSelectType={(id) => {
            setSelectedTypeId(id);
            setSelectedItemId(null);
            setCreating(false);
          }}
          onSelectItem={(id) => {
            setSelectedItemId(id);
            setCreating(false);
          }}
        />

        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {!selectedType ? (
              <EmptyState>Pick a type on the left, or create one.</EmptyState>
            ) : filtered.length === 0 ? (
              <EmptyState>
                {query ? "Nothing matches that search." : "No items in this type yet."}
              </EmptyState>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-2 text-left text-xs font-semibold tracking-wide text-ink-muted uppercase backdrop-blur">
                        Name
                      </th>
                      {visibleColumns.map((column) => (
                        <th
                          key={column}
                          className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-2 text-left text-xs font-semibold tracking-wide text-ink-muted uppercase backdrop-blur"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setCreating(false);
                        }}
                        className={`cursor-pointer border-b border-line/60 transition-colors ${
                          selectedItemId === item.id ? "bg-accent-soft" : "hover:bg-raised"
                        }`}
                      >
                        <td className="max-w-[18rem] truncate px-4 py-2 font-medium text-ink">
                          {item.customName}
                        </td>
                        {visibleColumns.map((column) => (
                          <td
                            key={column}
                            className="max-w-[16rem] truncate px-4 py-2 text-ink-muted"
                            title={formatValue(item.fields?.[column])}
                          >
                            {formatValue(item.fields?.[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hiddenColumnCount > 0 && (
                  <p className="px-4 py-2 text-xs text-ink-muted">
                    {hiddenColumnCount} more field{hiddenColumnCount === 1 ? "" : "s"} — open an
                    item to see all of them.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 rounded-2xl border border-line bg-surface p-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name, field name or value…"
                aria-label="Filter items"
                className="pl-8"
              />
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Filters the {items?.length ?? 0} loaded item
              {(items?.length ?? 0) === 1 ? "" : "s"} in this type, in the browser. There's no
              query endpoint on the server — this is a filter, not SQL.
            </p>
          </div>
        </div>

        <div className="min-h-0 lg:overflow-y-auto">
          {creating && selectedTypeId !== null ? (
            <NewItemPanel
              typeId={selectedTypeId}
              suggestions={columns}
              onClose={() => setCreating(false)}
            />
          ) : selectedItem ? (
            <ItemPanel
              key={selectedItem.id}
              item={selectedItem}
              suggestions={columns}
              onClose={() => setSelectedItemId(null)}
            />
          ) : (
            <div className="rounded-2xl border border-line bg-surface">
              <EmptyState>Select an item to edit it, or add a new one.</EmptyState>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypeTree({
  types,
  isLoading,
  selectedTypeId,
  selectedItemId,
  onSelectType,
  onSelectItem,
}: {
  types: TypeDef[] | undefined;
  isLoading: boolean;
  selectedTypeId: number | null;
  selectedItemId: number | null;
  onSelectType: (id: number) => void;
  onSelectItem: (id: number) => void;
}) {
  const createType = useCreateType();
  const [newName, setNewName] = useState("");

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <form
        className="flex shrink-0 gap-2 border-b border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          createType.mutate(newName.trim());
          setNewName("");
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New type…"
          aria-label="New type name"
        />
        <Button type="submit" disabled={createType.isPending || !newName.trim()} aria-label="Add type">
          <PlusIcon />
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {isLoading && (
          <div className="p-3">
            <Spinner />
          </div>
        )}
        {createType.isError && (
          <div className="p-2">
            <ErrorNotice
              message={
                createType.error instanceof ApiError
                  ? createType.error.message
                  : "Failed to create type."
              }
            />
          </div>
        )}
        {!isLoading && (types ?? []).length === 0 && (
          <EmptyState>No types yet. Create one above.</EmptyState>
        )}

        <ul>
          {(types ?? []).map((type) => (
            <TypeNode
              key={type.id}
              type={type}
              selected={selectedTypeId === type.id}
              selectedItemId={selectedItemId}
              onSelectType={onSelectType}
              onSelectItem={onSelectItem}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}

function TypeNode({
  type,
  selected,
  selectedItemId,
  onSelectType,
  onSelectItem,
}: {
  type: TypeDef;
  selected: boolean;
  selectedItemId: number | null;
  onSelectType: (id: number) => void;
  onSelectItem: (id: number) => void;
}) {
  const deleteType = useDeleteType();
  const renameType = useRenameType();
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(type.name);

  const { data: items } = useItems(expanded || selected ? type.id : null);

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-1 ${
          selected ? "bg-accent-soft" : "hover:bg-raised"
        }`}
      >
        <IconButton
          size="sm"
          aria-label={expanded ? `Collapse ${type.name}` : `Expand ${type.name}`}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </IconButton>

        {renaming ? (
          <form
            className="flex flex-1 gap-1 py-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && name.trim() !== type.name) {
                renameType.mutate({ id: type.id, name: name.trim() });
              }
              setRenaming(false);
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Type name"
              autoFocus
              onBlur={() => setRenaming(false)}
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => onSelectType(type.id)}
            onDoubleClick={() => setRenaming(true)}
            title="Double-click to rename"
            className={`min-w-0 flex-1 truncate py-1.5 text-left text-sm ${
              selected ? "font-medium text-accent-strong" : "text-ink"
            }`}
          >
            {type.name}
          </button>
        )}

        {items && <Badge>{items.length}</Badge>}

        <IconButton
          size="sm"
          aria-label={`Delete type ${type.name}`}
          className="text-danger opacity-0 group-hover:opacity-100 hover:bg-danger-soft focus-visible:opacity-100"
          disabled={deleteType.isPending}
          onClick={async () => {
            const ok = await confirmDialog({
              title: `Delete the type “${type.name}”?`,
              body: "Any items using it must be deleted first, or the server will refuse.",
              confirmLabel: "Delete type",
            });
            if (ok) deleteType.mutate(type.id);
          }}
        >
          <TrashIcon />
        </IconButton>
      </div>

      {deleteType.isError && (
        <div className="px-2 py-1">
          <ErrorNotice
            message={
              deleteType.error instanceof ApiError
                ? deleteType.error.message
                : "Couldn't delete that type."
            }
          />
        </div>
      )}

      {expanded && (
        <ul className="ml-4 border-l border-line pl-2">
          {(items ?? []).length === 0 && <li className="py-1 text-xs text-ink-muted">Empty</li>}
          {(items ?? []).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onSelectType(type.id);
                  onSelectItem(item.id);
                }}
                className={`block w-full truncate rounded-md px-2 py-1 text-left text-xs transition-colors ${
                  selectedItemId === item.id
                    ? "bg-accent-soft text-accent-strong"
                    : "text-ink-muted hover:bg-raised hover:text-ink"
                }`}
              >
                {item.customName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function NewItemPanel({
  typeId,
  suggestions,
  onClose,
}: {
  typeId: number;
  suggestions: string[];
  onClose: () => void;
}) {
  const createItem = useCreateItem();
  const [customName, setCustomName] = useState("");
  const [rows, setRows] = useState<FieldRow[]>(() => [emptyRow()]);

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!customName.trim()) return;
        createItem.mutate(
          { customName: customName.trim(), typeId, fields: rowsToFields(rows) },
          { onSuccess: onClose },
        );
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">New item</h2>
        <IconButton size="sm" aria-label="Cancel" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>

      <Input
        value={customName}
        onChange={(e) => setCustomName(e.target.value)}
        placeholder="Item name"
        aria-label="Item name"
        autoFocus
      />
      <FieldsEditor rows={rows} onChange={setRows} suggestions={suggestions} />

      {createItem.isError && (
        <ErrorNotice
          message={
            createItem.error instanceof ApiError ? createItem.error.message : "Failed to add item."
          }
        />
      )}

      <Button type="submit" disabled={createItem.isPending || !customName.trim()}>
        <PlusIcon /> Add item
      </Button>
    </form>
  );
}

function ItemPanel({
  item,
  suggestions,
  onClose,
}: {
  item: TypeItem;
  suggestions: string[];
  onClose: () => void;
}) {
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const [customName, setCustomName] = useState(item.customName);
  const [rows, setRows] = useState<FieldRow[]>(() => fieldsToRows(item.fields));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [showHistory, setShowHistory] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextName = customName.trim();
  const nextFields = rowsToFields(rows);
  const fieldsJson = JSON.stringify(nextFields);
  const changed = nextName !== item.customName || fieldsJson !== JSON.stringify(item.fields ?? {});

  useEffect(() => {
    if (!changed) return;
    if (nextName === "") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setStatus("saving");
      updateItem
        .mutateAsync({ id: item.id, customName: nextName, fields: JSON.parse(fieldsJson) })
        .then(() => setStatus("saved"))
        .catch(() => setStatus("error"));
    }, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextName, fieldsJson, changed, item.id]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-2">
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          aria-label="Item name"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-base font-semibold outline-none hover:border-line focus:border-accent"
        />
        <IconButton size="sm" aria-label="Close item" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>

      {customName.trim() === "" && (
        <p className="text-xs text-danger">
          A name is required — the server rejects an empty one. Delete the item instead.
        </p>
      )}

      <FieldsEditor rows={rows} onChange={setRows} suggestions={suggestions} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-muted" aria-live="polite">
          {saveStatusLabel(status, changed) ?? "Changes save automatically"}
        </span>
        <Button variant="secondary" size="sm" onClick={() => setShowHistory((s) => !s)}>
          {showHistory ? "Hide history" : "History"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          disabled={deleteItem.isPending}
          onClick={async () => {
            const ok = await confirmDialog({
              title: "Delete this item?",
              body: item.customName,
            });
            if (ok) deleteItem.mutate(item.id, { onSuccess: onClose });
          }}
        >
          <TrashIcon /> Delete
        </Button>
      </div>

      {updateItem.isError && (
        <ErrorNotice
          message={
            updateItem.error instanceof ApiError ? updateItem.error.message : "Failed to save."
          }
        />
      )}

      {showHistory && (
        <div className="border-t border-line pt-3">
          <HistoryPanel entityKind="item" id={item.id} />
        </div>
      )}
    </div>
  );
}
