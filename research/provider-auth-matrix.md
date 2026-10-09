# Provider Auth Evidence Matrix

> Research notes for the **Slaygent Auth Manager GUI** (Windows-first Electron/Bun app with WSL support).
> Goal: safely **inventory** auth state and **launch** provider tools **without reading secret material** by default.
> Legend: ✅ = verified from an official doc/repo fetched during research; 🧠 = inferred (design synthesis or standard behavior, no fetched source).

---

## Summary matrix

| Provider | Windows credential store | WSL/Linux credential store | Status (no secret) | Logout | Server-side revoke? | Safe observe | Safe launch |
|---|---|---|---|---|---|---|---|
| **GitHub CLI (`gh`)** | System credential store (Windows Credential Manager); plaintext fallback `%APPDATA%\GitHub CLI\hosts.yml` | Secret service or plaintext `~/.config/gh/hosts.yml` | `gh auth status` (✅) | `gh auth logout` (✅) | ❌ local-only (✅) | ✅ | ✅ |
| **GitHub Copilot CLI** | OS keychain `copilot-cli` (Credential Manager); fallback `~/.copilot/config.json` | libsecret `copilot-cli`; fallback `~/.copilot/config.json` | `/user` (interactive) (✅) | `/logout` (✅) | ❌ local-only (✅) | ✅ | ✅ |
| **Claude Code / Desktop** | `~/.claude/.credentials.json` (plaintext, ACL-inherited) | `~/.claude/.credentials.json` (0600) | `claude auth status` (✅) | `claude auth logout` / `/logout` (✅) | ⚠️ keyless profile revokes; claude.ai OAuth unknown (🧠) | ✅ | ✅ |
| **Codex CLI** | `~/.codex/auth.json` **or** Credential Manager (`cli_auth_credentials_store`) | `~/.codex/auth.json` **or** libsecret | `codex login status` (✅) | `codex logout` (✅) | ❌ local-only (✅) | ✅ | ✅ |
| **OpenCode** | `~/.local/share/opencode/auth.json` (plaintext) | `~/.local/share/opencode/auth.json` (plaintext) | `opencode auth list` (✅) | `opencode auth logout` (✅) | ❌ local-only (✅) | ✅ | ✅ |
| **OpenRouter** | n/a (key held by client) | n/a | `GET /api/v1/key` → masked metadata (✅) | delete key server-side (✅) | ✅ (delete key) | ✅ | ✅ |
| **Zed** | System keychain (API keys); OAuth token 🧠 keychain | System keychain | none documented (🧠) | `client: sign out` (UI) (✅) | 🧠 | ⚠️ UI-only | ✅ |
| **Zen** | Firefox profile `%APPDATA%\zen\Profiles` (encrypted) | `~/.zen/` (encrypted) | none documented (🧠) | UI sign-out (🧠) | 🧠 | ⚠️ UI-only | ✅ |
| **Bitbucket** | Git Credential Manager → Credential Manager | GCM → libsecret / GPG / plaintext | `git ls-remote` / API `/user` / `ssh -T` (🧠) | remove token/SSH key (✅) | ✅ (delete token) | ✅ | ✅ |

---

## 1. GitHub CLI (`gh`)

- **Storage (Windows):** system credential store (Windows Credential Manager). Falls back to plaintext `%APPDATA%\GitHub CLI\hosts.yml` if no credential store or on error. `--insecure-storage` forces plaintext. ✅
- **Storage (WSL/Linux):** secret service, or plaintext `~/.config/gh/hosts.yml`. ✅
- **Env vars:** `GH_TOKEN` / `GITHUB_TOKEN` (headless/automation). ✅
- **Status:** `gh auth status` — shows active account + auth state per host, **without** the token. `--show-token` explicitly reveals it. `--json hosts` for machine-readable output (exit 0 even on auth issues). ✅
- **Logout:** `gh auth logout` — removes local config **only**; does **not** revoke the token. Revocation is manual via GitHub → Settings → Applications → "GitHub CLI" → Revoke Access. ✅
- **Safe observe:** ✅ `gh auth status` (or `--json`). Never parse `hosts.yml`.
- **Safe launch:** ✅ spawn `gh`; it reads its own credential.
- **Recommended integration:** **CLI status adapter** (`gh auth status --json hosts`) + launch adapter. Highest-confidence provider.

