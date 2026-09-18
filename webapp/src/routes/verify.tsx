import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { verifyPin } from "../features/auth/api";
import { Button, ErrorNotice, Field, Input } from "../components/ui";
import { AuthShell } from "../components/AuthShell";
import { ApiError } from "../lib/api-client";

const searchSchema = z.object({
  username: z.string().default(""),
});

export const Route = createFileRoute("/verify")({
  validateSearch: searchSchema,
  component: VerifyPage,
});

function VerifyPage() {
  const { username: initialUsername } = Route.useSearch();
  const navigate = useNavigate();
  const [username, setUsername] = useState(initialUsername);
  const [pin, setPin] = useState("");

  const mutation = useMutation({
    mutationFn: () => verifyPin(username, pin),
    onSuccess: () => navigate({ to: "/login", search: { username } }),
  });

  return (
    <AuthShell title="Verify your account" subtitle="Enter the PIN printed in the backend server log.">
      <p className="mb-4 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-accent-strong">
        There is no email or SMS delivery yet. When you sign up, the server prints your 6-digit PIN
        to its log, valid for 10 minutes.
      </p>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </Field>
        <Field label="PIN">
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            required
          />
        </Field>

        {mutation.isError && (
          <ErrorNotice
            message={mutation.error instanceof ApiError ? mutation.error.message : "Verification failed."}
          />
        )}

        <Button type="submit" disabled={mutation.isPending} className="mt-1 w-full">
          {mutation.isPending ? "Verifying…" : "Verify"}
        </Button>
      </form>
    </AuthShell>
  );
}
