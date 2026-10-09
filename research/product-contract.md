# Slaygent Auth Manager — First-Release Product Contract

> The binding scope for v1. Anything not listed here is out of scope.
> Security-first: the app's core promise is that it **never reads secret material**.

---

## 1. Purpose

A lightweight Windows-first Electron app (with WSL support) that gives the user a single pane to:

1. **See** which provider accounts are signed in (identity, not secrets).
2. **Group** accounts into named profiles (e.g., "Personal" vs "Work").
3. **Map** projects/directories to those profiles.
4. **Act** safely: refresh status, launch a provider session, and log out locally.

The app is an **inventory + launcher**, not a credential manager. It observes auth state through each provider's own status command and never touches tokens, keys, or keychains.

---

## 2. Explicit refusals (non-goals)

These are hard boundaries, not preferences. v1 **will not**:

1. **Read secret material** — never parse `~/.claude/.credentials.json`, `~/.codex/auth.json`, `~/.local/share/opencode/auth.json`, `hosts.yml`, keychain values, or any other secret-bearing file.
2. **Read environment-variable secrets** — never inspect `GH_TOKEN`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, etc.
3. **Display or log secrets** — tokens/keys are never shown, persisted, or written to logs.
4. **Revoke server-side** — logout is local-only; server-side revocation is surfaced as *guidance* (a link/instructions), never automated.
5. **Migrate or sync secrets** — no copying credentials between machines, profiles, or WSL↔Windows.
6. **Switch accounts** — no `gh auth switch` / re-login automation (a mutation with side effects; deferred to v2).
7. **Elevate** — never run as admin or request UAC.
8. **Load remote content** — no remote HTML/JS, no telemetry, no network calls except the provider status/verify endpoints the user explicitly triggers.

---

## 3. Domain model

| Entity | Definition | Source of truth |
|---|---|---|
| **Provider** | A supported tool (enum): `gh`, `copilot-cli`, `claude`, `codex`, `opencode`, `openrouter`, `zed`, `zen`, `bitbucket` | Built-in adapter registry |
| **Account** | A detected sign-in identity for a provider, e.g. `gh → alice@github.com`, `claude → acme org` | Provider status command output |
| **Profile** | A user-named grouping of accounts + project rules (e.g. "Personal", "Work") | App config (non-secret) |
| **Project** | A directory/workspace classified into a profile | App config (non-secret) |

**Invariant:** an `Account` stores **identity only** (username/email/org/host/distro + detection timestamp). It never stores a token, key, or password.

---

## 4. Account & profile model

### Account detection (per provider)

Each provider adapter implements a `status()` that returns `{ signedIn, identity?, method?, scope? }` by invoking the provider's own status command — **never** by reading secret files:

| Provider | Status command | Identity signal |
|---|---|---|
| `gh` | `gh auth status --json hosts` | active account per host |
| `copilot-cli` | keychain presence (`copilot-cli`) + optional `/user` | credential present (interactive identity) |
| `claude` | `claude auth status` | `authMethod` + email/org (via `/status`) |
| `codex` | `codex login status` | auth method + exit code |
| `opencode` | `opencode auth list` | configured providers |
| `openrouter` | `GET /api/v1/key` | masked label, tier, limits |
| `zed` | *(none — launch-only)* | — |
| `zen` | *(none — launch-only)* | — |
| `bitbucket` | `git ls-remote` / `ssh -T` / API `/user` | reachability/account |

### Profiles

- A **Profile** is a named, user-owned grouping: `{ id, name, color, accounts: AccountRef[], projectRules: Rule[] }`.
- Profiles are **local metadata** — creating/editing them never mutates any provider.
- A provider account can belong to multiple profiles (e.g. the same GitHub account used for both personal and work projects).
- Default profiles: `Personal` and `Work`, both editable/deletable.

### Account ↔ profile relationship

- The app suggests profile membership from detection (e.g. a `claude` account in the `acme` org → suggest "Work"), but the user confirms.
- The active account per provider is shown, but **switching is out of scope** (refusal #6).

---

## 5. Project classification rules

Ordered, first-match-wins. Each rule yields a `{ profileId, confidence, source }`.

1. **Manual override** (user assigns a project to a profile) — `confidence: high`.
2. **Git remote host/org** — parse `git remote get-url origin`; map `github.com/<org>` / `bitbucket.org/<workspace>` to a profile via user-configured org→profile rules.
3. **Directory path prefix** — e.g. `~/work/**` → Work, `~/personal/**` → Personal.
4. **WSL distro** — a project living in a specific distro can map to a profile.
5. **Default** — unclassified projects fall back to a user-chosen default profile (or "Unclassified").

Rules 2–4 are **user-configured**, not hard-coded. The app ships with no assumptions about which orgs/paths are "work."

---

## 6. Supported actions (v1)

| Action | What it does | Secret exposure |
|---|---|---|
| `inventory` | List providers + detected accounts | none |
| `status` | Refresh one/all providers' auth state | none |
| `launch` | Spawn a provider CLI/app (Windows or WSL) | none (provider self-authenticates) |
| `logout` | Run the provider's local logout command | none (local-only; shows revoke guidance) |
| `profile:*` | Create/edit/delete profiles | none |
| `project:classify` | Assign/auto-classify a project | none |

All actions are **user-initiated** (no background mutation). `logout` always displays a confirmation noting it is local-only and does not revoke server-side.

---

## 7. Threat model

### Assets
- **Identity metadata** (who is signed in where) — low sensitivity, but still personal.
- **Profile/project mapping** — reveals work vs personal structure; should stay local.

### What we defend against
1. **Renderer compromise (XSS/injection)** — mitigated by `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, strict CSP, no remote content.
2. **IPC abuse** — mitigated by a narrow typed preload API + sender validation (`senderFrame`).
3. **Secret leakage via the app** — structurally impossible in v1 because the app never reads secrets.
4. **A compromised provider CLI** — the app only spawns CLIs and parses their status output; it never passes secrets to them.
5. **WSL boundary confusion** — the app treats WSL as a separate environment; the WSL helper runs *inside* WSL and returns only status JSON.

### Explicitly out of threat scope (v1)
- Malware already running as the user (it can read secrets directly; the app can't prevent that, only avoid *adding* an exfiltration path).
- Physical access / shoulder-surfing.

---

## 8. Data & storage (non-secret only)

- **App config** (`profiles`, `projectRules`, `projectAssignments`, `orgMappings`) — JSON under `%APPDATA%\Slaygent\config.json` (Windows) and `~/.config/slaygent/` (WSL helper side). Contains **no secrets**.
- **No cache of status output** is persisted beyond the current session (or a short TTL, still identity-only).
- **Logs** are redacted by construction (the app never holds secrets to redact).

---

## 9. Open questions

- [ ] Exact app config schema + location (Windows `%APPDATA%\Slaygent` vs `~/.config/slaygent`).
- [ ] How to represent "the same account in Windows vs WSL" (two `Account` records with a `scope: windows|wsl` field, or one merged view?).
- [ ] Multi-distro WSL handling (`wsl.exe -l -v`) and which distro a project belongs to.
- [ ] Whether `openrouter` status (`GET /api/v1/key`) should be gated behind an explicit user action (it sends the key as a Bearer header, even though the response is masked).
- [ ] Profile→account suggestion heuristics (org/email matching) — how aggressive in v1?
- [ ] Launch UX for WSL providers (spawn `wsl.exe -d <distro> <cmd>` vs. open a Windows Terminal tab).