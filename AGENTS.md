# AGENTS.md

## Runtime & commands

This is a **Bun** project (not npm/Node). Use `bun` for everything — there is no build step (`tsconfig.json` has `noEmit: true`).

- Install deps: `bun install`
- Run the real test suite: `bun test` (targets `test/index.test.ts`)
- Run one test file: `bun test test/index.test.ts`

## Entrypoints (all have `#!/usr/bin/env bun`; `bin` entries point at `.ts` files)

- `index.ts` — CLI tool. `bun run index.ts --task "..." [flags]`. `--json` for machine-readable output.
- `setup.ts` — interactive harness-config wizard. `bun run setup.ts` (also `--project`, `--user`, `--detect`, `--add <name>`, `--noninteractive`).
- `src/mcp-server.ts` — MCP server over stdio. Exposes one tool: `get_router_recommendation`.

`index.ts` delegates to `setup.ts` when its first arg is `setup` (spawns `bun run setup.ts` with args forwarded).

## Quirks / gotchas

- **MCP server must never write to stdout.** The stdio transport corrupts on `console.log`. Always `console.error` for logging in `src/mcp-server.ts`.
- **`setup.ts` uses module-level shared stdin state** (`stdinQueue`, `stdinBufferResolved`) to support piped (non-TTY) input. The `prompt`/`promptYN` helpers must run in a known order; it explicitly trims `\r\n` Windows line endings. Don't reuse these helpers for parallel/out-of-order prompts.
- `model-cache.json` (6-hour TTL model cache) and `decisions-log.jsonl` are generated at runtime and gitignored. Don't commit them.
- `test-mcp.ts` at the repo root is an ad-hoc manual MCP integration harness (spawns the server and pings it). It is *not* covered by `bun test`.
- Tests spawn real `bun run` subprocesses and pipe stdin, so they hit the actual CLI/MCP behavior (and the stdin-parsing cold paths) rather than mocking.