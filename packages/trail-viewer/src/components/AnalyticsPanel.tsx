import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import { BarChart, BarPlot } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { LinePlot, MarkPlot } from '@mui/x-charts/LineChart';
import { ChartsDataProvider } from '@mui/x-charts/ChartsDataProvider';
import { ChartsSurface } from '@mui/x-charts/ChartsSurface';
import { ChartsWrapper } from '@mui/x-charts/ChartsWrapper';
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import {
  ChartsTooltip,
  ChartsTooltipContainer,
  ChartsTooltipPaper,
  ChartsTooltipTable,
  ChartsTooltipRow,
  ChartsTooltipCell,
  useAxesTooltip,
} from '@mui/x-charts/ChartsTooltip';
import { ChartsLabelMark } from '@mui/x-charts/ChartsLabel';
import { ChartsGrid } from '@mui/x-charts/ChartsGrid';
import { ChartsLegend } from '@mui/x-charts/ChartsLegend';
import { ChartsAxisHighlight } from '@mui/x-charts/ChartsAxisHighlight';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import { useDrawingArea, useXScale } from '@mui/x-charts/hooks';
import { formatLocalTime, toLocalDateKey } from '@anytime-markdown/trail-core/formatDate';
import { extractCommitPrefix } from '@anytime-markdown/trail-core/domain';
import type { QualityMetrics, DateRange, ReleaseQualityBucket } from '@anytime-markdown/trail-core/domain/metrics';
import type { AnalyticsData, CombinedData, CombinedPeriodMode, CombinedRangeDays, CostOptimizationData, ToolMetrics, TrailMessage, TrailSession, TrailSessionCommit, TrailTokenUsage, TrailToolCall } from '../domain/parser/types';
import { useTrailTheme } from './TrailThemeContext';
import { useTrailI18n } from '../i18n';
import { toolActionColors, modelColors, analyticsPalette, releaseColors, LEAD_TIME_LOC_COLOR } from '../theme/designTokens';
import {
  fmtDuration,
  fmtDurationShort,
  fmtNum,
  fmtPercent,
  fmtTokens,
  fmtUsd,
  fmtUsdShort,
} from '../domain/analytics/formatters';
import {
  capTopN,
  countCompactDrops,
  dominantTool,
  extractPrefixWithScope,
  groupByWeek,
  laneClassifyTool,
  mergeRuns,
  mergeToolMetrics,
  niceTicks,
  parseCommitSubject,
  sessionCost,
  toFridayWeekKey,
  LANE_TOOL_CATS,
  type LaneTool,
  type ChartEntry,
} from '../domain/analytics/calculators';
import type {
  AnalyticsPanelProps,
  CommitMarkerData,
  ErrorMarkerData,
  MetricItem,
  AgentMetric,
  ChartMetric,
  CombinedChartKind,
  CombinedMetric,
  CommitMetric,
  DailyViewMode,
  PeriodDays,
  SessionToolMetric,
} from './analytics/types';
import {
  LANE_TOOL_COLORS,
  LANE_TOOL_LABELS,
  laneModelColor,
  laneSkillColor,
} from './analytics/constants';
import { getMainAgentLabel, buildDaySession } from './analytics/helpers';
import { ChartTitle } from './analytics/charts/shared/ChartTitle';
import { PieCenterLabel } from './analytics/charts/shared/PieCenterLabel';
import { CommitMarkers } from './analytics/charts/shared/CommitMarkers';
import { ErrorMarkers } from './analytics/charts/shared/ErrorMarkers';
import { StackedReferenceLines } from './analytics/charts/shared/StackedReferenceLines';
import { LeadTimeAxisTooltipContent } from './analytics/charts/shared/LeadTimeAxisTooltipContent';
import { CyclingCard } from './analytics/widgets/CyclingCard';
import { formatDoraValue } from './analytics/widgets/DoraValueDisplay';
import { ToolUsageChart } from './analytics/charts/ToolUsageChart';
import { ReleasesBarChart } from './analytics/charts/ReleasesBarChart';
import { SessionToolUsageChart } from './analytics/charts/SessionToolUsageChart';
import { SessionSkillUsageChart } from './analytics/charts/SessionSkillUsageChart';
import { SessionErrorChart } from './analytics/charts/SessionErrorChart';
import { SessionCommitPrefixChart } from './analytics/charts/SessionCommitPrefixChart';
import { TurnLaneChart, TurnLaneChartLegend } from './analytics/charts/TurnLaneChart';
import { SessionCacheTimeline } from './analytics/charts/SessionCacheTimeline';
import { DailyActivityChart } from './analytics/charts/DailyActivityChart';
import { OverviewCards } from './analytics/panels/OverviewCards';
import { SessionMetricsPanel } from './analytics/panels/SessionMetricsPanel';
import { SessionCommitList } from './analytics/panels/SessionCommitList';
import { DailySessionList } from './analytics/panels/DailySessionList';

export type { AnalyticsPanelProps } from './analytics/types';
export { getMainAgentLabel } from './analytics/helpers';

// ---------------------------------------------------------------------------
//  Helpers (getMainAgentLabel moved to ./analytics/helpers)
// ---------------------------------------------------------------------------

// PieCenterLabel moved to ./analytics/charts/shared/PieCenterLabel

// Cost rates removed — backend now provides pre-calculated estimatedCostUsd

// DailyViewMode / PeriodDays / MetricItem moved to ./analytics/types

// ---------------------------------------------------------------------------
//  Sub-components
// ---------------------------------------------------------------------------

// CyclingCard moved to ./analytics/widgets/CyclingCard
// formatDoraValue moved to ./analytics/widgets/DoraValueDisplay

// OverviewCards moved to ./analytics/panels/OverviewCards

// ToolUsageChart moved to ./analytics/charts/ToolUsageChart

// ---------------------------------------------------------------------------
//  Marker types (CommitMarkerData / ErrorMarkerData moved to ./analytics/types)
// ---------------------------------------------------------------------------

// CommitMarkers / ErrorMarkers moved to ./analytics/charts/shared/{CommitMarkers,ErrorMarkers}

// ---------------------------------------------------------------------------
//  TurnLaneChart — model & tool-usage lanes aligned to turn count
//  (LANE_TOOL_COLORS / LANE_TOOL_LABELS / laneModelColor / laneSkillColor
//   moved to ./analytics/constants)
// ---------------------------------------------------------------------------

// TurnLaneChart moved to ./analytics/charts/TurnLaneChart

// TurnLaneChartLegend moved to ./analytics/charts/TurnLaneChart

