import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getCurrentUsername, useAuth } from "../../lib/auth-context";
import { registerSessionCleaner } from "../../lib/session-reset";
import { useUsers } from "../users/hooks";
import type {
  Message,
  MessageTarget,
  SendMessageResult,
  UnreadSummary,
} from "../../types/models";
import * as api from "./api";
import { getHistoryFeed } from "../history/api";

const RECEIVED_KEY = ["messages", "received"] as const;
const SENT_PEERS_KEY = ["messages", "sentPeers"] as const;
const conversationKey = (peerUsername: string, target: MessageTarget) =>
  ["messages", "conversation", peerUsername, target] as const;

const threadId = (peerUsername: string, target: MessageTarget) => `${peerUsername}|${target}`;

export function messageKey(m: Message): string {
  return typeof m.id === "number"
    ? `id:${m.id}`
    : `${m.createdAt}|${m.from.username}|${m.to.username}|${m.kind}`;
}

let optimisticSeq = -1;
const EMPTY: Message[] = [];
const pendingByThread = new Map<string, Message[]>();
const pendingListeners = new Set<() => void>();

function emitPending() {
  for (const listener of pendingListeners) listener();
}

function subscribePending(listener: () => void) {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

function addPending(id: string, message: Message) {
  pendingByThread.set(id, [...(pendingByThread.get(id) ?? []), message]);
  emitPending();
}

function removePending(id: string, messageId: number) {
  const next = (pendingByThread.get(id) ?? []).filter((m) => m.id !== messageId);
  if (next.length === 0) pendingByThread.delete(id);
  else pendingByThread.set(id, next);
  emitPending();
}

function usePending(peerUsername: string, target: MessageTarget): Message[] {
  const id = threadId(peerUsername, target);
  return useSyncExternalStore(
    subscribePending,
    useCallback(() => pendingByThread.get(id) ?? EMPTY, [id]),
    () => EMPTY,
  );
}

export function isOptimistic(m: Message): boolean {
  return m.id < 0;
}

export function usePendingSendCount(): number {
  return useSyncExternalStore(
    subscribePending,
    () => {
      let total = 0;
      for (const list of pendingByThread.values()) total += list.length;
      return total;
    },
    () => 0,
  );
}

export function useIsSending(peerUsername: string, target: MessageTarget): boolean {
  return usePending(peerUsername, target).length > 0;
}

const drafts = new Map<string, string>();

export function getDraft(peerUsername: string, target: MessageTarget): string {
  return drafts.get(threadId(peerUsername, target)) ?? "";
}

export function setDraft(peerUsername: string, target: MessageTarget, value: string) {
  const id = threadId(peerUsername, target);
  if (value) drafts.set(id, value);
  else drafts.delete(id);
}

export interface RunWindow {
  threadId: string;
  fromRevisionId: number | null;
  toRevisionId: number | null;
}

// A run window is the range of revision ids written while one assistant run was in flight.
// It is bounded by revision id, not by clock time, so client/server clock skew can't matter.
let runWindows: RunWindow[] = [];
const runWindowListeners = new Set<() => void>();

function emitRunWindows() {
  for (const listener of runWindowListeners) listener();
}

function subscribeRunWindows(listener: () => void) {
  runWindowListeners.add(listener);
  return () => runWindowListeners.delete(listener);
}

function windowsStorageKey(username: string | null) {
  return `runWindows:${username ?? "anon"}`;
}

let windowsLoadedFor: string | null | undefined;

function loadRunWindows(username: string | null): RunWindow[] {
  if (windowsLoadedFor === username) return runWindows;
  windowsLoadedFor = username;
  try {
    const raw = sessionStorage.getItem(windowsStorageKey(username));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    runWindows = Array.isArray(parsed)
      ? (parsed as RunWindow[]).filter((w) => w && typeof w.threadId === "string" && "fromRevisionId" in w)
      : [];
  } catch {
    runWindows = [];
  }
  return runWindows;
}

function persistRunWindows(username: string | null) {
  try {
    sessionStorage.setItem(windowsStorageKey(username), JSON.stringify(runWindows));
  } catch {
    // storage unavailable; the in-memory value still applies
  }
  emitRunWindows();
}

function openRunWindow(username: string | null, id: string, fromRevisionId: number | null) {
  loadRunWindows(username);
  runWindows = [
    ...runWindows.filter((w) => !(w.threadId === id && w.toRevisionId === null)),
    { threadId: id, fromRevisionId, toRevisionId: null },
  ].slice(-100);
  persistRunWindows(username);
}

function closeRunWindow(username: string | null, id: string, toRevisionId: number | null) {
  let closed = false;
  runWindows = runWindows.map((w) => {
    if (closed || w.threadId !== id || w.toRevisionId !== null) return w;
    closed = true;
    return { ...w, toRevisionId: toRevisionId ?? w.fromRevisionId };
  });
  if (closed) persistRunWindows(username);
}

function revisionIdsIn(data: unknown): number[] {
  const ids: number[] = [];
  const collect = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const row of list) {
      const id = (row as { revisionId?: unknown } | null)?.revisionId;
      if (typeof id === "number") ids.push(id);
    }
  };
  if (!data || typeof data !== "object") return ids;
  const record = data as { revisions?: unknown; pages?: unknown };
  collect(record.revisions);
  if (Array.isArray(record.pages)) {
    for (const page of record.pages) collect((page as { revisions?: unknown } | null)?.revisions);
  }
  return ids;
}

