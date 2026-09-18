import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { signup } from "../features/auth/api";
import { Button, ErrorNotice, Field, Input } from "../components/ui";
import { AuthShell } from "../components/AuthShell";
import { ApiError } from "../lib/api-client";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => signup({ username, password, email }),
    onSuccess: () => {
      navigate({ to: "/verify", search: { username } });
    },
  });

  return (
    <AuthShell
      title="Create an account"
      subtitle="Password must be at least 15 characters. Username: letters, numbers, underscore, hyphen only."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-accent-strong underline-offset-2 hover:underline">
            Log in
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
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={15}
            required
          />
        </Field>

        {mutation.isError && (
          <ErrorNotice
            message={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : "Sign up failed. Check that the backend is running and reachable."
            }
          />
        )}

        <Button type="submit" disabled={mutation.isPending} className="mt-1 w-full">
          {mutation.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">
        Passwords are sent to the backend once at signup, over the connection you've
        configured (must be HTTPS in production). This client never stores your password
        itself — only a Basic-auth token is kept, in this tab's session storage. See
        Settings → Security for details.
      </p>
    </AuthShell>
  );
}