// StackedReferenceLines moved to ./analytics/charts/shared/StackedReferenceLines

// SessionCacheTimeline moved to ./analytics/charts/SessionCacheTimeline

// SessionCommitPrefixChart moved to ./analytics/charts/SessionCommitPrefixChart

// SessionCommitList moved to ./analytics/panels/SessionCommitList

// SessionMetricsPanel moved to ./analytics/panels/SessionMetricsPanel

// SessionToolMetric moved to ./analytics/types

// ChartTitle moved to ./analytics/charts/shared/ChartTitle

// SessionToolUsageChart / SessionSkillUsageChart / SessionErrorChart moved to ./analytics/charts/

// buildDaySession moved to ./analytics/helpers

// DailySessionList moved to ./analytics/panels/DailySessionList

// DailyActivityChart moved to ./analytics/charts/DailyActivityChart



// ---------------------------------------------------------------------------
//  Main component
// ---------------------------------------------------------------------------

// ─── Behavior charts in Analytics ───────────────────────────────────────────

// ChartMetric / CombinedChartKind / AgentMetric / CommitMetric moved to ./analytics/types
// (上位 N 件以外を "Others" に集約する設計はそのまま維持)

// LeadTimeAxisTooltipContent moved to ./analytics/charts/shared/LeadTimeAxisTooltipContent