const BASELINE_TIMEOUT_MS = 2000;

async function latestRevisionId(basicToken: string | null): Promise<number | null> {
  if (!basicToken) return null;
  try {
    const page = await Promise.race([
      getHistoryFeed(basicToken, { limit: 1 }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), BASELINE_TIMEOUT_MS)),
    ]);
    if (!page) return null;
    return page.revisions[0]?.revisionId ?? 0;
  } catch {
    return null;
  }
}

function latestKnownRevisionId(qc: QueryClient): number | null {
  let max: number | null = null;
  let answered = false;
  for (const [, data] of qc.getQueriesData({ queryKey: ["history"] })) {
    if (data === undefined) continue;
    answered = true;
    for (const id of revisionIdsIn(data)) {
      if (max === null || id > max) max = id;
    }
  }
  if (max === null && answered) return 0;
  return max;
}

function isInRunWindow(revisionId: number | null | undefined, w: RunWindow): boolean {
  if (typeof revisionId !== "number" || w.fromRevisionId === null) return false;
  if (revisionId <= w.fromRevisionId) return false;
  return w.toRevisionId === null || revisionId <= w.toRevisionId;
}

export function isWithinRun(revisionId: number | null | undefined, windows: RunWindow[]): boolean {
  return windows.some((w) => isInRunWindow(revisionId, w));
}

export function isWithinWindow(
  revisionId: number | null | undefined,
  window: RunWindow | null,
): boolean {
  return window ? isInRunWindow(revisionId, window) : false;
}

export function useRunWindows(): RunWindow[] {
  const { username } = useAuth();
  return useSyncExternalStore(
    subscribeRunWindows,
    useCallback(() => loadRunWindows(username), [username]),
    () => runWindows,
  );
}

export function useRunWindow(peerUsername: string, target: MessageTarget): RunWindow | null {
  const { username } = useAuth();
  const id = threadId(peerUsername, target);
  return useSyncExternalStore(
    subscribeRunWindows,
    useCallback(() => {
      const all = loadRunWindows(username);
      for (let i = all.length - 1; i >= 0; i -= 1) {
        if (all[i].threadId === id) return all[i];
      }
      return null;
    }, [username, id]),
    () => null,
  );
}

registerSessionCleaner(() => {
  pendingByThread.clear();
  drafts.clear();
  markedRecently.clear();
  runWindows = [];
  windowsLoadedFor = undefined;
  emitPending();
  emitRunWindows();
});

