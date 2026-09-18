import { apiFetch } from "../../lib/api-client";
import type { UserListEntry, UserMe } from "../../types/models";

export function listUsers(basicToken: string): Promise<UserListEntry[]> {
  return apiFetch<UserListEntry[]>("/users", { basicToken });
}

export function getMe(basicToken: string): Promise<UserMe> {
  return apiFetch<UserMe>("/users/me", { basicToken });
}
