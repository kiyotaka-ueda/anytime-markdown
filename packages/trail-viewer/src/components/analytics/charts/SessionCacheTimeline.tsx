import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { BarPlot } from '@mui/x-charts/BarChart';
import { LinePlot } from '@mui/x-charts/LineChart';
import { ChartsDataProvider } from '@mui/x-charts/ChartsDataProvider';
import { ChartsSurface } from '@mui/x-charts/ChartsSurface';
import { ChartsWrapper } from '@mui/x-charts/ChartsWrapper';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip';
import { ChartsGrid } from '@mui/x-charts/ChartsGrid';
import { ChartsAxisHighlight } from '@mui/x-charts/ChartsAxisHighlight';
import { useTrailTheme } from '../../TrailThemeContext';
import { useTrailI18n } from '../../../i18n';
import type { TrailMessage, TrailSession } from '../../../domain/parser/types';
import {
  countCompactDrops,
  dominantTool,
  extractPrefixWithScope,
  parseCommitSubject,
} from '../../../domain/analytics/calculators';
import { fmtDurationShort, fmtTokens } from '../../../domain/analytics/formatters';
import { getMainAgentLabel } from '../helpers';
import type { CommitMarkerData, ErrorMarkerData } from '../types';
import { CommitMarkers } from './shared/CommitMarkers';
import { ErrorMarkers } from './shared/ErrorMarkers';
import { StackedReferenceLines } from './shared/StackedReferenceLines';
import { TurnLaneChart, TurnLaneChartLegend } from './TurnLaneChart';

