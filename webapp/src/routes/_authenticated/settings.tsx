import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import type { LlmProvider } from "../../types/models";
import {
  useSetAiMode,
  useSetAutoReply,
  useSetInboxProvider,
  useSetLlmKey,
  useDeleteLlmKey,
  useSetProvider,
} from "../../features/settings/hooks";
import { useMe } from "../../features/users/hooks";
import { useSetHistorySettings, usePurgeAllHistory, usePurgeHistoryOlderThan } from "../../features/history/hooks";
import {
  Button,
  Card,
  ErrorNotice,
  Field,
  Input,
  PageHeader,
  Segmented,
  Spinner,
  Toggle,
} from "../../components/ui";
import { MonitorIcon, MoonIcon, SunIcon } from "../../components/icons";
import { useTheme, type ThemeMode } from "../../lib/theme";
import { confirmDialog } from "../../components/ConfirmDialog";
import { ApiError } from "../../lib/api-client";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const PROVIDERS: LlmProvider[] = ["CEREBRAS", "GROQ", "GEMINI", "OPENAI", "ANTHROPIC"];

function SettingsPage() {
  const { data: me, isLoading, error } = useMe();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title="Settings" />

      {isLoading && <Spinner />}
      {error && (
        <ErrorNotice message={error instanceof ApiError ? error.message : "Failed to load your settings."} />
      )}

      <AppearanceForm />

      {me && <CurrentSettingsSummary me={me} />}

      <LlmKeyForm me={me} />
      <ProviderForm me={me} />
      <InboxProviderForm me={me} />
      <AiModeForm me={me} />
      <AutoReplyForm me={me} />
      <HistoryForm me={me} />
      <SecurityNotes />
    </div>
  );
}

type Me = NonNullable<ReturnType<typeof useMe>["data"]>;

function AppearanceForm() {
  const [mode, resolved, setMode] = useTheme();

  const options = [
    { value: "light" as const, label: <><SunIcon /> Light</>, title: "Orange on white" },
    { value: "dark" as const, label: <><MoonIcon /> Dark</>, title: "Yellow on black" },
    { value: "system" as const, label: <><MonitorIcon /> System</>, title: "Follow the OS setting" },
  ] satisfies readonly { value: ThemeMode; label: ReactNode; title: string }[];

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Appearance</h2>
      <Segmented label="Theme" value={mode} onChange={setMode} options={options} />
      <p className="mt-2 text-xs text-ink-muted">
        {mode === "system"
          ? `Following your system setting — currently ${resolved}.`
          : `Pinned to ${mode}.`}{" "}
        Saved in this browser, not on your account.
      </p>
    </Card>
  );
}

function CurrentSettingsSummary({ me }: { me: Me }) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Current settings</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <SummaryItem label="Username" value={me.username} />
        <SummaryItem label="Email" value={me.email} />
        <SummaryItem label="Verified" value={me.verified ? "Yes" : "No"} />
        <SummaryItem label="Role" value={me.role} />
        <SummaryItem label="Self-chat provider" value={me.llmProvider} />
        <SummaryItem label="Inbox provider" value={me.inboxLlmProvider} />
        <SummaryItem
          label="AI mode"
          value={me.aiExecutionMode === "CLIENT" && me.localLlmAddress ? `CLIENT (${me.localLlmAddress})` : me.aiExecutionMode}
        />
        <SummaryItem label="Auto-reply" value={me.autoReplyEnabled ? "On" : "Off"} />
        <SummaryItem label="History" value={me.historyEnabled ? "On" : "Off"} />
        <SummaryItem
          label="Retention"
          value={me.historyEnabled ? (me.historyRetentionDays ? `${me.historyRetentionDays} days` : "Forever") : "—"}
        />
        <SummaryItem label="Custom model" value={me.model ?? "—"} />
        <SummaryItem label="Custom system prompt" value={me.systemPrompt ? "Set" : "—"} />
        <SummaryItem label="Inbox model" value={me.inboxModel ?? "—"} />
        <div className="col-span-2 sm:col-span-3">
          <dt className="font-medium text-ink-muted">LLM keys set</dt>
          <dd className="mt-1 flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <span
                key={p}
                className={`rounded px-2 py-0.5 text-xs ${
                  me.llmKeysSet[p]
                    ? "border border-accent/40 bg-accent-soft text-accent-strong"
                    : "border border-line-strong bg-raised text-ink-muted"
                }`}
              >
                {p} {me.llmKeysSet[p] ? "✓" : "—"}
              </span>
            ))}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-ink-muted">{label}</dt>
      <dd className="text-ink-muted">{value}</dd>
    </div>
  );
}

