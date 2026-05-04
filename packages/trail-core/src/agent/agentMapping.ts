import path from 'path';
import type { MappingState, SessionMapping, WorktreeEntry, WorktreeMapping } from './types';

// ---------------------------------------------------------------------------
// Local AgentInfo-compatible type (trail-core has no dependency on vscode-common)
// ---------------------------------------------------------------------------

interface AgentInfoLike {
  readonly sessionId: string;
  readonly editing: boolean;
  readonly file: string;
  readonly timestamp: string;
  readonly branch: string;
  readonly sessionEdits: readonly { file: string; timestamp: string }[];
  readonly plannedEdits: readonly string[];
  readonly sessionTitle?: string;
}

// ---------------------------------------------------------------------------
// classifySession
// ---------------------------------------------------------------------------

interface ClassifyOptions {
  activeThresholdSec?: number;
  recentThresholdSec?: number;
}

export function classifySession(
  timestamp: string,
  now: Date = new Date(),
  options: ClassifyOptions = {}
): MappingState {
  const { activeThresholdSec = 300, recentThresholdSec = 3600 } = options;
  const ageSeconds = (now.getTime() - new Date(timestamp).getTime()) / 1000;
  if (ageSeconds <= activeThresholdSec) {
    return 'active';
  }
  if (ageSeconds <= recentThresholdSec) {
    return 'recent';
  }
  return 'stale';
}

// ---------------------------------------------------------------------------
// resolveWorktree
// ---------------------------------------------------------------------------

export function resolveWorktree(
  file: string,
  branch: string,
  worktrees: readonly WorktreeEntry[]
): WorktreeEntry | null {
  // 1. file path prefix match (longest wins)
  if (file) {
    let best: WorktreeEntry | null = null;
    for (const wt of worktrees) {
      const prefix = wt.path.endsWith('/') ? wt.path : `${wt.path}/`;
      if (file.startsWith(prefix) || file === wt.path) {
        if (best === null || wt.path.length > best.path.length) {
          best = wt;
        }
      }
    }
    // file が非空でどのworktreeパスにも一致しない場合はブランチ照合せず orphan 扱い。
    // フックは常に同一 git root で branch を取得するため、別リポジトリのセッションが
    // 誤って main worktree に割り当てられるのを防ぐ。
    return best;
  }

  // 2. file が空のとき（セッション開始直後）のみ branch でフォールバック
  const byBranch = worktrees.find((wt) => wt.branch === branch);
  if (byBranch !== undefined) {
    return byBranch;
  }

  return null;
}

// ---------------------------------------------------------------------------
// buildAgentMapping
// ---------------------------------------------------------------------------

interface BuildOptions {
  now?: Date;
  activeThresholdSec?: number;
  recentThresholdSec?: number;
}

const STATE_PRIORITY: Record<MappingState, number> = {
  active: 2,
  recent: 1,
  stale: 0,
};

function aggregateState(states: readonly MappingState[]): MappingState {
  if (states.length === 0) {
    return 'stale';
  }
  return states.reduce<MappingState>(
    (best, s) => (STATE_PRIORITY[s] > STATE_PRIORITY[best] ? s : best),
    states[0]
  );
}

function worktreeName(wt: WorktreeEntry): string {
  if (wt.isMain) {
    return '(main)';
  }
  return path.basename(wt.path);
}

export function buildAgentMapping(
  agents: readonly AgentInfoLike[],
  worktrees: readonly WorktreeEntry[],
  options: BuildOptions = {}
): readonly WorktreeMapping[] {
  const { now = new Date(), activeThresholdSec, recentThresholdSec } = options;

  const classifyOpts: ClassifyOptions = {};
  if (activeThresholdSec !== undefined) {
    classifyOpts.activeThresholdSec = activeThresholdSec;
  }
  if (recentThresholdSec !== undefined) {
    classifyOpts.recentThresholdSec = recentThresholdSec;
  }

  // Map worktree path → session list
  const wtSessions = new Map<string, SessionMapping[]>();
  const orphanSessions: SessionMapping[] = [];

  for (const agent of agents) {
    const state = classifySession(agent.timestamp, now, classifyOpts);
    const ageSeconds = (now.getTime() - new Date(agent.timestamp).getTime()) / 1000;
    const session: SessionMapping = {
      sessionId: agent.sessionId,
      state,
      editing: agent.editing,
      file: agent.file,
      fileBasename: agent.file ? path.basename(agent.file) : '',
      timestamp: agent.timestamp,
      ageSeconds,
      sessionEdits: agent.sessionEdits,
      plannedEdits: agent.plannedEdits,
      sessionTitle: agent.sessionTitle,
    };

    const resolved = resolveWorktree(agent.file, agent.branch, worktrees);
    if (resolved === null) {
      orphanSessions.push(session);
    } else {
      const key = resolved.path;
      const existing = wtSessions.get(key);
      if (existing !== undefined) {
        existing.push(session);
      } else {
        wtSessions.set(key, [session]);
      }
    }
  }

  const result: WorktreeMapping[] = [];

  // Build entries for each worktree that has at least one session
  for (const wt of worktrees) {
    const sessions = wtSessions.get(wt.path);
    if (sessions === undefined || sessions.length === 0) {
      continue;
    }
    const states = sessions.map((s) => s.state);
    result.push({
      worktreePath: wt.path,
      worktreeName: worktreeName(wt),
      isMain: wt.isMain,
      branch: wt.branch,
      sessions,
      aggregatedState: aggregateState(states),
      activeCount: sessions.filter((s) => s.state === 'active').length,
    });
  }

  // Orphan group (only if non-empty)
  if (orphanSessions.length > 0) {
    const states = orphanSessions.map((s) => s.state);
    result.push({
      worktreePath: '(orphan)',
      worktreeName: '(orphan)',
      isMain: false,
      branch: '(orphan)',
      sessions: orphanSessions,
      aggregatedState: aggregateState(states),
      activeCount: orphanSessions.filter((s) => s.state === 'active').length,
    });
  }

  return result;
}
