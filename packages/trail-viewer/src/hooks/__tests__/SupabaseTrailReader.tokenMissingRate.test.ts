/**
 * Task 7 - SupabaseTrailReader token missing-rate compensation integration test.
 *
 * Strategy: mock @supabase/supabase-js createClient so that each
 * this.client.from(...).select(...).xxx() call returns controlled fixture data.
 */

import { SupabaseTrailReader } from '../SupabaseTrailReader';

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

type FromCallHandler = (table: string) => unknown;

function makeSupabaseMock(fromHandler: FromCallHandler): {
  createClient: () => { from: (t: string) => unknown };
} {
  return {
    createClient: () => ({
      from: (table: string) => fromHandler(table),
    }),
  };
}

// A chainable mock that resolves to { data, error }
function chain(resolvedData: unknown, resolvedError: unknown = null) {
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  const methods = ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit', 'filter'];
  for (const m of methods) {
    obj[m] = (..._args: unknown[]) => obj;
  }
  // Terminal: awaiting returns { data, error }
  obj.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve({ data: resolvedData, error: resolvedError }));
  return obj;
}

// ---------------------------------------------------------------------------
// Fixture: 5 CC sessions (100 turns, 0 missing) + 3 Codex sessions (60 turns, 24 missing)
// ---------------------------------------------------------------------------

const TS = '2026-05-01T10:00:00.000Z';

const CC_SESSIONS = 5;
const CC_TURNS_PER = 20;
const CC_INPUT = 10;
const CC_OUTPUT = 10;
const CX_SESSIONS = 3;
const CX_TURNS_PER = 20;
const CX_OBSERVED = 12;
const CX_MISSING = 8;
const CX_INPUT = 5;
const CX_OUTPUT = 5;

// Build sessions
const sessions = [
  ...Array.from({ length: CC_SESSIONS }, (_, i) => ({
    id: `cc-${i}`,
    source: 'claude_code',
    start_time: TS,
  })),
  ...Array.from({ length: CX_SESSIONS }, (_, i) => ({
    id: `cx-${i}`,
    source: 'codex',
    start_time: TS,
  })),
];

// Build trail_messages rows (type='assistant')
const messages: Array<{
  session_id: string;
  timestamp: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}> = [];

for (let s = 0; s < CC_SESSIONS; s++) {
  for (let t = 0; t < CC_TURNS_PER; t++) {
    messages.push({
      session_id: `cc-${s}`, timestamp: TS,
      input_tokens: CC_INPUT, output_tokens: CC_OUTPUT,
      cache_read_tokens: 0, cache_creation_tokens: 0,
    });
  }
}
for (let s = 0; s < CX_SESSIONS; s++) {
  for (let t = 0; t < CX_OBSERVED; t++) {
    messages.push({
      session_id: `cx-${s}`, timestamp: TS,
      input_tokens: CX_INPUT, output_tokens: CX_OUTPUT,
      cache_read_tokens: 0, cache_creation_tokens: 0,
    });
  }
  for (let t = 0; t < CX_MISSING; t++) {
    messages.push({
      session_id: `cx-${s}`, timestamp: TS,
      input_tokens: 0, output_tokens: 0,
      cache_read_tokens: 0, cache_creation_tokens: 0,
    });
  }
}

// Minimal cost rows (zero cost)
const costRows = sessions.map(s => ({
  session_id: s.id,
  estimated_cost_usd: 0,
}));

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js
// ---------------------------------------------------------------------------

jest.mock('@supabase/supabase-js', () => {
  const fromHandler: FromCallHandler = (table: string) => {
    if (table === 'trail_sessions') return chain(sessions);
    if (table === 'trail_session_commits') return chain([]);
    if (table === 'trail_messages') return chain(messages);
    if (table === 'trail_session_costs') return chain(costRows);
    return chain(null, new Error(`unexpected table: ${table}`));
  };
  return makeSupabaseMock(fromHandler);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupabaseTrailReader.getAnalytics - token missing-rate compensation', () => {
  let reader: SupabaseTrailReader;

  beforeAll(() => {
    reader = new SupabaseTrailReader('http://localhost', 'anon-key');
  });

  it('applies factor to totalInput and totalOutput', async () => {
    const analytics = await reader.getAnalytics();
    expect(analytics).not.toBeNull();
    // Claude: 5×20×10 = 1000 input, 1000 output (factor=1)
    // Codex raw: 3×12×5 = 180 input, 180 output; factor=60/36=5/3; adjusted=300
    expect(analytics!.totals.inputTokens).toBe(1000 + 300);
    expect(analytics!.totals.outputTokens).toBe(1000 + 300);
    expect(analytics!.totals.cacheReadTokens).toBe(0);
    expect(analytics!.totals.cacheCreationTokens).toBe(0);
  });

  it('dailyActivity entry reflects factor-adjusted tokens', async () => {
    const analytics = await reader.getAnalytics();
    expect(analytics).not.toBeNull();
    const dayEntry = analytics!.dailyActivity.find(d => d.date === '2026-05-01');
    expect(dayEntry).toBeDefined();
    expect(dayEntry!.inputTokens).toBe(1300);
    expect(dayEntry!.outputTokens).toBe(1300);
  });

  it('totals.inputTokens + outputTokens equals agentStats sum (2600)', async () => {
    const analytics = await reader.getAnalytics();
    expect(analytics).not.toBeNull();
    const total = analytics!.totals.inputTokens + analytics!.totals.outputTokens
      + analytics!.totals.cacheReadTokens + analytics!.totals.cacheCreationTokens;
    expect(total).toBe(2600);
  });
});
