// domain/usecase/BackfillMessageCommits.ts — match JSONL messages to git commits

import type { TrailMessage, TrailSessionCommit, MessageCommitMatchConfidence } from '../model/session';

export interface MessageCommitMatch {
  readonly messageUuid: string;
  readonly commitHash: string;
  readonly matchConfidence: MessageCommitMatchConfidence;
}

const HIGH_THRESHOLD_MS = 10_000;
const MEDIUM_THRESHOLD_MS = 10_000;
const LOW_THRESHOLD_MS = 30_000;

function hasGitCommitInBash(msg: TrailMessage): boolean {
  return (msg.toolCalls ?? []).some(
    (tc) => tc.name === 'Bash' && typeof tc.input?.command === 'string'
      && (tc.input.command as string).includes('git commit'),
  );
}

function hasBashTool(msg: TrailMessage): boolean {
  return (msg.toolCalls ?? []).some((tc) => tc.name === 'Bash');
}

export function matchCommitsToMessages(
  messages: readonly TrailMessage[],
  commits: readonly TrailSessionCommit[],
): readonly MessageCommitMatch[] {
  const assistantMessages = messages
    .filter((m) => m.type === 'assistant')
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const matches: MessageCommitMatch[] = [];

  for (const commit of commits) {
    const commitMs = Date.parse(commit.committedAt);
    if (Number.isNaN(commitMs)) continue;

    let match: MessageCommitMatch | null = null;

    // 優先度1: git commit を含む Bash
    for (let i = assistantMessages.length - 1; i >= 0; i--) {
      const m = assistantMessages[i];
      const msgMs = Date.parse(m.timestamp);
      if (Number.isNaN(msgMs) || msgMs > commitMs) continue;
      if (commitMs - msgMs > HIGH_THRESHOLD_MS) break;
      if (hasGitCommitInBash(m)) {
        match = { messageUuid: m.uuid, commitHash: commit.commitHash, matchConfidence: 'high' };
        break;
      }
    }

    // 優先度2: Bash を含む
    if (!match) {
      for (let i = assistantMessages.length - 1; i >= 0; i--) {
        const m = assistantMessages[i];
        const msgMs = Date.parse(m.timestamp);
        if (Number.isNaN(msgMs) || msgMs > commitMs) continue;
        if (commitMs - msgMs > MEDIUM_THRESHOLD_MS) break;
        if (hasBashTool(m)) {
          match = { messageUuid: m.uuid, commitHash: commit.commitHash, matchConfidence: 'medium' };
          break;
        }
      }
    }

    // 優先度3: 任意の assistant メッセージ
    if (!match) {
      for (let i = assistantMessages.length - 1; i >= 0; i--) {
        const m = assistantMessages[i];
        const msgMs = Date.parse(m.timestamp);
        if (Number.isNaN(msgMs) || msgMs > commitMs) continue;
        if (commitMs - msgMs > LOW_THRESHOLD_MS) break;
        match = { messageUuid: m.uuid, commitHash: commit.commitHash, matchConfidence: 'low' };
        break;
      }
    }

    if (match) matches.push(match);
  }

  return matches;
}
