# Roadmap

OpenRouter router-recommendation engine + portable prompt/agent skills.
(`slaygent` folder and npm package.)

## Done

- [x] Core router engine: `classifier.ts`, `router-recommender.ts`, `model-cache.ts`, `output.ts`, `types.ts`
- [x] CLI (`index.ts`): `--task`, `--budget`, `--free-only`, `--context-*`, `--json`
- [x] MCP server (`src/mcp-server.ts`): `get_router_recommendation` tool
- [x] Interactive harness wizard (`setup.ts`) + `--detect/--add/--noninteractive`
- [x] Install wrappers (`slaygent.sh` / `.ps1`)
- [x] 22 CLI tests passing (`bun test`)
- [x] `skills/spec-architect` (replaced old `interactive_architect` MCP tool)
- [x] `skills/prompt-optimizer`
- [x] Slash templates `commands/op.md` (`/op`), `commands/ope.md` (`/ope`)
- [x] **Researched the Slaygent Auth Manager GUI.** Produced the provider auth evidence matrix, Electron/Bun baseline, product contract, and implementation roadmap in `research/`, plus the consolidated `SPEC.md` and the implementation prompt `GUI-PROMPT.md`.
- [x] **De-coupled skills from OpenRouter.** `spec-architect`, `prompt-optimizer`, `commands/ope.md`, and the `/op` skill now reference a generic routing capability.
- [x] Updated README to document skills and commands.
- [x] **Routed the OpenRouter engine behind a generic adapter contract.** Added `ExecutionTargetAdapter` + `openrouter-adapter.ts`; CLI, MCP server, and output now use it.
- [x] **Install skills/commands during setup.** `setup.ts` now copies `skills/` and `commands/` into harness locations (Claude Code, OpenCode, Zed).

## Next

## Backlog / Ideas

- [ ] Slaygent custom harness: execute routed agent workflows with provider adapters, tools, verification, and learning.
- [ ] Phase 2 learning loop: analyze `decisions-log.jsonl` to adjust confidence
      and build a performance database.
