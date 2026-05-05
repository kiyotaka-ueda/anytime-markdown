import Database from 'better-sqlite3';
import {
  upsertCommunitySummariesDirect,
  upsertCommunityMappingsDirect,
  addElementDirect,
  updateElementDirect,
  removeElementDirect,
  addGroupDirect,
  updateGroupDirect,
  removeGroupDirect,
  addRelationshipDirect,
  removeRelationshipDirect,
} from '../../sqlite/write';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE current_code_graph_communities (
      repo_name TEXT NOT NULL,
      community_id INTEGER NOT NULL,
      label TEXT,
      name TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      generated_at TEXT,
      updated_at TEXT,
      PRIMARY KEY (repo_name, community_id)
    );
    CREATE TABLE c4_manual_elements (
      repo_name TEXT NOT NULL,
      element_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      external INTEGER NOT NULL DEFAULT 0,
      parent_id TEXT,
      service_type TEXT,
      updated_at TEXT,
      PRIMARY KEY (repo_name, element_id)
    );
    CREATE TABLE c4_manual_relationships (
      repo_name TEXT NOT NULL,
      rel_id TEXT NOT NULL,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      label TEXT,
      technology TEXT,
      updated_at TEXT,
      PRIMARY KEY (repo_name, rel_id)
    );
    CREATE TABLE c4_manual_groups (
      repo_name TEXT NOT NULL,
      group_id TEXT NOT NULL,
      member_ids TEXT NOT NULL DEFAULT '[]',
      label TEXT,
      updated_at TEXT,
      PRIMARY KEY (repo_name, group_id)
    );
  `);
  return db;
}

const REPO = 'test-repo';

describe('upsertCommunitySummariesDirect', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test('INSERT 新規行', async () => {
    const result = await upsertCommunitySummariesDirect(db, REPO, [
      { communityId: 1, name: 'Comm A', summary: 'Summary A' },
    ]);
    expect(result.updated).toBe(0);
    const row = db.prepare('SELECT name, summary FROM current_code_graph_communities WHERE repo_name=? AND community_id=?').get(REPO, 1) as { name: string; summary: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.name).toBe('Comm A');
    expect(row!.summary).toBe('Summary A');
  });

  test('2 回目 upsert で UPDATE、updated カウント正確', async () => {
    await upsertCommunitySummariesDirect(db, REPO, [{ communityId: 1, name: 'Old', summary: 'Old summary' }]);
    const result = await upsertCommunitySummariesDirect(db, REPO, [{ communityId: 1, name: 'New', summary: 'New summary' }]);
    expect(result.updated).toBe(1);
    const row = db.prepare('SELECT name, summary FROM current_code_graph_communities WHERE repo_name=? AND community_id=?').get(REPO, 1) as { name: string; summary: string } | undefined;
    expect(row!.name).toBe('New');
    expect(row!.summary).toBe('New summary');
  });
});

describe('upsertCommunityMappingsDirect', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test('mappings_json カラムがなければ ALTER で追加される', async () => {
    // 初期状態ではカラムなし
    const colsBefore = db.pragma('table_info(current_code_graph_communities)') as Array<{ name: string }>;
    expect(colsBefore.some((c) => c.name === 'mappings_json')).toBe(false);

    await upsertCommunityMappingsDirect(db, REPO, [
      { communityId: 1, mappings: [{ elementId: 'e1', elementType: 'Container', role: 'primary' }] },
    ]);

    const colsAfter = db.pragma('table_info(current_code_graph_communities)') as Array<{ name: string }>;
    expect(colsAfter.some((c) => c.name === 'mappings_json')).toBe(true);
  });

  test('mappings が JSON で保存される', async () => {
    const mappings = [{ elementId: 'e1', elementType: 'Container', role: 'primary' as const }];
    await upsertCommunityMappingsDirect(db, REPO, [{ communityId: 1, mappings }]);
    const row = db.prepare('SELECT mappings_json FROM current_code_graph_communities WHERE repo_name=? AND community_id=?').get(REPO, 1) as { mappings_json: string } | undefined;
    expect(row).toBeDefined();
    expect(JSON.parse(row!.mappings_json)).toEqual(mappings);
  });

  test('updated / inserted 集計正確', async () => {
    // INSERT 1 件
    const r1 = await upsertCommunityMappingsDirect(db, REPO, [
      { communityId: 1, mappings: [] },
      { communityId: 2, mappings: [] },
    ]);
    expect(r1.inserted).toBe(2);
    expect(r1.updated).toBe(0);

    // UPDATE 1 件 + INSERT 1 件
    const r2 = await upsertCommunityMappingsDirect(db, REPO, [
      { communityId: 1, mappings: [] },
      { communityId: 3, mappings: [] },
    ]);
    expect(r2.updated).toBe(1);
    expect(r2.inserted).toBe(1);
  });
});

describe('addElementDirect', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test('id が man_ 始まりで生成される', async () => {
    const result = await addElementDirect(db, REPO, { type: 'Container', name: 'API', external: false, parentId: null });
    expect(result.id).toMatch(/^man_/);
  });

  test('SELECT で取得できる', async () => {
    const { id } = await addElementDirect(db, REPO, { type: 'Container', name: 'API', external: false, parentId: null, description: 'desc', serviceType: 'web' });
    const row = db.prepare('SELECT * FROM c4_manual_elements WHERE repo_name=? AND element_id=?').get(REPO, id) as Record<string, unknown> | undefined;
    expect(row).toBeDefined();
    expect(row!.name).toBe('API');
    expect(row!.type).toBe('Container');
    expect(row!.description).toBe('desc');
    expect(row!.service_type).toBe('web');
  });

  test('external true -> 1, false -> 0', async () => {
    const { id: id1 } = await addElementDirect(db, REPO, { type: 'Container', name: 'Ext', external: true, parentId: null });
    const { id: id2 } = await addElementDirect(db, REPO, { type: 'Container', name: 'Int', external: false, parentId: null });
    const r1 = db.prepare('SELECT external FROM c4_manual_elements WHERE element_id=?').get(id1) as { external: number };
    const r2 = db.prepare('SELECT external FROM c4_manual_elements WHERE element_id=?').get(id2) as { external: number };
    expect(r1.external).toBe(1);
    expect(r2.external).toBe(0);
  });
});

describe('updateElementDirect', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test('name のみ更新（description は変わらない）', async () => {
    const { id } = await addElementDirect(db, REPO, { type: 'Container', name: 'Old', external: false, parentId: null, description: 'Desc' });
    await updateElementDirect(db, REPO, id, { name: 'New' });
    const row = db.prepare('SELECT name, description FROM c4_manual_elements WHERE element_id=?').get(id) as { name: string; description: string };
    expect(row.name).toBe('New');
    expect(row.description).toBe('Desc');
  });

  test('changes 空 -> no-op', async () => {
    const { id } = await addElementDirect(db, REPO, { type: 'Container', name: 'Same', external: false, parentId: null });
    await updateElementDirect(db, REPO, id, {});
    const row = db.prepare('SELECT name FROM c4_manual_elements WHERE element_id=?').get(id) as { name: string };
    expect(row.name).toBe('Same');
  });
});

describe('removeElementDirect', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test('関連 relationship も削除される', async () => {
    const { id: fromId } = await addElementDirect(db, REPO, { type: 'Container', name: 'From', external: false, parentId: null });
    const { id: toId } = await addElementDirect(db, REPO, { type: 'Container', name: 'To', external: false, parentId: null });
    const { id: relId } = await addRelationshipDirect(db, REPO, { fromId, toId });

    await removeElementDirect(db, REPO, fromId);

    const el = db.prepare('SELECT * FROM c4_manual_elements WHERE element_id=?').get(fromId);
    expect(el).toBeUndefined();
    const rel = db.prepare('SELECT * FROM c4_manual_relationships WHERE rel_id=?').get(relId);
    expect(rel).toBeUndefined();
  });
});

describe('addGroupDirect', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test('group_id が grp_ 始まり', async () => {
    const result = await addGroupDirect(db, REPO, { memberIds: ['e1', 'e2'] });
    expect(result.id).toMatch(/^grp_/);
  });

  test('member_ids が JSON で保存される', async () => {
    const { id } = await addGroupDirect(db, REPO, { memberIds: ['e1', 'e2'], label: 'G1' });
    const row = db.prepare('SELECT member_ids, label FROM c4_manual_groups WHERE group_id=?').get(id) as { member_ids: string; label: string };
    expect(JSON.parse(row.member_ids)).toEqual(['e1', 'e2']);
    expect(row.label).toBe('G1');
  });
});

describe('updateGroupDirect', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test('memberIds 更新', async () => {
    const { id } = await addGroupDirect(db, REPO, { memberIds: ['e1'] });
    await updateGroupDirect(db, REPO, id, { memberIds: ['e1', 'e2', 'e3'] });
    const row = db.prepare('SELECT member_ids FROM c4_manual_groups WHERE group_id=?').get(id) as { member_ids: string };
    expect(JSON.parse(row.member_ids)).toEqual(['e1', 'e2', 'e3']);
  });

  test('label null 更新', async () => {
    const { id } = await addGroupDirect(db, REPO, { memberIds: [], label: 'Labeled' });
    await updateGroupDirect(db, REPO, id, { label: null });
    const row = db.prepare('SELECT label FROM c4_manual_groups WHERE group_id=?').get(id) as { label: string | null };
    expect(row.label).toBeNull();
  });
});

describe('removeGroupDirect', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test('削除確認', async () => {
    const { id } = await addGroupDirect(db, REPO, { memberIds: [] });
    await removeGroupDirect(db, REPO, id);
    const row = db.prepare('SELECT * FROM c4_manual_groups WHERE group_id=?').get(id);
    expect(row).toBeUndefined();
  });
});

describe('addRelationshipDirect', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test('rel_id が rel_ 始まり', async () => {
    const result = await addRelationshipDirect(db, REPO, { fromId: 'e1', toId: 'e2' });
    expect(result.id).toMatch(/^rel_/);
  });

  test('SELECT で取得できる', async () => {
    const { id } = await addRelationshipDirect(db, REPO, { fromId: 'e1', toId: 'e2', label: 'uses', technology: 'HTTP' });
    const row = db.prepare('SELECT * FROM c4_manual_relationships WHERE rel_id=?').get(id) as Record<string, unknown> | undefined;
    expect(row).toBeDefined();
    expect(row!.from_id).toBe('e1');
    expect(row!.to_id).toBe('e2');
    expect(row!.label).toBe('uses');
    expect(row!.technology).toBe('HTTP');
  });
});

describe('removeRelationshipDirect', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test('削除確認', async () => {
    const { id } = await addRelationshipDirect(db, REPO, { fromId: 'e1', toId: 'e2' });
    await removeRelationshipDirect(db, REPO, id);
    const row = db.prepare('SELECT * FROM c4_manual_relationships WHERE rel_id=?').get(id);
    expect(row).toBeUndefined();
  });
});

describe('withRetry', () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test('SQLITE_BUSY で 1 回失敗 -> 2 回目成功', async () => {
    let callCount = 0;
    const original = db.prepare.bind(db);
    const prepareSpy = jest.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (sql.includes('c4_manual_elements') && sql.startsWith('INSERT')) {
        callCount++;
        if (callCount === 1) {
          const err = new Error('SQLITE_BUSY: database is locked');
          throw err;
        }
      }
      return original(sql);
    });

    const result = await addElementDirect(db, REPO, { type: 'Container', name: 'Retry', external: false, parentId: null });
    expect(result.id).toMatch(/^man_/);
    prepareSpy.mockRestore();
  });

  test('3 回連続 SQLITE_BUSY -> throw', async () => {
    let callCount = 0;
    const original = db.prepare.bind(db);
    const prepareSpy = jest.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (sql.includes('c4_manual_elements') && sql.startsWith('INSERT')) {
        callCount++;
        const err = new Error('SQLITE_BUSY: database is locked');
        throw err;
      }
      return original(sql);
    });

    await expect(
      addElementDirect(db, REPO, { type: 'Container', name: 'Fail', external: false, parentId: null }),
    ).rejects.toThrow(/SQLITE_BUSY/);
    expect(callCount).toBe(3);
    prepareSpy.mockRestore();
  });
});
