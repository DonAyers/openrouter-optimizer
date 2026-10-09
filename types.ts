export interface Model {
  id: string;
  name: string;
  canonical_slug: string;
  description: string;
  pricing: Pricing;
  context_length: number | null;
  architecture: ModelArchitecture;
  supported_parameters: string[];
}

export interface Pricing {
  prompt: string;
  completion: string;
  request?: string;
  image?: string;
  image_output?: string;
  input_cache_read?: string;
  input_cache_write?: string;
  web_search?: string;
  [key: string]: string | undefined;
}

export interface ModelArchitecture {
  input_modalities: string[];
  output_modalities: string[];
  modality: string;
}

export interface TaskClassification {
  type: TaskType;
  confidence: number;
  keywords: string[];
  requiresImageOutput: boolean;
  requiresImageInput: boolean;
  requiresFileInput: boolean;
  requiresTools: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
}

export type TaskType =
  | 'coding'
  | 'coding-agentic'
  | 'research'
  | 'creative'
  | 'vision-analysis'
  | 'image-generation'
  | 'image-editing'
  | 'general'
  | 'summarization'
  | 'unknown';

export interface RouterRecommendation {
  router: RouterType;
  model?: string;
  config?: Record<string, unknown>;
  reasoning: string;
  estimatedCostPerMillionTokens: number | null;
  estimatedCostPerRequest: number | null;
  confidence: number;
  alternatives: AlternativeRecommendation[];
}

export interface AlternativeRecommendation {
  router: RouterType;
  config: Record<string, unknown>;
  reasoning: string;
  estimatedCostPerMillionTokens: number | null;
}

export type RouterType =
  | 'auto'
  | 'jev'
  | 'pareto'
  | 'fusion'
  | 'fusion-flash'
  | 'free'
  | 'specific';

export interface RoutingRequest {
  task: string;
  budgetPerRequest?: number;
  maxTokens?: number;
  constraints?: RoutingConstraints;
  sessionId?: string;
  context?: TaskContext;
}

export interface TaskContext {
  /** Files being modified or referenced */
  files?: string[];
  /** Programming language (e.g., "typescript", "python") */
  language?: string;
  /** Framework or library (e.g., "react", "django", "express") */
  framework?: string;
  /** Project type (e.g., "web app", "api", "cli", "mobile") */
  projectType?: string;
  /** Relevant code snippet for deeper analysis */
  codeSnippet?: string;
}

export interface RoutingConstraints {
  freeOnly?: boolean;
  includeModels?: string[];
  excludeModels?: string[];
  minCodingScore?: number;
  preferSpeed?: boolean;
  preferQuality?: boolean;
  excludeImageModels?: boolean;
  excludeMultimodal?: boolean;
}

export interface DecisionLogEntry {
  decision_id: string;
  timestamp: string;
  task: string;
  task_type: TaskType;
  confidence: number;
  budget_constraint: number | null;
  max_tokens: number | null;
  chosen_model: string;
  chosen_config: Record<string, unknown>;
  estimated_cost_per_request: number | null;
  alternatives_considered: number;
  session_id?: string;
}

export interface ModelCache {
  models: Model[];
  fetchedAt: number;
  totalCount: number;
}

export interface RouterInfo {
  type: RouterType;
  name: string;
  description: string;
  bestFor: string[];
  costMultiplier: number;
  supportsBudgetConstraint: boolean;
  supportsModelConstraints: boolean;
  supportsSessionStickiness: boolean;
}

/**
 * Generic execution target (provider-agnostic).
 *
 * The concrete OpenRouter knowledge (router names, `min_coding_score`, model
 * pools) lives behind this contract so other providers can be siblings.
 */
export interface ExecutionTarget {
  /** The model or routing strategy to execute with */
  model: string;
  /** Provider-specific configuration */
  config: Record<string, unknown>;
  /** Estimated cost per request in dollars */
  estCost: number | null;
  /** Estimated cost per million tokens in dollars */
  estCostPerMillionTokens: number | null;
  /** Human-readable reasoning for the choice */
  reasoning: string;
  /** Confidence in the recommendation (0-1) */
  confidence: number;
  /** Alternative targets with tradeoffs */
  alternatives: ExecutionTarget[];
}

/**
 * Provider-agnostic contract for recommending an execution target.
 * Each provider (OpenRouter, Anthropic, etc.) implements this interface.
 */
export interface ExecutionTargetAdapter {
  recommend(classification: TaskClassification, request: RoutingRequest): ExecutionTarget;
}
