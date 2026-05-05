import type { Database } from 'better-sqlite3';

async function withRetry<T>(fn: () => T, attempts = 3): Promise<T> {
  const delays = [50, 200, 800];
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/SQLITE_BUSY|database is locked/i.test(msg)) throw e;
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delays[i]!));
    }
  }
  throw lastErr;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function upsertCommunitySummariesDirect(
  db: Database,
  repoName: string,
  rows: ReadonlyArray<{ communityId: number; name: string; summary: string }>,
): Promise<{ updated: number }> {
  return withRetry(() => {
    let updated = 0;
    const updateStmt = db.prepare(
      `UPDATE current_code_graph_communities SET name = ?, summary = ?, updated_at = datetime('now') WHERE repo_name = ? AND community_id = ?`,
    );
    const insertStmt = db.prepare(
      `INSERT INTO current_code_graph_communities (repo_name, community_id, label, name, summary, generated_at, updated_at) VALUES (?, ?, '', ?, ?, datetime('now'), datetime('now'))`,
    );
    const tx = db.transaction(() => {
      for (const row of rows) {
        const result = updateStmt.run(row.name, row.summary, repoName, row.communityId);
        if (result.changes === 0) {
          insertStmt.run(repoName, row.communityId, row.name, row.summary);
        } else {
          updated++;
        }
      }
    });
    tx();
    return { updated };
  });
}

export async function upsertCommunityMappingsDirect(
  db: Database,
  repoName: string,
  rows: ReadonlyArray<{
    communityId: number;
    mappings: ReadonlyArray<{ elementId: string; elementType: string; role: 'primary' | 'secondary' | 'dependency' }>;
  }>,
): Promise<{ updated: number; inserted: number }> {
  return withRetry(() => {
    // Ensure mappings_json column exists
    const cols = db.pragma('table_info(current_code_graph_communities)') as Array<{ name: string }>;
    const hasMappingsJson = cols.some((c) => c.name === 'mappings_json');
    if (!hasMappingsJson) {
      db.prepare('ALTER TABLE current_code_graph_communities ADD COLUMN mappings_json TEXT').run();
    }

    let updated = 0;
    let inserted = 0;
    const updateStmt = db.prepare(
      `UPDATE current_code_graph_communities SET mappings_json = ?, updated_at = datetime('now') WHERE repo_name = ? AND community_id = ?`,
    );
    const insertStmt = db.prepare(
      `INSERT INTO current_code_graph_communities (repo_name, community_id, label, name, summary, mappings_json, generated_at, updated_at) VALUES (?, ?, '', '', '', ?, datetime('now'), datetime('now'))`,
    );
    const tx = db.transaction(() => {
      for (const row of rows) {
        const mappingsJson = JSON.stringify(row.mappings);
        const result = updateStmt.run(mappingsJson, repoName, row.communityId);
        if (result.changes === 0) {
          insertStmt.run(repoName, row.communityId, mappingsJson);
          inserted++;
        } else {
          updated++;
        }
      }
    });
    tx();
    return { updated, inserted };
  });
}

export async function addElementDirect(
  db: Database,
  repoName: string,
  body: {
    type: string;
    name: string;
    external: boolean;
    parentId: string | null;
    description?: string;
    serviceType?: string;
  },
): Promise<{ id: string }> {
  return withRetry(() => {
    const elementId = genId('man');
    db.prepare(
      `INSERT INTO c4_manual_elements (repo_name, element_id, type, name, description, external, parent_id, service_type, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(
      repoName,
      elementId,
      body.type,
      body.name,
      body.description ?? null,
      body.external ? 1 : 0,
      body.parentId,
      body.serviceType ?? null,
    );
    return { id: elementId };
  });
}

export async function updateElementDirect(
  db: Database,
  repoName: string,
  id: string,
  changes: { name?: string; description?: string; external?: boolean; serviceType?: string },
): Promise<void> {
  return withRetry(() => {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (changes.name !== undefined) {
      sets.push('name = ?');
      params.push(changes.name);
    }
    if (changes.description !== undefined) {
      sets.push('description = ?');
      params.push(changes.description);
    }
    if (changes.external !== undefined) {
      sets.push('external = ?');
      params.push(changes.external ? 1 : 0);
    }
    if (changes.serviceType !== undefined) {
      sets.push('service_type = ?');
      params.push(changes.serviceType);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    db.prepare(`UPDATE c4_manual_elements SET ${sets.join(', ')} WHERE repo_name = ? AND element_id = ?`).run(
      ...params,
      repoName,
      id,
    );
  });
}

export async function removeElementDirect(db: Database, repoName: string, id: string): Promise<void> {
  return withRetry(() => {
    const tx = db.transaction(() => {
      db.prepare(
        `DELETE FROM c4_manual_relationships WHERE repo_name = ? AND (from_id = ? OR to_id = ?)`,
      ).run(repoName, id, id);
      db.prepare(`DELETE FROM c4_manual_elements WHERE repo_name = ? AND element_id = ?`).run(repoName, id);
    });
    tx();
  });
}

export async function addGroupDirect(
  db: Database,
  repoName: string,
  body: { memberIds: ReadonlyArray<string>; label?: string },
): Promise<{ id: string }> {
  return withRetry(() => {
    const groupId = genId('grp');
    db.prepare(
      `INSERT INTO c4_manual_groups (repo_name, group_id, member_ids, label, updated_at) VALUES (?, ?, ?, ?, datetime('now'))`,
    ).run(repoName, groupId, JSON.stringify(body.memberIds), body.label ?? '');
    return { id: groupId };
  });
}

export async function updateGroupDirect(
  db: Database,
  repoName: string,
  id: string,
  body: { memberIds?: ReadonlyArray<string>; label?: string | null },
): Promise<void> {
  return withRetry(() => {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (body.memberIds !== undefined) {
      sets.push('member_ids = ?');
      params.push(JSON.stringify(body.memberIds));
    }
    if ('label' in body) {
      sets.push('label = ?');
      params.push(body.label);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    db.prepare(`UPDATE c4_manual_groups SET ${sets.join(', ')} WHERE repo_name = ? AND group_id = ?`).run(
      ...params,
      repoName,
      id,
    );
  });
}

export async function removeGroupDirect(db: Database, repoName: string, id: string): Promise<void> {
  return withRetry(() => {
    db.prepare(`DELETE FROM c4_manual_groups WHERE repo_name = ? AND group_id = ?`).run(repoName, id);
  });
}

export async function addRelationshipDirect(
  db: Database,
  repoName: string,
  body: { fromId: string; toId: string; label?: string; technology?: string },
): Promise<{ id: string }> {
  return withRetry(() => {
    const relId = genId('rel');
    db.prepare(
      `INSERT INTO c4_manual_relationships (repo_name, rel_id, from_id, to_id, label, technology, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(repoName, relId, body.fromId, body.toId, body.label ?? null, body.technology ?? null);
    return { id: relId };
  });
}

export async function removeRelationshipDirect(db: Database, repoName: string, id: string): Promise<void> {
  return withRetry(() => {
    db.prepare(`DELETE FROM c4_manual_relationships WHERE repo_name = ? AND rel_id = ?`).run(repoName, id);
  });
}
