import { apiFetch } from "../../lib/api-client";
import type { UserMe, UserPublic } from "../../types/models";

export interface SignupInput {
  username: string;
  password: string;
  email: string;
}

export function signup(input: SignupInput): Promise<UserPublic> {
  return apiFetch<UserPublic>("/users", { method: "POST", body: input });
}

export function verifyPin(username: string, pin: string): Promise<unknown> {
  return apiFetch(`/users/${encodeURIComponent(username)}`, {
    method: "PATCH",
    body: { pin },
  });
}

export function verifyCredentials(basicToken: string): Promise<UserMe> {
  return apiFetch<UserMe>("/users/me", { basicToken });
}
