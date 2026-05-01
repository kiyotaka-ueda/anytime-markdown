// __non_webpack_require__ はwebpackグローバル。テスト環境では sql-asm.js を直接ロードするよう差し替え
const sqlAsmActual = require(require.resolve('sql.js/dist/sql-asm.js')); // eslint-disable-line @typescript-eslint/no-require-imports
(global as Record<string, unknown>).__non_webpack_require__ = (_path: string) => sqlAsmActual;

import { TrailDatabase } from '../TrailDatabase';
import { createTestTrailDatabase } from './support/createTestDb';

type SqlJsDb = {
  run: (sql: string, params?: ReadonlyArray<unknown>) => void;
};

const inner = (db: TrailDatabase): SqlJsDb => (db as unknown as { db: SqlJsDb }).db;

const insertSession = (db: TrailDatabase, sessionId: string, source: string): void => {
  inner(db).run(
    `INSERT OR IGNORE INTO sessions (
       id, slug, repo_name, version, entrypoint, model, start_time, end_time,
       message_count, file_path, file_size, imported_at, source
     ) VALUES (?, ?, 'r', '0', '', '', '', '', 0, '', 0, '', ?)`,
    [sessionId, sessionId, source],
  );
};

const insertAssistantMessage = (
  db: TrailDatabase,
  uuid: string,
  sessionId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  timestamp = '2026-05-01T10:00:00.000Z',
): void => {
  inner(db).run(
    `INSERT OR IGNORE INTO messages (
       uuid, session_id, type, model, input_tokens, output_tokens,
       cache_read_tokens, cache_creation_tokens, timestamp
     ) VALUES (?, ?, 'assistant', ?, ?, ?, 0, 0, ?)`,
    [uuid, sessionId, model, inputTokens, outputTokens, timestamp],
  );
};

describe('TrailDatabase.getCombinedData - token missing rate compensation', () => {
  let db: TrailDatabase;

  beforeAll(async () => {
    db = await createTestTrailDatabase();
  });

  describe('modelStats', () => {
    beforeAll(() => {
      // Codex session: 10 assistant messages, 4 with tokens=0 (missing)
      insertSession(db, 'session-codex-1', 'codex');
      const codexModel = 'gpt-5.4-codex';
      for (let i = 0; i < 6; i++) {
        // observed turns: input=100, output=100
        insertAssistantMessage(db, `msg-codex-observed-${i}`, 'session-codex-1', codexModel, 100, 100);
      }
      for (let i = 0; i < 4; i++) {
        // missing turns: tokens=0
        insertAssistantMessage(db, `msg-codex-missing-${i}`, 'session-codex-1', codexModel, 0, 0);
      }

      // Claude Code session: 5 assistant messages, none missing (different model)
      insertSession(db, 'session-cc-1', 'claude_code');
      const ccModel = 'claude-sonnet-4-6';
      for (let i = 0; i < 5; i++) {
        insertAssistantMessage(db, `msg-cc-${i}`, 'session-cc-1', ccModel, 200, 200);
      }
    });

    it('applies factor to Codex modelStats tokens', () => {
      const data = db.getCombinedData('day', 30);
      const codexModel = data.modelStats.find(
        r => r.tokenMissingTurns > 0,
      );
      expect(codexModel).toBeDefined();
      expect(codexModel!.tokenMissingRate).toBeCloseTo(0.4);
      expect(codexModel!.tokenTotalTurns).toBe(10);
      expect(codexModel!.tokenMissingTurns).toBe(4);

      // raw tokens = 6 * (100 + 100) = 1200
      // factor = 10 / 6 ≈ 1.667
      // adjusted = round(1200 * 10/6) = round(2000) = 2000
      const rawTokens = 6 * 200;
      const factor = 10 / 6;
      expect(codexModel!.tokens).toBe(Math.round(rawTokens * factor));
    });

    it('has factor=1 (no compensation) for Claude Code modelStats', () => {
      const data = db.getCombinedData('day', 30);
      const ccModel = data.modelStats.find(
        r => r.tokenMissingTurns === 0 && r.tokenTotalTurns > 0,
      );
      expect(ccModel).toBeDefined();
      expect(ccModel!.tokenMissingRate).toBe(0);
      // raw tokens = 5 * 400 = 2000, factor = 1
      expect(ccModel!.tokens).toBe(5 * 400);
    });

    it('includes tokenMissingRate, tokenTotalTurns, tokenMissingTurns on all rows', () => {
      const data = db.getCombinedData('day', 30);
      for (const row of data.modelStats) {
        expect(typeof row.tokenMissingRate).toBe('number');
        expect(typeof row.tokenTotalTurns).toBe('number');
        expect(typeof row.tokenMissingTurns).toBe('number');
      }
    });
  });
});
