import { splitCodeGraph, composeCodeGraph } from '../codeGraph';
import type { CodeGraph } from '../codeGraph';

// テスト用のベースノード/エッジ/リポジトリ
const baseGraph: Omit<CodeGraph, 'communities' | 'communitySummaries'> = {
  generatedAt: '2026-05-02T00:00:00.000Z',
  repositories: [{ id: 'repo1', label: 'repo1', path: '/repo1' }],
  nodes: [
    {
      id: 'n1',
      label: 'NodeA',
      repo: 'repo1',
      package: 'pkg',
      fileType: 'code',
      community: 0,
      communityLabel: 'Alpha',
      x: 0,
      y: 0,
      size: 1,
    },
    {
      id: 'n2',
      label: 'NodeB',
      repo: 'repo1',
      package: 'pkg',
      fileType: 'code',
      community: 1,
      communityLabel: 'Beta',
      x: 1,
      y: 1,
      size: 2,
    },
  ],
  edges: [
    { source: 'n1', target: 'n2', confidence: 'EXTRACTED', confidence_score: 1, crossRepo: false },
  ],
  godNodes: ['n1'],
};

describe('splitCodeGraph / composeCodeGraph round-trip', () => {
  describe('(a) 要約あり - 全コミュニティに name/summary がある場合', () => {
    const full: CodeGraph = {
      ...baseGraph,
      communities: { 0: 'Alpha', 1: 'Beta' },
      communitySummaries: {
        0: { name: 'Alpha Group', summary: 'Core utilities.' },
        1: { name: 'Beta Group', summary: 'UI components.' },
      },
    };

    it('splitCodeGraph が正しい communities 配列を返す', () => {
      const { communities } = splitCodeGraph(full);
      expect(communities).toHaveLength(2);
      const c0 = communities.find((c) => c.id === 0);
      expect(c0).toEqual({ id: 0, label: 'Alpha', name: 'Alpha Group', summary: 'Core utilities.' });
      const c1 = communities.find((c) => c.id === 1);
      expect(c1).toEqual({ id: 1, label: 'Beta', name: 'Beta Group', summary: 'UI components.' });
    });

    it('stored に communities / communitySummaries が含まれない', () => {
      const { stored } = splitCodeGraph(full);
      expect(Object.keys(stored)).not.toContain('communities');
      expect(Object.keys(stored)).not.toContain('communitySummaries');
    });

    it('composeCodeGraph で元の CodeGraph と等価になる', () => {
      const { stored, communities } = splitCodeGraph(full);
      const restored = composeCodeGraph(stored, communities);
      expect(restored).toEqual(full);
    });
  });

  describe('(b) 要約なし - communitySummaries が undefined の場合', () => {
    const full: CodeGraph = {
      ...baseGraph,
      communities: { 0: 'Alpha', 1: 'Beta' },
    };

    it('splitCodeGraph の communities は name/summary が空文字列', () => {
      const { communities } = splitCodeGraph(full);
      expect(communities).toHaveLength(2);
      for (const c of communities) {
        expect(c.name).toBe('');
        expect(c.summary).toBe('');
      }
    });

    it('composeCodeGraph で communitySummaries が undefined になる', () => {
      const { stored, communities } = splitCodeGraph(full);
      const restored = composeCodeGraph(stored, communities);
      expect(restored.communitySummaries).toBeUndefined();
    });

    it('composeCodeGraph で元の CodeGraph と等価になる', () => {
      const { stored, communities } = splitCodeGraph(full);
      const restored = composeCodeGraph(stored, communities);
      expect(restored).toEqual(full);
    });
  });

  describe('(c) 部分的な要約 - 一部の community_id のみ summary がある場合', () => {
    const full: CodeGraph = {
      ...baseGraph,
      communities: { 0: 'Alpha', 1: 'Beta' },
      communitySummaries: {
        0: { name: 'Alpha Group', summary: 'Core utilities.' },
        // community 1 は summary なし
      },
    };

    it('splitCodeGraph で summary なしの community は name/summary が空文字列', () => {
      const { communities } = splitCodeGraph(full);
      const c1 = communities.find((c) => c.id === 1);
      expect(c1?.name).toBe('');
      expect(c1?.summary).toBe('');
    });

    it('composeCodeGraph で summary なし community は communitySummaries に含まれない', () => {
      const { stored, communities } = splitCodeGraph(full);
      const restored = composeCodeGraph(stored, communities);
      expect(restored.communitySummaries).toBeDefined();
      expect(Object.keys(restored.communitySummaries ?? {})).toEqual(['0']);
    });

    it('composeCodeGraph で元の CodeGraph と等価になる', () => {
      const { stored, communities } = splitCodeGraph(full);
      const restored = composeCodeGraph(stored, communities);
      expect(restored).toEqual(full);
    });
  });
});
