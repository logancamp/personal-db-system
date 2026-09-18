# Security

Personal Server stores personal data and users' LLM API keys. It is a hobby project that has not
been independently audited; treat it accordingly and read this before exposing it beyond
`localhost`.

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** on this repository (Security tab), not a
public issue. Include what you found, how to reproduce it, and the version or commit.
The project is currently paused, so responses may be slow.

## Threat model

Assume the backend may eventually be reachable from more than `localhost`, and that some users
of an instance (or people messaging them) are untrusted. The main things being protected:

- one user's data from another user,
- stored LLM API keys,
- the assistant's ability to act on a user's data.

## What is in place

**Authentication and authorization**
- HTTP Basic auth, passwords hashed with Spring Security's delegating encoder (bcrypt by default),
  minimum 15 characters.
- New accounts have no authorities until verified with a random 6-digit PIN (10-minute window,
  5 attempts, constant-time comparison). Unverified accounts cannot reach any data or settings endpoint.
- Every request is checked against an explicit route allowlist; anything unlisted is denied.
  Sessions are stateless and CSRF protection is off because no cookies are used.
- Every read and write is scoped to the authenticated user in the service layer, including
  updates, deletes, batch reordering and the history feed. An item can only reference a type its
  owner owns.
- Entity ids are never accepted from request bodies on create.

**Secrets**
- LLM API keys are encrypted at rest with AES-256-GCM (PBKDF2, 600,000 iterations, random salt and
  IV per value) and are never returned by any endpoint. `GET /users/me` only reports which
  providers have a key.
- `KEY_PASSWORD` and `VAULT_TOKEN` have no defaults; the app refuses to start without them, and
  rejects a key password shorter than 16 characters.
- Datasource credentials come from Vault. The dev script generates random secrets on every run and
  keeps them in a git-ignored file. The dev Vault listens on `127.0.0.1` only.
- Passwords, PINs and keys are not logged, apart from the verification PIN (see below).

**Client**
- No `dangerouslySetInnerHTML`, no third-party scripts; assistant output is rendered as plain text.
- Credentials are kept only as a base64 Basic token in `sessionStorage` (cleared when the tab
  closes) and sent with `credentials: "omit"`. All cached data and in-flight requests are dropped
  on login and logout so accounts can't see each other's data in one tab.
- Production client builds refuse to start unless `VITE_API_BASE_URL` is `https://`.

**The on-behalf agent**
When someone messages another user's assistant and that user has auto-reply on, an agent runs
using the *sender's* API key with a single job: file a todo or note into the recipient's fixed
*Inbox* section. The safety property is structural: that agent's tool class has no read, update,
delete or send-message method, and it is not given the recipient's data as context, so nothing in
an incoming message can make it disclose or change anything. The confirmation goes back to the
sender, addressed by code rather than by the model. Triggers are limited to 5 per
sender-recipient pair per hour. Do not add read tools or `send_message` to it.

## Known limitations

- **HTTP Basic auth.** The password is re-sent on every request. It must only ever travel over
  HTTPS, and a leaked password can't be revoked short of changing it. Short-lived tokens would be better.
- **No login rate limiting or lockout** on Basic auth. Add it at your reverse proxy.
- **Verification PIN goes to the server log.** There is no email or SMS delivery yet, so the
  operator reads it from the console. Anyone who can read that log can verify accounts.
- **Open registration.** Anyone who can reach the API can create an (unverified) account and
  trigger a PIN. Restrict network access, or add an approval step, if that matters to you.
- **Prompt injection.** Text filed into a user's Inbox by someone else is later shown to that
  user's own assistant, which can update and delete their data and message other users. A
  malicious sender could try to steer it. Review Inbox items before asking the assistant to act on them.
- **History keeps deleted data.** With history on, deleting an item leaves its last state in the
  revision log until it is purged or ages out. Use Settings → History to purge or set a retention.
  History also records who triggered a change, including senders behind on-behalf items.
- **Usernames are visible** to every verified user (`GET /users`), which the messaging UI uses.
- **In-memory database.** Nothing persists across restarts. A persistent database needs its own
  hardening (credentials, backups, encryption at rest).
- **CORS origins are compiled in** (`CorsConfig`). Add yours explicitly; never use a wildcard with credentials.
- **Local/private mode** is only a stored preference. If it is ever implemented on the server,
  validate the configured address (SSRF).
- No automated dependency auditing and only one context-load test.

## Running it beyond localhost

1. Put the backend and client behind a TLS-terminating reverse proxy (Caddy, nginx, Tailscale
   Serve). Bind the backend to loopback (the default) and let the proxy reach it; set
   `SERVER_ADDRESS` only if you must.
2. Rate-limit `/users` and any authenticated route at the proxy.
3. Use the default profile, not `dev`. It hides error details and disables the H2 console, and
   requires `VAULT_TOKEN` and `KEY_PASSWORD` to be set from a real secret store.
4. Serve the client with a `Content-Security-Policy` such as `default-src 'self'`.
5. Use a real Vault (not dev mode) with TLS, and set `spring.cloud.vault.scheme` accordingly.
6. Run `npm audit` and keep Spring dependencies current.
