import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { classifyTask } from '../classifier';
import { recommendRouter } from '../router-recommender';
import { TaskContext } from '../types';
import { getModels } from '../model-cache';

// Initialize MCP server
const server = new McpServer({
  name: 'openrouter-router',
  version: '1.0.0',
});

// Tool: Get router recommendation
server.registerTool(
  'get_router_recommendation',
  {
    description: `Recommend the optimal OpenRouter router for a given task.

Use this tool when you need to determine which OpenRouter router (auto, jev, pareto, fusion, etc.)
is best suited for a task, along with the appropriate configuration and budget-aware settings.

The tool analyzes the task description and optional context (framework, language, files) to:
- Classify the task type (coding, research, vision, image-gen, etc.)
- Recommend the best router for that task type
- Provide budget-aware configuration (min_coding_score, model pools, etc.)
- Return ready-to-use configuration for the OpenRouter API

Returns a recommendation with:
- recommended_router: The router to use
- config: The configuration to pass to OpenRouter
- reasoning: Why this router was chosen
- alternatives: Other viable options with their tradeoffs
- curl_example: Ready-to-run curl command (for debugging)`,
    inputSchema: z.object({
      task: z
        .string()
        .min(1)
        .describe('Description of the task to be performed (e.g., "Fix the bug in this React component", "Research quantum computing developments")'),
      budget_per_request: z
        .number()
        .min(0)
        .optional()
        .describe('Maximum budget per request in dollars. Use 0 for free-only recommendations. Defaults to no limit.'),
      max_tokens: z
        .number()
        .min(1)
        .optional()
        .describe('Estimated maximum tokens per request. Used to estimate costs.'),
      session_id: z
        .string()
        .optional()
        .describe('Session ID for multi-turn conversations. Enables session stickiness for cache efficiency.'),
      context_files: z
        .array(z.string())
        .optional()
        .describe('List of files being modified or referenced (e.g., ["src/auth.ts", "package.json"])'),
      context_language: z
        .string()
        .optional()
        .describe('Programming language (e.g., "typescript", "python", "rust")'),
      context_framework: z
        .string()
        .optional()
        .describe('Framework or library (e.g., "react", "express", "django")'),
      context_project_type: z
        .string()
        .optional()
        .describe('Project type (e.g., "web app", "api", "cli", "mobile")'),
    }),
  },
  async (params) => {
    // Build context from params
    const context: TaskContext = {
      files: params.context_files,
      language: params.context_language,
      framework: params.context_framework,
      projectType: params.context_project_type,
    };

    // Classify task with context
    const classification = classifyTask(params.task, {}, context);

    // Build request
    const request = {
      task: params.task,
      budgetPerRequest: params.budget_per_request ?? undefined,
      maxTokens: params.max_tokens ?? undefined,
      sessionId: params.session_id ?? undefined,
      context,
    };

    // Get recommendation
    const recommendation = recommendRouter(classification, request, {});

    // Return structured result
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            task: params.task,
            task_type: classification.type,
            task_description: getTaskTypeDescription(classification.type),
            confidence: classification.confidence,
            complexity: classification.complexity,
            recommended_router: recommendation.router,
            config: recommendation.config,
            reasoning: recommendation.reasoning,
            estimated_cost_per_million_tokens: recommendation.estimatedCostPerMillionTokens,
            estimated_cost_per_request: recommendation.estimatedCostPerRequest,
            alternatives: recommendation.alternatives.map((alt, i) => ({
              rank: i + 1,
              router: alt.router,
              config: alt.config,
              reasoning: alt.reasoning,
              estimated_cost_per_million_tokens: alt.estimatedCostPerMillionTokens,
            })),
          }, null, 2),
        }],
    };
  }
);

// Helper: get task type description
function getTaskTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    coding: 'Writing, fixing, or modifying code',
    'coding-agentic': 'Multi-step coding tasks requiring tool use or autonomous behavior',
    research: 'Information gathering, analysis, and synthesis',
    creative: 'Design, writing, or creative content generation',
    'vision-analysis': 'Analyzing or extracting information from images',
    'image-generation': 'Creating new images from text prompts',
    'image-editing': 'Modifying or manipulating existing images',
    summarization: 'Summarizing or condensing information',
    general: 'General purpose tasks not fitting other categories',
    unknown: 'Unable to classify',
  };
  return descriptions[type] || descriptions.general;
}

// Main: Run the MCP server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr, not stdout!
  console.error('OpenRouter Router MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
