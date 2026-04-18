import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import type { TrailMessage, TrailSession, TrailTreeNode } from '../parser/types';
import { useTrailTheme } from './TrailThemeContext';

const TIMELINE_HEIGHT = 160;
const COLLAPSED_HEIGHT = 32;
const STORAGE_KEY = 'trail.timeline.collapsed';
const LANE_LABEL_WIDTH = 60;
const TIME_AXIS_HEIGHT = 24;

type MessageRole = 'user' | 'assistant' | 'system';

const LANES: readonly { readonly role: MessageRole; readonly label: string }[] = [
  { role: 'user', label: 'User' },
  { role: 'assistant', label: 'AI' },
  { role: 'system', label: 'System' },
];

function getToolColor(
  toolNames: readonly string[],
  toolColors: { bash: string; edit: string; write: string; read: string; other: string; plain: string },
): string {
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

  const timelineMessages = useMemo(() => {
    const result: Array<{
      uuid: string;
      timestamp: string;
      role: MessageRole;
      toolNames: readonly string[];
      hasCommit: boolean;
    }> = [];
    function traverse(n: TrailTreeNode): void {
      const msg = n.message as TrailMessage;
      const t = msg.type;
      if (t === 'user' || t === 'assistant' || t === 'system') {
        result.push({
          uuid: msg.uuid,
          timestamp: msg.timestamp,
          role: t,
          toolNames: (msg.toolCalls ?? []).map((tc) => tc.name),
          hasCommit: (msg.triggerCommitHashes?.length ?? 0) > 0,
        });
      }
      for (const child of n.children) traverse(child);
    }
    for (const node of nodes) traverse(node);
    return result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [nodes]);

  // Compute time range from session or fall back to message timestamps
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
      {/* Toggle button */}
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
                key={lane.role}
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
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Plot area with lanes */}
          <Box
            sx={{
              position: 'absolute',
              top: plotTop,
              left: plotLeft,
              right: plotRight,
              bottom: plotBottom,
            }}
          >
            {/* Lane separators (horizontal lines) */}
            {LANES.map((lane, i) => (
              <Box
                key={`lane-bg-${lane.role}`}
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
                const barColor = getToolColor(msg.toolNames, toolColors);
                const laneIndex = LANES.findIndex((l) => l.role === msg.role);
                const topPct = (laneIndex / LANES.length) * 100;
                const laneHeightPct = 100 / LANES.length;
                const tooltipLabel = `[${msg.role}] ${msg.timestamp}${msg.toolNames.length > 0 ? ` · ${msg.toolNames.join(', ')}` : ''}`;

                return (
                  <Tooltip key={msg.uuid} title={tooltipLabel} placement="top">
                    <Box
                      component="button"
                      onClick={() => handleBarClick(msg.uuid)}
                      aria-label={`${msg.role} message at ${msg.timestamp}`}
                      sx={{
                        position: 'absolute',
                        left: `${Math.max(0, Math.min(leftPct, 99.5))}%`,
                        top: `calc(${topPct}% + ${laneHeightPct * 0.2}%)`,
                        width: 4,
                        height: `${laneHeightPct * 0.6}%`,
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
                            bottom: -6,
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
