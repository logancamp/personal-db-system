import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { useAuth } from "../lib/auth-context";
import { IconButton, UnreadBadge } from "../components/ui";
import { usePendingSendCount, useUnreadTotals } from "../features/messages/hooks";
import {
  ChatIcon,
  CloseIcon,
  DbIcon,
  HistoryIcon,
  HomeIcon,
  InboxIcon,
  LogoutIcon,
  MenuIcon,
  MessagesIcon,
  NoteIcon,
  SettingsIcon,
  TodoIcon,
} from "../components/icons";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    let hasToken = false;
    try {
      hasToken = sessionStorage.getItem("auth.basicToken") !== null;
    } catch {
      hasToken = false;
    }
    if (!hasToken) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

export const BUILD = "0.1.0";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/chat", label: "Chat", icon: ChatIcon },
  { to: "/inbox", label: "Inbox", icon: InboxIcon },
  { to: "/messages", label: "Messages", icon: MessagesIcon },
  { to: "/todos", label: "Todos", icon: TodoIcon },
  { to: "/notes", label: "Notes", icon: NoteIcon },
  { to: "/db", label: "DB", icon: DbIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/history", label: "History", icon: HistoryIcon },
] as const satisfies readonly {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[];

const COLLAPSE_KEY = "nav.collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function AuthenticatedLayout() {
  const { username, logout } = useAuth();
  const unread = useUnreadTotals();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // storage unavailable; the in-memory value still applies
      }
      return next;
    });
  };

  return (
    <div className="flex h-svh overflow-hidden bg-canvas">
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <Sidebar
        unread={unread}
        collapsed={collapsed}
        drawerOpen={drawerOpen}
        onToggleCollapsed={toggleCollapsed}
        onCloseDrawer={() => setDrawerOpen(false)}
        username={username}
        onLogout={() => {
          logout();
          navigate({ to: "/login" });
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2 md:hidden">
          <IconButton aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
          <span className="text-sm font-semibold tracking-tight">
            {NAV_ITEMS.find((item) => item.to === pathname)?.label ?? "Personal server"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <UnreadBadge count={unread.chat + unread.messages} />
            <RunningTasks />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  unread,
  collapsed,
  drawerOpen,
  onToggleCollapsed,
  onCloseDrawer,
  username,
  onLogout,
}: {
  unread: { chat: number; messages: number };
  collapsed: boolean;
  drawerOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseDrawer: () => void;
  username: string | null;
  onLogout: () => void;
}) {
  return (
    <nav
      aria-label="Main"
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface transition-[width,transform] duration-200 md:static md:translate-x-0 ${
        drawerOpen ? "translate-x-0" : "-translate-x-full"
      } ${collapsed ? "w-[68px]" : "w-60"}`}
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-4">
        <IconButton
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={onToggleCollapsed}
          className="hidden md:inline-flex"
        >
          <MenuIcon />
        </IconButton>
        <IconButton aria-label="Close navigation" onClick={onCloseDrawer} className="md:hidden">
          <CloseIcon />
        </IconButton>

        {!collapsed && (
          <>
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-on-accent"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 0 1 0 20Z" />
                <path d="M12 2a10 10 0 0 0 0 20" fillOpacity="0.35" />
              </svg>
            </span>
            <span className="truncate text-sm font-semibold tracking-tight">personal server</span>
          </>
        )}
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {NAV_ITEMS.map((item) => {
          const count =
            item.to === "/chat" ? unread.chat : item.to === "/messages" ? unread.messages : 0;
          return (
          <li key={item.to}>
            <Link
              to={item.to}
              title={collapsed ? item.label : undefined}
              activeOptions={item.to === "/" ? { exact: true } : undefined}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink [&.active]:bg-accent-soft [&.active]:text-accent-strong ${
                collapsed ? "justify-center" : ""
              }`}
              activeProps={{ className: "active" }}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {collapsed ? (
                <span className="absolute top-1.5 right-1.5">
                  <UnreadBadge count={count} dot />
                </span>
              ) : (
                <span className="ml-auto">
                  <UnreadBadge count={count} />
                </span>
              )}
            </Link>
          </li>
          );
        })}
      </ul>

      <div className={`shrink-0 border-t border-line p-2 ${collapsed ? "space-y-2" : "space-y-2"}`}>
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : "px-1"}`}>
          <RunningTasks compact={collapsed} />
        </div>
        <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong bg-raised text-xs font-semibold text-ink"
          >
            {(username ?? "?").slice(0, 2).toUpperCase()}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{username}</span>
              <BuildMarker />
            </span>
          )}
          <IconButton aria-label="Log out" size="sm" onClick={onLogout}>
            <LogoutIcon />
          </IconButton>
        </div>
        {collapsed && (
          <div className="flex justify-center">
            <BuildMarker />
          </div>
        )}
      </div>
    </nav>
  );
}

function BuildMarker() {
  return (
    <span className="font-mono text-[10px] text-ink-muted" title="Client build">
      {BUILD}
    </span>
  );
}

function RunningTasks({ compact = false }: { compact?: boolean }) {
  const count = usePendingSendCount();
  if (count === 0) return null;
  return (
    <span
      className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong"
      title={`${count} assistant run${count === 1 ? "" : "s"} in progress`}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      {compact ? count : `${count} running`}
    </span>
  );
}
