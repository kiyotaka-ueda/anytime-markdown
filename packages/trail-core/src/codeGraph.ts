export interface CodeGraphRepository {
  readonly id: string;
  readonly label: string;
  readonly path: string;
}

export type EdgeConfidence = 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS';

export interface CodeGraphNode {
  readonly id: string;
  readonly label: string;
  readonly repo: string;
  readonly package: string;
  readonly fileType: 'code' | 'document';
  readonly community: number;
  readonly communityLabel: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface CodeGraphEdge {
  readonly source: string;
  readonly target: string;
  readonly confidence: EdgeConfidence;
  readonly confidence_score: number;
  readonly crossRepo: boolean;
}

export interface CommunitySummary {
  /** AI が生成した 3 語以内の表示名 */
  readonly name: string;
  /** AI が生成した 1 文 60 文字以内の説明 */
  readonly summary: string;
}

export interface CodeGraph {
  readonly generatedAt: string;
  readonly repositories: readonly CodeGraphRepository[];
  readonly nodes: readonly CodeGraphNode[];
  readonly edges: readonly CodeGraphEdge[];
  readonly communities: Record<number, string>;
  readonly godNodes: readonly string[];
  /**
   * AI 生成のコミュニティ要約（任意）。
   * /build-code-graph スキル経由で生成。VS Code 拡張の Generate Code Graph 単独では未生成。
   */
  readonly communitySummaries?: Record<number, CommunitySummary>;
}

export interface CodeGraphQueryResult {
  readonly nodes: readonly string[];
  readonly edges: Array<{ source: string; target: string }>;
}

export interface CodeGraphExplainResult {
  readonly node: CodeGraphNode;
  readonly incoming: readonly CodeGraphEdge[];
  readonly outgoing: readonly CodeGraphEdge[];
}

export interface CodeGraphPathResult {
  readonly found: boolean;
  readonly path: readonly string[];
  readonly hops: number;
}
