#!/usr/bin/env bun
import { resolve } from 'path';
import { getModels } from './model-cache';
import { classifyTask, getTaskTypeDescription } from './classifier';
import { generateCurlExample } from './router-recommender';
import { openrouterAdapter } from './openrouter-adapter';
import { 
  formatRecommendation, 
  formatUsageGuide, 
  logDecision,
  generateDecisionId
} from './output';
import type { 
  TaskClassification, 
  RoutingRequest, 
  RoutingConstraints,
  DecisionLogEntry,
  TaskContext
} from './types';

// CLI argument parsing
interface ParsedArgs {
  task: string | null;
  budget: number | null;
  maxTokens: number | null;
  sessionId: string | null;
  freeOnly: boolean;
  includeModels: string[] | null;
  excludeModels: string[] | null;
  minCodingScore: number | null;
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  help: boolean;
  // Context fields
  contextFiles: string[] | null;
  contextLanguage: string | null;
  contextFramework: string | null;
  contextProjectType: string | null;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    task: null,
    budget: null,
    maxTokens: null,
    sessionId: null,
    freeOnly: false,
    includeModels: null,
    excludeModels: null,
    minCodingScore: null,
    json: false,
    quiet: false,
    verbose: true,
    help: false,
    // Context fields
    contextFiles: null,
    contextLanguage: null,
    contextFramework: null,
    contextProjectType: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--task':
      case '-t':
        result.task = args[++i] || null;
        break;
      case '--budget':
      case '-b':
        result.budget = parseFloat(args[++i] || '0');
        break;
      case '--max-tokens':
      case '-m':
        result.maxTokens = parseInt(args[++i] || '0');
        break;
      case '--session':
      case '-s':
        result.sessionId = args[++i] || null;
        break;
      case '--free-only':
        result.freeOnly = true;
        break;
      case '--include':
        result.includeModels = args[++i]?.split(',') || null;
        break;
      case '--exclude':
        result.excludeModels = args[++i]?.split(',') || null;
        break;
      case '--min-coding':
        result.minCodingScore = parseFloat(args[++i] || '0.66');
        break;
      case '--context-files':
        result.contextFiles = args[++i]?.split(',') || null;
        break;
      case '--context-language':
        result.contextLanguage = args[++i] || null;
        break;
      case '--context-framework':
        result.contextFramework = args[++i] || null;
        break;
      case '--context-project':
        result.contextProjectType = args[++i] || null;
        break;
      case '--json':
        result.json = true;
        break;
      case '--quiet':
      case '-q':
        result.quiet = true;
        result.verbose = false;
        break;
      case '--verbose':
      case '-v':
        result.verbose = true;
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
    }
  }

  return result;
}

function buildConstraints(args: ParsedArgs): RoutingConstraints {
  const constraints: RoutingConstraints = {};

  if (args.freeOnly) constraints.freeOnly = true;
  if (args.includeModels) constraints.includeModels = args.includeModels;
  if (args.excludeModels) constraints.excludeModels = args.excludeModels;
  if (args.minCodingScore !== null) constraints.minCodingScore = args.minCodingScore;

  return constraints;
}

function buildRequest(args: ParsedArgs): RoutingRequest {
  return {
    task: args.task || '',
    budgetPerRequest: args.budget ?? undefined,
    maxTokens: args.maxTokens ?? undefined,
    sessionId: args.sessionId ?? undefined,
    constraints: buildConstraints(args),
    context: buildContext(args),
  };
}

function buildContext(args: ParsedArgs): TaskContext | undefined {
  if (!args.contextFiles && !args.contextLanguage && !args.contextFramework && !args.contextProjectType) {
    return undefined;
  }
  return {
    files: args.contextFiles ?? undefined,
    language: args.contextLanguage ?? undefined,
    framework: args.contextFramework ?? undefined,
    projectType: args.contextProjectType ?? undefined,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // If first arg is "setup", delegate to setup.ts
  if (process.argv[2] === 'setup') {
    const { spawn } = await import('child_process');
    const setupArgs = process.argv.slice(2);
    const setup = spawn('bun', ['run', resolve(__dirname, 'setup.ts'), ...setupArgs], {
      stdio: 'inherit',
    });
    await new Promise((resolve) => setup.on('close', resolve));
    return;
  }

  // Show help
  if (args.help) {
    console.log(formatUsageGuide());
    process.exit(0);
  }

  if (!args.task) {
    console.log(formatUsageGuide());
    console.error('\nError: --task is required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  if (!args.json) {
    console.log('Analyzing task and recommending optimal OpenRouter router...');
    console.log('');
  }

  try {
    // Get models (with caching)
    const modelCache = await getModels();
    
    // Classify task (with optional context)
    const context = buildContext(args);
    const classification = classifyTask(args.task, {}, context);
    if (!args.json) {
      console.log(`Task classified as: ${classification.type} (${(classification.confidence * 100).toFixed(0)}% confidence)`);
      console.log(`Complexity: ${classification.complexity}`);
      if (classification.keywords.length > 0) {
        console.log(`Signals: ${classification.keywords.join(', ')}`);
      }
      console.log('');
    }

    // Build request and constraints
    const request = buildRequest(args);
    const constraints = buildConstraints(args);

    // Get recommendation via the generic adapter
    const target = openrouterAdapter.recommend(classification, request);

    // Format and output
    const format = {
      json: args.json,
      verbose: args.verbose,
      quiet: args.quiet,
    };

    const output = formatRecommendation(target, classification, args.task, format);
    
    if (args.json) {
      console.log(output);
    } else {
      console.log(output);
    }

    // Log decision for future learning
    const logEntry: DecisionLogEntry = {
      decision_id: generateDecisionId(),
      timestamp: new Date().toISOString(),
      task: args.task,
      task_type: classification.type,
      confidence: classification.confidence,
      budget_constraint: args.budget ?? null,
      max_tokens: args.maxTokens ?? null,
      chosen_model: target.model,
      chosen_config: target.config,
      estimated_cost_per_request: target.estCost,
      alternatives_considered: target.alternatives.length,
      session_id: args.sessionId ?? undefined,
    };

    await logDecision(logEntry);
    
    // Show curl example in non-json mode
    if (!args.json && !args.quiet) {
      console.log('');
      console.log('─'.repeat(70));
      console.log('  CURL EXAMPLE (ready to run):');
      console.log('─'.repeat(70));
      console.log('');
      console.log(generateCurlExample(target.model, target.config, args.task));
      console.log('');
      console.log('─'.repeat(70));
      console.log('');
      console.log('For agentic use: run with --json flag for machine-readable output.');
      console.log('Decisions are logged to ./decisions-log.jsonl for future optimization.');
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