function CombinedChartsContent({ data, periodDays, activeChart, toolMetric, modelMetric, agentMetric, commitMetric, repoMetric, leadTimeOverlay, onDateClick }: Readonly<{
  data: CombinedData | null;
  periodDays: PeriodDays;
  activeChart: CombinedChartKind;
  toolMetric: ChartMetric;
  modelMetric: ChartMetric;
  agentMetric: AgentMetric;
  commitMetric: CommitMetric;
  repoMetric: ChartMetric;
  leadTimeOverlay: {
    leadTimePerLoc: ReadonlyArray<{ bucketStart: string; value: number }>;
    unmapped: ReadonlyArray<{ bucketStart: string; value: number }>;
    byPrefix: {
      prefixes: ReadonlyArray<string>;
      series: ReadonlyArray<{ bucketStart: string; byPrefix: Readonly<Record<string, number>> }>;
    };
  } | null;
  onDateClick?: (fullDate: string) => void;
}>) {
  const { cardSx, toolPalette } = useTrailTheme();
  const { t } = useTrailI18n();

  const axisInfo = useMemo(() => {
    if (!data) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const toolRows = (data.toolCounts ?? []).filter(r => r.period >= cutoffStr);
    const errorRows = (data.errorRate ?? []).filter(r => r.period >= cutoffStr);
    const skillRows = (data.skillStats ?? []).filter(r => r.period >= cutoffStr);
    const modelRows = (data.modelStats ?? []).filter(r => r.period >= cutoffStr);
    const agentRows = (data.agentStats ?? []).filter(r => r.period >= cutoffStr);
    const commitRows = (data.commitPrefixStats ?? []).filter(r => r.period >= cutoffStr);
    const repoRows = (data.repoStats ?? []).filter(r => r.period >= cutoffStr);
    const aiRateRows = (data.aiFirstTryRate ?? []).filter(r => r.period >= cutoffStr);
    const allPeriods = [...new Set(toolRows.map(r => r.period))].sort();
    const labels = allPeriods.map(p => p.length > 5 ? p.slice(5) : p);
    const modelPeriods = [...new Set(modelRows.map(r => r.period))].sort();
    const modelLabels = modelPeriods.map(p => p.length > 5 ? p.slice(5) : p);
    const agentPeriods = [...new Set(agentRows.map(r => r.period))].sort();
    const agentLabels = agentPeriods.map(p => p.length > 5 ? p.slice(5) : p);
    const commitPeriods = [...new Set(commitRows.map(r => r.period))].sort();
    const commitLabels = commitPeriods.map(p => p.length > 5 ? p.slice(5) : p);
    const repoPeriods = [...new Set(repoRows.map(r => r.period))].sort();
    const repoLabels = repoPeriods.map(p => p.length > 5 ? p.slice(5) : p);

    const toolTotals = new Map<string, number>();
    for (const r of toolRows) toolTotals.set(r.tool, (toolTotals.get(r.tool) ?? 0) + r.count);
    const errToolTotals = new Map<string, number>();
    for (const r of errorRows) for (const [k, v] of Object.entries(r.byTool)) errToolTotals.set(k, (errToolTotals.get(k) ?? 0) + v);
    const skillTotals = new Map<string, number>();
    for (const r of skillRows) skillTotals.set(r.skill, (skillTotals.get(r.skill) ?? 0) + r.count);
    const modelTotals = new Map<string, number>();
    for (const r of modelRows) modelTotals.set(r.model, (modelTotals.get(r.model) ?? 0) + r.count);
    const agentTotals = new Map<string, number>();
    for (const r of agentRows) agentTotals.set(r.agent, (agentTotals.get(r.agent) ?? 0) + r.tokens);
    const commitTotals = new Map<string, number>();
    for (const r of commitRows) commitTotals.set(r.prefix, (commitTotals.get(r.prefix) ?? 0) + r.count);
    const repoTotals = new Map<string, number>();
    for (const r of repoRows) repoTotals.set(r.repoName, (repoTotals.get(r.repoName) ?? 0) + r.count);

    const toolCap = capTopN(toolTotals);
    const errCap = capTopN(errToolTotals);
    const skillCap = capTopN(skillTotals);
    const modelCap = capTopN(modelTotals);
    const agentCap = capTopN(agentTotals);
    const commitCap = capTopN(commitTotals);
    const repoCap = capTopN(repoTotals);
    const agentMissingByDisplay = new Map<string, { total: number; missing: number }>();
    for (const r of agentRows) {
      const displayKey = agentCap.keyMap.get(r.agent) ?? r.agent;
      const cur = agentMissingByDisplay.get(displayKey) ?? { total: 0, missing: 0 };
      cur.total += r.tokenTotalTurns ?? 0;
      cur.missing += r.tokenMissingTurns ?? 0;
      agentMissingByDisplay.set(displayKey, cur);
    }
    const modelMissingByDisplay = new Map<string, { total: number; missing: number }>();
    for (const r of modelRows) {
      const displayKey = modelCap.keyMap.get(r.model) ?? r.model;
      const cur = modelMissingByDisplay.get(displayKey) ?? { total: 0, missing: 0 };
      cur.total += r.tokenTotalTurns ?? 0;
      cur.missing += r.tokenMissingTurns ?? 0;
      modelMissingByDisplay.set(displayKey, cur);
    }
    const toolMissingByDisplay = new Map<string, { total: number; missing: number }>();
    for (const r of toolRows) {
      const displayKey = toolCap.keyMap.get(r.tool) ?? r.tool;
      const cur = toolMissingByDisplay.get(displayKey) ?? { total: 0, missing: 0 };
      cur.total += r.tokenTotalTurns ?? 0;
      cur.missing += r.tokenMissingTurns ?? 0;
      toolMissingByDisplay.set(displayKey, cur);
    }

    return {
      toolRows,
      errorRows,
      skillRows,
      modelRows,
      agentRows,
      commitRows,
      aiRateRows,
      allPeriods,
      labels,
      modelPeriods,
      modelLabels,
      agentPeriods,
      agentLabels,
      commitPeriods,
      commitLabels,
      tools: toolCap.displayKeys,
      toolMap: toolCap.keyMap,
      errTools: errCap.displayKeys,
      errMap: errCap.keyMap,
      skills: skillCap.displayKeys,
      skillMap: skillCap.keyMap,
      models: modelCap.displayKeys,
      modelMap: modelCap.keyMap,
      agents: agentCap.displayKeys,
      agentMap: agentCap.keyMap,
      agentMissingByDisplay,
      modelMissingByDisplay,
      toolMissingByDisplay,
      commitPrefixes: commitCap.displayKeys,
      commitMap: commitCap.keyMap,
      repoRows,
      repoPeriods,
      repoLabels,
      repos: repoCap.displayKeys,
      repoMap: repoCap.keyMap,
    };
  }, [data, periodDays]);

  const toolDataset = useMemo(() => {
    if (!axisInfo) return [];
    const { toolRows, allPeriods, labels, tools, toolMap } = axisInfo;
    const getValue = (r: { count: number; tokens?: number }): number =>
      toolMetric === 'tokens' ? (r.tokens ?? 0) : r.count;
    const valMap = new Map<string, number>();
    for (const r of toolRows) {
      const displayKey = toolMap.get(r.tool) ?? r.tool;
      const key = `${r.period}::${displayKey}`;
      valMap.set(key, (valMap.get(key) ?? 0) + getValue(r));
    }
    return allPeriods.map((p, pi) => {
      const entry: Record<string, string | number> = { period: labels[pi] };
      for (let i = 0; i < tools.length; i++) {
        entry[`t${i}`] = valMap.get(`${p}::${tools[i]}`) ?? 0;
      }
      return entry;
    });
  }, [axisInfo, toolMetric]);

  const errDataset = useMemo(() => {
    if (!axisInfo) return [];
    const { errorRows, allPeriods, labels, errTools, errMap } = axisInfo;
    const valMap = new Map<string, number>();
    for (const r of errorRows) {
      for (const [tool, v] of Object.entries(r.byTool)) {
        const displayKey = errMap.get(tool) ?? tool;
        const key = `${r.period}::${displayKey}`;
        valMap.set(key, (valMap.get(key) ?? 0) + v);
      }
    }
    return allPeriods.map((p, pi) => {
      const entry: Record<string, string | number> = { period: labels[pi] };
      for (let i = 0; i < errTools.length; i++) {
        entry[`e${i}`] = valMap.get(`${p}::${errTools[i]}`) ?? 0;
      }
      return entry;
    });
  }, [axisInfo]);

  const skillDataset = useMemo(() => {
    if (!axisInfo) return [];
    const { skillRows, allPeriods, labels, skills, skillMap } = axisInfo;
    const countMap = new Map<string, number>();
    for (const r of skillRows) {
      const displayKey = skillMap.get(r.skill) ?? r.skill;
      const key = `${r.period}::${displayKey}`;
      countMap.set(key, (countMap.get(key) ?? 0) + r.count);
    }
    return allPeriods.map((p, pi) => {
      const entry: Record<string, string | number> = { period: labels[pi] };
      for (let i = 0; i < skills.length; i++) {
        entry[`s${i}`] = countMap.get(`${p}::${skills[i]}`) ?? 0;
      }
      return entry;
    });
  }, [axisInfo]);

  const commitDataset = useMemo(() => {
    if (!axisInfo) return [];
    const { commitRows, commitPeriods, commitLabels, commitPrefixes, commitMap } = axisInfo;
    const valMap = new Map<string, number>();
    for (const r of commitRows) {
      const displayKey = commitMap.get(r.prefix) ?? r.prefix;
      const key = `${r.period}::${displayKey}`;
      const value = commitMetric === 'loc' ? (r.linesAdded ?? 0) : r.count;
      valMap.set(key, (valMap.get(key) ?? 0) + value);
    }
    return commitPeriods.map((p, pi) => {
      const entry: Record<string, string | number> = { period: commitLabels[pi] };
      for (let i = 0; i < commitPrefixes.length; i++) {
        entry[`c${i}`] = valMap.get(`${p}::${commitPrefixes[i]}`) ?? 0;
      }
      return entry;
    });
  }, [axisInfo, commitMetric]);

  const modelDataset = useMemo(() => {
    if (!axisInfo) return [];
    const { modelRows, modelPeriods, modelLabels, models, modelMap } = axisInfo;
    const getValue = (r: { count: number; tokens: number }): number =>
      modelMetric === 'tokens' ? r.tokens : r.count;
    const valMap = new Map<string, number>();
    for (const r of modelRows) {
      const displayKey = modelMap.get(r.model) ?? r.model;
      const key = `${r.period}::${displayKey}`;
      valMap.set(key, (valMap.get(key) ?? 0) + getValue(r));
    }
    return modelPeriods.map((p, pi) => {
      const entry: Record<string, string | number> = { period: modelLabels[pi] };
      for (let i = 0; i < models.length; i++) {
        entry[`m${i}`] = valMap.get(`${p}::${models[i]}`) ?? 0;
      }
      return entry;
    });
  }, [axisInfo, modelMetric]);

  const agentDataset = useMemo(() => {
    if (!axisInfo) return [];
    const { agentRows, agentPeriods, agentLabels, agents, agentMap } = axisInfo;
    const getValue = (r: { tokens: number; costUsd: number; loc: number }): number =>
      agentMetric === 'tokens' ? r.tokens : agentMetric === 'cost' ? r.costUsd : r.loc;
    const valMap = new Map<string, number>();
    for (const r of agentRows) {
      const displayKey = agentMap.get(r.agent) ?? r.agent;
      const key = `${r.period}::${displayKey}`;
      valMap.set(key, (valMap.get(key) ?? 0) + getValue(r));
    }
    return agentPeriods.map((p, pi) => {
      const entry: Record<string, string | number> = { period: agentLabels[pi] };
      for (let i = 0; i < agents.length; i++) {
        entry[`a${i}`] = valMap.get(`${p}::${agents[i]}`) ?? 0;
      }
      return entry;
    });
  }, [axisInfo, agentMetric]);

  const repoDataset = useMemo(() => {
    if (!axisInfo) return [];
    const { repoRows, repoPeriods, repoLabels, repos, repoMap } = axisInfo;
    const getValue = (r: { count: number; tokens: number }): number =>
      repoMetric === 'tokens' ? r.tokens : r.count;
    const valMap = new Map<string, number>();
    for (const r of repoRows) {
      const displayKey = repoMap.get(r.repoName) ?? r.repoName;
      const key = `${r.period}::${displayKey}`;
      valMap.set(key, (valMap.get(key) ?? 0) + getValue(r));
    }
    return repoPeriods.map((p, pi) => {
      const entry: Record<string, string | number> = { period: repoLabels[pi] };
      for (let i = 0; i < repos.length; i++) {
        entry[`r${i}`] = valMap.get(`${p}::${repos[i]}`) ?? 0;
      }
      return entry;
    });
  }, [axisInfo, repoMetric]);

  if (!axisInfo) return null;
  const { toolRows, errTools, tools, skills, models, agents, agentMissingByDisplay, modelMissingByDisplay, toolMissingByDisplay, commitPrefixes, aiRateRows, allPeriods, modelPeriods, agentPeriods, commitPeriods, commitLabels, repos, repoPeriods } = axisInfo;
  const hideZero = (v: number | null) => (v == null || v === 0 ? null : String(v));
  const agentSeriesLabel = (agent: string): string => {
    const missing = agentMissingByDisplay.get(agent);
    const rate = missing && missing.total > 0 ? missing.missing / missing.total : 0;
    return `${agent} (${t('analytics.combined.missingRate')} ${fmtPercent(rate)})`;
  };
  const modelSeriesLabel = (model: string): string => {
    const missing = modelMissingByDisplay.get(model);
    const rate = missing && missing.total > 0 ? missing.missing / missing.total : 0;
    return rate > 0 ? `${model} (${t('analytics.combined.missingRate')} ${fmtPercent(rate)})` : model;
  };
  const toolSeriesLabel = (tool: string): string => {
    const missing = toolMissingByDisplay.get(tool);
    const rate = missing && missing.total > 0 ? missing.missing / missing.total : 0;
    return rate > 0 ? `${tool} (${t('analytics.combined.missingRate')} ${fmtPercent(rate)})` : tool;
  };
  const canDrill = periodDays < 90 && !!onDateClick;
  const makeAxisClick = (periods: readonly string[]) =>
    canDrill
      ? (_e: MouseEvent, d: { dataIndex: number } | null) => {
          const idx = d?.dataIndex;
          if (idx == null || idx < 0 || idx >= periods.length) return;
          onDateClick?.(periods[idx]);
        }
      : undefined;

  if (activeChart === 'tools') {
    if (toolRows.length === 0) {
      return <Typography variant="body2" color="text.secondary">0</Typography>;
    }
    return (
      <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
        <BarChart
          dataset={toolDataset}
          xAxis={[{ scaleType: 'band', dataKey: 'period' }]}
          yAxis={[{ valueFormatter: fmtTokens }]}
          series={tools.map((tool, i) => ({
            dataKey: `t${i}`,
            label: toolSeriesLabel(tool),
            stack: 'total',
            color: toolPalette[i % toolPalette.length],
            valueFormatter: hideZero,
          }))}
          height={240}
          margin={{ left: 16, right: 8, top: 8, bottom: 60 }}
          slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'bottom', horizontal: 'center' } } }}
          onAxisClick={makeAxisClick(allPeriods)}
        />
      </Paper>
    );
  }

  if (activeChart === 'errors') {
    return (
      <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
        {errTools.length === 0 ? (
          <Typography variant="body2" color="text.secondary">0</Typography>
        ) : (
          <BarChart
            dataset={errDataset}
            xAxis={[{ scaleType: 'band', dataKey: 'period' }]}
            yAxis={[{ valueFormatter: fmtTokens }]}
            series={errTools.map((tool, i) => ({
              dataKey: `e${i}`,
              label: tool,
              stack: 'total',
              color: toolPalette[i % toolPalette.length],
              valueFormatter: hideZero,
            }))}
            height={240}
            margin={{ left: 16, right: 8, top: 8, bottom: 40 }}
            slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'bottom', horizontal: 'center' } } }}
            onAxisClick={makeAxisClick(allPeriods)}
          />
        )}
      </Paper>
    );
  }

  if (activeChart === 'repos') {
    if (repos.length === 0) {
      return <Typography variant="body2" color="text.secondary">0</Typography>;
    }
    return (
      <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
        <BarChart
          dataset={repoDataset}
          xAxis={[{ scaleType: 'band', dataKey: 'period' }]}
          yAxis={[{ valueFormatter: repoMetric === 'tokens' ? fmtTokens : fmtNum }]}
          series={repos.map((repo, i) => ({
            dataKey: `r${i}`,
            label: repo,
            stack: 'total',
            color: toolPalette[i % toolPalette.length],
            valueFormatter: hideZero,
          }))}
          height={240}
          margin={{ left: 16, right: 8, top: 8, bottom: 60 }}
          slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'bottom', horizontal: 'center' } } }}
          onAxisClick={makeAxisClick(repoPeriods)}
        />
      </Paper>
    );
  }

  if (activeChart === 'skills') {
    if (skills.length === 0) {
      return <Typography variant="body2" color="text.secondary">0</Typography>;
    }
    return (
      <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
        <BarChart
          dataset={skillDataset}
          xAxis={[{ scaleType: 'band', dataKey: 'period' }]}
          yAxis={[{ valueFormatter: fmtNum }]}
          series={skills.map((skill, i) => ({
            dataKey: `s${i}`,
            label: skill,
            stack: 'total',
            color: toolPalette[i % toolPalette.length],
            valueFormatter: hideZero,
          }))}
          height={240}
          margin={{ left: 16, right: 8, top: 8, bottom: 40 }}
          slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'bottom', horizontal: 'center' } } }}
          onAxisClick={makeAxisClick(allPeriods)}
        />
      </Paper>
    );
  }

  if (activeChart === 'agents') {
    return (
      <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
        <BarChart
          dataset={agentDataset}
          xAxis={[{ scaleType: 'band', dataKey: 'period' }]}
          yAxis={[{ valueFormatter: agentMetric === 'cost' ? fmtUsd : fmtTokens }]}
          series={agents.map((agent, i) => ({
            dataKey: `a${i}`,
            label: agentSeriesLabel(agent),
            stack: 'total',
            color: toolPalette[i % toolPalette.length],
            valueFormatter: hideZero,
          }))}
          height={240}
          margin={{ left: 16, right: 8, top: 8, bottom: 60 }}
          slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'bottom', horizontal: 'center' } } }}
          onAxisClick={makeAxisClick(agentPeriods)}
        />
      </Paper>
    );
  }

  if (activeChart === 'commits') {
    if (commitMetric === 'leadTime') {
      const ratioRows = leadTimeOverlay?.leadTimePerLoc ?? [];
      const byPrefixSeries = leadTimeOverlay?.byPrefix.series ?? [];
      const allPrefixes = leadTimeOverlay?.byPrefix.prefixes ?? [];
      if (byPrefixSeries.length === 0 && ratioRows.length === 0) {
        return <Typography variant="body2" color="text.secondary">0</Typography>;
      }

      const ltTotals = new Map<string, number>();
      for (const row of byPrefixSeries) {
        for (const [p, v] of Object.entries(row.byPrefix)) {
          ltTotals.set(p, (ltTotals.get(p) ?? 0) + v);
        }
      }
      const ltCap = capTopN(ltTotals);
      const ltPrefixes = ltCap.displayKeys;
      const ltMap = ltCap.keyMap;

      const unmappedRows = leadTimeOverlay?.unmapped ?? [];
      const bucketKeys = [...new Set([
        ...byPrefixSeries.map((r) => r.bucketStart),
        ...ratioRows.map((r) => r.bucketStart),
      ])].sort();
      const ratioByBucket = new Map(ratioRows.map((r) => [r.bucketStart, r.value]));
      const prefixRowByBucket = new Map(byPrefixSeries.map((r) => [r.bucketStart, r.byPrefix]));
      const unmappedByBucket = new Map(unmappedRows.map((r) => [r.bucketStart, r.value]));
      const fullDates = bucketKeys.map((b) => b.slice(0, 10));
      const labels = bucketKeys.map((b) => b.slice(5, 10));

      const ltDataset = bucketKeys.map((b, i) => {
        const byPrefix = prefixRowByBucket.get(b) ?? {};
        const aggregated: Record<string, number> = {};
        for (const p of ltPrefixes) aggregated[p] = 0;
        for (const origPrefix of allPrefixes) {
          const displayKey = ltMap.get(origPrefix) ?? origPrefix;
          aggregated[displayKey] = (aggregated[displayKey] ?? 0) + (byPrefix[origPrefix] ?? 0);
        }
        const entry: Record<string, string | number | null> = { period: labels[i] };
        for (let k = 0; k < ltPrefixes.length; k++) {
          entry[`l${k}`] = aggregated[ltPrefixes[k]] ?? 0;
        }
        entry.leadTimePerLoc = ratioByBucket.get(b) ?? null;
        return entry;
      });

      const fmtMin = (v: number | null) => v == null ? '-' : `${Math.round(v).toLocaleString()} min`;
      const fmtRatio = (v: number | null) => v == null ? '-' : `${v.toFixed(2)} min/LOC`;

      const barSeries = ltPrefixes.map((prefix, i) => ({
        type: 'bar' as const,
        dataKey: `l${i}`,
        label: prefix,
        stack: 'total',
        color: toolPalette[i % toolPalette.length],
        yAxisId: 'minAxis',
        valueFormatter: (v: number | null) => v == null || v === 0 ? null : fmtMin(v),
      }));
      const lineSeries = [{
        type: 'line' as const,
        dataKey: 'leadTimePerLoc',
        label: 'Lead Time / LOC (min/LOC)',
        color: LEAD_TIME_LOC_COLOR,
        yAxisId: 'ratioAxis',
        showMark: true,
        connectNulls: true,
        valueFormatter: fmtRatio,
      }];

      return (
        <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
          <ChartsDataProvider
            dataset={ltDataset}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            series={[...barSeries, ...lineSeries] as any}
            xAxis={[{ id: 'period', scaleType: 'band', dataKey: 'period' }]}
            yAxis={[
              { id: 'minAxis', valueFormatter: fmtTokens },
              { id: 'ratioAxis', position: 'right' as const, valueFormatter: (v: number) => v.toFixed(2) },
            ]}
            height={260}
            margin={{ left: 16, right: 56, top: 8, bottom: 40 }}
            onAxisClick={canDrill
              ? (_e: MouseEvent, d: { dataIndex: number } | null) => {
                  const idx = d?.dataIndex;
                  if (idx == null || idx < 0 || idx >= fullDates.length) return;
                  onDateClick?.(fullDates[idx]);
                }
              : undefined}
          >
            <ChartsWrapper legendDirection="horizontal" legendPosition={{ vertical: 'bottom', horizontal: 'center' }}>
              <ChartsLegend />
              <ChartsSurface>
                <ChartsGrid horizontal />
                <BarPlot />
                <LinePlot />
                <MarkPlot />
                <ChartsAxisHighlight x="band" />
                <ChartsXAxis axisId="period" />
                <ChartsYAxis axisId="minAxis" />
                <ChartsYAxis axisId="ratioAxis" />
              </ChartsSurface>
              <ChartsTooltipContainer trigger="axis">
                <LeadTimeAxisTooltipContent
                  unmappedByBucket={unmappedByBucket}
                  bucketKeys={bucketKeys}
                />
              </ChartsTooltipContainer>
            </ChartsWrapper>
          </ChartsDataProvider>
        </Paper>
      );
    }

    if (commitPrefixes.length === 0) {
      return <Typography variant="body2" color="text.secondary">0</Typography>;
    }
    const showRate = commitMetric === 'count';
    const rateByPeriod = new Map<string, number | null>();
    if (showRate) {
      for (const r of aiRateRows) {
        rateByPeriod.set(r.period, r.sampleSize > 0 ? r.rate : null);
      }
    }
    const augmentedDataset = commitDataset.map((row, i) => ({
      ...row,
      rate: showRate ? (rateByPeriod.get(commitPeriods[i]) ?? null) : null,
    }));

    const barSeries = commitPrefixes.map((prefix, i) => ({
      type: 'bar' as const,
      dataKey: `c${i}`,
      label: prefix,
      stack: 'total',
      color: toolPalette[i % toolPalette.length],
      yAxisId: 'countAxis',
    }));
    const lineSeries = showRate ? [{
      type: 'line' as const,
      dataKey: 'rate',
      label: 'AI 1 発成功率 (%)',
      color: LEAD_TIME_LOC_COLOR,
      yAxisId: 'rateAxis',
      showMark: true,
      connectNulls: true,
      valueFormatter: (v: number | null) => v == null ? '-' : `${v.toFixed(1)}%`,
    }] : [];

    const yAxisConfig = showRate
      ? [
          { id: 'countAxis', valueFormatter: fmtTokens },
          { id: 'rateAxis', min: 0, max: 100, position: 'right' as const, valueFormatter: (v: number) => `${v}%` },
        ]
      : [{ id: 'countAxis', valueFormatter: fmtTokens }];

    return (
      <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
        <ChartsDataProvider
          dataset={augmentedDataset}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          series={[...barSeries, ...lineSeries] as any}
          xAxis={[{ id: 'period', scaleType: 'band', dataKey: 'period' }]}
          yAxis={yAxisConfig}
          height={260}
          margin={{ left: 16, right: showRate ? 48 : 8, top: 8, bottom: 40 }}
          onAxisClick={makeAxisClick(commitPeriods)}
        >
          <ChartsWrapper legendDirection="horizontal" legendPosition={{ vertical: 'bottom', horizontal: 'center' }}>
            <ChartsLegend />
            <ChartsSurface>
              <ChartsGrid horizontal />
              <BarPlot />
              {showRate && <LinePlot />}
              {showRate && <MarkPlot />}
              <ChartsAxisHighlight x="band" />
              <ChartsXAxis axisId="period" />
              <ChartsYAxis axisId="countAxis" />
              {showRate && <ChartsYAxis axisId="rateAxis" />}
            </ChartsSurface>
            <ChartsTooltip />
          </ChartsWrapper>
        </ChartsDataProvider>
      </Paper>
    );
  }

  // activeChart === 'models'
  if (models.length === 0) {
    return <Typography variant="body2" color="text.secondary">0</Typography>;
  }
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
      <BarChart
        dataset={modelDataset}
        xAxis={[{ scaleType: 'band', dataKey: 'period' }]}
        yAxis={[{ valueFormatter: fmtTokens }]}
        series={models.map((model, i) => ({
          dataKey: `m${i}`,
          label: modelSeriesLabel(model),
          stack: 'total',
          color: toolPalette[i % toolPalette.length],
          valueFormatter: hideZero,
        }))}
        height={240}
        margin={{ left: 16, right: 8, top: 8, bottom: 40 }}
        slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'bottom', horizontal: 'center' } } }}
        onAxisClick={makeAxisClick(modelPeriods)}
      />
    </Paper>
  );
}

