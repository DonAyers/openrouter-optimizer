# Slaygent Auth Manager — Specification

> Authoritative, self-contained spec for v1. Supersedes the `research/` notes.
> Security-first: the app **never reads secret material**.

---

## 1. Overview

The **Slaygent Auth Manager** is a lightweight, Windows-first desktop app (Electron, TypeScript, Bun tooling) with first-class WSL support. It gives the user a single pane to:

1. **See** which provider accounts are signed in (identity only, never secrets).
2. **Group** accounts into named profiles (e.g. "Personal" vs "Work").
3. **Map** projects/directories to those profiles.
4. **Act** safely: refresh status, launch a provider session, and log out locally.

It is an **inventory + launcher**, not a credential manager. Auth state is observed through each provider's own status command; tokens, keys, and keychains are never touched.

---

## 2. Goals

- G1. Inventory sign-in state for 9 providers across Windows and WSL.
- G2. Group accounts into user-defined profiles.
- G3. Classify projects into profiles via ordered, user-configured rules.
- G4. Launch provider CLIs/apps and log out locally — without reading secrets.
- G5. Enforce the Electron security checklist end-to-end.

---

## 3. Non-goals (explicit refusals)

The app **will not**:

1. Read secret material (secret-bearing files, keychain values, env-var secrets).
2. Display, log, or persist tokens/keys.
3. Revoke server-side (logout is local-only; revoke is surfaced as guidance).
4. Migrate or sync secrets between machines, profiles, or WSL↔Windows.
5. Switch accounts (`gh auth switch` / re-login) — deferred to v2.
6. Elevate (run as admin / request UAC).
7. Load remote content or send telemetry.

---

## 4. Technology stack

| Layer | Choice |
|---|---|
| Shell | Electron (main + preload + renderer) |
| Language | TypeScript |
| Package mgmt / scripts | Bun (`bun install`, `bun run`) |
| Build tool | electron-vite (Vite-based) |
| Bundler | Vite |
| Packaging | electron-builder (NSIS / portable / MSIX) |
| Renderer | Minimal no-framework (vanilla TS + HTML/CSS) |
| WSL helper | Compiled Bun binary (`bun build --compile --target=bun-linux-x64`) |

> **Clarification:** Electron's main process runs on Electron's bundled Node.js — Bun cannot replace it. Bun's roles are package management, the WSL helper sidecar, and optional build acceleration.

---

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (sandboxed, contextIsolation, no Node, no secrets) │
└───────────────▲─────────────────────────────────────────────┘
                │ contextBridge (typed, minimal API)
┌───────────────┴─────────────────────────────────────────────┐
│  Preload — window.api (typed surface, no raw ipcRenderer)    │
└───────────────▲─────────────────────────────────────────────┘
                │ IPC (validated sender)
┌───────────────┴─────────────────────────────────────────────┐
│  Main (Electron/Node) — orchestration:                       │
│   • spawn Windows provider CLIs (status/launch/logout)       │
│   • read/write non-secret app config                         │
│   • invoke WSL helper via wsl.exe                            │
└───────────────┬─────────────────────────────────────────────┘
                │ wsl.exe -d <distro> <helper> status --json
┌───────────────▼─────────────────────────────────────────────┐
│  WSL helper (compiled Bun binary, bun-linux-x64)             │
│   • query provider CLIs inside WSL; JSON-over-stdout         │
└─────────────────────────────────────────────────────────────┘
```

**Rules:** renderer is sandboxed; all privileged work lives in main; preload exposes a narrow typed API; secrets never cross into the renderer.

---

## 6. Domain model

| Entity | Definition | Source of truth |
|---|---|---|
| **Provider** | A supported tool (enum, 9 values) | Built-in adapter registry |
| **Account** | A detected sign-in identity for a provider | Provider status command |
| **Profile** | A user-named grouping of accounts + project rules | App config (non-secret) |
| **Project** | A directory classified into a profile | App config (non-secret) |

**Invariant:** an `Account` stores identity only (username/email/org/host/distro + detection timestamp). It never stores a token, key, or password.

### Provider enum

`gh` · `copilot-cli` · `claude` · `codex` · `opencode` · `openrouter` · `zed` · `zen` · `bitbucket`

---

## 7. Provider adapters

Each adapter implements:

```ts
interface ProviderAdapter {
  id: ProviderId;
  status(scope: 'windows' | 'wsl', distro?: string): Promise<AccountStatus>;
  launch(scope: 'windows' | 'wsl', distro?: string): Promise<void>;
  logout(scope: 'windows' | 'wsl', distro?: string): Promise<LogoutResult>;
  storageTier: 'keychain' | 'plaintext-file' | 'env-var';
}

