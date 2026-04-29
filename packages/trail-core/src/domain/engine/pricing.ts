// domain/engine/pricing.ts — Model pricing and cost calculation

import type { TokenUsage, ModelPricing } from '../model/cost';

export type { TokenUsage, ModelPricing };
export type PricingSource = 'claude_code' | 'codex';

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
  'gpt-5.2-codex': {
    inputPerM: 1.75,
    outputPerM: 14,
    cacheReadMultiplier: 0.1,
    cacheCreationMultiplier: 1,
  },
  'gpt-5.1-codex-max': {
    inputPerM: 1.25,
    outputPerM: 10,
    cacheReadMultiplier: 0.1,
    cacheCreationMultiplier: 1,
  },
  'gpt-5.1-codex': {
    inputPerM: 1.25,
    outputPerM: 10,
    cacheReadMultiplier: 0.1,
    cacheCreationMultiplier: 1,
  },
  'gpt-5-codex': {
    inputPerM: 1.25,
    outputPerM: 10,
    cacheReadMultiplier: 0.1,
    cacheCreationMultiplier: 1,
  },
  'gpt-5.1-codex-mini': {
    inputPerM: 0.25,
    outputPerM: 2,
    cacheReadMultiplier: 0.1,
    cacheCreationMultiplier: 1,
  },
  'codex-mini-latest': {
    inputPerM: 1.5,
    outputPerM: 6,
    cacheReadMultiplier: 0.25,
    cacheCreationMultiplier: 1,
  },
};

const DEFAULT_MODEL = 'sonnet';
const DEFAULT_CODEX_MODEL = 'gpt-5.1-codex';

export function normalizeModelName(model: string): string {
  const lower = model.toLowerCase().trim();
  if (lower.includes('gpt-5.2-codex')) return 'gpt-5.2-codex';
  if (lower.includes('gpt-5.1-codex-mini')) return 'gpt-5.1-codex-mini';
  if (lower.includes('codex-mini-latest')) return 'codex-mini-latest';
  if (lower.includes('gpt-5.1-codex') || lower.includes('gpt-5-codex')) return 'gpt-5.1-codex';
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('haiku')) return 'haiku';
  if (lower.includes('sonnet')) return 'sonnet';
  return lower;
}

export function resolvePricingModelName(model: string, source?: PricingSource): string {
  const normalized = normalizeModelName(model);
  if (source !== 'codex') return normalized;
  if (normalized && MODEL_PRICING[normalized]) return normalized;
  return DEFAULT_CODEX_MODEL;
}

export function calculateCost(model: string, usage: TokenUsage, source?: PricingSource): number {
  const normalized = resolvePricingModelName(model, source);
  const pricing = MODEL_PRICING[normalized] ?? MODEL_PRICING[DEFAULT_MODEL];
  const inputCost = (usage.inputTokens * pricing.inputPerM) / 1_000_000;
  const outputCost = (usage.outputTokens * pricing.outputPerM) / 1_000_000;
  const cacheReadCost =
    (usage.cacheReadTokens * pricing.inputPerM * pricing.cacheReadMultiplier) / 1_000_000;
  const cacheCreationCost =
    (usage.cacheCreationTokens * pricing.inputPerM * pricing.cacheCreationMultiplier) / 1_000_000;
  return inputCost + outputCost + cacheReadCost + cacheCreationCost;
}