function LlmKeyForm({ me }: { me?: Me }) {
  const setLlmKey = useSetLlmKey();
  const deleteLlmKey = useDeleteLlmKey();
  const [provider, setProviderField] = useState<LlmProvider>("CEREBRAS");
  const [apiKey, setApiKey] = useState("");

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">LLM API Key</h2>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!apiKey) return;
          setLlmKey.mutate({ provider, apiKey }, { onSuccess: () => setApiKey("") });
        }}
      >
        <Field label="Provider">
          <select
            value={provider}
            onChange={(e) => setProviderField(e.target.value as LlmProvider)}
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p} {me?.llmKeysSet[p] ? "(key set)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="API Key">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            placeholder="Stored encrypted server-side (AES-256-GCM)"
          />
        </Field>
        {setLlmKey.isError && (
          <ErrorNotice
            message={setLlmKey.error instanceof ApiError ? setLlmKey.error.message : "Failed to save key."}
          />
        )}
        {setLlmKey.isSuccess && <p className="text-sm text-accent-strong">Saved.</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={setLlmKey.isPending || !apiKey}>
            Save key
          </Button>
          {me?.llmKeysSet[provider] && (
            <Button
              type="button"
              variant="danger"
              disabled={deleteLlmKey.isPending}
              onClick={() => {
                confirmDialog({
                  title: `Remove your saved ${provider} key?`,
                  body: "Anything that uses this provider will stop working until you set a new one.",
                  confirmLabel: "Remove key",
                }).then((ok) => {
                  if (ok) deleteLlmKey.mutate(provider);
                });
              }}
            >
              Remove {provider} key
            </Button>
          )}
        </div>
        {deleteLlmKey.isError && (
          <ErrorNotice
            message={deleteLlmKey.error instanceof ApiError ? deleteLlmKey.error.message : "Failed to remove key."}
          />
        )}
      </form>
    </Card>
  );
}

function ProviderForm({ me }: { me?: Me }) {
  const setProvider = useSetProvider();
  const [provider, setProviderField] = useState<LlmProvider>("CEREBRAS");

  useEffect(() => {
    if (me) setProviderField(me.llmProvider);
  }, [me]);

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Active Self-Chat Provider</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setProvider.mutate(provider);
        }}
      >
        <select
          value={provider}
          onChange={(e) => setProviderField(e.target.value as LlmProvider)}
          className="flex-1 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={setProvider.isPending}>
          Set
        </Button>
      </form>
      {setProvider.isError && (
        <div className="mt-2">
          <ErrorNotice
            message={setProvider.error instanceof ApiError ? setProvider.error.message : "Failed to set provider."}
          />
        </div>
      )}
    </Card>
  );
}

