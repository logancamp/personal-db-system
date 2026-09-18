import { createFileRoute, Link } from "@tanstack/react-router";
import { SelfChatPanel } from "../../features/messages/SelfChatPanel";
import { ActionRail } from "../../features/history/ActionRail";
import { PageHeader } from "../../components/ui";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col">
      <PageHeader title="Chat" subtitle="Your assistant, and what it changed" />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:flex">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2.5">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Actions</h2>
              <p className="mt-0.5 text-xs text-ink-muted">What this chat changed</p>
            </div>
            <Link
              to="/history"
              className="rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              All history
            </Link>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ActionRail
              scope="chat"
              emptyMessage="Nothing yet. What your assistant creates or edits shows up here as it happens."
            />
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          <SelfChatPanel />
        </section>
      </div>
    </div>
  );
}
