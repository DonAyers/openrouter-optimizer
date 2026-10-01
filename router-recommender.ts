import { 
  TaskClassification, 
  RouterRecommendation, 
  AlternativeRecommendation,
  RouterType,
  RoutingRequest,
  RoutingConstraints,
  RouterInfo
} from './types';

const ROUTER_INFOS: Record<RouterType, RouterInfo> = {
  auto: {
    type: 'auto',
    name: 'Auto Router',
    description: 'Classifier-based routing - picks best model for any task',
    bestFor: ['general', 'unknown'],
    costMultiplier: 1,
    supportsBudgetConstraint: false,
    supportsModelConstraints: true,
    supportsSessionStickiness: true,
  },
  jev: {
    type: 'jev',
    name: 'Jev Router',
    description: 'Decision model picks model + reasoning effort from your pool',
    bestFor: ['coding', 'coding-agentic', 'general', 'research'],
    costMultiplier: 1,
    supportsBudgetConstraint: true,
    supportsModelConstraints: true,
    supportsSessionStickiness: true,
  },
  pareto: {
    type: 'pareto',
    name: 'Pareto Router',
    description: 'Coding-optimized - picks cheapest model above min coding score',
    bestFor: ['coding', 'coding-agentic'],
    costMultiplier: 1,
    supportsBudgetConstraint: true,
    supportsModelConstraints: false,
    supportsSessionStickiness: true,
  },
  fusion: {
    type: 'fusion',
    name: 'Fusion Router',
    description: 'Multi-model deliberation panel + analyst',
    bestFor: ['research', 'complex'],
    costMultiplier: 4.5,
    supportsBudgetConstraint: false,
    supportsModelConstraints: true,
    supportsSessionStickiness: true,
  },
  'fusion-flash': {
    type: 'fusion-flash',
    name: 'Fusion Flash Router',
    description: 'Fast multi-model deliberation with latency-homogeneous panel',
    bestFor: ['research', 'complex'],
    costMultiplier: 3.5,
    supportsBudgetConstraint: false,
    supportsModelConstraints: true,
    supportsSessionStickiness: true,
  },
  free: {
    type: 'free',
    name: 'Free Models Router',
    description: 'Zero-cost routing to available free models',
    bestFor: ['all'],
    costMultiplier: 0,
    supportsBudgetConstraint: true,
    supportsModelConstraints: false,
    supportsSessionStickiness: false,
  },
  specific: {
    type: 'specific',
    name: 'Specific Model',
    description: 'Direct model selection',
    bestFor: ['image-generation', 'image-editing', 'vision-analysis'],
    costMultiplier: 1,
    supportsBudgetConstraint: false,
    supportsModelConstraints: false,
    supportsSessionStickiness: true,
  },
};

function estimateCostForRouter(
  router: RouterType,
  taskType: string,
  budgetPerRequest: number | undefined,
  complexity: string
): { costPerMillion: number | null; costPerRequest: number | null } {
  // These are rough estimates based on typical model pricing
  // In production, you'd calculate from actual model data
  
  switch (router) {
    case 'free':
      return { costPerMillion: 0, costPerRequest: 0 };
    
    case 'pareto': {
      // Pareto picks cheapest in tier
      const score = budgetPerRequest ? 0.33 : 0.66; // Lower score if budget constrained
      // Estimate: $0.50-$2/M tokens for coding models at medium tier
      const costPerM = budgetPerRequest ? 0.5 : 1.5;
      const estTokens = 10000; // rough estimate
      return { 
        costPerMillion: costPerM, 
        costPerRequest: (costPerM / 1000000) * estTokens 
      };
    }
    
    case 'jev': {
      // Jev picks from pool - cost varies by pool
      // With constrained pool (cheap models): ~$0.20-$1/M
      // With full pool: ~$0.50-$3/M
      const costPerM = budgetPerRequest ? 0.3 : 1.0;
      const estTokens = 10000;
      return { 
        costPerMillion: costPerM, 
        costPerRequest: (costPerM / 1000000) * estTokens 
      };
    }
    
    case 'auto':
    case 'specific':
      // Auto/specific: varies widely
      return { costPerMillion: null, costPerRequest: null };
    
    case 'fusion':
    case 'fusion-flash': {
      // Fusion: 3-5x single request cost
      const baseCostPerM = 2.0; // typical for panel models
      const multiplier = router === 'fusion-flash' ? 3.5 : 4.5;
      return { 
        costPerMillion: baseCostPerM * multiplier,
        costPerRequest: (baseCostPerM / 1000000) * 10000 * multiplier 
      };
    }
    
    default:
      return { costPerMillion: null, costPerRequest: null };
  }
}