**Sources:** https://cli.github.com/manual/gh_auth_login · https://cli.github.com/manual/gh_auth_status · https://cli.github.com/manual/gh_auth_logout

---

## 2. GitHub Copilot CLI

> Two products surface as `gh copilot`: the **deprecated `gh-copilot` extension** (archived Oct 2025) and the current **`copilot` binary** (`@github/copilot`). Facts below describe the current binary.

- **Storage (Windows):** OAuth token in OS keychain under service `copilot-cli` (Windows Credential Manager). Config/state in `~/.copilot/config.json`; token is **not** plaintext there by default. If keychain unavailable, prompts to store plaintext (gated by `storeTokenPlaintext`, default `false`). ✅
- **Storage (WSL/Linux):** same keychain model via libsecret. On headless WSL without a running keyring, falls back to plaintext `~/.copilot/config.json`. Lookup: `secret-tool search copilot-cli`. ✅
- **Status:** interactive `/user` (shows account), `/user list`, `/user switch`. **No `copilot auth status` command.** `gh auth status` only reflects the `gh` fallback, not Copilot's own token. ✅
- **Logout:** `/logout` (interactive) removes local token, does **not** revoke server-side. Manual revoke via GitHub → Settings → Applications → Authorized OAuth Apps. ✅
- **Safe observe:** ✅ `/user` (interactive) or keychain **presence** check (`secret-tool search copilot-cli`) without reading the value.
- **Safe launch:** ✅ spawn `copilot`; it reads the keychain itself.
- **Relationship to `gh`:** keeps its **own** credential; lowest-priority fallback to `gh auth token`. Precedence: `COPILOT_GITHUB_TOKEN` → `GH_TOKEN` → `GITHUB_TOKEN` → keychain OAuth → `gh auth token`. ✅
- **Recommended integration:** **launch adapter** + keychain-presence check. Status is interactive-only, so a manager can detect "credential present" but not "logged in as X" without driving the TUI.

**Sources:** https://docs.github.com/en/copilot · https://cli.github.com/manual/gh_copilot · https://github.com/github/gh-copilot · https://docs.github.com/en/copilot/github-copilot-in-the-cli · https://gh.io/copilot-cli

---

## 3. Claude Code / Claude Desktop

