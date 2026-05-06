import type { TrailPromptEntry } from '../../../domain/parser/types';
import { buildPromptTree } from '../promptTree';

function createPrompt(id: string, tags: string[], updatedAt: string): TrailPromptEntry {
  return {
    id,
    name: id,
    content: id,
    version: 1,
    tags,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('buildPromptTree', () => {
  it('groups prompts by normalized category and orders by category and updatedAt desc', () => {
    const prompts: TrailPromptEntry[] = [
      createPrompt('skill-1', ['skill'], '2026-04-01T00:00:00.000Z'),
      createPrompt('rule-1', ['rule'], '2026-04-02T00:00:00.000Z'),
      createPrompt('mem-1', ['memory'], '2026-04-03T00:00:00.000Z'),
      createPrompt('rule-2', ['rule'], '2026-04-04T00:00:00.000Z'),
      createPrompt('script-1', ['script'], '2026-04-04T12:00:00.000Z'),
      createPrompt('other-1', ['x'], '2026-04-05T00:00:00.000Z'),
    ];

    const tree = buildPromptTree(prompts);

    expect(tree.map((n) => n.category)).toEqual(['rules', 'memory', 'skill', 'scripts', 'other']);
    expect(tree[0]?.prompts.map((p) => p.id)).toEqual(['rule-2', 'rule-1']);
  });
});
