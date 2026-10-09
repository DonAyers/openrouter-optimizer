# CURRENT.md — What we are working on RIGHT NOW

> Resume rule: if you are told to **"continue"**, read this file first, then `NEXT.md`.
> Keep the top section current; move finished items to the archive at the bottom.

## In flight: Start the Auth Manager implementation (Phase 0)

**Goal:** Scaffold the Slaygent Auth Manager GUI (electron-vite + electron-builder) per `research/implementation-roadmap.md` Phase 0.

- [ ] Scaffold electron-vite + electron-builder under Bun tooling.
- [ ] Enforce the Electron security checklist (contextIsolation, sandbox, CSP).
- [ ] Define the typed IPC contract (`window.api`).

**Blockers:** None.

**Next action if resuming:** Scaffold the Electron project and enforce the security checklist.

---

## Archive (completed work — newest first)

### Install skills/commands during setup
- [x] Added `skillsPath`/`commandsPath` to `HarnessConfig` and mapped Claude Code, OpenCode, and Zed.
- [x] Added `installSkillsAndCommands` to copy `skills/` and `commands/` during setup.

### Route OpenRouter engine behind generic adapter
- [x] Added `ExecutionTargetAdapter` contract and `openrouter-adapter.ts`.
- [x] Updated CLI, MCP server, and output to use the generic adapter.

### De-couple skills from OpenRouter
- [x] Rewrote `spec-architect`, `prompt-optimizer`, `commands/ope.md`, and the `/op` skill to reference a generic routing capability.
- [x] Updated the `.agents/` and `.opencode/` copies for consistency.

### Implementation roadmap
- [x] Wrote `research/implementation-roadmap.md` (phases 0–4, cross-cutting security boundaries, consolidated open questions).

### First-release product contract
- [x] Defined the domain model (Provider / Account / Profile / Project) and the identity-only invariant.
- [x] Specified account detection per provider, profile grouping, and project classification rules.
- [x] Enumerated v1 actions (inventory/status/launch/logout/profile/project) and the explicit refusals.
- [x] Wrote the threat model and non-secret data/storage boundaries.
- [x] Wrote `research/product-contract.md`.

### Electron/Bun baseline
- [x] Selected electron-vite (build) + electron-builder (packaging) + Vite (bundler).
- [x] Chose a minimal no-framework renderer for v1 (Solid as upgrade path).
- [x] Defined the main/preload/renderer/WSL-helper process architecture and security posture.
- [x] Designed the WSL helper as a compiled Bun binary (`bun build --compile --target=bun-linux-x64`).
- [x] Wrote `research/electron-bun-baseline.md`.

### Provider auth evidence matrix
- [x] Researched auth storage, status/logout commands, Windows vs WSL boundaries, and safe observe/launch for GitHub CLI, GitHub Copilot CLI, Claude Code/Desktop, Codex CLI, OpenCode + OpenRouter, Zed, Zen, and Bitbucket.
- [x] Documented Windows Credential Manager, Git Credential Manager, WSL interop, and DPAPI boundaries.
- [x] Wrote `research/provider-auth-matrix.md` (summary matrix + per-provider notes + open questions).

### Harness integration audit
- [x] Audited current MCP/config conventions for Zed, Claude Code, Codex, GitHub Copilot, and OpenCode.
- [x] Updated the harness configuration matrix and native skill/command discovery paths.