- **Storage (Windows):** `%USERPROFILE%\.claude\.credentials.json` (plaintext JSON, inherits user-profile ACLs). **Not** Windows Credential Manager. macOS uses Keychain. ✅
- **Storage (WSL/Linux):** `~/.claude/.credentials.json` (mode 0600). `CLAUDE_CONFIG_DIR` relocates it. ✅
- **Env vars:** `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, `apiKeyHelper` script. ✅
- **Status:** `claude auth status` — JSON (or `--text`), exit 0 if logged in / 1 if not; reports `authMethod` (`none`, `claude.ai`, `oauth_token`, `api_key`, `api_key_helper`, `third_party`) + `configDirectory`. In-session `/status` shows Login method / Organization / Email / Profile. ✅
- **Logout:** `claude auth logout` (CLI) or `/logout` (in-session). Keyless Console profile is **removed and revoked**; claude.ai subscription OAuth revocation is **not explicitly documented** (treat as local-only). ✅/🧠
- **Safe observe:** ✅ `claude auth status` (parse `authMethod` + exit code; `/status` for email/org) — never touch `.credentials.json`.
- **Safe launch:** ✅ spawn `claude`; it self-authenticates.
- **Config boundaries:** secret = `.credentials.json`, macOS Keychain, Anthropic profiles (`%APPDATA%\Anthropic`). Non-secret = `~/.claude.json`, `~/.claude/settings.json`, `~/.claude/` (skills/hooks/transcripts), project `.claude/`, `.mcp.json`, `claude_desktop_config.json`. ✅
- **Desktop:** uses OAuth, ignores `apiKeyHelper`/`ANTHROPIC_API_KEY`; reads same settings files. Windows deployment is MSIX; policy via registry `SOFTWARE\Policies\Claude`. Exact Desktop OAuth token location on Windows is **unknown**. ✅/🧠
- **Recommended integration:** **CLI status adapter** (`claude auth status`) + launch adapter. Strong, machine-readable status.

**Sources:** https://code.claude.com/docs/en/authentication · https://code.claude.com/docs/en/desktop · https://docs.anthropic.com/en/docs/claude-code/cli-reference

---

## 4. Codex CLI

- **Storage (Windows):** `~/.codex/auth.json` (plaintext) **or** OS credential store (Windows Credential Manager), selected by `cli_auth_credentials_store` = `file` | `keyring` | `auto` (default) | `ephemeral`. Docs warn `auth.json` "contains access tokens." ✅
- **Storage (WSL/Linux):** identical model; `~/.codex/auth.json` under Linux home, `keyring` → libsecret. `CODEX_HOME` overrides. ✅
- **Env vars:** `OPENAI_API_KEY`, `CODEX_API_KEY`, `CODEX_ACCESS_TOKEN`. ✅
- **Status:** `codex login status` — reports active auth method; **exit 0 when credentials present** (explicitly for automation). `codex doctor` checks auth health. ✅
- **Logout:** `codex logout` (no flags) — clears local credentials for both API key and ChatGPT auth; **local-only, no server revoke**. `/logout` in TUI. ✅
- **Safe observe:** ✅ `codex login status` (method + exit code). Account email/workspace name is shown in GUI profile menu; CLI text may not include it (🧠).
- **Safe launch:** ✅ spawn `codex` (interactive) or `codex exec` (non-interactive); it reads its own cached credential.
- **Auth modes:** ChatGPT plan (browser OAuth / `--device-auth`) vs API key (`codex login --with-api-key`) vs access token (`--with-access-token`). CLI and IDE extension **share** the same cached login. ✅
- **Recommended integration:** **CLI status adapter** (`codex login status`) + launch adapter.

**Sources:** https://developers.openai.com/codex/auth · https://developers.openai.com/codex/sign-in-with-chatgpt · https://developers.openai.com/codex/config-file/config-reference · https://developers.openai.com/codex/windows/wsl · https://github.com/openai/codex

---

## 5. OpenCode + OpenRouter

- **Storage (Windows):** `~/.local/share/opencode/auth.json` (plaintext JSON; same path on macOS/Linux/Windows; `XDG_DATA_HOME` overrides). **No OS keychain.** Config at `~/.config/opencode/opencode.json` (non-secret options; can reference `{env:...}`/`{file:...}`). ✅
- **Storage (WSL/Linux):** identical `~/.local/share/opencode/auth.json`. ✅
- **Env vars:** `OPENROUTER_API_KEY`, `GITLAB_TOKEN`, etc. ✅
- **Status:** `opencode auth list` / `opencode auth ls` — lists authenticated providers (no key values). ✅
- **Logout:** `opencode auth logout` — clears the provider from `auth.json`; **local-only**. ✅
- **Safe observe:** ✅ `opencode auth list`. Do **not** parse `auth.json` (contains raw secrets).
- **Safe launch:** ✅ spawn `opencode` (TUI) or `opencode run "…"` (headless); also `opencode serve` (HTTP), `opencode acp` (stdin/stdout). CLI reads `auth.json`/env itself.
- **OpenRouter:** Bearer token `Authorization: Bearer <OPENROUTER_API_KEY>` against `https://openrouter.ai/api/v1`. Keys start `sk-or-v1-`. **Verify endpoint** `GET /api/v1/key` returns **masked metadata** (label masked, limits, usage, tier, expiry) and **401** on invalid — the canonical "is this key valid?" check without echoing the key. ✅
- **Recommended integration:** **CLI status adapter** (`opencode auth list`) + launch adapter. For OpenRouter, a **verify adapter** (`GET /api/v1/key`) gives masked status.

