import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/types")({
  beforeLoad: () => {
    throw redirect({ to: "/db" });
  },
});