function getCodingScoreForBudget(budgetPerRequest: number | undefined): number {
  if (budgetPerRequest === undefined) return 0.66; // Default: high tier
  
  if (budgetPerRequest === 0) return 0.33; // Free/cheap tier
  
  // Rough mapping: budget → coding score
  if (budgetPerRequest < 0.0001) return 0.33;   // Very tight: medium tier
  if (budgetPerRequest < 0.001) return 0.5;    // Tight: upper-medium
  if (budgetPerRequest < 0.01) return 0.66;    // Moderate: high tier
  return 0.8; // Generous: top tier
}

function getRecommendedJevPool(
  taskType: string,
  budgetPerRequest: number | undefined,
  constraints: RoutingConstraints
): { models: string[]; reasoning: string } {
  if (budgetPerRequest === 0 || constraints.freeOnly) {
    return {
      models: ['qwen/*', 'deepseek/*', 'google/*', 'mistral/*', 'meta/*', 'nvidia/*'],
      reasoning: 'Budget-constrained: pool includes free-friendly model families'
    };
  }
  
  if (taskType === 'coding' || taskType === 'coding-agentic') {
    return {
      models: ['openai/*', 'anthropic/*', 'deepseek/*', 'google/*', 'qwen/*', 'codestral/*'],
      reasoning: 'Coding task: include strong coding models'
    };
  }
  
  // General/research: broad pool
  return {
    models: ['anthropic/*', 'openai/*', 'google/*', 'deepseek/*', 'qwen/*', 'mistral/*'],
    reasoning: 'General task: broad pool of capable models'
  };
}

export function recommendRouter(
  classification: TaskClassification,
  request: RoutingRequest,
  constraints: RoutingConstraints = {}
): RouterRecommendation {
  const { task, budgetPerRequest, maxTokens, sessionId, constraints: reqConstraints } = request;
  const mergedConstraints = { ...constraints, ...reqConstraints };
  
  const taskType = classification.type;
  const complexity = classification.complexity;
  const confidence = classification.confidence;
  
  // For image tasks, we need specific models (routers don't handle image gen well yet)
  if (taskType === 'image-generation' || taskType === 'image-editing') {
    return buildSpecificModelRecommendation(taskType, budgetPerRequest);
  }
  
  // Vision analysis - need multimodal model
  if (taskType === 'vision-analysis') {
    return buildVisionRecommendation(budgetPerRequest, mergedConstraints);
  }
  
  // Coding tasks → Pareto or Jev
  if (taskType === 'coding' || taskType === 'coding-agentic') {
    return buildCodingRecommendation(
      taskType, 
      budgetPerRequest, 
      complexity,
      mergedConstraints,
      request.sessionId
    );
  }
  
  // Research / complex → Fusion (if budget allows) or Jev
  if (taskType === 'research' || complexity === 'complex') {
    return buildResearchRecommendation(
      budgetPerRequest, 
      complexity,
      mergedConstraints
    );
  }
  
  // Creative / general → Auto or Jev
  return buildGeneralRecommendation(
    budgetPerRequest,
    mergedConstraints
  );
}

function buildSpecificModelRecommendation(
  taskType: string,
  budgetPerRequest: number | undefined
): RouterRecommendation {
  // For image tasks, recommend specific image models
  const alternatives: AlternativeRecommendation[] = [
    {
      router: 'specific',
      config: { model: 'google/gemini-3.1-flash-lite-image' },
      reasoning: 'Cheapest image model, good for quick generations',
      estimatedCostPerMillionTokens: 2,
    },
    {
      router: 'specific',
      config: { model: 'google/gemini-2.5-flash-image' },
      reasoning: 'Mid-tier image model, Nano Banana',
      estimatedCostPerMillionTokens: 3,
    },
    {
      router: 'specific',
      config: { model: 'openai/gpt-5-image-mini' },
      reasoning: 'OpenAI image model with file input support',
      estimatedCostPerMillionTokens: 5,
    },
  ];

  return {
    router: 'specific',
    model: budgetPerRequest === 0 ? 'google/gemini-3.1-flash-lite-image' 
                                   : 'google/gemini-3.1-flash-image',
    config: { 
      model: budgetPerRequest === 0 ? 'google/gemini-3.1-flash-lite-image' 
                                     : 'google/gemini-3.1-flash-image' 
    },
    reasoning: budgetPerRequest === 0 
      ? 'Image generation with zero budget → free image model'
      : 'Image generation → dedicated image model (Gemini or GPT-Image)',
    estimatedCostPerMillionTokens: budgetPerRequest === 0 ? 0 : 3,
    estimatedCostPerRequest: budgetPerRequest === 0 ? 0 : 0.03,
    confidence: 0.85,
    alternatives,
  };
}

