export type LlmProvider = "CEREBRAS" | "GROQ" | "GEMINI" | "OPENAI" | "ANTHROPIC";
export type AiExecutionMode = "SERVER" | "CLIENT";
export type CreationSource =
  | "WEB"
  | "MCP"
  | "SMS_KNOWN"
  | "SMS_UNKNOWN"
  | "ON_BEHALF_AGENT";

export interface UserPublic {
  username: string;
  autoReplyEnabled: boolean;
}

export type UserListEntry = UserPublic;

export interface UserMe {
  username: string;
  email: string;
  verified: boolean;
  role: string;
  llmProvider: LlmProvider;
  llmKeysSet: Record<LlmProvider, boolean>;
  aiExecutionMode: AiExecutionMode;
  localLlmAddress: string | null;
  autoReplyEnabled: boolean;
  inboxLlmProvider: LlmProvider;
  model: string | null;
  systemPrompt: string | null;
  inboxModel: string | null;
  inboxSystemPrompt: string | null;
  historyEnabled: boolean;
  historyRetentionDays: number | null;
}

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  notes: string | null;
  createdVia: CreationSource;
  createdByPhone: string | null;
  createdAt: string;
  dueAt: string | null;
  todoDate: string | null;
  section: string | null;
  createdByUsername: string | null;
  sortOrder: number;
}

export interface Note {
  id: number;
  content: string;
  createdVia: CreationSource;
  createdByPhone: string | null;
  createdAt: string;
  section: string | null;
  createdByUsername: string | null;
}

export interface TypeDef {
  id: number;
  name: string;
  createdVia: CreationSource;
  createdByPhone: string | null;
}

export interface TypeItem {
  id: number;
  customName: string;
  type: TypeDef | number;
  fields: Record<string, unknown>;
  createdVia: CreationSource;
  createdByPhone: string | null;
  createdAt: string;
}

export type MessageTarget = "PERSON" | "ASSISTANT";

export type MessageKind = "USER" | "ASSISTANT_REPLY" | "ON_BEHALF_CONFIRMATION";

export interface Message {
  id: number;
  msg: string;
  createdAt: string;
  from: UserPublic;
  to: UserPublic;
  generatedByBot: boolean;
  target: MessageTarget;
  kind: MessageKind;
  readAt: string | null;
}

export interface SendMessageResult {
  sent: Message;
  reply: Message | null;
}

export interface InboxItems {
  todos: Todo[];
  notes: Note[];
}

export interface InboxSummary {
  summary: string;
  itemCount: number;
}

export type EntityKind = "todo" | "note" | "type" | "item";
export type ChangeType = "ADD" | "MOD" | "DEL";

export interface Revision {
  revisionId: number;
  changedAt: string;
  changedBy: string;
  changeType: ChangeType;
  state: Record<string, unknown> | null;
}

export interface HistoryResponse {
  historyEnabled: boolean;
  revisions: Revision[];
}

export interface FeedRevision extends Revision {
  entityKind: EntityKind;
  entityId: number;
}

export interface HistoryFeedResponse {
  historyEnabled: boolean;
  revisions: FeedRevision[];
  nextCursor: number | null;
}

export interface HistorySettings {
  enabled: boolean;
  retentionDays: number | null;
}

export interface PurgeResult {
  deletedRevisions: number;
}

export interface UnreadConversation {
  username: string;
  target: MessageTarget;
  count: number;
  latestAt: string;
}

export interface UnreadSummary {
  total: number;
  conversations: UnreadConversation[];
}
