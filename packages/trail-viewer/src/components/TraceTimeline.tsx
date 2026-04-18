import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import type { TrailMessage, TrailSession, TrailTreeNode } from '../parser/types';
import { useTrailTheme } from './TrailThemeContext';

const TIMELINE_HEIGHT = 180;
const COLLAPSED_HEIGHT = 32;
const STORAGE_KEY = 'trail.timeline.collapsed';
const LANE_LABEL_WIDTH = 72;
const TIME_AXIS_HEIGHT = 24;

type LaneKind = 'user' | 'assistant' | 'system' | 'subagent';

const LANES: readonly { readonly kind: LaneKind; readonly label: string }[] = [
  { kind: 'user', label: 'User' },
  { kind: 'assistant', label: 'AI' },
  { kind: 'system', label: 'System' },
  { kind: 'subagent', label: 'Subagent' },
];

// Agent color palette (HSL-based for distinctness)
const AGENT_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#FFD93D', '#6A4C93', '#1982C4',
  '#8AC926', '#F48C06', '#E56B6F', '#52B788', '#B5838D',
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getAgentColor(agentId: string): string {
  return AGENT_PALETTE[hashString(agentId) % AGENT_PALETTE.length];
}

function getToolColor(
  toolNames: readonly string[],
  toolColors: { bash: string; edit: string; write: string; read: string; task: string; other: string; plain: string },
): string {
  if (toolNames.includes('Task')) return toolColors.task;
  if (toolNames.includes('Bash')) return toolColors.bash;
  if (toolNames.includes('Edit') || toolNames.includes('MultiEdit')) return toolColors.edit;
  if (toolNames.includes('Write')) return toolColors.write;
  if (toolNames.includes('Read')) return toolColors.read;
  if (toolNames.length > 0) return toolColors.other;
  return toolColors.plain;
}