function buildVisionRecommendation(
  budgetPerRequest: number | undefined,
  constraints: RoutingConstraints
): RouterRecommendation {
  const alternatives: AlternativeRecommendation[] = [
    {
      router: 'jev',
      config: { 
        models: ['qwen/*', 'deepseek/*', 'google/*', 'anthropic/*'],
        excluded_models: ['anthropic/claude-opus*']
      },
      reasoning: 'Jev with constrained pool of multimodal models',
      estimatedCostPerMillionTokens: 1.5,
    },
    {
      router: 'auto',
      config: {},
      reasoning: 'Auto Router - will pick best multimodal model',
      estimatedCostPerMillionTokens: null,
    },
    {
      router: 'specific',
      config: { model: 'qwen/qwen3.8-27b:free' },
      reasoning: 'Free vision-capable model with large context',
      estimatedCostPerMillionTokens: 0,
    },
  ];

  return {
    router: budgetPerRequest === 0 ? 'specific' : 'jev',
    model: budgetPerRequest === 0 ? 'qwen/qwen3.8-27b:free' : undefined,
    config: budgetPerRequest === 0 
      ? { model: 'qwen/qwen3.8-27b:free' }
      : { 
          models: ['qwen/*', 'deepseek/*', 'google/*', 'anthropic/*'],
          excluded_models: ['anthropic/claude-opus*']
        },
    reasoning: budgetPerRequest === 0
      ? 'Vision analysis with zero budget → free multimodal model'
      : 'Vision analysis → Jev Router with multimodal model pool',
    estimatedCostPerMillionTokens: budgetPerRequest === 0 ? 0 : 1.5,
    estimatedCostPerRequest: budgetPerRequest === 0 ? 0 : 0.015,
    confidence: 0.8,
    alternatives,
  };
}

function buildCodingRecommendation(
  taskType: string,
  budgetPerRequest: number | undefined,
  complexity: string,
  constraints: RoutingConstraints,
  sessionId?: string
): RouterRecommendation {
  const minCodingScore = getCodingScoreForBudget(budgetPerRequest);
  
  const alternatives: AlternativeRecommendation[] = [
    {
      router: 'jev',
      config: { 
        models: ['openai/*', 'anthropic/*', 'deepseek/*', 'google/*', 'qwen/*'],
        excluded_models: ['anthropic/claude-opus*']
      },
      reasoning: 'Jev Router for coding - picks from pool based on task difficulty',
      estimatedCostPerMillionTokens: 1.5,
    },
    {
      router: 'auto',
      config: {},
      reasoning: 'Auto Router for general coding tasks',
      estimatedCostPerMillionTokens: null,
    },
  ];

  if (taskType === 'coding-agentic') {
    alternatives.push({
      router: 'fusion',
      config: {},
      reasoning: 'Agentic coding may benefit from multi-model deliberation',
      estimatedCostPerMillionTokens: 9,
    });
  }

  const reasoning = complexity === 'simple'
    ? `Simple coding task with ${budgetPerRequest === 0 ? 'no' : ''}budget → Pareto Router at ${minCodingScore.toFixed(2)} coding score`
    : `Complex coding task → Pareto Router at ${minCodingScore.toFixed(2)} coding score (or Jev for more control)`;

  return {
    router: 'pareto',
    config: { 
      minCodingScore,
      ...(sessionId ? { sessionId } : {}),
    },
    reasoning,
    estimatedCostPerMillionTokens: minCodingScore < 0.5 ? 0.5 : 2.0,
    estimatedCostPerRequest: minCodingScore < 0.5 ? 0.0005 : 0.002,
    confidence: 0.9,
    alternatives,
  };
}