**Sources:** https://opencode.ai/docs/cli/ · https://opencode.ai/docs/providers/ · https://openrouter.ai/docs/api-reference/authentication · https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key

---

## 6. Zed + Zen

### Zed (editor)
- **Auth:** GitHub OAuth (`read:user` only); sign-in optional. ✅
- **Storage:** API keys (Anthropic/OpenAI/Google/DeepSeek) saved through Zed go to the **system keychain**, not `settings.json` ("Do not put API keys in `settings.json`"). Non-empty env vars take precedence. Account/OAuth token location is 🧠 keychain (not documented). ✅/🧠
- **Config:** `~/.config/zed/settings.json` (Linux shown); user-data dir `%LOCALAPPDATA%\Zed` (Windows) / `~/.local/share/zed` (Linux). ✅
- **Status:** **no documented CLI/file** to query sign-in state; `zed --version` prints version only. Sign-in state is UI-only (Sign In button / avatar menu). ✅
- **Safe observe:** ⚠️ read `settings.json`/user-data dir (non-secret) but sign-in state is not machine-readable.
- **Safe launch:** ✅ run `zed` / `zed.exe`; WSL paths supported natively.

### Zen (Firefox-based browser)
- **Auth:** Firefox Sync / Mozilla account (Settings → Sync). ✅
- **Storage:** profile dir `%APPDATA%\zen\Profiles` (Windows) / `~/.zen/` (Linux). Passwords/cookies "managed by Firefox," encrypted (`logins.json` + `key4.db`/NSS, master key in OS keychain 🧠). ✅/🧠
- **Status:** no documented programmatic sign-in detection (🧠).
- **Safe observe:** ⚠️ **avoid reading the profile dir** (contains secret-bearing material). Rely on launch/UI.
- **Safe launch:** ✅ run the Zen binary.

**Recommended integration (both):** **launch adapter only** in v1; no reliable machine-readable status. Treat as "launch + let the app render its own auth UI."

**Sources:** https://zed.dev/docs/authentication · https://zed.dev/docs/ai/use-api-access · https://zed.dev/docs/reference/cli · https://zed.dev/docs/reference/all-settings · https://docs.zen-browser.app/faq · https://docs.zen-browser.app/security

---

## 7. Bitbucket + Windows/WSL credential handling

### Bitbucket
- **Auth:** **API tokens** (long-term replacement for app passwords) — user-based, scoped, cannot be viewed/edited after creation, cannot log in to bitbucket.org (API + git-over-HTTPS only). SSH keys in `~/.ssh/` (public key uploaded). `.gitconfig` holds commit identity (non-secret). ✅
- **Status:** `git ls-remote` (non-secret probe), Bitbucket REST `GET /api.bitbucket.org/2.0/user`, `ssh -T git@bitbucket.org` (🧠).
- **Safe observe/launch:** ✅ detect via git/API/SSH probes; launch git/Bitbucket tools (GCM pulls credentials implicitly) without reading secrets.