function scrollToMessage(uuid: string): void {
  const el = document.querySelector(`[data-message-uuid="${uuid}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function formatTimeLabel(ms: number, includeDate: boolean): string {
  if (!Number.isFinite(ms) || ms <= 0) return '-';
  const d = new Date(ms);
  const opts: Intl.DateTimeFormatOptions = includeDate
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

interface TraceTimelineProps {
  readonly nodes: readonly TrailTreeNode[];
  readonly session?: TrailSession;
  readonly onSelectMessage: (uuid: string) => void;
}

interface TimelineEntry {
  readonly uuid: string;
  readonly timestamp: string;
  readonly laneKind: LaneKind;
  readonly agentId?: string;
  readonly agentDescription?: string;
  readonly toolNames: readonly string[];
  readonly hasCommit: boolean;
  readonly role: string;
}

export function TraceTimeline({
  nodes,
  session,
  onSelectMessage,
}: Readonly<TraceTimelineProps>) {
  const { colors } = useTrailTheme();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toolColors = {
    bash: '#4CAF50',
    edit: '#2196F3',
    write: '#9C27B0',
    read: '#757575',
    task: '#FFB300',
    other: '#FF9800',
    plain: '#90A4AE',
  };

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const timelineMessages = useMemo<readonly TimelineEntry[]>(() => {
    const result: TimelineEntry[] = [];
    function traverse(n: TrailTreeNode): void {
      const msg = n.message as TrailMessage;
      const t = msg.type;
      if (t === 'user' || t === 'assistant' || t === 'system') {
        const hasAgentId = typeof msg.agentId === 'string' && msg.agentId.length > 0;
        const laneKind: LaneKind = hasAgentId ? 'subagent' : t;
        result.push({
          uuid: msg.uuid,
          timestamp: msg.timestamp,
          laneKind,
          agentId: hasAgentId ? msg.agentId : undefined,
          agentDescription: msg.agentDescription,
          toolNames: (msg.toolCalls ?? []).map((tc) => tc.name),
          hasCommit: (msg.triggerCommitHashes?.length ?? 0) > 0,
          role: t,
        });
      }
      for (const child of n.children) traverse(child);
    }
    for (const node of nodes) traverse(node);
    return result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [nodes]);

  // Discover sub-tracks within the Subagent lane: one per unique agentId, ordered by first appearance
  const subagentTracks = useMemo<readonly string[]>(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const m of timelineMessages) {
      if (m.laneKind === 'subagent' && m.agentId && !seen.has(m.agentId)) {
        seen.add(m.agentId);
        order.push(m.agentId);
      }
    }
    return order;
  }, [timelineMessages]);

  const subTrackCount = Math.max(subagentTracks.length, 1);
  const subagentIndex = useMemo(() => {
    const map = new Map<string, number>();
    subagentTracks.forEach((id, i) => map.set(id, i));
    return map;
  }, [subagentTracks]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    const sStart = session?.startTime ? Date.parse(session.startTime) : NaN;
    const sEnd = session?.endTime ? Date.parse(session.endTime) : NaN;
    if (Number.isFinite(sStart) && Number.isFinite(sEnd) && sEnd > sStart) {
      return { rangeStart: sStart, rangeEnd: sEnd };
    }
    if (timelineMessages.length === 0) {
      return { rangeStart: 0, rangeEnd: 0 };
    }
    const first = Date.parse(timelineMessages[0].timestamp);
    const last = Date.parse(timelineMessages[timelineMessages.length - 1].timestamp);
    return { rangeStart: first, rangeEnd: Math.max(last, first + 1) };
  }, [session, timelineMessages]);

  const duration = Math.max(rangeEnd - rangeStart, 1);
  const includeDate = duration > 24 * 60 * 60 * 1000;

  const handleBarClick = useCallback((uuid: string) => {
    onSelectMessage(uuid);
    scrollToMessage(uuid);
  }, [onSelectMessage]);

  const plotLeft = LANE_LABEL_WIDTH;
  const plotRight = 36;
  const plotTop = 8;
  const plotBottom = TIME_AXIS_HEIGHT;

  function getLanePosition(entry: TimelineEntry): { topPct: number; heightPct: number } {
    const laneIndex = LANES.findIndex((l) => l.kind === entry.laneKind);
    const laneBasePct = (laneIndex / LANES.length) * 100;
    const laneHeightPct = 100 / LANES.length;
    if (entry.laneKind === 'subagent' && entry.agentId) {
      // subdivide lane into N tracks
      const trackIndex = subagentIndex.get(entry.agentId) ?? 0;
      const trackHeightPct = laneHeightPct / subTrackCount;
      const trackTopPct = laneBasePct + trackIndex * trackHeightPct;
      return {
        topPct: trackTopPct + trackHeightPct * 0.15,
        heightPct: trackHeightPct * 0.7,
      };
    }
    return {
      topPct: laneBasePct + laneHeightPct * 0.2,
      heightPct: laneHeightPct * 0.6,
    };
  }

  return (
    <Box
      sx={{
        height: collapsed ? COLLAPSED_HEIGHT : TIMELINE_HEIGHT,
        bgcolor: colors.charcoal,
        borderBottom: `1px solid ${colors.border}`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'height 0.2s ease',
        flexShrink: 0,
      }}
      role="region"
      aria-label="Trace timeline"
    >
      <IconButton
        size="small"
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand timeline' : 'Collapse timeline'}
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 2,
          color: colors.textSecondary,
        }}
      >
        {collapsed ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowUpIcon fontSize="small" />}
      </IconButton>

      {!collapsed && (
        <>
          {/* Lane labels */}
          <Box
            sx={{
              position: 'absolute',
              top: plotTop,
              left: 0,
              width: LANE_LABEL_WIDTH,
              bottom: plotBottom,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {LANES.map((lane) => (
              <Box
                key={lane.kind}
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  pr: 1,
                  borderRight: `1px solid ${colors.border}`,
                }}
              >
                <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
                  {lane.label}
                  {lane.kind === 'subagent' && subagentTracks.length > 0 && (
                    <Box component="span" sx={{ ml: 0.5, color: colors.textSecondary, opacity: 0.6 }}>
                      ×{subagentTracks.length}
                    </Box>
                  )}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Plot area */}
          <Box
            sx={{
              position: 'absolute',
              top: plotTop,
              left: plotLeft,
              right: plotRight,
              bottom: plotBottom,
            }}
          >
            {/* Lane background separators */}
            {LANES.map((lane, i) => (
              <Box
                key={`lane-bg-${lane.kind}`}
                sx={{
                  position: 'absolute',
                  top: `${(i / LANES.length) * 100}%`,
                  left: 0,
                  right: 0,
                  height: `${100 / LANES.length}%`,
                  borderBottom: i < LANES.length - 1 ? `1px dashed ${colors.border}` : 'none',
                }}
              />
            ))}

            {timelineMessages.length === 0 ? (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                  データなし
                </Typography>
              </Box>
            ) : (
              timelineMessages.map((msg) => {
                const msgMs = Date.parse(msg.timestamp);
                const leftPct = rangeStart > 0 ? ((msgMs - rangeStart) / duration) * 100 : 0;
                const { topPct, heightPct } = getLanePosition(msg);
                const barColor = msg.laneKind === 'subagent' && msg.agentId
                  ? getAgentColor(msg.agentId)
                  : getToolColor(msg.toolNames, toolColors);
                const toolSuffix = msg.toolNames.length > 0 ? ` · ${msg.toolNames.join(', ')}` : '';
                const agentSuffix = msg.agentId
                  ? ` · agent=${msg.agentId.slice(0, 8)}${msg.agentDescription ? ` (${msg.agentDescription})` : ''}`
                  : '';
                const tooltipLabel = `[${msg.role}] ${msg.timestamp}${toolSuffix}${agentSuffix}`;

                return (
                  <Tooltip key={msg.uuid} title={tooltipLabel} placement="top">
                    <Box
                      component="button"
                      onClick={() => handleBarClick(msg.uuid)}
                      aria-label={`${msg.role} message at ${msg.timestamp}`}
                      sx={{
                        position: 'absolute',
                        left: `${Math.max(0, Math.min(leftPct, 99.5))}%`,
                        top: `${topPct}%`,
                        width: 4,
                        height: `${heightPct}%`,
                        bgcolor: barColor,
                        borderRadius: '2px',
                        border: 'none',
                        cursor: 'pointer',
                        p: 0,
                        transform: 'translateX(-50%)',
                        '&:hover': { opacity: 0.7 },
                        '&:focus-visible': { outline: `2px solid ${colors.iceBlue}`, outlineOffset: '2px' },
                      }}
                    >
                      {msg.hasCommit && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: -5,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            bgcolor: colors.iceBlue,
                          }}
                          aria-hidden="true"
                        />
                      )}
                    </Box>
                  </Tooltip>
                );
              })
            )}
          </Box>

          {/* Time axis */}
          <Box
            sx={{
              position: 'absolute',
              left: plotLeft,
              right: plotRight,
              bottom: 0,
              height: TIME_AXIS_HEIGHT,
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1,
            }}
          >
            <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
              {formatTimeLabel(rangeStart, includeDate)}
            </Typography>
            <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
              {formatTimeLabel(rangeEnd, includeDate)}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
}

// IntersectionObserver hook for scroll sync (TraceTree → Timeline)
export function useTimelineScrollSync(
  nodes: readonly TrailTreeNode[],
): { visibleUuid: string | null } {
  const [visibleUuid, setVisibleUuid] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current?.disconnect();

    const uuids = new Set(nodes.flatMap(function collect(n: TrailTreeNode): string[] {
      return [n.message.uuid, ...n.children.flatMap(collect)];
    }));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const uuid = (entry.target as HTMLElement).dataset['messageUuid'];
            if (uuid && uuids.has(uuid)) {
              setVisibleUuid(uuid);
              break;
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    for (const uuid of uuids) {
      const el = document.querySelector(`[data-message-uuid="${uuid}"]`);
      if (el) observer.observe(el);
    }

    observerRef.current = observer;
    return () => observer.disconnect();
  }, [nodes]);

  return { visibleUuid };
}
