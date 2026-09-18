# Personal Server

A self-hosted place to keep your own data (todos, notes, custom typed items, messages) and let an
LLM assistant work with it through a limited set of tools. It is a Spring Boot API plus a React
web client.

> **Status: paused.** The project is in a usable but unfinished state and is not under active
> development. Everything that was planned but not built is written down in
> [ROADMAP.md](ROADMAP.md).
>
> **About the history:** this repository is a clean snapshot of a project that was developed
> privately. The earlier commit history was not carried over. Project was originally architecture with a small group on a separate github account, we split into diverging projects early on and the old repo was discontinued. Given this, all code included in this project is mine and my own, other group members split off before any commits were actually pushed to the main branch for this project.

## What it does

- **Todos** with due dates, calendar view, sections and drag-and-drop ordering.
- **Notes**, shown as a masonry board.
- **Custom types and items** (a small "DB" screen): define a type, then store items with arbitrary fields.
- **Assistant chat.** Message your own assistant; it can list, create, update and delete your
  todos, notes and items, and send messages to other users. You bring your own API key
  (Cerebras, Anthropic, OpenAI, Gemini or Groq).
- **Messaging between users**, split into a person thread and an assistant thread per contact.
- **Inbox.** If a user enables auto-reply, another user's message to their assistant can file a
  todo or note into the recipient's *Inbox* section. That agent is create-only by design and cannot
  read anything (see [SECURITY.md](SECURITY.md)).
- **History.** Every change to todos, notes, types and items is recorded as a revision, with
  retention settings and purge controls.
- Light theme (orange on white) and dark theme (yellow on black).

## Layout

```
backend/   Spring Boot 4 / Java 25 API (Gradle). Open this folder in IntelliJ for the Java side.
webapp/    React 19 + Vite + TanStack Router/Query client. Needs only Node.
boot-dev.sh   Starts a local dev-mode Vault and generates the backend's dev secrets.
```

```
browser  --HTTP Basic-->  Spring Boot API (:8080)  -->  in-memory H2
 (:5173)                        |
                                +--> LLM provider (your API key, encrypted at rest)
                                +--> Vault (:8200)   supplies the datasource credentials
```

## Requirements

| For | You need |
|---|---|
| Backend | JDK **25** (the Gradle toolchain looks for it; e.g. Temurin 25) |
| Vault (dev secrets) | Docker with Compose, and `bash` |
| Client | Node **22** and npm |

## Running it locally

You run two things: the **Java backend** and the **web client**. They are separate projects in
separate folders; open each on its own.

### 1. Java backend

Open the `backend/` folder (not the repo root) in IntelliJ, or just use a terminal.

```bash
# from the repo root: start Vault and generate the dev secrets (Docker must be running)
./boot-dev.sh

# in the terminal you will run the backend from:
source backend/vault/dev.env
cd backend
./gradlew bootRun
```

`dev.env` exports `VAULT_TOKEN`, `KEY_PASSWORD` and `SPRING_PROFILES_ACTIVE=dev`. Run
`./boot-dev.sh` (and `source` the new `dev.env`) again after each Docker restart, since dev-mode Vault keeps nothing between runs.

Running from IntelliJ instead: run `MyAppApplication` and set the same three variables in the run
configuration's environment.

The API is then at <http://localhost:8080>. In the `dev` profile the H2 console is at
<http://localhost:8080/h2c>.

### 2. Web client

Open the `webapp/` folder in your editor (or a terminal). No Java is involved.

```bash
cd webapp
npm install
cp .env.example .env.local     # VITE_API_BASE_URL defaults to http://localhost:8080
npm run dev
```

Open <http://localhost:5173>. The port is fixed: the backend's CORS allowlist only knows a few
origins, so Vite refuses to start on a different one. If it says the port is taken, stop the other
copy.

### 3. First use