function InboxProviderForm({ me }: { me?: Me }) {
  const setInboxProvider = useSetInboxProvider();
  const [provider, setProviderField] = useState<LlmProvider>("CEREBRAS");

  useEffect(() => {
    if (me) setProviderField(me.inboxLlmProvider);
  }, [me]);

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Inbox Curation Provider</h2>
      <p className="mb-3 text-xs text-ink-muted">
        Which provider generates your Inbox → AI Summary. Separate from your self-chat
        provider above.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setInboxProvider.mutate(provider);
        }}
      >
        <select
          value={provider}
          onChange={(e) => setProviderField(e.target.value as LlmProvider)}
          className="flex-1 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={setInboxProvider.isPending}>
          Set
        </Button>
      </form>
      {setInboxProvider.isError && (
        <div className="mt-2">
          <ErrorNotice
            message={
              setInboxProvider.error instanceof ApiError ? setInboxProvider.error.message : "Failed to set provider."
            }
          />
        </div>
      )}
    </Card>
  );
}

function AiModeForm({ me }: { me?: Me }) {
  const setAiMode = useSetAiMode();
  const [mode, setMode] = useState<"SERVER" | "CLIENT">("SERVER");
  const [localLlmAddress, setLocalLlmAddress] = useState("");

  useEffect(() => {
    if (me) {
      setMode(me.aiExecutionMode);
      setLocalLlmAddress(me.localLlmAddress ?? "");
    }
  }, [me]);

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">AI Execution Mode</h2>
      <p className="mb-3 text-xs text-ink-muted">
        CLIENT mode is not implemented yet: the backend returns no reply in this mode.
        Selecting it only records the preference; it won't run inference locally.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setAiMode.mutate({ mode, localLlmAddress: mode === "CLIENT" ? localLlmAddress : undefined });
        }}
      >
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "SERVER"} onChange={() => setMode("SERVER")} />
            SERVER
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "CLIENT"} onChange={() => setMode("CLIENT")} />
            CLIENT
          </label>
        </div>
        {mode === "CLIENT" && (
          <Field label="Local LLM address">
            <Input
              value={localLlmAddress}
              onChange={(e) => setLocalLlmAddress(e.target.value)}
              placeholder="http://localhost:11434"
            />
          </Field>
        )}
        {setAiMode.isError && (
          <ErrorNotice
            message={setAiMode.error instanceof ApiError ? setAiMode.error.message : "Failed to set mode."}
          />
        )}
        <Button type="submit" disabled={setAiMode.isPending}>
          Save
        </Button>
      </form>
    </Card>
  );
}

function AutoReplyForm({ me }: { me?: Me }) {
  const setAutoReply = useSetAutoReply();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (me) setEnabled(me.autoReplyEnabled);
  }, [me]);

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Auto-Reply (On-Behalf Agent)</h2>
      <div className="mb-3 rounded-md border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-accent-strong">
        <p className="font-medium">Whose account pays, in both directions.</p>
        <p className="mt-0.5">
          When someone messages <strong>your</strong> assistant, the run is billed to{" "}
          <strong>their</strong> key and processed under their credentials — not yours.
          The same is true in reverse: messaging someone else's assistant spends{" "}
          <strong>your</strong> key. The sender always pays.
        </p>
      </div>
      <p className="mb-3 text-xs text-ink-muted">
        With this on, other users can address your assistant. It can only create items
        in your Inbox — no read, update or delete access to anything else of yours —
        and it confirms back to the sender when it files something (capped at 5 per
        sender per hour). Ordinary conversation still gets no reply.
      </p>
      <Toggle
        checked={enabled}
        disabled={setAutoReply.isPending}
        label="Enable auto-reply"
        onChange={(next) => {
          setEnabled(next);
          setAutoReply.mutate(next, {
            onError: () => setEnabled(!next),
          });
        }}
      />
      {setAutoReply.isError && (
        <div className="mt-2">
          <ErrorNotice
            message={setAutoReply.error instanceof ApiError ? setAutoReply.error.message : "Failed to update."}
          />
        </div>
      )}
    </Card>
  );
}

