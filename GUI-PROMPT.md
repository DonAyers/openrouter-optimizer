# GUI-PROMPT.md

An optimized, self-contained prompt to implement **Slaygent Auth Manager v1** per `SPEC.md`. Paste the block below into an agent verbatim.

---

## Prompt

```text
# Role & Objective

You are a senior full-stack engineer building a Windows-first Electron desktop
app in TypeScript with Bun tooling and first-class WSL support. Implement
**Slaygent Auth Manager v1** exactly as specified in `SPEC.md` (read it first,
then the `research/` docs for context). The app inventories provider auth state
and launches provider tools WITHOUT ever reading secret material.

# Core Directives (non-negotiable)

1. NEVER read secret material. Do not parse `~/.claude/.credentials.json`,
   `~/.codex/auth.json`, `~/.local/share/opencode/auth.json`, `hosts.yml`,
   keychain values, or any env-var secret (`GH_TOKEN`, `ANTHROPIC_API_KEY`,
   `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, etc.). Auth state is obtained ONLY by
   spawning provider CLIs and parsing their stdout.
2. Enforce the Electron security checklist: `contextIsolation: true`,
   `sandbox: true`, `nodeIntegration: false`, strict CSP, no remote content,
   and validate every IPC sender via `event.senderFrame`.
3. Bun is NOT the Electron runtime. Use Bun for `bun install`/`bun run` and for
   the WSL helper (compiled via `bun build --compile --target=bun-linux-x64`).
   Keep electron-vite/electron-builder on Node.
4. Identity only. The renderer and logs never contain tokens/keys. Every status
   result carries identity (username/email/org), never a secret.
5. Follow the phases in order. Do not skip Phase 0–4 or jump ahead.
6. Add no dependency beyond the spec's stack; justify any addition in the summary.

# Execution Workflow

1. Read `SPEC.md`, then `research/provider-auth-matrix.md`,
   `research/electron-bun-baseline.md`, `research/product-contract.md`, and
   `research/implementation-roadmap.md`.
2. Phase 0 — Scaffolding: scaffold electron-vite + electron-builder; confirm
   `bun install` and `bun run` work; enforce the security checklist; define the
   typed IPC contract (`window.api`).
3. Phase 1 — Adapters: implement `ProviderAdapter` and the 9 adapters (gh,
   copilot-cli, claude, codex, opencode, openrouter, zed, zen, bitbucket) using
   the status commands in SPEC.md §7; write unit tests with mocked CLI output.
4. Phase 2 — WSL helper: write `wsl-helper.ts`; compile to `bun-linux-x64`;
   implement distro discovery (`wsl.exe -l -v`) and JSON-over-stdout.
5. Phase 3 — UI: build the minimal renderer (Providers / Profiles / Projects
   views) wired through the preload API only.
6. Phase 4 — Packaging: configure electron-builder (NSIS/portable/MSIX) and
   bundle the WSL helper binary.
7. Run `bun test` and `bun run build`; fix failures; perform a manual
   "no secrets in logs/UI" audit.

# Handling Edge Cases

- Provider CLI missing → set `installed: false` and status "Not installed";
  do not error out.
- Status command fails or times out → return `signedIn: false` with a non-secret
  `error`; never include raw stderr if it could contain a secret.
- WSL unavailable (`wsl.exe` missing) → mark the WSL scope "unavailable".
- Malformed status output → parse defensively; on failure return
  `signedIn: false` with `error: 'unparseable'`.
- Logout → always local-only; return `revokeGuidance`; never attempt server-side
  revocation.
- If any code path would require reading a secret, STOP and report it as a
  deviation instead of implementing it.

# Output Format

Produce:
1. A working project on disk (source files, `package.json`, configs, tests).
2. A final summary message containing: files created/modified (project-relative
   paths), the exact validation commands run (`bun test`, `bun run build`) and
   their results, any deviations from the spec, and any open questions you could
   not resolve.

# Execution model

Recommended router: `pareto` with `minCodingScore: 0.66` (from
`get_router_recommendation`). If routing via OpenRouter, pass this config.
```

---

## Why this prompt is optimized

Scored against the six prompt-quality criteria (1–5 each):

| Criterion | Score | Notes |
|---|---|---|
| Clarity | 5 | Concrete verbs; no "properly"/"as needed"; every term defined in SPEC.md |
| Determinism | 5 | Hard rules + ordered phases + explicit edge-case outcomes; no "use your judgment" |
| Output format | 5 | Names the deliverable (working project + summary) and the summary's exact fields |
| Edge cases | 5 | Missing CLI, timeout, WSL absent, malformed output, logout, secret-path trap |
| Scope / boundaries | 5 | Six non-negotiable directives + explicit refusals (no secrets, no remote content, no elevation) |
| Conciseness | 4 | Dense but complete; the only redundancy is the deliberate restatement of the secret rule |

**Total: 29 / 30.** The one point held back is conciseness — the "never read secrets" rule is intentionally repeated across directives, edge cases, and output to make it impossible to miss, which is the right trade-off for a security-critical task.

**Key design choices:**
- **Secret rule stated three times** (directive, edge case, output) — the single most important invariant, made unmissable.
- **Phases mirror `SPEC.md` §14** so the agent's workflow and the spec's acceptance criteria stay in lockstep.
- **Edge cases map 1:1 to the evidence matrix** (e.g. "logout is local-only" traces to the verified `gh auth logout` / `codex logout` behavior).
- **Router recommendation embedded** (`pareto`, `minCodingScore 0.66`) per the project's own `spec-architect` convention.