1. Go to **Sign up**. Passwords need at least 15 characters.
2. There is no email or SMS delivery yet. The backend prints your 6-digit **verification PIN** in
   its console, valid for 10 minutes and 5 attempts. Enter it on the verify screen.
3. Log in, open **Settings**, add an API key for a provider, then use **Chat**.

The database is **in-memory H2**, so everything is lost when the backend stops. Sign up again
after each restart.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `VAULT_TOKEN` | yes | Token for the Vault that holds the datasource credentials |
| `KEY_PASSWORD` | yes | Encrypts stored LLM API keys. At least 16 characters. No default |
| `SPRING_PROFILES_ACTIVE` | for local use | Set to `dev` for verbose errors, debug logs and the H2 console |
| `SERVER_ADDRESS` | no | Bind address. Defaults to `127.0.0.1` |
| `VITE_API_BASE_URL` | no (client) | Backend origin. Production client builds require `https://` |

Keep `KEY_PASSWORD` stable if you ever move to a persistent database, or stored keys become
unreadable.

To allow a different web origin, add it to the list in
`backend/src/main/java/dev/camp/MyApp/security/CorsConfig.java`.

## Tests and builds

```bash
cd backend && ./gradlew test      # loads the Spring context with no Vault
cd webapp  && npm run build       # typecheck + production build (needs an https VITE_API_BASE_URL)
cd webapp  && npm run lint
```

## API overview

Authentication is HTTP Basic on every request. Data is always scoped to the authenticated user.

| Area | Endpoints |
|---|---|
| Users | `POST /users`, `PATCH /users/{username}` (verify), `GET /users`, `GET /users/me`, `PUT /users/me/{llm-key, provider, inbox-provider, ai-mode, auto-reply, history}`, `DELETE /users/me/llm-key` |
| Todos | `GET/POST /todo`, `PUT/DELETE /todo/{id}`, `PUT /todo/positions` |
| Notes | `GET/POST /note`, `PUT/DELETE /note/{id}` |
| Types and items | `GET/POST /types`, `PUT/DELETE /types/{id}`, `GET/POST /typeItems`, `PUT/DELETE /typeItems/{id}` |
| Messages | `GET/POST /message`, `GET /message/conversation/{username}`, `GET /message/unread`, `PUT /message/conversation/{username}/read` |
| Inbox | `GET /inbox/items`, `GET /inbox/summary` |
| History | `GET /history`, `GET /history/{entityKind}/{id}`, `DELETE /history/me`, `DELETE /history/me/older-than/{days}` |

Conventions worth knowing:

- **Updates:** absent or `null` leaves a field unchanged, `""` clears it, any other value sets it.
  Assistant tools differ on purpose: an empty string means "unchanged", so a model that omits a
  value can't wipe data.
- **Messages** carry a `target`: `PERSON` (plain delivery, never runs an agent) or `ASSISTANT`.
  The web client always sends it explicitly.
- `POST /message` to your own assistant runs the agent inline and returns `{sent, reply}`. A message
  to someone else's assistant returns `reply: null`; any confirmation arrives later as its own message.
- **Todo order** is a sparse integer `sortOrder`; the list is returned already sorted.

## Known issues

- **Groq.** Its current models all reason, which breaks Spring AI's tool-calling loop. It stays
  selectable, but new accounts default to Cerebras instead.
- **No persistence.** Data lives in in-memory H2.
- **Verification is one-shot.** If the 10-minute PIN window passes there is no resend.
- **Timestamps** are serialized without a zone, so displayed times may be off by the viewer's UTC offset.
- **Local/private mode** is stored as a preference only and does nothing yet.
- Test coverage is a single context-load test.

## Security

Read [SECURITY.md](SECURITY.md) before exposing this beyond `localhost`. In short: it uses HTTP
Basic auth, so it must sit behind HTTPS, and it has no login rate limiting.

## License

No license has been chosen yet, which means all rights are reserved by default. Add a `LICENSE`
file before inviting reuse.
