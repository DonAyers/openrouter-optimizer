import type {
  ExecutionTarget,
  ExecutionTargetAdapter,
  RouterRecommendation,
} from './types';
import { recommendRouter } from './router-recommender';

/**
 * OpenRouter implementation of the generic execution-target contract.
 *
 * Keeps all OpenRouter-specific knowledge (router names, `min_coding_score`,
 * model pools) behind the generic `ExecutionTargetAdapter` interface so other
 * providers can be added as siblings later.
 */
export const openrouterAdapter: ExecutionTargetAdapter = {
  recommend(classification, request) {
    const recommendation = recommendRouter(classification, request, request.constraints ?? {});
    return toExecutionTarget(recommendation);
  },
};

function toExecutionTarget(recommendation: RouterRecommendation): ExecutionTarget {
  return {
    model: recommendation.model ?? recommendation.router,
    config: recommendation.config ?? {},
    estCost: recommendation.estimatedCostPerRequest,
    estCostPerMillionTokens: recommendation.estimatedCostPerMillionTokens,
    reasoning: recommendation.reasoning,
    confidence: recommendation.confidence,
    alternatives: recommendation.alternatives.map((alt) => ({
      model: alt.router,
      config: alt.config,
      estCost: null,
      estCostPerMillionTokens: alt.estimatedCostPerMillionTokens,
      reasoning: alt.reasoning,
      confidence: 0,
      alternatives: [],
    })),
  };
}