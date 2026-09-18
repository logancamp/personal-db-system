import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { verifyCredentials } from "../features/auth/api";
import { useAuth } from "../lib/auth-context";
import { ME_QUERY_KEY } from "../features/users/hooks";
import { Button, ErrorNotice, Field, Input } from "../components/ui";
import { AuthShell } from "../components/AuthShell";
import { ApiError, UnauthorizedError } from "../lib/api-client";

const searchSchema = z.object({
  username: z.string().default(""),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { username: initialUsername } = Route.useSearch();
  const { login } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const token = btoa(`${username}:${password}`);
      const me = await verifyCredentials(token);
      return { token, me };
    },
    onSuccess: ({ me }) => {
      login(username, password);
      qc.setQueryData(ME_QUERY_KEY, me);
      navigate({ to: "/" });
    },
  });

  return (
    <AuthShell
      title="Log in"
      footer={
        <>
          Need an account?{" "}
          <Link to="/signup" className="font-medium text-accent-strong underline-offset-2 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Field label="Username">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>

        {mutation.isError && (
          <ErrorNotice
            message={
              mutation.error instanceof UnauthorizedError
                ? "Incorrect username or password."
                : mutation.error instanceof ApiError
                  ? mutation.error.message
                  : "Could not reach the backend."
            }
          />
        )}

        <Button type="submit" disabled={mutation.isPending} className="mt-1 w-full">
          {mutation.isPending ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}
