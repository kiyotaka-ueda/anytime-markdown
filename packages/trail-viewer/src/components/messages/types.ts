import type { TrailMessage, TrailSession, TrailTreeNode } from '../../domain/parser/types';

export type LaneKind = 'user' | 'assistant' | 'system' | 'subagent';

export interface MessageTimelineProps {
  readonly nodes: readonly TrailTreeNode[];
  readonly session?: TrailSession;
  readonly onSelectMessage: (uuid: string) => void;
}

export interface TimelineEntry {
  readonly uuid: string;
  readonly timestamp: string;
  readonly ms: number;
  readonly laneKind: LaneKind;
  readonly agentId?: string;
  readonly agentDescription?: string;
  readonly toolNames: readonly string[];
  readonly hasCommit: boolean;
  readonly role: string;
}

export interface Turn {
  readonly userMsg: TimelineEntry | null;
  readonly aiMsgs: TimelineEntry[];
  readonly subagentMsgs: TimelineEntry[];
  readonly systemMsgs: TimelineEntry[];
}

// `TrailMessage` is re-exported here for downstream timeline modules that
// build TimelineEntry-compatible structures from raw JSONL messages.
export type { TrailMessage };
