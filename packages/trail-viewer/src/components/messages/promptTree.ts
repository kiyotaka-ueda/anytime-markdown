import type { TrailPromptEntry } from '../../domain/parser/types';

export interface PromptTreeNode {
  readonly category: string;
  readonly prompts: readonly TrailPromptEntry[];
}

function categoryFromTags(tags: readonly string[]): string {
  if (tags.includes('rule')) return 'rules';
  if (tags.includes('memory')) return 'memory';
  if (tags.includes('skill')) return 'skill';
  if (tags.includes('script')) return 'scripts';
  if (tags.includes('project')) return 'project';
  if (tags.includes('main')) return 'main';
  if (tags.includes('config')) return 'config';
  return 'other';
}

const CATEGORY_ORDER = ['main', 'rules', 'memory', 'skill', 'scripts', 'project', 'config', 'other'] as const;

export function buildPromptTree(prompts: readonly TrailPromptEntry[]): readonly PromptTreeNode[] {
  const grouped = new Map<string, TrailPromptEntry[]>();
  for (const prompt of prompts) {
    const category = categoryFromTags(prompt.tags);
    const arr = grouped.get(category);
    if (arr) arr.push(prompt);
    else grouped.set(category, [prompt]);
  }

  return CATEGORY_ORDER
    .filter((category) => grouped.has(category))
    .map((category) => {
      const categoryPrompts = grouped.get(category) ?? [];
      return {
        category,
        prompts: [...categoryPrompts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      };
    });
}
