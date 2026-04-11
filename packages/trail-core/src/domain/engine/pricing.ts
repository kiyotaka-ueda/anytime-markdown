// domain/engine/pricing.ts — Model pricing and cost calculation

import type { TokenUsage, ModelPricing } from '../model/cost';

export type { TokenUsage, ModelPricing };

export const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  opus: {
    inputPerM: 15,
    outputPerM: 75,
    cacheReadMultiplier: 0.1,
    cacheCreationMultiplier: 1.25,
  },
  sonnet: {
    inputPerM: 3,
    outputPerM: 15,
    cacheReadMultiplier: 0.1,
    cacheCreationMultiplier: 1.25,
  },
  haiku: {
    inputPerM: 0.8,
    outputPerM: 4,
    cacheReadMultiplier: 0.1,
    cacheCreationMultiplier: 1.25,
  },
};

const DEFAULT_MODEL = 'sonnet';

export function normalizeModelName(model: string): string {
  const lower = model.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('haiku')) return 'haiku';
  if (lower.includes('sonnet')) return 'sonnet';
  return lower;
}

export function calculateCost(model: string, usage: TokenUsage): number {
  const normalized = normalizeModelName(model);
  const pricing = MODEL_PRICING[normalized] ?? MODEL_PRICING[DEFAULT_MODEL];
  const inputCost = (usage.inputTokens * pricing.inputPerM) / 1_000_000;
  const outputCost = (usage.outputTokens * pricing.outputPerM) / 1_000_000;
  const cacheReadCost =
    (usage.cacheReadTokens * pricing.inputPerM * pricing.cacheReadMultiplier) / 1_000_000;
  const cacheCreationCost =
    (usage.cacheCreationTokens * pricing.inputPerM * pricing.cacheCreationMultiplier) / 1_000_000;
  return inputCost + outputCost + cacheReadCost + cacheCreationCost;
}
