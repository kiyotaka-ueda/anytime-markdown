// --- Raw JSONL types (Claude Code output format) ---
// These are trail-viewer specific (JSONL parsing) and remain here.

export interface RawJsonlMessage {
  readonly type: string;
  readonly subtype?: string;
  readonly uuid?: string;
  readonly parentUuid?: string | null;
  readonly isSidechain?: boolean;
  readonly timestamp?: string;
  readonly sessionId?: string;
  readonly version?: string;
  readonly gitBranch?: string;
  readonly cwd?: string;
  readonly slug?: string;
  readonly message?: {
    readonly role?: string;
    readonly model?: string;
    readonly content?: string | readonly RawContentBlock[];
    readonly usage?: RawUsage;
    readonly stop_reason?: string | null;
  };
  readonly userContent?: string;
  readonly isMeta?: boolean;
}

export interface RawContentBlock {
  readonly type: string;
  readonly text?: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: Record<string, unknown>;
  readonly content?: string | readonly RawContentBlock[];
}

export interface RawUsage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_read_input_tokens?: number;
  readonly cache_creation_input_tokens?: number;
}

// --- Analytics types ---

export interface AnalyticsData {
  readonly totals: {
    readonly sessions: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreationTokens: number;
    readonly estimatedCostUsd: number;
    readonly totalCommits: number;
    readonly totalLinesAdded: number;
    readonly totalLinesDeleted: number;
    readonly totalFilesChanged: number;
    readonly totalAiAssistedCommits: number;
    readonly totalSessionDurationMs: number;
    readonly totalRetries: number;
    readonly totalEdits: number;
    readonly totalBuildRuns: number;
    readonly totalBuildFails: number;
    readonly totalTestRuns: number;
    readonly totalTestFails: number;
  };
  readonly toolUsage: readonly { name: string; count: number }[];
  readonly modelBreakdown: readonly {
    readonly model: string;
    readonly sessions: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly estimatedCostUsd: number;
  }[];
  readonly dailyActivity: readonly {
    readonly date: string;
    readonly sessions: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreationTokens: number;
    readonly estimatedCostUsd: number;
  }[];
}

// --- Domain types (re-exported from trail-core) ---

/** @deprecated Import from '@anytime-markdown/trail-core/domain' directly */
export type {
  TrailTokenUsage,
  TrailToolCall,
  TrailMessage,
  TrailSession,
  TrailSessionCommit,
  ToolMetrics,
  TrailTreeNode,
  TrailFilter,
  CostOptimizationData,
  CostDailyEntry,
  TrailPromptEntry,
  TrailEvaluation,
} from '@anytime-markdown/trail-core/domain';