### Windows Credential Manager + WSL + GCM
- **Credential Manager:** DPAPI-backed vault. `cmdkey /list` enumerates **target names + usernames only** — "Passwords are not displayed after they're stored." ✅
- **GCM Windows:** default store = Windows Credential Manager (`wincredman`); alt DPAPI files `%USERPROFILE%\.gcm\dpapi_store`. ✅
- **GCM Linux/WSL:** **no default store**; options libsecret, GPG/`pass`, plaintext (`~/.gcm/store`, "NOT secure"), in-memory. ✅
- **WSL bridge:** WSL Git invokes the **Windows** `git-credential-manager.exe` via `/mnt/c/...`, so it uses the **host's** secure storage and GUI; credentials shared across Windows + all WSL distros (single sign-in). ✅
- **WSL boundary:** config files are separate (`%USERPROFILE%\.gitconfig` vs `\\wsl$\distro\home\$USER\.gitconfig`); GCM running as a Linux app "cannot utilize authentication or credential storage features of the host Windows OS." A Windows app cannot directly read WSL's `~/.git-credentials`/keyring (🧠). ✅/🧠
- **DPAPI:** only a process with the **same logon credential** (and usually same machine) can decrypt; `CRYPTPROTECT_LOCAL_MACHINE` relaxes to any user on the machine. Credential Guard (VBS) additionally isolates secrets from admin malware. ✅

**Recommended integration:** **git/API probe adapter** (status via `git ls-remote`/`ssh -T`/API `/user`) + launch adapter. Credential Manager enumeration (`cmdkey /list`) is safe (names only) and useful for a "which accounts exist" view.

**Sources:** https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/ (→ API tokens) · https://support.atlassian.com/bitbucket-cloud/docs/set-up-an-ssh-key/ · https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/wsl.md · https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/credstores.md · https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmdkey · https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata · https://learn.microsoft.com/en-us/windows/security/identity-protection/credential-guard/

---

## Cross-cutting findings

1. **Three storage tiers exist:** (a) OS keychain/Credential Manager (`gh`, Copilot CLI, Codex `keyring`, Zed API keys); (b) plaintext JSON files (`~/.claude/.credentials.json`, `~/.codex/auth.json`, `~/.local/share/opencode/auth.json`); (c) env vars. A manager must **never** parse tier (b) files or read env-var secrets.
2. **Status is the safe inventory primitive.** Every CLI except Zed/Zen exposes a status command that reports identity/state **without** the secret (`gh auth status`, `claude auth status`, `codex login status`, `opencode auth list`). Copilot CLI is interactive-only (`/user`).
3. **Logout is almost always local-only.** `gh auth logout`, `codex logout`, `opencode auth logout`, Copilot `/logout` remove local state but do **not** revoke server-side. Server-side revoke is a separate manual/API action.
4. **WSL is a hard boundary.** WSL has its own filesystem and (often absent) keyring. The only shared credential path is the Windows GCM bridge (WSL Git → Windows GCM → Windows Credential Manager). A Windows app cannot read WSL's keyring/`~/.git-credentials` directly.
5. **"Inventory without secrets" is achievable for CLIs, hard for GUI apps.** Zed and Zen expose no machine-readable sign-in state; for them the safe v1 posture is launch-only.

---

## Open questions

- [ ] Claude Code: does `claude auth logout` revoke the claude.ai subscription OAuth token server-side? (only the keyless Console profile is documented as revoked)
- [ ] Claude Desktop: exact OAuth token storage location on Windows (Credential Manager vs Electron `safeStorage` vs file)?
- [ ] Codex: does `codex login status` print the account email/workspace name in CLI text, or only the method?
- [ ] OpenCode: exact `auth list` output columns; exact `auth.json` OAuth schema; whether a native-Windows build honors `XDG_DATA_HOME`.
- [ ] Zed: exact account/OAuth token storage location; exact Windows `settings.json` path.
- [ ] Zen: programmatic signed-in-account detection (Firefox `signedInUser.json` is unverified).
- [ ] Copilot CLI: exact Windows Credential Manager target name; any non-interactive "who am I".
- [ ] Bitbucket: REST `/user` response shape (not fetched); `cmdkey /list` elevation/scope details.