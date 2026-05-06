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
import { CombinedChartsContent } from './analytics/charts/combined/CombinedChartsContent';
import { CombinedChartsSection } from './analytics/panels/CombinedChartsSection';

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

// CombinedChartsContent moved to ./analytics/charts/combined/CombinedChartsContent

// ReleasesBarChart moved to ./analytics/charts/ReleasesBarChart

// CombinedMetric moved to ./analytics/types

// CombinedChartsSection moved to ./analytics/panels/CombinedChartsSection

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