const LIVE_DATA_OPTIONS = {
  staleTime: 0,
  refetchOnMount: "always",
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;

function useReceivedMessages(pollIntervalMs: number) {
  const { basicToken } = useAuth();
  return useQuery({
    queryKey: RECEIVED_KEY,
    queryFn: () => api.listReceivedMessages(basicToken!),
    enabled: !!basicToken,
    refetchInterval: pollIntervalMs,
    ...LIVE_DATA_OPTIONS,
  });
}

function belongsToThread(
  message: Message,
  selfUsername: string | null,
  peerUsername: string,
  target: MessageTarget,
): boolean {
  if (!selfUsername) return true;
  const participants = [message.from.username, message.to.username];
  const allowed = new Set([selfUsername, peerUsername]);
  if (!participants.every((p) => allowed.has(p))) return false;
  if (!participants.includes(selfUsername)) return false;
  return message.target === undefined || message.target === target;
}

export function useConversation(
  peerUsername: string,
  target: MessageTarget,
  pollIntervalMs = 5000,
) {
  const { basicToken, username } = useAuth();
  const pending = usePending(peerUsername, target);
  const query = useQuery({
    queryKey: conversationKey(peerUsername, target),
    queryFn: () => api.getConversation(basicToken!, peerUsername, target),
    enabled: !!basicToken && !!peerUsername,
    refetchInterval: pending.length > 0 ? false : pollIntervalMs,
    ...LIVE_DATA_OPTIONS,
  });

  const { thread, foreign } = useMemo(() => {
    const raw = query.data ?? [];
    const kept = raw.filter((m) => belongsToThread(m, username, peerUsername, target));
    const strays = raw.filter((m) => !belongsToThread(m, username, peerUsername, target));

    const seenKeys = new Set<string>();
    const server = kept.filter((m) => {
      const key = messageKey(m);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    if (pending.length === 0) return { thread: server, foreign: strays };
    const seen = new Set(server.map((m) => `${m.from.username}|${m.msg}`));
    const stillPending = pending.filter((m) => !seen.has(`${m.from.username}|${m.msg}`));
    return { thread: [...server, ...stillPending], foreign: strays };
  }, [query.data, pending, username, peerUsername, target]);

  const foreignSenders = useMemo(
    () => [...new Set(foreign.map((m) => m.from.username))].filter((u) => u !== username),
    [foreign, username],
  );

  return { ...query, thread, foreignSenders, selfUsername: username };
}

export interface ConversationPeer {
  username: string;
  lastAt: string;
  preview: string | null;
}

function sentPeersStorageKey(username: string | null) {
  return `sentPeers:${username ?? "anon"}`;
}

function loadSentPeers(username: string | null): ConversationPeer[] {
  try {
    const raw = sessionStorage.getItem(sentPeersStorageKey(username));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ConversationPeer[]) : [];
  } catch {
    return [];
  }
}

function saveSentPeers(username: string | null, peers: ConversationPeer[]) {
  try {
    sessionStorage.setItem(sentPeersStorageKey(username), JSON.stringify(peers));
  } catch {
    // storage unavailable; the in-memory value still applies
  }
}

export function useForgetPeer() {
  const { username } = useAuth();
  const qc = useQueryClient();
  return useCallback(
    (peerUsername: string) => {
      const next = loadSentPeers(username).filter((p) => p.username !== peerUsername);
      saveSentPeers(username, next);
      qc.setQueryData<ConversationPeer[]>([...SENT_PEERS_KEY, username], next);
    },
    [username, qc],
  );
}

export function useConversationPeers(): { peers: ConversationPeer[]; isLoading: boolean } {
  const { username } = useAuth();
  const qc = useQueryClient();
  const receivedQuery = useReceivedMessages(15_000);
  const usersQuery = useUsers();
  const { data: sentPeers = [] } = useQuery<ConversationPeer[]>({
    queryKey: [...SENT_PEERS_KEY, username],
    queryFn: () => loadSentPeers(username),
    initialData: () => loadSentPeers(username),
    staleTime: Infinity,
  });

  const knownUsernames = useMemo(
    () => (usersQuery.data ? new Set(usersQuery.data.map((u) => u.username)) : null),
    [usersQuery.data],
  );

  useEffect(() => {
    if (!knownUsernames || knownUsernames.size === 0) return;
    const kept = sentPeers.filter((p) => knownUsernames.has(p.username));
    if (kept.length === sentPeers.length) return;
    saveSentPeers(username, kept);
    qc.setQueryData<ConversationPeer[]>([...SENT_PEERS_KEY, username], kept);
  }, [knownUsernames, sentPeers, username, qc]);

  const peers = useMemo(() => {
    const map = new Map<string, ConversationPeer>();
    const consider = (peer: ConversationPeer) => {
      if (!peer.username || peer.username === username) return;
      const existing = map.get(peer.username);
      if (!existing || new Date(peer.lastAt) > new Date(existing.lastAt)) {
        map.set(peer.username, peer);
      }
    };
    for (const m of receivedQuery.data ?? []) {
      consider({ username: m.from.username, lastAt: m.createdAt, preview: m.msg });
    }
    for (const p of sentPeers) {
      if (knownUsernames && knownUsernames.size > 0 && !knownUsernames.has(p.username)) continue;
      consider({ ...p, preview: null });
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );
  }, [receivedQuery.data, sentPeers, username, knownUsernames]);

  return { peers, isLoading: receivedQuery.isLoading };
}

const DUPLICATE_WINDOW_MS = 8000;
const inFlightSends = new Map<string, Promise<SendMessageResult>>();
const recentSends = new Map<string, { at: number; result: SendMessageResult }>();

function sendKey(input: api.SendMessageInput): string {
  return `${input.to.username} ${input.target} ${input.msg}`;
}

function sendOnce(
  basicToken: string,
  input: api.SendMessageInput,
): Promise<SendMessageResult> {
  const key = sendKey(input);

  const pending = inFlightSends.get(key);
  if (pending) return pending;

  const prior = recentSends.get(key);
  if (prior && Date.now() - prior.at < DUPLICATE_WINDOW_MS) {
    return Promise.resolve(prior.result);
  }

  const request = api
    .sendMessage(basicToken, input)
    .then((result) => {
      recentSends.set(key, { at: Date.now(), result });
      return result;
    })
    .finally(() => {
      inFlightSends.delete(key);
    });

  inFlightSends.set(key, request);
  return request;
}

const CONFIRMATION_RECHECKS_MS = [2000, 6000];

async function settleRunWindow(
  qc: QueryClient,
  basicToken: string | null,
  username: string | null,
  id: string,
) {
  try {
    await qc.refetchQueries({ queryKey: ["history"] });
  } catch {
    // a failed refetch leaves the feed as it was
  }
  const upper = (await latestRevisionId(basicToken)) ?? latestKnownRevisionId(qc);
  closeRunWindow(username, id, upper);
}

export function useSendMessage() {
  const { basicToken, username } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: api.SendMessageInput) => {
      const id = threadId(input.to.username, input.target);
      const optimistic: Message = {
        id: optimisticSeq--,
        msg: input.msg,
        createdAt: new Date().toISOString(),
        from: { username: username ?? "", autoReplyEnabled: false },
        to: { username: input.to.username, autoReplyEnabled: false },
        generatedByBot: false,
        target: input.target,
        kind: "USER",
        readAt: null,
      };
      addPending(id, optimistic);

      const baseline =
        (await latestRevisionId(basicToken)) ?? latestKnownRevisionId(qc);
      openRunWindow(username, id, baseline);
      const issuedFor = username;

      try {
        const result = await sendOnce(basicToken!, input);

        const stillSameSession =
          getCurrentUsername() === issuedFor && result.sent.from.username === issuedFor;
        if (!stillSameSession) {
          return result;
        }

        qc.setQueryData<Message[]>(
          conversationKey(input.to.username, input.target),
          (current = []) => {
            const known = new Set(current.map((m) => m.id));
            const additions = [result.sent, ...(result.reply ? [result.reply] : [])];
            return [...current, ...additions.filter((m) => !known.has(m.id))];
          },
        );

        if (input.to.username !== username) {
          const next = [
            ...loadSentPeers(username).filter((p) => p.username !== input.to.username),
            { username: input.to.username, lastAt: result.sent.createdAt, preview: null },
          ];
          saveSentPeers(username, next);
          qc.setQueryData<ConversationPeer[]>([...SENT_PEERS_KEY, username], next);
        }

        if (!result.reply) {
          qc.invalidateQueries({ queryKey: conversationKey(input.to.username, input.target) });
          if (input.target === "ASSISTANT") {
            for (const delay of CONFIRMATION_RECHECKS_MS) {
              setTimeout(() => {
                qc.invalidateQueries({
                  queryKey: conversationKey(input.to.username, input.target),
                });
                qc.invalidateQueries({ queryKey: UNREAD_KEY });
              }, delay);
            }
          }
        }

        qc.invalidateQueries({ queryKey: UNREAD_KEY });

        qc.invalidateQueries({ queryKey: ["todos"] });
        qc.invalidateQueries({ queryKey: ["notes"] });
        qc.invalidateQueries({ queryKey: ["inbox"] });
        qc.invalidateQueries({ queryKey: ["history"] });
        qc.invalidateQueries({ queryKey: RECEIVED_KEY });
        return result;
      } catch (error) {
        qc.invalidateQueries({ queryKey: conversationKey(input.to.username, input.target) });
        qc.invalidateQueries({ queryKey: ["todos"] });
        qc.invalidateQueries({ queryKey: ["notes"] });
        qc.invalidateQueries({ queryKey: ["history"] });
        throw error;
      } finally {
        removePending(id, optimistic.id);
        void settleRunWindow(qc, basicToken, username, id);
      }
    },
  });
}