export function SessionCacheTimeline({
  messages,
  session,
}: Readonly<{
  messages: readonly TrailMessage[];
  session: TrailSession;
}>) {
  const { colors, chartColors, cardSx } = useTrailTheme();
  const { t } = useTrailI18n();
  const assistantMsgs = messages.filter((m) => m.type === 'assistant' && m.usage);
  const hasData = assistantMsgs.length > 0;
  const compactDrops = useMemo(() => countCompactDrops(assistantMsgs), [assistantMsgs]);
  const [mode, setMode] = useState<'tool' | 'skill'>('tool');
  const mainAgentLabel = getMainAgentLabel(session.source);

  const byUuid = useMemo(() => {
    const map = new Map<string, TrailMessage>();
    for (const m of messages) map.set(m.uuid, m);
    return map;
  }, [messages]);

  const dataset = useMemo(() => {
    let cumulativeMs = 0;
    let currentSkill = '';
    return assistantMsgs.map((m, i) => {
      const parent = m.parentUuid ? byUuid.get(m.parentUuid) : undefined;
      const apiInferenceMs = (parent?.timestamp && m.timestamp)
        ? Math.max(0, new Date(m.timestamp).getTime() - new Date(parent.timestamp).getTime())
        : 0;
      const toolExecMs = m.toolExecMs ?? 0;
      cumulativeMs += apiInferenceMs + toolExecMs;
      const inputTokens = m.usage?.inputTokens ?? 0;
      const outputTokens = m.usage?.outputTokens ?? 0;
      const hasTool = (m.toolCalls?.length ?? 0) > 0;
      if (!m.agentId && m.skill) currentSkill = m.skill;
      const skillActive = !m.agentId && currentSkill !== '';
      return {
        turn: i + 1,
        inputTokens,
        outputTokens,
        cacheReadTokens: m.usage?.cacheReadTokens ?? 0,
        cacheCreationTokens: m.usage?.cacheCreationTokens ?? 0,
        toolUsageTokens: hasTool ? inputTokens + outputTokens : 0,
        skillUsageTokens: skillActive ? inputTokens + outputTokens : 0,
        skillExecMs: skillActive ? apiInferenceMs + toolExecMs : 0,
        cumulativeMs,
        apiInferenceMs,
        toolExecMs,
      };
    });
  }, [assistantMsgs, byUuid]);

  const agentIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const m of assistantMsgs) {
      if (m.agentId && !map.has(m.agentId)) map.set(m.agentId, ++idx);
    }
    return map;
  }, [assistantMsgs]);

  const commitMarkers = useMemo<readonly CommitMarkerData[]>(() =>
    assistantMsgs.flatMap((m, i) => {
      if (!((m.triggerCommitHashes && m.triggerCommitHashes.length > 0) || m.hasCommit)) return [];
      const agentLabel = m.agentId ? `SubAgent ${agentIndexMap.get(m.agentId) ?? '?'}` : mainAgentLabel;
      const commitHash = m.triggerCommitHashes?.[0]?.slice(0, 8) ?? '';
      const bashCmd = m.toolCalls?.find((tc) => tc.name === 'Bash')?.input?.command;
      const subject = typeof bashCmd === 'string' ? parseCommitSubject(bashCmd) : '';
      const commitPrefix = extractPrefixWithScope(subject);
      return [{ turn: i + 1, agentLabel, commitHash, commitPrefix }];
    }),
    [assistantMsgs, agentIndexMap, mainAgentLabel],
  );

  const errorMarkers = useMemo<readonly ErrorMarkerData[]>(() =>
    assistantMsgs.flatMap((m, i) => {
      if (!m.hasToolError) return [];
      const agentLabel = m.agentId ? `SubAgent ${agentIndexMap.get(m.agentId) ?? '?'}` : mainAgentLabel;
      const toolName = dominantTool(m.toolCalls) || m.toolCalls?.[0]?.name || '';
      return [{ turn: i + 1, agentLabel, toolName }];
    }),
    [assistantMsgs, agentIndexMap, mainAgentLabel],
  );

  const commitTurns = useMemo(() => commitMarkers.map((m) => m.turn), [commitMarkers]);
  const errorTurns = useMemo(() => errorMarkers.map((m) => m.turn), [errorMarkers]);

  const totalTurns = dataset.length;
  const tickStep = totalTurns <= 5 ? 1
    : totalTurns <= 10 ? 2
    : totalTurns <= 25 ? 5
    : totalTurns <= 50 ? 10
    : totalTurns <= 100 ? 20
    : totalTurns <= 250 ? 50
    : totalTurns <= 500 ? 100
    : totalTurns <= 1000 ? 200
    : 500;

  return (
    <Paper elevation={0} sx={{ ...cardSx, mt: 1, p: 1.5 }}>
      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2">
          {t('analytics.sessionCacheTimelineTitle')} {hasData && `(${assistantMsgs.length} ${t('analytics.turns')})`}
        </Typography>
        {compactDrops >= 2 && (
          <Tooltip title={t('analytics.compactLoopTooltip')}>
            <Chip
              label={`⚠ Compact ×${compactDrops}`}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, v: 'tool' | 'skill' | null) => { if (v) setMode(v); }}
          sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1, fontSize: '0.7rem' } }}
        >
          <Tooltip title={t('analytics.modeTool.description')} arrow placement="top">
            <ToggleButton value="tool">{t('analytics.modeTool')}</ToggleButton>
          </Tooltip>
          <Tooltip title={t('analytics.modeSkill.description')} arrow placement="top">
            <ToggleButton value="skill">{t('analytics.modeSkill')}</ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      </Box>
      {hasData ? (
        <>
        <Box sx={{ position: 'relative' }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <ChartsDataProvider
            dataset={dataset as any}
            series={[
              mode === 'tool'
                ? { type: 'bar' as const, dataKey: 'toolUsageTokens', label: t('analytics.chartToolUsageTokens'), color: chartColors.toolExec, yAxisId: 'toolTokens', valueFormatter: (v: number | null) => (v == null ? '' : fmtTokens(v)) }
                : { type: 'bar' as const, dataKey: 'skillUsageTokens', label: t('analytics.chartSkillUsageTokens'), color: chartColors.skill, yAxisId: 'toolTokens', valueFormatter: (v: number | null) => (v == null ? '' : fmtTokens(v)) },
              { type: 'line', dataKey: 'inputTokens', label: t('analytics.chartInput'), color: chartColors.input, showMark: false, yAxisId: 'tokens' },
              { type: 'line', dataKey: 'outputTokens', label: t('analytics.chartOutput'), color: chartColors.output, showMark: false, yAxisId: 'tokens' },
              { type: 'line', dataKey: 'cacheReadTokens', label: t('analytics.chartCacheRead'), color: chartColors.cacheRead, showMark: false, yAxisId: 'tokens' },
              { type: 'line', dataKey: 'cacheCreationTokens', label: t('analytics.chartCacheWrite'), color: chartColors.cacheWrite, showMark: false, yAxisId: 'tokens' },
            ]}
            xAxis={[{ id: 'x', dataKey: 'turn', scaleType: 'band', tickInterval: (value: number) => value % tickStep === 0 }]}
            yAxis={[
              { id: 'tokens', valueFormatter: fmtTokens, width: 50 },
              { id: 'toolTokens', position: 'right', valueFormatter: fmtTokens, width: 50 },
            ]}
            height={200}
            margin={{ left: 10, right: 10, top: 16, bottom: 0 }}
          >
            <ChartsWrapper>
              <ChartsSurface>
                <ChartsGrid horizontal />
                <BarPlot />
                <LinePlot />
                <ChartsAxisHighlight x="band" />
                <ChartsYAxis axisId="tokens" />
                <ChartsYAxis axisId="toolTokens" />
                <CommitMarkers markers={commitMarkers} />
                <ErrorMarkers markers={errorMarkers} />
              </ChartsSurface>
              <ChartsTooltip />
            </ChartsWrapper>
          </ChartsDataProvider>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <ChartsDataProvider
            dataset={dataset as any}
            series={mode === 'tool' ? [
              { type: 'bar' as const, dataKey: 'apiInferenceMs', label: t('analytics.chartApiInferenceTime'), color: chartColors.apiInference, stack: 'timing', yAxisId: 'perTurn', valueFormatter: (v: number | null) => (v == null ? '' : fmtDurationShort(v)) },
              { type: 'bar' as const, dataKey: 'toolExecMs', label: t('analytics.chartToolExecTime'), color: chartColors.toolExec, stack: 'timing', yAxisId: 'perTurn', valueFormatter: (v: number | null) => (v == null ? '' : fmtDurationShort(v)) },
              { type: 'line' as const, dataKey: 'cumulativeMs', label: t('analytics.chartCumulativeInferenceTime'), color: chartColors.cumulativeTime, showMark: false, yAxisId: 'cumTime', valueFormatter: (v: number | null) => (v == null ? '' : fmtDurationShort(v)) },
            ] : [
              { type: 'bar' as const, dataKey: 'skillExecMs', label: t('analytics.chartSkillExecTime'), color: chartColors.skill, yAxisId: 'perTurn', valueFormatter: (v: number | null) => (v == null ? '' : fmtDurationShort(v)) },
              { type: 'line' as const, dataKey: 'cumulativeMs', label: t('analytics.chartCumulativeInferenceTime'), color: chartColors.cumulativeTime, showMark: false, yAxisId: 'cumTime', valueFormatter: (v: number | null) => (v == null ? '' : fmtDurationShort(v)) },
            ]}
            xAxis={[{ id: 'x', dataKey: 'turn', scaleType: 'band', tickInterval: (value: number) => value % tickStep === 0 }]}
            yAxis={[
              { id: 'perTurn', valueFormatter: fmtDurationShort, width: 50 },
              { id: 'cumTime', position: 'right', valueFormatter: fmtDurationShort, width: 50 },
            ]}
            height={140}
            margin={{ left: 10, right: 10, top: 0, bottom: 0 }}
          >
            <ChartsWrapper>
              <ChartsSurface>
                <ChartsGrid horizontal />
                <BarPlot />
                <LinePlot />
                <ChartsAxisHighlight x="band" />
                <ChartsYAxis axisId="perTurn" />
                <ChartsYAxis axisId="cumTime" />
              </ChartsSurface>
              <ChartsTooltip />
            </ChartsWrapper>
          </ChartsDataProvider>
          <TurnLaneChart
            assistantMsgs={assistantMsgs}
            tickStep={tickStep}
            commitTurns={commitTurns}
            errorTurns={errorTurns}
            mainAgentLabel={mainAgentLabel}
          />
          <StackedReferenceLines
            commitTurns={commitTurns}
            errorTurns={errorTurns}
            totalTurns={totalTurns}
          />
        </Box>
        <TurnLaneChartLegend assistantMsgs={assistantMsgs} />
        </>
      ) : (
        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${colors.border}`, borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            {t('analytics.noTokenData')}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