function HistoryForm({ me }: { me?: Me }) {
  const setHistory = useSetHistorySettings();
  const purgeAll = usePurgeAllHistory();
  const purgeOlderThan = usePurgeHistoryOlderThan();

  const [enabled, setEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState("");
  const [purgeDays, setPurgeDays] = useState("30");

  useEffect(() => {
    if (me) {
      setEnabled(me.historyEnabled);
      setRetentionDays(me.historyRetentionDays ? String(me.historyRetentionDays) : "");
    }
  }, [me]);

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">History</h2>
      <p className="mb-3 text-xs text-ink-muted">
        Every create/update/delete on todos, notes, types, and items is recorded as a
        revision. Turning this off purges everything already recorded immediately, not
        just going forward.
      </p>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setHistory.mutate({
            enabled,
            retentionDays: retentionDays.trim() === "" ? null : Number(retentionDays),
          });
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Record history
        </label>
        <Field label="Retention (days) — leave blank to keep forever">
          <Input
            type="number"
            min={1}
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            placeholder="forever"
          />
        </Field>
        {setHistory.isError && (
          <ErrorNotice
            message={
              setHistory.error instanceof ApiError ? setHistory.error.message : "Failed to save history settings."
            }
          />
        )}
        {setHistory.isSuccess && <p className="text-sm text-accent-strong">Saved.</p>}
        <Button type="submit" disabled={setHistory.isPending}>
          Save
        </Button>
      </form>

      <div className="mt-4 border-t border-line pt-4">
        <p className="mb-2 text-xs font-medium text-ink-muted">Purge recorded history</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="danger"
            disabled={purgeAll.isPending}
            onClick={() => {
              confirmDialog({
                title: "Delete all recorded history?",
                body: "This can't be undone. Deleted items lose their recoverable copies too.",
                confirmLabel: "Delete all",
              }).then((ok) => {
                if (ok) purgeAll.mutate();
              });
            }}
          >
            Delete all
          </Button>
          <span className="text-sm text-ink-muted">or older than</span>
          <Input
            type="number"
            min={1}
            value={purgeDays}
            onChange={(e) => setPurgeDays(e.target.value)}
            className="w-20"
          />
          <span className="text-sm text-ink-muted">days</span>
          <Button
            variant="danger"
            disabled={purgeOlderThan.isPending || !purgeDays}
            onClick={() => {
              const days = Number(purgeDays);
              if (days > 0) {
                confirmDialog({
                  title: `Delete history older than ${days} days?`,
                  body: "This can't be undone.",
                  confirmLabel: "Delete",
                }).then((ok) => {
                  if (ok) purgeOlderThan.mutate(days);
                });
              }
            }}
          >
            Delete
          </Button>
        </div>
        {purgeAll.isSuccess && (
          <p className="mt-2 text-sm text-accent-strong">Deleted {purgeAll.data.deletedRevisions} revision(s).</p>
        )}
        {purgeOlderThan.isSuccess && (
          <p className="mt-2 text-sm text-accent-strong">Deleted {purgeOlderThan.data.deletedRevisions} revision(s).</p>
        )}
        {(purgeAll.isError || purgeOlderThan.isError) && (
          <div className="mt-2">
            <ErrorNotice message="Failed to purge history." />
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Worth knowing: deleting an item does not erase its data if history is on — the
        deleted state is retained as a revision until you purge it or it ages past your
        retention window. See SECURITY.md.
      </p>
    </Card>
  );
}

function SecurityNotes() {
  return (
    <Card className="text-xs text-ink-muted">
      <h2 className="mb-2 text-sm font-semibold text-ink">Security notes</h2>
      <ul className="list-disc space-y-1 pl-4">
        <li>This backend uses HTTP Basic auth only — every request re-sends your credentials, so the connection must always be HTTPS in production.</li>
        <li>Your Basic-auth token is kept in this browser tab's session storage, cleared when the tab closes. It is never written to localStorage.</li>
        <li>API keys you enter above are encrypted at rest server-side and are never returned in any response.</li>
        <li>See SECURITY.md in the project for the full threat-model writeup.</li>
      </ul>
    </Card>
  );
}