const UNREAD_KEY = ["messages", "unread"] as const;

const UNREAD_POLL_MS = 15_000;

export function useUnread() {
  const { basicToken } = useAuth();
  return useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => api.getUnread(basicToken!),
    enabled: !!basicToken,
    refetchInterval: UNREAD_POLL_MS,
    ...LIVE_DATA_OPTIONS,
  });
}

function countIn(
  summary: UnreadSummary | undefined,
  peerUsername: string,
  target?: MessageTarget,
): number {
  if (!summary || !peerUsername) return 0;
  return summary.conversations.reduce(
    (total, c) =>
      c.username === peerUsername && (target === undefined || c.target === target)
        ? total + c.count
        : total,
    0,
  );
}

export function useUnreadCount(peerUsername: string, target?: MessageTarget): number {
  const { data } = useUnread();
  return countIn(data, peerUsername, target);
}

export function useUnreadTotals(): { chat: number; messages: number } {
  const { username } = useAuth();
  const { data } = useUnread();
  return useMemo(() => {
    let chat = 0;
    let messages = 0;
    for (const c of data?.conversations ?? []) {
      if (username && c.username === username) chat += c.count;
      else messages += c.count;
    }
    return { chat, messages };
  }, [data, username]);
}

const MARK_READ_COOLDOWN_MS = 3000;
const markedRecently = new Map<string, number>();

