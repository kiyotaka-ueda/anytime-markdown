const sqlAsmActual = require(require.resolve('sql.js/dist/sql-asm.js')); // eslint-disable-line @typescript-eslint/no-require-imports
(global as Record<string, unknown>).__non_webpack_require__ = (_path: string) => sqlAsmActual;

import { SyncService } from '../SyncService';
import type { IRemoteTrailStore } from '../IRemoteTrailStore';
import type { ManualElement, ManualRelationship } from '@anytime-markdown/trail-core';
import { createTestTrailDatabase } from './support/createTestDb';

const createDb = createTestTrailDatabase;

class FakeRemoteStore implements IRemoteTrailStore {
  elements: ManualElement[] = [];
  relationships: ManualRelationship[] = [];

  async connect(): Promise<void> {}
  async close(): Promise<void> {}
  async unsafeClearAll(): Promise<void> {}
  async getExistingSessionIds(): Promise<readonly string[]> { return []; }
  async getExistingSyncedAt(): Promise<ReadonlyMap<string, string>> { return new Map(); }
  async upsertSessions(): Promise<void> {}
  async upsertMessages(): Promise<void> {}
  async upsertCommits(): Promise<void> {}
  async upsertCommitFiles(): Promise<void> {}
  async upsertReleases(): Promise<void> {}
  async upsertReleaseFiles(): Promise<void> {}
  async upsertReleaseFeatures(): Promise<void> {}
  async upsertSessionCosts(): Promise<void> {}
  async upsertAllSessionCosts(): Promise<void> {}
  async upsertDailyCounts(): Promise<void> {}
  async unsafeClearCurrentGraphs(): Promise<void> {}
  async unsafeClearReleaseGraphs(): Promise<void> {}
  async upsertCurrentGraph(): Promise<void> {}
  async upsertReleaseGraph(): Promise<void> {}
  async unsafeClearMessageToolCalls(): Promise<void> {}
  async upsertMessageToolCalls(): Promise<void> {}

  coverageRows: Array<{ repo_name: string; package: string; file_path: string; lines_total: number; lines_covered: number; lines_pct: number; statements_total: number; statements_covered: number; statements_pct: number; functions_total: number; functions_covered: number; functions_pct: number; branches_total: number; branches_covered: number; branches_pct: number; updated_at: string }> = [];
  releaseCoverageRows: Array<{ release_tag: string; package: string; file_path: string; lines_total: number; lines_covered: number; lines_pct: number; statements_total: number; statements_covered: number; statements_pct: number; functions_total: number; functions_covered: number; functions_pct: number; branches_total: number; branches_covered: number; branches_pct: number }> = [];
  codeGraphRows: Array<{ repo_name: string; graph_json: string; generated_at: string; updated_at: string }> = [];
  codeGraphCommunityRows: Array<{ repo_name: string; community_id: number; label: string; name: string; summary: string; generated_at: string; updated_at: string }> = [];
  releaseCodeGraphRows: Array<{ release_tag: string; graph_json: string; generated_at: string; updated_at: string }> = [];
  releaseCodeGraphCommunityRows: Array<{ release_tag: string; community_id: number; label: string; name: string; summary: string; generated_at: string; updated_at: string }> = [];

