# Slaygent Auth Manager — Implementation Roadmap

> Phased plan to build v1 from the product contract, baseline, and evidence matrix.
> Each phase lists tasks, acceptance criteria, and the security boundary it must respect.

---

## Guiding principles

1. **Secrets never enter the app.** Every phase is gated on this invariant.
2. **Smallest secure surface.** Minimal renderer, narrow preload API, no remote content.
3. **Bun is the WSL-boundary tool, not the Electron runtime.** (Electron's main process runs on Electron's bundled Node.)
4. **Ship identity, not credentials.** Status via provider CLIs; never parse secret files.

---

## Phase 0 — Project scaffolding

**Goal:** a runnable, hardened Electron shell under Bun tooling.

- [ ] Scaffold electron-vite + electron-builder; confirm `bun install` / `bun run` work end-to-end (spike the Node-centric toolchain risk).
- [ ] Enforce the security checklist in `main`: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict CSP, no remote content.
- [ ] Stand up the four-process skeleton: `main`, `preload`, `renderer`, and a placeholder `wsl-helper`.
- [ ] Define the typed IPC contract (the `window.api` surface) and a shared types package.

**Acceptance:** `bun run dev` opens a sandboxed window; `bun run build` + electron-builder produce a Windows installer.

**Security boundary:** renderer has zero Node access; preload exposes only the typed API; main validates every IPC sender.

---

## Phase 1 — Provider adapter framework (Windows)

**Goal:** a uniform, secret-free adapter layer for the Windows-side providers.

- [ ] Define `ProviderAdapter`: `{ id, status(): AccountStatus, launch(): void, logout(): void, storageTier }`.
- [ ] Implement adapters for `gh`, `claude`, `codex`, `opencode`, `copilot-cli`, `bitbucket`, `zed`, `zen`, `openrouter` using the status commands from the evidence matrix.
- [ ] Parse status output into `{ signedIn, identity?, method?, scope? }` — identity only.
- [ ] Unit-test each adapter against mocked CLI output (no live secrets).

**Acceptance:** `inventory` returns a correct, secret-free account list for every provider.

**Security boundary:** adapters only `spawn` provider CLIs and parse stdout; they never read secret files, keychain values, or env-var secrets.

---

## Phase 2 — WSL helper

**Goal:** a self-contained Bun binary that reports WSL-side auth state.

- [ ] Write `wsl-helper.ts` (status + launch commands, JSON-over-stdout).
- [ ] Compile to a standalone Linux binary: `bun build --compile --target=bun-linux-x64`.
- [ ] Detect WSL distros from the main process (`wsl.exe -l -v`) and invoke `wsl.exe -d <distro> <helper> status --json`.
- [ ] Decide glibc vs musl target (most WSL distros are glibc → `bun-linux-x64`).

**Acceptance:** the main process can query WSL-side `gh`/`claude`/`codex`/`opencode` status through the helper, with no runtime installed in the distro.

**Security boundary:** the helper returns status JSON only; it never reads or forwards secret material across the WSL↔Windows boundary.

---

## Phase 3 — v1 UI (minimal renderer)

**Goal:** the inventory/launcher dashboard.

- [ ] Render the provider list with per-provider status badges (identity only).
- [ ] Profile grouping: create/edit/delete profiles; assign accounts to profiles.
- [ ] Project mapping: classify a directory via the ordered rules (manual → git remote org → path prefix → WSL distro → default).
- [ ] Actions: `status` (refresh), `launch`, `logout` (with the local-only + revoke-guidance confirmation).
- [ ] Wire everything through the preload API; no direct `ipcRenderer` in the renderer.

**Acceptance:** a user can see who is signed in, group accounts, map a project, and launch/log out — all without the app ever displaying a secret.

**Security boundary:** renderer stays sandboxed; all privileged work remains in main; logout is local-only with explicit server-side-revoke guidance.

---

## Phase 4 — Packaging & distribution

**Goal:** a distributable Windows app.

- [ ] electron-builder targets: NSIS (installer), portable, and MSIX if signing is available.
- [ ] Bundle the compiled WSL helper as an extra resource.
- [ ] Code signing (optional/deferred) and auto-update (deferred).
- [ ] Final pass on the security checklist and a manual "no secrets in logs/UI" audit.

**Acceptance:** a signed-or-unsigned installer installs and runs on Windows 10/11; the WSL helper works on a clean machine.

**Security boundary:** shipped artifacts contain no secrets and no secret-reading code paths.

---

## Cross-cutting security boundaries (apply to every phase)

1. `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict CSP, no remote content.
2. Narrow typed preload API; validate IPC senders (`senderFrame`).
3. Never read secret files, keychain values, or env-var secrets.
4. Never display, log, or persist tokens/keys.
5. Logout is local-only; server-side revoke is guidance, never automated.
6. No elevation, no account switching, no secret migration/sync.

---

## Definition of done

- [ ] All four phases complete with acceptance criteria met.
- [ ] A `bun test` suite covers the adapter layer (mocked CLI output) and the WSL helper protocol.
- [ ] The security checklist is enforced and manually audited.
- [ ] Open questions below are resolved or explicitly deferred with owners.

---

## Open questions (consolidated)

**Tooling**
- [ ] Does electron-vite + electron-builder run cleanly under `bun install`/`bun run`? (Phase 0 spike)

**Providers**
- [ ] Claude Code: does `claude auth logout` revoke the claude.ai subscription OAuth token server-side?
- [ ] Claude Desktop: exact OAuth token storage location on Windows?
- [ ] Codex: does `codex login status` print the account email/workspace name in CLI text?
- [ ] OpenCode: exact `auth list` output columns; exact `auth.json` OAuth schema; native-Windows `XDG_DATA_HOME` behavior?
- [ ] Zed: exact account/OAuth token storage location; exact Windows `settings.json` path?
- [ ] Zen: programmatic signed-in-account detection?
- [ ] Copilot CLI: exact Windows Credential Manager target name; any non-interactive "who am I"?
- [ ] Bitbucket: REST `/user` response shape; `cmdkey /list` elevation/scope details?

**Product**
- [ ] App config schema + location (`%APPDATA%\Slaygent` vs `~/.config/slaygent`)?
- [ ] How to represent "same account in Windows vs WSL" (two records with `scope`, or one merged view)?
- [ ] Multi-distro WSL handling and project→distro attribution?
- [ ] Should `openrouter` status (`GET /api/v1/key`) be gated behind explicit user action (it sends the key as a Bearer header)?
- [ ] Profile→account suggestion heuristics (org/email matching) aggressiveness?
- [ ] Launch UX for WSL providers (spawn `wsl.exe` vs. open a Windows Terminal tab)?
- [ ] WSL helper glibc vs musl target (confirm `bun-linux-x64` covers target distros)?