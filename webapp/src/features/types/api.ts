import { apiFetch } from "../../lib/api-client";
import type { TypeDef, TypeItem } from "../../types/models";

export function listTypes(basicToken: string): Promise<TypeDef[]> {
  return apiFetch<TypeDef[]>("/types", { basicToken });
}

export function createType(basicToken: string, name: string): Promise<TypeDef> {
  return apiFetch<TypeDef>("/types", { method: "POST", body: { name }, basicToken });
}

export function renameType(basicToken: string, id: number, name: string): Promise<TypeDef> {
  return apiFetch<TypeDef>(`/types/${id}`, { method: "PUT", body: { name }, basicToken });
}

export function deleteType(basicToken: string, id: number): Promise<void> {
  return apiFetch<void>(`/types/${id}`, { method: "DELETE", basicToken });
}

export function listItems(basicToken: string, typeId: number): Promise<TypeItem[]> {
  return apiFetch<TypeItem[]>(`/typeItems?typeId=${typeId}`, { basicToken });
}

export interface CreateItemInput {
  customName: string;
  typeId: number;
  fields: Record<string, unknown>;
}

export function createItem(basicToken: string, input: CreateItemInput): Promise<TypeItem> {
  return apiFetch<TypeItem>("/typeItems", { method: "POST", body: input, basicToken });
}

export function updateItem(
  basicToken: string,
  id: number,
  input: Partial<Pick<CreateItemInput, "customName" | "fields">>,
): Promise<TypeItem> {
  return apiFetch<TypeItem>(`/typeItems/${id}`, { method: "PUT", body: input, basicToken });
}

export function deleteItem(basicToken: string, id: number): Promise<void> {
  return apiFetch<void>(`/typeItems/${id}`, { method: "DELETE", basicToken });
}