interface AccountStatus {
  provider: ProviderId;
  installed: boolean;          // CLI binary present?
  signedIn: boolean;
  identity?: string;           // username/email/org — never a secret
  method?: string;             // e.g. 'oauth', 'api_key'
  scope: 'windows' | 'wsl';
  error?: string;              // non-secret failure reason
}
```

### Status / launch / logout per provider

| Provider | Status (safe observe) | Launch | Logout (local-only) |
|---|---|---|---|
| `gh` | `gh auth status --json hosts` | spawn `gh` | `gh auth logout` |
| `copilot-cli` | keychain presence `copilot-cli` (+ `/user`) | spawn `copilot` | `/logout` (interactive) |
| `claude` | `claude auth status` | spawn `claude` | `claude auth logout` |
| `codex` | `codex login status` | spawn `codex` | `codex logout` |
| `opencode` | `opencode auth list` | spawn `opencode` | `opencode auth logout` |
| `openrouter` | `GET /api/v1/key` (masked) | n/a (key-based) | delete key (guidance) |
| `zed` | *(none — launch-only)* | spawn `zed` | UI `client: sign out` |
| `zen` | *(none — launch-only)* | spawn Zen | UI sign-out |
| `bitbucket` | `git ls-remote` / `ssh -T` / API `/user` | spawn git/Bitbucket | remove token/SSH key |

**Hard rule:** adapters only `spawn` provider CLIs and parse stdout. They never read secret files, keychain values, or env-var secrets.

---

## 8. Data model & storage (non-secret only)

App config is JSON, contains **no secrets**, and lives at:
- Windows: `%APPDATA%\Slaygent\config.json`
- WSL helper side: `~/.config/slaygent/` (read-only usage)

```jsonc
{
  "version": 1,
  "defaultProfileId": "personal",
  "profiles": [
    { "id": "personal", "name": "Personal", "color": "#4f8cff",
      "accountRefs": [], "projectRules": [] }
  ],
  "orgMappings": [
    { "pattern": "github.com/acme-corp", "profileId": "work" }
  ],
  "pathRules": [
    { "prefix": "~/work", "profileId": "work" }
  ],
  "distroRules": [
    { "distro": "Ubuntu", "profileId": "work" }
  ],
  "projectAssignments": [
    { "path": "/home/alice/proj", "profileId": "work", "source": "manual" }
  ]
}
```

Status output is **not persisted** beyond the current session (identity-only, short TTL at most).

---

## 9. Preload / IPC API surface

The renderer sees exactly one object, `window.api`, exposing:

```ts
interface SlaygentAPI {
  listProviders(): Promise<ProviderSummary[]>;
  getStatus(providerId: ProviderId, scope: Scope, distro?: string): Promise<AccountStatus>;
  launch(providerId: ProviderId, scope: Scope, distro?: string): Promise<void>;
  logout(providerId: ProviderId, scope: Scope, distro?: string): Promise<LogoutResult>;

  listProfiles(): Promise<Profile[]>;
  createProfile(name: string): Promise<Profile>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;

