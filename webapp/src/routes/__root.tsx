import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ConfirmDialogHost } from "../components/ConfirmDialog";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-svh">
      <Outlet />
      <ConfirmDialogHost />
    </div>
  );
}
