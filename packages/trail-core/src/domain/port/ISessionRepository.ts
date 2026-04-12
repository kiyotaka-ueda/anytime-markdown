// domain/port/ISessionRepository.ts — Session data access port

export interface SessionStats {
  readonly sessionCount: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalCacheReadTokens: number;
  readonly totalDurationMs: number;
}

export interface ISessionRepository {
  getStatsByBranch(branchName: string): SessionStats | null;
}
