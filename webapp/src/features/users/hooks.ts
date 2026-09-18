import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import * as api from "./api";

export function useUsers() {
  const { basicToken } = useAuth();
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.listUsers(basicToken!),
    enabled: !!basicToken,
    staleTime: 60_000,
  });
}

export const ME_QUERY_KEY = ["users", "me"] as const;

export function useMe() {
  const { basicToken } = useAuth();
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => api.getMe(basicToken!),
    enabled: !!basicToken,
  });
}
