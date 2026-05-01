import type { C4Model, CoverageDiffMatrix, CoverageMatrix, DsmMatrix, FeatureMatrix, HeatmapMatrix } from '@anytime-markdown/trail-core/c4';
import { aggregateDsmToC4ComponentLevel, aggregateDsmToC4ContainerLevel, sortDsmMatrixByName } from '@anytime-markdown/trail-core/c4';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';

import { useTrailI18n } from '../../i18n';
import { getC4Colors } from '../c4Theme';
import { useActivityHeatmap } from '../hooks/useActivityHeatmap';
import { CoverageCanvas } from './CoverageCanvas';
import { DsmCanvas } from './DsmCanvas';
import { FcMapCanvas } from './FcMapCanvas';
import { HeatmapCanvas } from './HeatmapCanvas';

export interface MatrixPanelProps {
  readonly dsmMatrix: DsmMatrix | null;
  readonly featureMatrix: FeatureMatrix | null;
  readonly coverageMatrix: CoverageMatrix | null;
  readonly coverageDiff: CoverageDiffMatrix | null;
  readonly c4Model: C4Model | null;
  readonly serverUrl?: string;
  readonly selectedRepo?: string;
  readonly isDark?: boolean;
}

export function MatrixPanel({
  dsmMatrix,
  featureMatrix,
  coverageMatrix,
  coverageDiff,
  c4Model,
  serverUrl,
  selectedRepo,
  isDark = false,
}: Readonly<MatrixPanelProps>) {
  const { t } = useTrailI18n();
  const colors = useMemo(() => getC4Colors(isDark), [isDark]);

  const [matrixView, setMatrixView] = useState<'dsm' | 'fcmap' | 'coverage' | 'heatmap'>('dsm');
  const [dsmLevel, setDsmLevel] = useState<'component' | 'package'>('component');
  const [dsmClustered, setDsmClustered] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState<'session-file' | 'subagent-file'>('session-file');

  const heatmapEnabled = matrixView === 'heatmap';
  const { data: heatmapResponse } = useActivityHeatmap({
    enabled: heatmapEnabled,
    serverUrl,
    period: '30d',
    mode: heatmapMode,
    topK: 50,
    repoName: selectedRepo || undefined,
  });
  const heatmapMatrix = useMemo<HeatmapMatrix | null>(() => {
    if (!heatmapResponse) return null;
    return {
      rows: heatmapResponse.rows,
      columns: heatmapResponse.columns,
      cells: heatmapResponse.cells,
      maxValue: heatmapResponse.maxValue,
    };
  }, [heatmapResponse]);

  const filteredDsmMatrix = useMemo(() => {
    if (!dsmMatrix) return null;
    let m = dsmMatrix;
    if (c4Model) {
      m = dsmLevel === 'package'
        ? aggregateDsmToC4ContainerLevel(dsmMatrix, c4Model.elements)
        : aggregateDsmToC4ComponentLevel(dsmMatrix, c4Model.elements);
    }
    return sortDsmMatrixByName(m);
  }, [dsmMatrix, dsmLevel, c4Model]);

  const toolbarButtonSx = {
    textTransform: 'none' as const,
    color: colors.accent,
    borderColor: colors.border,
    fontSize: '0.75rem',
    '&:hover': { bgcolor: colors.hover },
    '&:focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: '2px' },
    '&:disabled': { color: colors.textMuted },
  };
  const toolbarButtonActiveBg = colors.focus;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: colors.bg }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderBottom: `1px solid ${colors.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <ButtonGroup size="small">
          {(['dsm', 'fcmap', 'coverage', 'heatmap'] as const).map((view) => {
            const label = view === 'dsm' ? 'DSM' : view === 'fcmap' ? 'F-cMap' : view === 'coverage' ? 'Cov' : t('c4.viewToggle.heatmap');
            const isDisabled = (view === 'fcmap' && !featureMatrix) || (view === 'coverage' && !coverageMatrix);
            return (
              <Button
                key={view}
                size="small"
                disabled={isDisabled}
                aria-pressed={matrixView === view}
                aria-label={`Show ${label} matrix`}
                onClick={() => setMatrixView(view)}
                sx={{ ...toolbarButtonSx, ...(matrixView === view && { bgcolor: toolbarButtonActiveBg }) }}
              >
                {label}
              </Button>
            );
          })}
        </ButtonGroup>

        {matrixView === 'dsm' && (
          <>
            <ButtonGroup size="small">
              {(['component', 'package'] as const).map((level) => (
                <Button
                  key={level}
                  size="small"
                  aria-pressed={dsmLevel === level}
                  onClick={() => setDsmLevel(level)}
                  sx={{ ...toolbarButtonSx, ...(dsmLevel === level && { bgcolor: toolbarButtonActiveBg }) }}
                >
                  {level === 'component' ? 'Component' : 'Package'}
                </Button>
              ))}
            </ButtonGroup>
            <Button
              size="small"
              onClick={() => setDsmClustered(prev => !prev)}
              sx={{ ...toolbarButtonSx, ...(dsmClustered && { bgcolor: toolbarButtonActiveBg }) }}
            >
              Cluster
            </Button>
          </>
        )}

        {matrixView === 'heatmap' && (
          <ButtonGroup size="small" aria-label="Heatmap mode">
            {(['session-file', 'subagent-file'] as const).map((m) => {
              const label = m === 'session-file' ? t('c4.heatmap.modeSessionFile') : t('c4.heatmap.modeSubagentFile');
              return (
                <Button
                  key={m}
                  size="small"
                  aria-pressed={heatmapMode === m}
                  onClick={() => setHeatmapMode(m)}
                  sx={{ ...toolbarButtonSx, ...(heatmapMode === m && { bgcolor: toolbarButtonActiveBg }) }}
                >
                  {label}
                </Button>
              );
            })}
          </ButtonGroup>
        )}
      </Box>

      {/* Canvas */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {matrixView === 'heatmap' ? (
          heatmapMatrix && heatmapMatrix.rows.length > 0 && heatmapMatrix.columns.length > 0 ? (
            <HeatmapCanvas
              matrix={heatmapMatrix}
              colorScale={isDark ? 'amber' : 'sumi'}
              isDark={isDark}
            />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                {heatmapEnabled ? t('c4.heatmap.empty') : t('c4.heatmap.loading')}
              </Typography>
            </Box>
          )
        ) : matrixView === 'coverage' && coverageMatrix && c4Model ? (
          <CoverageCanvas
            coverageMatrix={coverageMatrix}
            coverageDiff={coverageDiff}
            model={c4Model}
            isDark={isDark}
          />
        ) : matrixView === 'fcmap' && featureMatrix && c4Model ? (
          <FcMapCanvas
            featureMatrix={featureMatrix}
            model={c4Model}
            isDark={isDark}
          />
        ) : filteredDsmMatrix ? (
          <DsmCanvas
            matrix={filteredDsmMatrix}
            fullModel={c4Model ?? undefined}
            clustered={dsmClustered}
            isDark={isDark}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Import a C4 model to view DSM
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
