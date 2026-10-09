import type { 
  ExecutionTarget, 
  TaskClassification, 
  DecisionLogEntry,
} from './types';
import { getTaskTypeDescription } from './classifier';

function pad(str: string, len: number): string {
  return str.padEnd(len).slice(0, len);
}

function formatCost(cost: number | null, isPerRequest = false): string {
  if (cost === null) return 'variable';
  if (cost === 0) return '$0 (free!)';
  if (isPerRequest) {
    if (cost < 0.0001) return `$${(cost * 1000000).toFixed(0)}/M tokens (est.)`;
    return `$${cost.toFixed(4)} per request (est.)`;
  }
  if (cost < 0.001) return `$${(cost * 1000000).toFixed(0)}/M tokens`;
  return `$${cost.toFixed(4)}`;
}

export interface OutputFormat {
  json: boolean;
  verbose: boolean;
  quiet: boolean;
}

export function formatRecommendation(
  target: ExecutionTarget,
  classification: TaskClassification,
  task: string,
  format: OutputFormat = { json: false, verbose: true, quiet: false }
): string | object {
  if (format.json) {
    return JSON.stringify({
      decision_id: generateDecisionId(),
      timestamp: new Date().toISOString(),
      task,
      task_type: classification.type,
      task_description: getTaskTypeDescription(classification.type),
      confidence: classification.confidence,
      complexity: classification.complexity,
      required_capabilities: {
        image_output: classification.requiresImageOutput,
        image_input: classification.requiresImageInput,
        file_input: classification.requiresFileInput,
        tools: classification.requiresTools,
      },
      recommendation: {
        model: target.model,
        config: target.config,
        reasoning: target.reasoning,
        estimated_cost_per_million_tokens: target.estCostPerMillionTokens,
        estimated_cost_per_request: target.estCost,
        confidence: target.confidence,
      },
      alternatives: target.alternatives.map((alt, i) => ({
        rank: i + 1,
        model: alt.model,
        config: alt.config,
        reasoning: alt.reasoning,
        estimated_cost_per_million_tokens: alt.estCostPerMillionTokens,
      })),
      // For logging/learning
      log_entry: {
        decision_id: generateDecisionId(),
        timestamp: new Date().toISOString(),
        task,
        task_type: classification.type,
        confidence: classification.confidence,
        budget_constraint: null, // Would be passed separately
        max_tokens: null, // Would be passed separately
        chosen_model: target.model,
        chosen_config: target.config,
        estimated_cost_per_request: target.estCost,
        alternatives_considered: target.alternatives.length,
      }
    }, null, 2);
  }

  // Human-readable format
  const lines: string[] = [];
  
  if (!format.quiet) {
    lines.push('═'.repeat(70));
    lines.push('  OPENROUTER ROUTING RECOMMENDATION');
    lines.push('═'.repeat(70));
    lines.push('');
    lines.push(`  Task: ${task}`);
    lines.push(`  Type: ${classification.type} (${getTaskTypeDescription(classification.type)})`);
    lines.push(`  Complexity: ${classification.complexity}`);
    lines.push(`  Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
    lines.push('');
  }

  // Main recommendation
  lines.push('─'.repeat(70));
  lines.push(`  RECOMMENDED TARGET`);
  lines.push('─'.repeat(70));
  lines.push('');
  lines.push(`  ${target.model}`);
  lines.push('');

  if (target.config && Object.keys(target.config).length > 0) {
    lines.push('  Config:');
    for (const [key, value] of Object.entries(target.config)) {
      lines.push(`    ${key}: ${JSON.stringify(value)}`);
    }
    lines.push('');
  }

  lines.push(`  Reasoning: ${target.reasoning}`);
  lines.push('');
  
  if (target.estCostPerMillionTokens !== null) {
    lines.push(`  Estimated Cost:`);
    lines.push(`    Per million tokens: ${formatCost(target.estCostPerMillionTokens)}`);
    lines.push(`    Per request (est.): ${formatCost(target.estCost, true)}`);
    lines.push('');
  }

  // Alternatives
  if (format.verbose && target.alternatives.length > 0) {
    lines.push('─'.repeat(70));
    lines.push(`  ALTERNATIVES (${target.alternatives.length})`);
    lines.push('─'.repeat(70));
    lines.push('');

    for (let i = 0; i < target.alternatives.length; i++) {
      const alt = target.alternatives[i]!;
      
      lines.push(`  ${i + 1}. ${alt.model}`);
      lines.push(`     ${alt.reasoning}`);
      
      if (alt.estCostPerMillionTokens !== null) {
        lines.push(`     Cost: ${formatCost(alt.estCostPerMillionTokens)}/M tokens`);
      }
      
      if (alt.config && Object.keys(alt.config).length > 0) {
        lines.push('     Config:');
        for (const [key, value] of Object.entries(alt.config)) {
          lines.push(`       ${key}: ${JSON.stringify(value)}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('═'.repeat(70));

  return lines.join('\n');
}

export function formatUsageGuide(): string {
  return `
╔══════════════════════════════════════════════════════════════════════╗
║                        ROUTER RECOMMENDATION TOOL                    ║
╚══════════════════════════════════════════════════════════════════════╝

USAGE:
  bun run index.ts --task "your task here" [options]

OPTIONS:
  --task, -t        Task description (required)
  --budget, -b      Budget per request in dollars (e.g., 0.01)
  --max-tokens, -m  Maximum tokens per request (estimated)
  --session, -s     Session ID for multi-turn conversations
  --free-only       Only recommend free models
  --include         Comma-separated list of model patterns to include
  --exclude         Comma-separated list of model patterns to exclude
  --min-coding      Minimum coding score (0-1) for Pareto Router
  --context-files   Comma-separated list of files being modified
  --context-language Programming language (e.g., typescript, python)
  --context-framework Framework/library (e.g., react, django)
  --context-project Project type (e.g., web app, api, cli)
  --json            Output JSON for agent consumption
  --quiet, -q       Minimal output (just the recommendation)
  --help, -h        Show this help

CONTEXT (optional - refines recommendations):
  Context fields help the tool make better recommendations when the
  task description is ambiguous. They are only used if they provide
  NEW signal - redundant info (already in task) is ignored.
  Example: --context-framework react adds signal if "React" isn't
  already mentioned in the task.

EXAMPLES:
  # Simple coding task
  bun run index.ts --task "Fix the bug in this React component"

  # With budget constraint
  bun run index.ts --task "Write a Python API endpoint" --budget 0.001

  # Free only
  bun run index.ts --task "Summarize this" --free-only

  # With context (explicit framework when not in task)
  bun run index.ts --task "Fix the authentication bug" \\
      --context-framework express --context-language typescript

  # Agent-ready JSON output
  bun run index.ts --task "Research quantum computing" --json

ROUTERS AVAILABLE:
  auto          - Auto Router: classifier-based, best for general tasks
  jev           - Jev Router: decision model, best for budget control
  pareto        - Pareto Router: coding-optimized, best for code tasks
  fusion        - Fusion Router: multi-model deliberation, best for research
  fusion-flash  - Fusion Flash: faster deliberation for agentic turns
  free          - Free Models Router: zero-cost routing
  specific      - Direct model selection (for image/vision tasks)

  FOR AGENTS:
  Use --json flag to get machine-readable output.
  The JSON includes a log_entry field for tracking decisions.

  FOR LEARNING (phase 2):
  Decisions are logged to ./decisions-log.jsonl for future optimization.
`;
}

export function generateDecisionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `dec_${timestamp}_${random}`;
}

export async function logDecision(entry: DecisionLogEntry): Promise<void> {
  const logFile = './decisions-log.jsonl';
  const line = JSON.stringify(entry) + '\n';
  
  try {
    const file = Bun.file(logFile);
    const exists = await file.exists();
    
    if (exists) {
      const existing = await file.text();
      await file.write(existing + line);
    } else {
      await file.write(line);
    }
  } catch (e) {
    // Silently fail - logging shouldn't break the tool
    console.error('Failed to log decision:', e);
  }
}
