# OpenRouter Optimizer

An MCP server that recommends the optimal OpenRouter router for any task, with budget-aware configuration.

## What It Does

Analyzes your task and recommends:
- **Which router** to use (auto, jev, pareto, fusion, free, specific)
- **Configuration** to pass to OpenRouter (min_coding_score, model pools, etc.)
- **Budget-aware settings** based on your constraints
- **Alternatives** with tradeoffs

## Quick Start

### Install (choose one)

**Option 1: npx (no install, works immediately)**
```bash
npx -y github:DonAyers/openrouter-optimizer setup
```
Note: npx uses npm to install dependencies, which may show a progress spinner. The package has minimal dependencies (~2MB).

**Option 2: npm install (global)**
```bash
npm install -g openrouter-optimizer
openrouter-optimizer setup
```

**Option 3: Clone with bun (fastest if you have bun)**
```bash
git clone https://github.com/DonAyers/openrouter-optimizer
cd openrouter-optimizer
bun install
bun run setup.ts
```
Bun installs dependencies faster than npm and doesn't show a progress spinner.

**Option 4: Bun wrapper script (best UX if you have bun)**
```bash
# Download and run the wrapper (one-liner)
curl -sL https://raw.githubusercontent.com/DonAyers/openrouter-optimizer/main/openrouter-optimizer.sh | bash

# Or download it first, then run
wget https://raw.githubusercontent.com/DonAyers/openrouter-optimizer/main/openrouter-optimizer.sh
chmod +x openrouter-optimizer.sh
./openrouter-optimizer.sh setup
```
The wrapper detects if bun is available and uses it for faster installation. Falls back to npx if not.

**PowerShell users (Windows):**

Download the PowerShell wrapper:
```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/DonAyers/openrouter-optimizer/main/openrouter-optimizer.ps1 -OutFile openrouter-optimizer.ps1
.\openrouter-optimizer.ps1 setup
```

Or use it directly:
```powershell
# One-liner
Invoke-WebRequest -Uri https://raw.githubusercontent.com/DonAyers/openrouter-optimizer/main/openrouter-optimizer.ps1 -OutFile $null -UseBasicParsing; powershell -File openrouter-optimizer.ps1 setup

# Or if you have bun, just clone and use bun directly (fastest)
git clone https://github.com/DonAyers/openrouter-optimizer
cd openrouter-optimizer
bun install
bun run setup.ts
```

### Setup
1. Detect installed AI harnesses (Claude Code, OpenCode, Cursor, etc.)
2. Ask which to configure (or configure all detected by default)
3. Write the MCP config to the correct locations

### Manual CLI Usage

```bash
# Analyze a task
bun run index.ts --task "Fix the bug in this React component"

# With budget constraint
bun run index.ts --task "Write a Python API" --budget 0.001

# Free models only
bun run index.ts --task "Summarize this" --free-only

# With context (helps when task is ambiguous)
bun run index.ts --task "Fix the authentication bug" \\
    --context-framework express --context-language typescript

# Agent-ready JSON output
bun run index.ts --task "Research quantum computing" --json
```

### As MCP Server (for Claude, Cursor, VS Code, etc.)

Once configured via `setup.ts`, the MCP server is available as a tool in your AI harness.

**Tool name:** `get_router_recommendation`

**Input:**
```json
{
  "task": "Fix the bug in this React component",
  "budget_per_request": 0.001,
  "context_framework": "react",
  "context_language": "typescript"
}
```

**Output:**
```json
{
  "task_type": "coding-agentic",
  "recommended_router": "pareto",
  "config": { "minCodingScore": 0.66 },
  "reasoning": "Complex coding task → Pareto Router at 0.66 coding score",
  "estimated_cost_per_request": 0.002,
  "alternatives": [...]
}
```

## Supported Harnesses

| Harness | Config Location |
|---------|-----------------|
| Claude Code | `~/.claude/settings.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) |
| OpenCode | `~/.config/opencode/settings.json` |
| Cursor | `~/.cursor/mcp.json` |
| GitHub Copilot (VS Code) | `~/.config/Code/User/globalStorage/github.copilot/storage.json` |

## Routers Available

| Router | Best For | Use When |
|--------|----------|----------|
| `auto` | General tasks | Default choice, let OpenRouter pick |
| `jev` | Budget control | You want to constrain model pool |
| `pareto` | Coding | You have a coding task |
| `fusion` | Research/complex | Accuracy > cost, multi-perspective |
| `fusion-flash` | Fast research | Lower latency multi-model |
| `free` | Zero budget | Only free models |
| `specific` | Image/vision | Direct model selection |

## Context Fields

Context fields help when the task description is ambiguous. They are only used if they provide NEW signal:

```bash
# Task mentions "Fix bug" but not what framework
--context-framework express --context-language typescript

# Redundant context is ignored (already in task)
--task "Fix the React component" --context-framework react  # "react" already mentioned
```

## Development

```bash
# Run tests
bun run test

# Run MCP server directly
bun run src/mcp-server.ts

# CLI mode
bun run index.ts --task "your task here"

# Setup mode
bun run setup.ts
```

## Project Structure

```
openrouter-optimizer/
├── index.ts              # CLI entrypoint
├── setup.ts              # Setup CLI for harness configuration
├── src/
│   └── mcp-server.ts     # MCP server entrypoint
├── classifier.ts         # Task classification logic
├── router-recommender.ts # Router + config recommendation
├── model-cache.ts        # OpenRouter model caching
├── output.ts             # Formatting (JSON + human)
├── types.ts              # TypeScript types
├── package.json
└── README.md
```

## How It Works

1. **Classify** the task (coding, research, vision, etc.)
2. **Select router** based on task type + budget
3. **Configure** router with appropriate settings
4. **Return** ready-to-use config + alternatives

The tool does NOT call OpenRouter - it recommends which router to use and with what config. You then use that config in your own OpenRouter API calls.

## Future: Learning Loop (Phase 2)

Decisions are logged to `./decisions-log.jsonl`. In phase 2, this log can be analyzed to:
- Track which router recommendations work best for which tasks
- Adjust confidence scores based on outcomes
- Build a performance database for optimization

## Security

- No API keys in code (uses `$OPENROUTER_API_KEY` env var placeholder)
- Cache files excluded from git via `.gitignore`
- Tool does not log or expose your API usage

## License

MIT
