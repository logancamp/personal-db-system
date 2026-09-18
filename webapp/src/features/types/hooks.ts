import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import * as api from "./api";

export function useTypes() {
  const { basicToken } = useAuth();
  return useQuery({
    queryKey: ["types"],
    queryFn: () => api.listTypes(basicToken!),
    enabled: !!basicToken,
  });
}

export function useCreateType() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createType(basicToken!, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["types"] }),
  });
}

export function useDeleteType() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteType(basicToken!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["types"] }),
  });
}

export function useItems(typeId: number | null) {
  const { basicToken } = useAuth();
  return useQuery({
    queryKey: ["items", typeId],
    queryFn: () => api.listItems(basicToken!, typeId!),
    enabled: !!basicToken && typeId !== null,
  });
}

export function useCreateItem() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreateItemInput) => api.createItem(basicToken!, input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["items", variables.typeId] });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function useUpdateItem() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number } & Parameters<typeof api.updateItem>[2]) =>
      api.updateItem(basicToken!, id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function useRenameType() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.renameType(basicToken!, id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["types"] });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function useDeleteItem() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteItem(basicToken!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}