function buildResearchRecommendation(
  budgetPerRequest: number | undefined,
  complexity: string,
  constraints: RoutingConstraints
): RouterRecommendation {
  const useFusion = budgetPerRequest !== undefined && budgetPerRequest > 0.01;
  
  const alternatives: AlternativeRecommendation[] = [
    {
      router: 'jev',
      config: { 
        models: ['anthropic/*', 'openai/*', 'google/*', 'deepseek/*'],
        excluded_models: ['anthropic/claude-opus*']
      },
      reasoning: 'Jev Router for research - picks model based on task difficulty',
      estimatedCostPerMillionTokens: 2,
    },
    {
      router: 'auto',
      config: {},
      reasoning: 'Auto Router for general research tasks',
      estimatedCostPerMillionTokens: null,
    },
  ];

  if (useFusion) {
    alternatives.push({
      router: 'fusion-flash',
      config: {},
      reasoning: 'Fusion Flash for faster research with multi-model input',
      estimatedCostPerMillionTokens: 7,
    });
  }

  const reasoning = useFusion
    ? 'Research task with adequate budget → Fusion Router for multi-perspective analysis'
    : 'Research task → Jev Router (Fusion requires higher budget for cost efficiency)';

  return {
    router: useFusion ? 'fusion-flash' : 'jev',
    config: useFusion ? {} : {
      models: ['anthropic/*', 'openai/*', 'google/*', 'deepseek/*'],
      excluded_models: ['anthropic/claude-opus*']
    },
    reasoning,
    estimatedCostPerMillionTokens: useFusion ? 7 : 2,
    estimatedCostPerRequest: useFusion ? 0.07 : 0.02,
    confidence: 0.75,
    alternatives,
  };
}

function buildGeneralRecommendation(
  budgetPerRequest: number | undefined,
  constraints: RoutingConstraints
): RouterRecommendation {
  const alternatives: AlternativeRecommendation[] = [
    {
      router: 'auto',
      config: {},
      reasoning: 'Auto Router - best general-purpose model selection',
      estimatedCostPerMillionTokens: null,
    },
    {
      router: 'jev',
      config: { 
        models: ['anthropic/*', 'openai/*', 'google/*', 'deepseek/*', 'qwen/*'],
        excluded_models: ['anthropic/claude-opus*']
      },
      reasoning: 'Jev Router for general tasks with model pool control',
      estimatedCostPerMillionTokens: 1.5,
    },
  ];

  if (budgetPerRequest === 0 || constraints.freeOnly) {
    alternatives.push({
      router: 'free',
      config: {},
      reasoning: 'Zero budget → Free Models Router',
      estimatedCostPerMillionTokens: 0,
    });
  }

  const reasoning = budgetPerRequest === 0 || constraints.freeOnly
    ? 'General task with no budget → Free Models Router'
    : 'General task → Auto Router for best model selection';

  return {
    router: budgetPerRequest === 0 || constraints.freeOnly ? 'free' : 'auto',
    config: budgetPerRequest === 0 || constraints.freeOnly ? {} : {},
    reasoning,
    estimatedCostPerMillionTokens: budgetPerRequest === 0 ? 0 : null,
    estimatedCostPerRequest: budgetPerRequest === 0 ? 0 : null,
    confidence: 0.7,
    alternatives,
  };
}

export function getRouterInfo(router: RouterType): RouterInfo {
  return ROUTER_INFOS[router] || ROUTER_INFOS.auto;
}

export function generateCurlExample(
  router: RouterType,
  config: Record<string, unknown>,
  task: string
): string {
  const baseCmd = 'curl https://openrouter.ai/api/v1/chat/completions \\';
  const authHeader = '-H "Authorization: Bearer $OPENROUTER_API_KEY" \\';
  const contentType = '-H "Content-Type: application/json" \\';
  
  let modelArg = `-d '{
  "model": "${router === 'pareto' ? 'openrouter/pareto-code' : router === 'jev' ? 'typesafe/jev-router' : router === 'fusion' ? 'openrouter/fusion' : router === 'fusion-flash' ? 'openrouter/fusion-flash' : router === 'free' ? 'openrouter/free' : 'auto'}",`;

  if (config.minCodingScore !== undefined) {
    modelArg += `\n  "plugins": [{"id": "pareto-router", "min_coding_score": ${config.minCodingScore}}],`;
  } else if (config.models !== undefined) {
    const modelsStr = JSON.stringify(config.models).replace(/"/g, "'");
    const excludedStr = config.excluded_models ? 
      `, "excluded_models": ${JSON.stringify(config.excluded_models)}` : '';
    modelArg += `\n  "plugins": [{"id": "jev-router", "models": ${modelsStr}${excludedStr}}],`;
  }

  modelArg += `\n  "messages": [
    {"role": "user", "content": "${task.replace(/"/g, '\\"')}"}
  ]}'`;

  return `${baseCmd}\n  ${authHeader}\n  ${contentType}\n  ${modelArg}`;
}
