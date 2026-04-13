import type { SessionRow, MessageRow, SessionCommitRow, ReleaseFileRow, ReleaseFeatureRow, ReleaseRow } from './TrailDatabase';

export interface IRemoteTrailStore {
  connect(): Promise<void>;
  close(): Promise<void>;
  clearAll(): Promise<void>;
  getExistingSessionIds(): Promise<readonly string[]>;
  getExistingSyncedAt(): Promise<ReadonlyMap<string, string>>;
  upsertSessions(rows: readonly SessionRow[]): Promise<void>;
  upsertMessages(rows: readonly MessageRow[]): Promise<void>;
  upsertCommits(rows: readonly SessionCommitRow[]): Promise<void>;
  upsertReleases(rows: readonly ReleaseRow[]): Promise<void>;
  upsertReleaseFiles(rows: readonly ReleaseFileRow[]): Promise<void>;
  upsertReleaseFeatures(rows: readonly ReleaseFeatureRow[]): Promise<void>;
  upsertSessionCosts(sessionId: string, costs: readonly {
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    estimated_cost_usd: number;
  }[]): Promise<void>;
  upsertAllSessionCosts(rows: readonly {
    session_id: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    estimated_cost_usd: number;
  }[]): Promise<void>;
  upsertDailyCosts(rows: readonly {
    date: string;
    model: string;
    cost_type: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    estimated_cost_usd: number;
  }[]): Promise<void>;
  clearCurrentGraphs(): Promise<void>;
  clearReleaseGraphs(): Promise<void>;
  upsertCurrentGraph(repoName: string, graphJson: string, commitId: string): Promise<void>;
  upsertReleaseGraph(tag: string, graphJson: string): Promise<void>;
}
