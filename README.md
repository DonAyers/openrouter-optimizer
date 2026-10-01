# OpenRouter Router Tool

An MCP server that recommends the optimal OpenRouter router for any task, with budget-aware configuration.

## What It Does

Analyzes your task and recommends:
- **Which router** to use (auto, jev, pareto, fusion, free, specific)
- **Configuration** to pass to OpenRouter (min_coding_score, model pools, etc.)
- **Budget-aware settings** based on your constraints
- **Alternatives** with tradeoffs

## Quick Start

### Install

```bash
# Clone or copy this directory
cd slaygent

# Install dependencies
bun install
```

### Use as CLI

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

### Use as MCP Server (for Claude, Cursor, VS Code, etc.)

The tool is packaged as an MCP server. Add it to your MCP configuration:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "openrouter-router": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/slaygent/src/mcp-server.ts"]
    }
  }
}
```

**VS Code / Cursor** (similar config):

```json
{
  "mcpServers": {
    "openrouter-router": {
      "command": "bun",
      "args": ["run", "${workspaceFolder}/slaygent/src/mcp-server.ts"]
    }
  }
}
```

**Restart your MCP host** (Claude Desktop, Cursor, VS Code) after adding the config.

### Available Tool

Once configured, the MCP host will expose the `get_router_recommendation` tool:

```json
{
  "name": "get_router_recommendation",
  "description": "Recommend the optimal OpenRouter router for a given task",
  "inputSchema": {
    "type": "object",
    "properties": {
      "task": { "type": "string" },
      "budget_per_request": { "type": "number" },
      "max_tokens": { "type": "number" },
      "session_id": { "type": "string" },
      "context_files": { "type": "array", "items": { "type": "string" } },
      "context_language": { "type": "string" },
      "context_framework": { "type": "string" },
      "context_project_type": { "type": "string" }
    },
    "required": ["task"]
  }
}
```

### Example Tool Call

```json
{
  "name": "get_router_recommendation",
  "arguments": {
    "task": "Fix the bug in this React component",
    "budget_per_request": 0.001,
    "context_framework": "react",
    "context_language": "typescript"
  }
}
```

**Returns:**
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
```

## Project Structure

```
slaygent/
├── index.ts              # CLI entrypoint
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

## License

MIT