  classifyProject(path: string): Promise<Classification>;
  assignProject(path: string, profileId: string): Promise<void>;
}
```

- No raw `ipcRenderer` in the renderer.
- Main validates every IPC sender (`event.senderFrame`).
- `LogoutResult` includes `{ localOnly: true, revokeGuidance: string }`.

---

## 10. UI specification (minimal renderer)

Single-window dashboard, vanilla TS + HTML/CSS.

**Views:**
1. **Providers** — list of 9 providers; per-provider status badge (Signed in / Signed out / Not installed / Unknown) and identity string; Windows vs WSL toggle; `Refresh`, `Launch`, `Log out` actions.
2. **Profiles** — create/edit/delete profiles; assign accounts to profiles.
3. **Projects** — classify a directory (manual or auto via rules); show the resolved profile + confidence + rule source.

**Rules:** no secrets rendered; logout always shows the local-only + revoke-guidance confirmation; all actions user-initiated (no background mutation).

---

## 11. WSL helper

- A single Bun script (`wsl-helper.ts`) compiled to a standalone Linux binary:
  `bun build ./wsl-helper.ts --compile --target=bun-linux-x64 --outfile slaygent-wsl`.
- Protocol: JSON-over-stdout. Commands: `status --json`, `launch <provider>`.
- Main invokes it via `wsl.exe -d <distro> <path> status --json` and parses stdout.
- Distro discovery: parse `wsl.exe -l -v`.
- **Boundary:** the helper returns status JSON only; it never forwards secret material across WSL↔Windows.

---

## 12. Project classification

Ordered, first-match-wins; each result carries `{ profileId, confidence, source }`:

1. Manual override (`projectAssignments`) — `high`.
2. Git remote host/org (`orgMappings`) — `medium`.
3. Directory path prefix (`pathRules`) — `medium`.
4. WSL distro (`distroRules`) — `low`.
5. Default profile — `low`.

All rules are user-configured; the app ships with no hard-coded "work" assumptions.

---

## 13. Security

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- Strict CSP; no remote content; no `shell.openExternal` on untrusted input.
- Validate every IPC sender (`senderFrame`).
- Never read secret files, keychain values, or env-var secrets.
- Never display/log/persist tokens or keys.
- Logout is local-only; server-side revoke is guidance, never automated.
- No elevation, no account switching, no secret migration.

---

## 14. Implementation phases

- **Phase 0 — Scaffolding:** electron-vite + electron-builder under Bun; hardened shell; typed IPC contract. *Acceptance: `bun run dev` opens a sandboxed window; `bun run build` produces a Windows installer.*
- **Phase 1 — Adapters (Windows):** `ProviderAdapter` + 9 adapters; mocked-CLI unit tests. *Acceptance: `inventory` returns a correct, secret-free account list.*
- **Phase 2 — WSL helper:** `wsl-helper.ts` → `bun-linux-x64` binary; distro discovery; JSON protocol. *Acceptance: main queries WSL-side status with no runtime in the distro.*
- **Phase 3 — UI:** providers/profiles/projects views; wire via preload. *Acceptance: full inventory/group/map/launch/logout flow, no secret ever shown.*
- **Phase 4 — Packaging:** electron-builder targets; bundle the WSL helper. *Acceptance: installer runs on Windows 10/11; helper works on a clean machine.*

---

## 15. Acceptance criteria (definition of done)

- [ ] All five phases complete with their acceptance criteria met.
- [ ] `bun test` covers the adapter layer (mocked CLI output) and the WSL helper protocol.
- [ ] Security checklist enforced and manually audited ("no secrets in logs/UI").
- [ ] Open questions below resolved or explicitly deferred with owners.

---

## 16. Open questions

**Tooling**
- Does electron-vite + electron-builder run cleanly under `bun install`/`bun run`? (Phase 0 spike)

**Providers**
- Claude Code: does `claude auth logout` revoke the claude.ai subscription OAuth server-side?
- Claude Desktop: exact OAuth token storage location on Windows?
- Codex: does `codex login status` print account email/workspace in CLI text?
- OpenCode: exact `auth list` columns; `auth.json` OAuth schema; native-Windows `XDG_DATA_HOME`?
- Zed: exact account/OAuth token location; Windows `settings.json` path?
- Zen: programmatic signed-in-account detection?
- Copilot CLI: exact Credential Manager target name; non-interactive "who am I"?
- Bitbucket: REST `/user` response shape; `cmdkey /list` scope?

**Product**
- Represent "same account in Windows vs WSL" as two records with `scope`, or one merged view?
- Multi-distro WSL handling and project→distro attribution?
- Gate `openrouter` status (`GET /api/v1/key`) behind explicit user action?
- Profile→account suggestion heuristics aggressiveness?
- Launch UX for WSL providers (spawn `wsl.exe` vs. Windows Terminal tab)?
- WSL helper glibc vs musl target (confirm `bun-linux-x64` covers target distros)?