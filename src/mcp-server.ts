#!/usr/bin/env bun
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { classifyTask, getTaskTypeDescription } from '../classifier';
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

// Tool: Interactive Architect (Clarification-First Meta-Prompt)
server.registerTool(
  'interactive_architect',
  {
    description: `Act as an Expert Agent Architect to transform a raw, unstructured request into a rigorous, deterministic agent specification.

PHASE 1: The Interview
Before writing any specs, analyze the raw request and ask 3 to 5 highly targeted clarifying questions. Focus on:
- Ambiguity: What edge cases or failure states need to be handled?
- I/O Constraints: What exact input format will the agent receive, and what strict output structure must it return?
- Tooling/Context: What external tools, API access, or specific codebase context will the agent have available?

PHASE 2: The Spec Generation
Once questions are answered, generate the final Agent Spec with:
- Role & Objective
- Core Directives
- Execution Workflow
- Handling Edge Cases
- Output Format

Returns a JSON envelope with:
- ok: true/false
- result: interview questions (Phase 1) or final spec (Phase 2)
- next_actions: what to do next (answer questions, generate spec)
- fix: if error occurred

Use this tool when you need to bridge the gap between a human ramble and a rigorous agent specification.`,
    inputSchema: z.object({
      raw_request: z.string().min(1).describe('The raw, unstructured request from the user'),
      phase: z.enum(['interview', 'spec']).optional().describe('Current phase: interview (ask questions) or spec (generate spec)'),
      answers: z.record(z.string(), z.string()).optional().describe('Answers to previous clarifying questions'),
    }),
  },
  async (params) => {
    // Phase 1: Interview - ask clarifying questions
    if (params.phase === 'interview' || !params.phase) {
      const questions = [
        "What are the specific edge cases or failure states that need to be handled in this task?",
        "What is the exact input format the agent will receive, and what strict output structure (e.g., JSON schema, Markdown, code blocks) must it return?",
        "What external tools, API access, or specific codebase context will the agent have available?",
        "Are there any constraints on the agent's behavior (e.g., must not access certain APIs, must follow specific patterns)?",
        "What is the expected success criteria for this agent? How will we know it's working correctly?"
      ];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: true,
              command: 'interactive_architect',
              result: {
                phase: 'interview',
                questions: questions,
                raw_request: params.raw_request,
              },
              next_actions: [
                {
                  command: 'interactive_architect --phase spec --answers <answers>',
                  description: 'Generate the final agent spec after answering questions',
                  params: {
                    answers: {
                      description: 'Answers to the clarifying questions',
                      value: '{}',
                      required: true,
                    },
                  },
                },
              ],
            }, null, 2),
          }],
      };
    }

    // Phase 2: Spec Generation - generate the final agent spec
    if (params.phase === 'spec') {
      const spec = {
        role_and_objective: `Transform the raw request into a rigorous, deterministic agent specification.`,
        core_directives: [
          "Must not generate any output until all clarifying questions are answered.",
          "Must follow the exact output format specified in the requirements.",
          "Must handle edge cases as specified in the answers.",
          "Must not access any tools or APIs not explicitly mentioned in the context.",
        ],
        execution_workflow: [
          "Analyze the raw request to identify key requirements.",
          "Ask clarifying questions to resolve ambiguity.",
          "Generate the final agent spec based on the answers.",
          "Return the spec in the exact format required.",
        ],
        handling_edge_cases: "If any required information is missing, return an error with a fix suggestion.",
        output_format: `{
  "role_and_objective": "string",
  "core_directives": ["string"],
  "execution_workflow": ["string"],
  "handling_edge_cases": "string",
  "output_format": "string"
}`,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: true,
              command: 'interactive_architect',
              result: {
                phase: 'spec',
                spec: spec,
                raw_request: params.raw_request,
                answers: params.answers || {},
              },
              next_actions: [],
            }, null, 2),
          }],
      };
    }

    // Error case
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ok: false,
            command: 'interactive_architect',
            error: {
              message: 'Invalid phase specified. Must be "interview" or "spec".',
              code: 'INVALID_PHASE',
            },
            fix: 'Specify the phase as "interview" to ask clarifying questions or "spec" to generate the final agent spec.',
            next_actions: [
              {
                command: 'interactive_architect --phase interview --raw_request <request>',
                description: 'Start the interview phase to ask clarifying questions',
                params: {
                  raw_request: {
                    description: 'The raw, unstructured request from the user',
                    value: params.raw_request,
                    required: true,
                  },
                },
              },
            ],
          }, null, 2),
        }],
      };
  }
);

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