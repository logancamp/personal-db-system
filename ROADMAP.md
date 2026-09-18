# Roadmap

Personal Server is **paused**. This file records what was built, what was in progress, and what
was planned, in case work resumes. Nothing here is a promise.

## Built

**Backend (Spring Boot)**
- Accounts with signup, PIN verification and per-user data isolation.
- Todos (dates, sections, sparse manual ordering with batch renumber), notes, user-defined types
  and items with free-form fields.
- Messaging with separate person and assistant threads, unread tracking and read receipts.
- Assistant agent with tools for todos, notes, types, items and messages, including duplicate
  detection and retry rules that never repeat a write.
- On-behalf Inbox agent: create-only, sender-funded, rate limited.
- Inbox summary curated by an LLM.
- Multi-provider LLM factory (Cerebras, Anthropic, OpenAI, Gemini, Groq) with per-user encrypted keys.
- Revision history for todos, notes, types and items, with retention, purge and a feed endpoint.
- Virtual-thread request handling so blocking agent calls stay cheap.

**Web client**
- Every screen: Home dashboard, Chat, Inbox, Messages, Todos (calendar and list, drag and drop),
  Notes, DB (type tree, item table, filters, field editor), Settings, History.
- Light and dark themes, autosave on edits (creation stays explicit), themed confirm dialogs,
  cross-account cache isolation, unread badges, and an action rail showing what the assistant
  changed during a chat run.

## Parked: private / local mode

"Local" or "private" can mean three different things, and the choice changes the design. Pick one
before building.

1. **Server-side local inference.** The backend calls a model on the same machine (for example
   Ollama) instead of a hosted provider. Data never leaves the host. Backend-only; the stored
   `localLlmAddress` field already describes it.
2. **Client-side inference.** The browser or a native app calls a local model directly. Raises CORS,
   key handling and a second agent implementation, and needs a real tool-calling loop in the client.
3. **Private data mode.** Mark items or sections as never sent to a hosted provider, and possibly
   exclude them from the Inbox summary. This is an authorization feature, not an inference one, and
   fits the original goal of letting agents use the data "with restrictions".

Today `AI Execution Mode = CLIENT` only stores a preference, and the backend returns no reply in it.
Also needed first: knowing which read tools the assistant really has, and revision provenance
(below), so the UI can say whether something was done locally or by a hosted model.

## Open questions for the backend

1. **Timestamp zone.** `changedAt` and `createdAt` have no offset, so browsers parse them as local
   time. If the server runs in UTC, displayed times are off by the viewer's offset. Decide and
   document the zone, or serialize with an offset.
2. **Revision provenance.** History can't tell a hand edit from an assistant tool call. Add a
   `source` (matching `CreationSource`) or the id of the message whose run made the change. That
   would replace the client's session-scoped run windows.
3. **Is `revisionId` one global sequence?** The client relies on it being monotonic across entity kinds.
4. **What does `changedBy` hold** for an assistant-made change: the owner, or something like "assistant"?
5. **Late replies.** `POST /message` has occasionally returned `reply: null` with the reply arriving later.
6. **Which read tools does the assistant have registered?** Whether "what are my todos" works
   depends on it.

## Planned features

- **SMS interface** through Twilio webhooks: ingest and classify messages. `SMS_KNOWN`,
  `SMS_UNKNOWN` and `createdByPhone` already exist in the model.
- **Tiered agent permissions:** owner, trusted, unknown. Unknown senders get no read access but can
  drop messages into an ideas pool. The messaging tiers and Inbox are the start of this.
- **Native mobile app** (Swift), after the web client is settled.
- **MCP server** so external agents can use the same tools under the same permissions.
- **Views:** spreadsheet, list and gallery for custom types.
- **Query interface.** Filtering is client-side over loaded data today; there is no query
  endpoint and no pagination on the data endpoints.
- **Chat branching** and **attachments/uploads**, both sketched in the UI design and not built.
- **Real typed tables** for user-defined types (real `CREATE TABLE`, typed columns) instead of a
  JSON field map.

## Architecture direction

A port to a single unified Rust backend was designed on paper and not started. The idea:

- Loco.rs (on Axum) for auth, built-in entities, AI classification, SMS webhooks and scheduled jobs.
- PostgreSQL, with application-level RBAC as the main permission layer and row-level security as
  defence in depth.
- Two data zones: fixed entities as compile-time SeaORM models, and user-created tables created at
  runtime through `sea-query`, so no recompilation is needed.
- Decisions taken: everything routes through one backend (no PostgREST or sidecar services), and
  real DDL is preferred to a `types/fields/records` metadata pattern.
- Codegen by layer: `sea-orm-cli generate entity` for Rust structs and a generated types file for the frontend.

The current Java backend is the working prototype of these ideas.

## Security and hardening

- Replace Basic auth with short-lived tokens; rate-limit and lock out failed logins.
- Real PIN delivery (email or SMS) or an admin approval step; a way to resend after the window expires.
- A switch to disable public signup.
- Persistent database with backups; move `CorsConfig` origins into configuration.
- Per-user limits on LLM spend; treat Inbox content as untrusted before the assistant acts on it.
- Dependency audit automation (Dependabot or Renovate), and tests for authentication and ownership checks.

## Known bugs to fix first

- Rendering of timestamps (see the timezone question above).
- Groq's tool-calling failure (every current Groq model reasons); revisit if Groq ships a non-reasoning model.