// ReleasesBarChart moved to ./analytics/charts/ReleasesBarChart

// CombinedMetric moved to ./analytics/types

function CombinedChartsSection({
  dailyActivity,
  sessions,
  sessionsLoading,
  period,
  setPeriod,
  onSelectSession,
  onJumpToTrace,
  fetchSessionMessages,
  fetchSessionCommits,
  fetchSessionToolMetrics,
  fetchDayToolMetrics,
  costOptimization,
  fetchCombinedData,
  fetchQualityMetrics,
  fetchReleaseQuality,
}: Readonly<{
  dailyActivity: AnalyticsData['dailyActivity'];
  sessions: readonly TrailSession[];
  sessionsLoading?: boolean;
  period: PeriodDays;
  setPeriod: (v: PeriodDays) => void;
  onSelectSession?: (id: string) => void;
  onJumpToTrace?: (session: TrailSession) => void;
  fetchSessionMessages?: (id: string) => Promise<readonly TrailMessage[]>;
  fetchSessionCommits?: (id: string) => Promise<readonly TrailSessionCommit[]>;
  fetchSessionToolMetrics?: (id: string) => Promise<ToolMetrics | null>;
  fetchDayToolMetrics?: (date: string) => Promise<ToolMetrics | null>;
  costOptimization?: CostOptimizationData | null;
  fetchCombinedData?: (period: CombinedPeriodMode, rangeDays: CombinedRangeDays) => Promise<CombinedData>;
  fetchQualityMetrics?: (range: DateRange) => Promise<QualityMetrics | null>;
  fetchReleaseQuality?: (range: DateRange, bucket: 'day' | 'week') => Promise<ReadonlyArray<ReleaseQualityBucket>>;
}>) {
  const { colors } = useTrailTheme();
  const { t } = useTrailI18n();
  const [metric, setMetric] = useState<CombinedMetric>('tokens');
  const [tokenMode, setTokenMode] = useState<DailyViewMode>('tokens');
  const [toolMetric, setToolMetric] = useState<ChartMetric>('count');
  const [modelMetric, setModelMetric] = useState<ChartMetric>('count');
  const [agentMetric, setAgentMetric] = useState<AgentMetric>('tokens');
  const [commitMetric, setCommitMetric] = useState<CommitMetric>('count');
  const [repoMetric, setRepoMetric] = useState<ChartMetric>('count');
  const [combinedData, setCombinedData] = useState<CombinedData | null>(null);
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [releasesTimeSeries, setReleasesTimeSeries] = useState<ReadonlyArray<ReleaseQualityBucket>>([]);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [overlay, setOverlay] = useState<{
    bucket: 'day' | 'week';
    tokens: ReadonlyArray<{ bucketStart: string; value: number }>;
    cost: ReadonlyArray<{ bucketStart: string; value: number }>;
    leadTime: ReadonlyArray<{ bucketStart: string; value: number }>;
    leadTimePerLoc: ReadonlyArray<{ bucketStart: string; value: number }>;
    leadTimeUnmapped: ReadonlyArray<{ bucketStart: string; value: number }>;
    leadTimeByPrefix: {
      prefixes: ReadonlyArray<string>;
      series: ReadonlyArray<{ bucketStart: string; byPrefix: Readonly<Record<string, number>> }>;
    };
    deploymentFrequency: ReadonlyArray<{ bucketStart: string; value: number }>;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  useEffect(() => { setSelectedDate(null); }, [period]);
  const handleDateClick = (fullDate: string) => {
    setSelectedDate((prev) => (prev === fullDate ? null : fullDate));
  };

  // Prefetch behavior data so switching to Tool/Error/Skill does not block on fetch.
  useEffect(() => {
    if (!fetchCombinedData) return;
    const rangeDays: CombinedRangeDays = period >= 90 ? 90 : 30;
    const periodMode: CombinedPeriodMode = period >= 90 ? 'week' : 'day';
    let mounted = true;
    setCombinedLoading(true);
    void (async () => {
      const result = await fetchCombinedData(periodMode, rangeDays);
      if (mounted) {
        setCombinedData(result);
        setCombinedLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [fetchCombinedData, period]);

  useEffect(() => {
    if (!fetchQualityMetrics) return;
    if (metric === 'releases') return; // Release chart uses fetchReleaseQuality; skip heavy quality metrics fetch
    const now = new Date();
    const to = now.toISOString();
    const from = new Date(now.getTime() - period * 86_400_000).toISOString();
    let mounted = true;
    setOverlayLoading(true);
    void (async () => {
      const result = await fetchQualityMetrics({ from, to });
      if (mounted) {
        setOverlayLoading(false);
      }
      if (mounted && result) {
        setOverlay({
          bucket: result.bucket,
          tokens: result.metrics.tokensPerLoc.timeSeries,
          cost: result.costPerLocTimeSeries ?? [],
          leadTime: result.leadTimeMinTimeSeries ?? [],
          leadTimePerLoc: result.metrics.leadTimePerLoc.timeSeries,
          leadTimeUnmapped: result.leadTimeUnmappedTimeSeries ?? [],
          leadTimeByPrefix: result.leadTimeMinByPrefix ?? { prefixes: [], series: [] },
          deploymentFrequency: result.metrics.deploymentFrequency.timeSeries,
        });
      }
    })();
    return () => { mounted = false; };
  }, [fetchQualityMetrics, period, metric]);

  useEffect(() => {
    if (!fetchReleaseQuality) return;
    const now = new Date();
    const to = now.toISOString();
    const from = new Date(now.getTime() - period * 86_400_000).toISOString();
    const bucket: 'day' | 'week' = period >= 90 ? 'week' : 'day';
    let mounted = true;
    setReleasesLoading(true);
    void (async () => {
      const result = await fetchReleaseQuality({ from, to }, bucket);
      if (mounted) {
        setReleasesTimeSeries(result);
        setReleasesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [fetchReleaseQuality, period]);

  const toggleSx = {
    color: colors.textSecondary,
    borderColor: colors.border,
    '&.Mui-selected': { color: colors.iceBlue, bgcolor: colors.iceBlueBg, borderColor: colors.iceBlue },
    '&:hover': { bgcolor: colors.hoverBg },
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={metric}
            exclusive
            onChange={(_e, v: CombinedMetric | null) => { if (v) setMetric(v); }}
            size="small"
          >
            <Tooltip title={t('chart.tokenUsage.description')} arrow placement="top">
              <ToggleButton value="tokens" sx={toggleSx}>{t('chart.tokenUsage')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.agent.description')} arrow placement="top">
              <ToggleButton value="agents" sx={toggleSx}>{t('analytics.combined.agent')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.model.description')} arrow placement="top">
              <ToggleButton value="models" sx={toggleSx}>{t('analytics.combined.model')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.skill.description')} arrow placement="top">
              <ToggleButton value="skills" sx={toggleSx}>{t('analytics.combined.skill')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.tool.description')} arrow placement="top">
              <ToggleButton value="tools" sx={toggleSx}>{t('analytics.combined.tool')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.error.description')} arrow placement="top">
              <ToggleButton value="errors" sx={toggleSx}>{t('analytics.combined.error')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.repository.description')} arrow placement="top">
              <ToggleButton value="repos" sx={toggleSx}>{t('analytics.combined.repository')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.commitPrefix.description')} arrow placement="top">
              <ToggleButton value="commits" sx={toggleSx}>{t('analytics.combined.commitPrefix')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.release.description')} arrow placement="top">
              <ToggleButton value="releases" sx={toggleSx}>{t('analytics.combined.release')}</ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={(_e, v: PeriodDays | null) => { if (v !== null) setPeriod(v); }}
            size="small"
          >
            <ToggleButton value={7} sx={toggleSx}>{`7${t('releases.days')}`}</ToggleButton>
            <ToggleButton value={30} sx={toggleSx}>{`30${t('releases.days')}`}</ToggleButton>
            <ToggleButton value={90} sx={toggleSx}>{`90${t('releases.days')}`}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {metric === 'tokens' && (
          <ToggleButtonGroup
            value={tokenMode}
            exclusive
            onChange={(_e, v: DailyViewMode | null) => { if (v) setTokenMode(v); }}
            size="small"
          >
            <Tooltip title={t('chart.tokens.description')} arrow placement="top">
              <ToggleButton value="tokens" sx={toggleSx}>{t('chart.tokens')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('chart.cost.description')} arrow placement="top">
              <ToggleButton value="cost" sx={toggleSx}>{t('chart.cost')}</ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        )}
        {metric === 'tools' && (
          <ToggleButtonGroup
            value={toolMetric}
            exclusive
            onChange={(_e, v: ChartMetric | null) => { if (v) setToolMetric(v); }}
            size="small"
          >
            <Tooltip title={t('analytics.combined.count.description')} arrow placement="top">
              <ToggleButton value="count" sx={toggleSx}>{t('analytics.combined.count')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.tokens.description')} arrow placement="top">
              <ToggleButton value="tokens" sx={toggleSx}>{t('analytics.combined.tokens')}</ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        )}
        {metric === 'models' && (
          <ToggleButtonGroup
            value={modelMetric}
            exclusive
            onChange={(_e, v: ChartMetric | null) => { if (v) setModelMetric(v); }}
            size="small"
          >
            <Tooltip title={t('analytics.combined.count.description')} arrow placement="top">
              <ToggleButton value="count" sx={toggleSx}>{t('analytics.combined.count')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.tokens.description')} arrow placement="top">
              <ToggleButton value="tokens" sx={toggleSx}>{t('analytics.combined.tokens')}</ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        )}
        {metric === 'agents' && (
          <ToggleButtonGroup
            value={agentMetric}
            exclusive
            onChange={(_e, v: AgentMetric | null) => { if (v) setAgentMetric(v); }}
            size="small"
          >
            <Tooltip title={t('analytics.combined.tokens.description')} arrow placement="top">
              <ToggleButton value="tokens" sx={toggleSx}>{t('analytics.combined.tokens')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('chart.cost.description')} arrow placement="top">
              <ToggleButton value="cost" sx={toggleSx}>{t('chart.cost')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.loc.description')} arrow placement="top">
              <ToggleButton value="loc" sx={toggleSx}>{t('analytics.combined.loc')}</ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        )}
        {metric === 'repos' && (
          <ToggleButtonGroup
            value={repoMetric}
            exclusive
            onChange={(_e, v: ChartMetric | null) => { if (v) setRepoMetric(v); }}
            size="small"
          >
            <Tooltip title={t('analytics.combined.count.description')} arrow placement="top">
              <ToggleButton value="count" sx={toggleSx}>{t('analytics.combined.count')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.tokens.description')} arrow placement="top">
              <ToggleButton value="tokens" sx={toggleSx}>{t('analytics.combined.tokens')}</ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        )}
        {metric === 'commits' && (
          <ToggleButtonGroup
            value={commitMetric}
            exclusive
            onChange={(_e, v: CommitMetric | null) => { if (v) setCommitMetric(v); }}
            size="small"
          >
            <Tooltip title={t('analytics.combined.commitCount.description')} arrow placement="top">
              <ToggleButton value="count" sx={toggleSx}>{t('analytics.combined.commitCount')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.loc.description')} arrow placement="top">
              <ToggleButton value="loc" sx={toggleSx}>{t('analytics.combined.loc')}</ToggleButton>
            </Tooltip>
            <Tooltip title={t('analytics.combined.leadTime.description')} arrow placement="top">
              <ToggleButton value="leadTime" sx={toggleSx}>{t('analytics.combined.leadTime')}</ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        )}
      </Box>
      {metric === 'tokens' ? (
        <DailyActivityChart
          items={dailyActivity}
          period={period}
          mode={tokenMode}
          onDateClick={handleDateClick}
          costOptimization={costOptimization}
          overlay={overlay}
        />
      ) : metric === 'releases' ? (
        releasesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <ReleasesBarChart timeSeries={releasesTimeSeries} />
        )
      ) : fetchCombinedData ? (
        combinedLoading && !combinedData ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <CombinedChartsContent
            data={combinedData}
            periodDays={period}
            activeChart={metric}
            toolMetric={toolMetric}
            modelMetric={modelMetric}
            agentMetric={agentMetric}
            commitMetric={commitMetric}
            repoMetric={repoMetric}
            leadTimeOverlay={overlay ? { leadTimePerLoc: overlay.leadTimePerLoc, unmapped: overlay.leadTimeUnmapped, byPrefix: overlay.leadTimeByPrefix } : null}
            onDateClick={handleDateClick}
          />
        )
      ) : null}
      {selectedDate && period !== 90 && (
        <DailySessionList
          date={selectedDate}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          onSelectSession={onSelectSession}
          onJumpToTrace={onJumpToTrace}
          fetchSessionMessages={fetchSessionMessages}
          fetchSessionCommits={fetchSessionCommits}
          fetchSessionToolMetrics={fetchSessionToolMetrics}
          fetchDayToolMetrics={fetchDayToolMetrics}
        />
      )}
    </Box>
  );
}

export function AnalyticsPanel({ analytics, sessions = [], sessionsLoading, onSelectSession, onJumpToTrace, fetchSessionMessages, fetchSessionCommits, fetchSessionToolMetrics, fetchDayToolMetrics, costOptimization, fetchCombinedData, fetchQualityMetrics, fetchDeploymentFrequency, fetchReleaseQuality }: Readonly<AnalyticsPanelProps>) {
  const { t } = useTrailI18n();
  const { scrollbarSx } = useTrailTheme();
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [overviewQualityMetrics, setOverviewQualityMetrics] = useState<QualityMetrics | null>(null);

  useEffect(() => {
    if (!fetchQualityMetrics) return;
    const to = new Date();
    const from = new Date(to.getTime() - period * 86_400_000);
    void fetchQualityMetrics({ from: from.toISOString(), to: to.toISOString() }).then((result) => {
      if (result) setOverviewQualityMetrics(result);
    });
  }, [fetchQualityMetrics, period]);

  const { currentTotals, comparison } = useMemo(() => {
    if (!analytics) return { currentTotals: null, comparison: undefined };
    const now = new Date();
    const currentFrom = new Date(now.getTime() - period * 24 * 3600 * 1000);
    const previousFrom = new Date(currentFrom.getTime() - period * 24 * 3600 * 1000);

    const current = { sessions: 0, tokens: 0, cost: 0, commits: 0, loc: 0 };
    const previous = { sessions: 0, tokens: 0, cost: 0, commits: 0, loc: 0 };

    for (const d of analytics.dailyActivity) {
      const date = new Date(d.date);
      if (date >= currentFrom) {
        current.sessions += d.sessions;
        current.tokens += (d.inputTokens + d.outputTokens);
        current.cost += d.estimatedCostUsd;
        current.commits += d.commits;
        current.loc += d.linesAdded;
      } else if (date >= previousFrom) {
        previous.sessions += d.sessions;
        previous.tokens += (d.inputTokens + d.outputTokens);
        previous.cost += d.estimatedCostUsd;
        previous.commits += d.commits;
        previous.loc += d.linesAdded;
      }
    }

    const calcDelta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

    return {
      currentTotals: {
        ...analytics.totals,
        sessions: current.sessions,
        inputTokens: 0,
        outputTokens: current.tokens, // Using combined tokens for display
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        estimatedCostUsd: current.cost,
        totalCommits: current.commits,
        totalLinesAdded: current.loc,
      },
      comparison: {
        sessions: { deltaPct: calcDelta(current.sessions, previous.sessions) },
        tokens: { deltaPct: calcDelta(current.tokens, previous.tokens) },
        cost: { deltaPct: calcDelta(current.cost, previous.cost) },
        commits: { deltaPct: calcDelta(current.commits, previous.commits) },
        loc: { deltaPct: calcDelta(current.loc, previous.loc) },
      },
    };
  }, [analytics, period]);

  if (!analytics || !currentTotals) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography variant="body2" color="text.secondary">
          {t('analytics.loadingAnalytics')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: 'auto', flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 3, ...scrollbarSx }}>
      <OverviewCards totals={{ ...currentTotals, comparison }} sessions={sessions} qualityMetrics={overviewQualityMetrics} />
      <ToolUsageChart items={analytics.toolUsage} />
      <CombinedChartsSection
        dailyActivity={analytics.dailyActivity}
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        period={period}
        setPeriod={setPeriod}
        onSelectSession={onSelectSession}
        onJumpToTrace={onJumpToTrace}
        fetchSessionMessages={fetchSessionMessages}
        fetchSessionCommits={fetchSessionCommits}
        fetchSessionToolMetrics={fetchSessionToolMetrics}
        fetchDayToolMetrics={fetchDayToolMetrics}
        costOptimization={costOptimization}
        fetchCombinedData={fetchCombinedData}
        fetchQualityMetrics={fetchQualityMetrics}
        fetchReleaseQuality={fetchReleaseQuality}
      />
    </Box>
  );
}