export function useMarkConversationRead() {
  const { basicToken } = useAuth();
  const qc = useQueryClient();

  return useCallback(
    (peerUsername: string, target: MessageTarget) => {
      if (!basicToken || !peerUsername) return;
      const id = threadId(peerUsername, target);
      const last = markedRecently.get(id);
      if (last !== undefined && Date.now() - last < MARK_READ_COOLDOWN_MS) return;
      markedRecently.set(id, Date.now());

      qc.setQueryData<UnreadSummary>(UNREAD_KEY, (current) => {
        if (!current) return current;
        const conversations = current.conversations.filter(
          (c) => !(c.username === peerUsername && c.target === target),
        );
        const removed = current.conversations.length - conversations.length;
        if (removed === 0) return current;
        const total = conversations.reduce((sum, c) => sum + c.count, 0);
        return { total, conversations };
      });

      api
        .markConversationRead(basicToken, peerUsername, target)
        .then(() => {
          qc.invalidateQueries({ queryKey: UNREAD_KEY });
          qc.invalidateQueries({ queryKey: conversationKey(peerUsername, target) });
        })
        .catch(() => {
          markedRecently.delete(id);
          qc.invalidateQueries({ queryKey: UNREAD_KEY });
        });
    },
    [basicToken, qc],
  );
}

function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    (listener) => {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
    () => document.visibilityState === "visible",
    () => true,
  );
}

export function useMarkReadOnOpen(peerUsername: string, target: MessageTarget) {
  const markRead = useMarkConversationRead();
  const unread = useUnreadCount(peerUsername, target);
  const visible = useDocumentVisible();

  useEffect(() => {
    if (!peerUsername || unread === 0 || !visible) return;
    markRead(peerUsername, target);
  }, [peerUsername, target, unread, visible, markRead]);
}