  async unsafeClearCurrentCoverage(): Promise<void> { this.coverageRows = []; }
  async upsertCurrentCoverage(rows: readonly { repo_name: string; package: string; file_path: string; lines_total: number; lines_covered: number; lines_pct: number; statements_total: number; statements_covered: number; statements_pct: number; functions_total: number; functions_covered: number; functions_pct: number; branches_total: number; branches_covered: number; branches_pct: number; updated_at: string }[]): Promise<void> {
    this.coverageRows.push(...(rows as typeof this.coverageRows));
  }
  async unsafeClearReleaseCoverage(): Promise<void> { this.releaseCoverageRows = []; }
  async upsertReleaseCoverage(rows: readonly { release_tag: string; package: string; file_path: string; lines_total: number; lines_covered: number; lines_pct: number; statements_total: number; statements_covered: number; statements_pct: number; functions_total: number; functions_covered: number; functions_pct: number; branches_total: number; branches_covered: number; branches_pct: number }[]): Promise<void> {
    this.releaseCoverageRows.push(...(rows as typeof this.releaseCoverageRows));
  }
  async unsafeClearCurrentCodeGraphs(): Promise<void> { this.codeGraphRows = []; this.codeGraphCommunityRows = []; }
  async upsertCurrentCodeGraphs(rows: readonly { repo_name: string; graph_json: string; generated_at: string; updated_at: string }[]): Promise<void> {
    this.codeGraphRows.push(...(rows as typeof this.codeGraphRows));
  }
  async upsertCurrentCodeGraphCommunities(rows: readonly { repo_name: string; community_id: number; label: string; name: string; summary: string; generated_at: string; updated_at: string }[]): Promise<void> {
    this.codeGraphCommunityRows.push(...(rows as typeof this.codeGraphCommunityRows));
  }
  async unsafeClearReleaseCodeGraphs(): Promise<void> { this.releaseCodeGraphRows = []; this.releaseCodeGraphCommunityRows = []; }
  async upsertReleaseCodeGraphs(rows: readonly { release_tag: string; graph_json: string; generated_at: string; updated_at: string }[]): Promise<void> {
    this.releaseCodeGraphRows.push(...(rows as typeof this.releaseCodeGraphRows));
  }
  async upsertReleaseCodeGraphCommunities(rows: readonly { release_tag: string; community_id: number; label: string; name: string; summary: string; generated_at: string; updated_at: string }[]): Promise<void> {
    this.releaseCodeGraphCommunityRows.push(...(rows as typeof this.releaseCodeGraphCommunityRows));
  }

  async listManualElements(repoName: string): Promise<readonly ManualElement[]> {
    return this.elements.filter(e => (e as ManualElement & { _repo: string })._repo === repoName);
  }
  async upsertManualElement(repoName: string, e: ManualElement): Promise<void> {
    const idx = this.elements.findIndex(x => x.id === e.id && (x as ManualElement & { _repo: string })._repo === repoName);
    const entry = { ...e, _repo: repoName } as ManualElement & { _repo: string };
    if (idx >= 0) this.elements[idx] = entry;
    else this.elements.push(entry);
  }
  async deleteManualElement(repoName: string, elementId: string): Promise<void> {
    this.elements = this.elements.filter(e => !(e.id === elementId && (e as ManualElement & { _repo: string })._repo === repoName));
  }
  async listManualRelationships(repoName: string): Promise<readonly ManualRelationship[]> {
    return this.relationships.filter(r => (r as ManualRelationship & { _repo: string })._repo === repoName);
  }
  async upsertManualRelationship(repoName: string, r: ManualRelationship): Promise<void> {
    const idx = this.relationships.findIndex(x => x.id === r.id && (x as ManualRelationship & { _repo: string })._repo === repoName);
    const entry = { ...r, _repo: repoName } as ManualRelationship & { _repo: string };
    if (idx >= 0) this.relationships[idx] = entry;
    else this.relationships.push(entry);
  }
  async deleteManualRelationship(repoName: string, relId: string): Promise<void> {
    this.relationships = this.relationships.filter(r => !(r.id === relId && (r as ManualRelationship & { _repo: string })._repo === repoName));
  }
}

describe('SyncService.syncManualElements', () => {
  it('pushes local-only elements to remote', async () => {
    const localDb = await createDb();
    const remoteStore = new FakeRemoteStore();
    localDb.saveManualElement('repo-a', { type: 'person', name: 'Local', external: false, parentId: null });
    const sync = new SyncService(localDb, remoteStore);
    await sync.syncManualElements('repo-a');
    const remoteElems = await remoteStore.listManualElements('repo-a');
    expect(remoteElems).toHaveLength(1);
    localDb.close();
  });

  it('pulls remote-only elements to local', async () => {
    const localDb = await createDb();
    const remoteStore = new FakeRemoteStore();
    await remoteStore.upsertManualElement('repo-a', {
      id: 'person_1', type: 'person', name: 'Remote',
      external: false, parentId: null, updatedAt: '2026-04-20T00:00:00.000Z',
    });
    const sync = new SyncService(localDb, remoteStore);
    await sync.syncManualElements('repo-a');
    expect(localDb.getManualElements('repo-a')).toHaveLength(1);
    localDb.close();
  });

  it('resolves conflicts with last-write-wins (remote newer)', async () => {
    const localDb = await createDb();
    const remoteStore = new FakeRemoteStore();
    localDb.saveManualElement('repo-a', { type: 'person', name: 'Old', external: false, parentId: null });
    await remoteStore.upsertManualElement('repo-a', {
      id: 'person_1', type: 'person', name: 'New',
      external: false, parentId: null, updatedAt: '2099-01-01T00:00:00.000Z',
    });
    const sync = new SyncService(localDb, remoteStore);
    await sync.syncManualElements('repo-a');
    expect(localDb.getManualElements('repo-a')[0].name).toBe('New');
    localDb.close();
  });
});

describe('SyncService.doSync coverage and code graph', () => {
  it('syncs current_coverage to remote (wash-away)', async () => {
    const localDb = await createDb();
    const remoteStore = new FakeRemoteStore();
    const sync = new SyncService(localDb, remoteStore);
    await sync.sync();
    expect(remoteStore.coverageRows).toHaveLength(0);
    localDb.close();
  });

  it('sync calls unsafeClearCurrentCoverage before upsert', async () => {
    const localDb = await createDb();
    const remoteStore = new FakeRemoteStore();
    let clearCalled = false;
    const origClear = remoteStore.unsafeClearCurrentCoverage.bind(remoteStore);
    remoteStore.unsafeClearCurrentCoverage = async () => { clearCalled = true; return origClear(); };
    const sync = new SyncService(localDb, remoteStore);
    await sync.sync();
    expect(clearCalled).toBe(true);
    localDb.close();
  });

  it('syncs release_coverage to remote (wash-away)', async () => {
    const localDb = await createDb();
    const remoteStore = new FakeRemoteStore();
    const sync = new SyncService(localDb, remoteStore);
    await sync.sync();
    expect(remoteStore.releaseCoverageRows).toHaveLength(0);
    localDb.close();
  });

  it('sync calls unsafeClearReleaseCoverage before upsert', async () => {
    const localDb = await createDb();
    const remoteStore = new FakeRemoteStore();
    let clearCalled = false;
    const origClear = remoteStore.unsafeClearReleaseCoverage.bind(remoteStore);
    remoteStore.unsafeClearReleaseCoverage = async () => { clearCalled = true; return origClear(); };
    const sync = new SyncService(localDb, remoteStore);
    await sync.sync();
    expect(clearCalled).toBe(true);
    localDb.close();
  });

  it('syncs current_code_graphs to remote (wash-away)', async () => {
    const localDb = await createDb();
    const remoteStore = new FakeRemoteStore();
    const sync = new SyncService(localDb, remoteStore);
    await sync.sync();
    expect(remoteStore.codeGraphRows).toHaveLength(0);
    localDb.close();
  });

  it('sync calls unsafeClearCurrentCodeGraphs before upsert', async () => {
    const localDb = await createDb();
    const remoteStore = new FakeRemoteStore();
    let clearCalled = false;
    const origClear = remoteStore.unsafeClearCurrentCodeGraphs.bind(remoteStore);
    remoteStore.unsafeClearCurrentCodeGraphs = async () => { clearCalled = true; return origClear(); };
    const sync = new SyncService(localDb, remoteStore);
    await sync.sync();
    expect(clearCalled).toBe(true);
    localDb.close();
  });

  it('syncs release_code_graphs to remote (wash-away)', async () => {
    const localDb = await createDb();
    const remoteStore = new FakeRemoteStore();
    const sync = new SyncService(localDb, remoteStore);
    await sync.sync();
    expect(remoteStore.releaseCodeGraphRows).toHaveLength(0);
    expect(remoteStore.releaseCodeGraphCommunityRows).toHaveLength(0);
    localDb.close();
  });

  it('sync calls unsafeClearReleaseCodeGraphs before upsert', async () => {
    const localDb = await createDb();
    const remoteStore = new FakeRemoteStore();
    let clearCalled = false;
    const origClear = remoteStore.unsafeClearReleaseCodeGraphs.bind(remoteStore);
    remoteStore.unsafeClearReleaseCodeGraphs = async () => { clearCalled = true; return origClear(); };
    const sync = new SyncService(localDb, remoteStore);
    await sync.sync();
    expect(clearCalled).toBe(true);
    localDb.close();
  });
});
