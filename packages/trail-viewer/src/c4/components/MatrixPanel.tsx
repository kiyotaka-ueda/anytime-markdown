import type { C4Element, C4Model, CoverageDiffMatrix, CoverageMatrix, DsmMatrix, DsmNode, FeatureMatrix, HeatmapMatrix } from '@anytime-markdown/trail-core/c4';
import { aggregateDsmToC4ComponentLevel, aggregateDsmToC4ContainerLevel, computeCommunityOverlay, sortDsmMatrixByName } from '@anytime-markdown/trail-core/c4';
import type { CellAlign, HeaderSpan } from '@anytime-markdown/spreadsheet-core';
import { SpreadsheetGrid, createInMemorySheetAdapter, spreadsheetViewerEnMessages } from '@anytime-markdown/spreadsheet-viewer';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';

import { useTrailI18n } from '../../i18n';
import { getDsmCellBackground, getC4Colors } from '../c4Theme';
import { useActivityHeatmap } from '../hooks/useActivityHeatmap';
import { useCodeGraph } from '../../hooks/useCodeGraph';
import { communityColor } from '../../components/communityColors';

// ---------------------------------------------------------------------------
// Coverage heat color (mirrors computeColorMap.ts logic)
// ---------------------------------------------------------------------------

function coverageHeatColor(pct: number): string {
  if (pct >= 80) return '#2e7d32';
  if (pct >= 50) return '#f9a825';
  return '#c62828';
}

// ---------------------------------------------------------------------------
// Package group helpers
// ---------------------------------------------------------------------------

/**
 * DSM ノード列からパッケージ別スパンを計算する。
 * component レベルのノードに対し C4 要素の boundaryId（親コンテナ）でグルーピングする。
 */
function buildDsmPackageSpans(
  nodes: readonly DsmNode[],
  elements: readonly C4Element[],
): readonly HeaderSpan[] | null {
  const elementById = new Map<string, C4Element>();
  for (const el of elements) elementById.set(el.id, el);

  const spans: HeaderSpan[] = [];
  let currentLabel = '';
  let currentSpan = 0;

  for (const node of nodes) {
    const el = elementById.get(node.id);
    const pkgEl = el?.boundaryId ? elementById.get(el.boundaryId) : null;
    const label = pkgEl?.name ?? '';

    if (label === currentLabel) {
      currentSpan++;
    } else {
      if (currentSpan > 0) spans.push({ label: currentLabel, span: currentSpan });
      currentLabel = label;
      currentSpan = 1;
    }
  }
  if (currentSpan > 0) spans.push({ label: currentLabel, span: currentSpan });

  return spans.length > 1 ? spans : null;
}

// ---------------------------------------------------------------------------
// Matrix → SheetSnapshot converters
// ---------------------------------------------------------------------------

function dsmToSheet(matrix: DsmMatrix) {
  const { nodes } = matrix;
  const n = nodes.length;
  const headerRow = ['', ...nodes.map(nd => nd.name)];
  const dataRows = nodes.map((nd, i) => [
    nd.name,
    ...matrix.adjacency[i].map(v => (v === 0 ? '' : String(v))),
  ]);
  const cells = [headerRow, ...dataRows];
  return { cells, alignments: cells.map(r => r.map(() => null)), range: { rows: n + 1, cols: n + 1 } };
}

function fcmapToSheet(fm: FeatureMatrix, model: C4Model) {
  const elementMap = new Map(model.elements.map(e => [e.id, e.name]));
  const colIds = [...new Set(fm.mappings.map(m => m.elementId))];
  const catMap = new Map(fm.categories.map(c => [c.id, c.name]));
  const roleLabel = { primary: 'P', secondary: 'S', dependency: 'D' } as const;
  const cellLookup = new Map(fm.mappings.map(m => [`${m.featureId}:${m.elementId}`, roleLabel[m.role] ?? '']));
  const headerRow = ['Feature', ...colIds.map(id => elementMap.get(id) ?? id)];
  const dataRows = fm.features.map(f => [
    `${catMap.get(f.categoryId) ?? f.categoryId} / ${f.name}`,
    ...colIds.map(id => cellLookup.get(`${f.id}:${id}`) ?? ''),
  ]);
  const cells = [headerRow, ...dataRows];
  return { cells, alignments: cells.map(r => r.map(() => null)), range: { rows: cells.length, cols: headerRow.length } };
}

function coverageToSheet(matrix: CoverageMatrix, model: C4Model) {
  const elementMap = new Map(model.elements.map(e => [e.id, e.name]));
  const headerRow = ['Component', 'Lines%', 'Branches%', 'Functions%'];
  const dataRows = matrix.entries.map(e => [
    elementMap.get(e.elementId) ?? e.elementId,
    String(Math.round(e.lines.pct * 10) / 10),
    String(Math.round(e.branches.pct * 10) / 10),
    String(Math.round(e.functions.pct * 10) / 10),
  ]);
  const cells = [headerRow, ...dataRows];
  const alignments = cells.map(r => r.map((_, ci) => (ci > 0 ? 'right' as const : null)));
  return { cells, alignments, range: { rows: cells.length, cols: 4 } };
}

function heatmapToSheet(matrix: HeatmapMatrix) {
  const cellMap = new Map(matrix.cells.map(c => [`${c.rowIndex}:${c.colIndex}`, c.value]));
  const headerRow = ['', ...matrix.columns.map(c => c.label)];
  const dataRows = matrix.rows.map((row, ri) => [
    row.label,
    ...matrix.columns.map((_, ci) => {
      const v = cellMap.get(`${ri}:${ci}`);
      return v !== undefined && v > 0 ? String(v) : '';
    }),
  ]);
  const cells = [headerRow, ...dataRows];
  return {
    cells,
    alignments: cells.map(r => r.map(() => null)),
    range: { rows: matrix.rows.length + 1, cols: matrix.columns.length + 1 },
  };
}

const sheetT = (key: string) => (spreadsheetViewerEnMessages.Spreadsheet as Record<string, string>)[key] ?? key;

function makeSheetResult(sheet: { cells: string[][]; alignments: CellAlign[][]; range: { rows: number; cols: number } }) {
  const colHeaders = sheet.cells[0]?.slice(1) ?? [];
  const dataRows = sheet.cells.slice(1).map(r => r.slice(1));
  const dataAligns = sheet.alignments.slice(1).map(r => r.slice(1));
  const rowHeaders = sheet.cells.slice(1).map(r => r[0] ?? '');
  const cols = Math.max(0, sheet.range.cols - 1);
  const adapter = createInMemorySheetAdapter(
    { cells: dataRows, alignments: dataAligns, range: { rows: dataRows.length, cols } },
    { readOnly: true },
  );
  return { colHeaders, rowHeaders, adapter };
}

// ---------------------------------------------------------------------------

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
  c4Model,
  serverUrl,
  selectedRepo,
  isDark = false,
}: Readonly<MatrixPanelProps>) {
  const { t } = useTrailI18n();
  const colors = useMemo(() => getC4Colors(isDark), [isDark]);

  const [matrixView, setMatrixView] = useState<'dsm' | 'fcmap' | 'coverage' | 'heatmap'>('dsm');
  const [dsmLevel, setDsmLevel] = useState<'component' | 'package'>('component');

  const { graph: codeGraph } = useCodeGraph(serverUrl ?? '');

  const heatmapEnabled = matrixView === 'heatmap';
  const { data: heatmapResponse } = useActivityHeatmap({
    enabled: heatmapEnabled,
    serverUrl,
    period: '30d',
    mode: 'session-file',
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

  const dsmPackageSpans = useMemo(() => {
    if (dsmLevel !== 'component' || !filteredDsmMatrix || !c4Model) return null;
    return buildDsmPackageSpans(filteredDsmMatrix.nodes, c4Model.elements);
  }, [dsmLevel, filteredDsmMatrix, c4Model]);

  const dsmNodeColorMap = useMemo(() => {
    if (!codeGraph || !c4Model || !filteredDsmMatrix) return null;
    const overlay = computeCommunityOverlay(c4Model, codeGraph, 3, selectedRepo ?? null);
    if (!overlay || overlay.size === 0) return null;
    const map = new Map<string, string>();
    for (const [elementId, entry] of overlay) {
      map.set(elementId, communityColor(entry.dominantCommunity));
    }
    return map;
  }, [codeGraph, c4Model, filteredDsmMatrix, selectedRepo]);

  const dsmResult = useMemo(
    () => filteredDsmMatrix ? makeSheetResult(dsmToSheet(filteredDsmMatrix)) : null,
    [filteredDsmMatrix],
  );
  const fcmapResult = useMemo(
    () => featureMatrix && c4Model ? makeSheetResult(fcmapToSheet(featureMatrix, c4Model)) : null,
    [featureMatrix, c4Model],
  );
  const coverageResult = useMemo(
    () => coverageMatrix && c4Model ? makeSheetResult(coverageToSheet(coverageMatrix, c4Model)) : null,
    [coverageMatrix, c4Model],
  );
  const heatmapResult = useMemo(
    () => heatmapMatrix ? makeSheetResult(heatmapToSheet(heatmapMatrix)) : null,
    [heatmapMatrix],
  );

  const activeResult =
    matrixView === 'heatmap' ? heatmapResult :
    matrixView === 'coverage' ? coverageResult :
    matrixView === 'fcmap' ? fcmapResult :
    dsmResult;

  const activeAdapter = activeResult?.adapter ?? null;
  const activeColHeaders = activeResult?.colHeaders;
  const activeRowHeaders = activeResult?.rowHeaders;

  const gridDimensions = useMemo(() => {
    if (!activeAdapter) return { rows: 51, cols: 15 };
    const snap = activeAdapter.getSnapshot();
    return { rows: snap.range.rows, cols: snap.range.cols };
  }, [activeAdapter]);

  const dsmMaxValue = useMemo(() => {
    if (!filteredDsmMatrix) return 1;
    return Math.max(1, ...filteredDsmMatrix.adjacency.map(row => Math.max(0, ...row)));
  }, [filteredDsmMatrix]);

  const dsmCellBackground = useMemo(
    () => getDsmCellBackground(colors, dsmMaxValue),
    [colors, dsmMaxValue],
  );

  const dsmRowHeaderBackground = useMemo(() => {
    if (!dsmNodeColorMap || !filteredDsmMatrix) return undefined;
    const nodes = filteredDsmMatrix.nodes;
    return (rowIndex: number) => dsmNodeColorMap.get(nodes[rowIndex]?.id ?? '');
  }, [dsmNodeColorMap, filteredDsmMatrix]);

  const dsmColHeaderBackground = useMemo(() => {
    if (!dsmNodeColorMap || !filteredDsmMatrix) return undefined;
    const nodes = filteredDsmMatrix.nodes;
    return (colIndex: number) => dsmNodeColorMap.get(nodes[colIndex]?.id ?? '');
  }, [dsmNodeColorMap, filteredDsmMatrix]);

  // Coverage ビュー: 行ヘッダーにコミュニティ色
  const coverageRowHeaderBackground = useMemo(() => {
    if (!dsmNodeColorMap || !coverageMatrix) return undefined;
    const entries = coverageMatrix.entries;
    return (rowIndex: number) => dsmNodeColorMap.get(entries[rowIndex]?.elementId ?? '');
  }, [dsmNodeColorMap, coverageMatrix]);

  // Coverage ビュー: セルを coverage overlay 色（Lines/Branches/Functions 共通の閾値）で塗りつぶし
  const coverageCellBackground = useMemo(() => {
    if (!coverageMatrix) return undefined;
    return (_row: number, _col: number, value: string): string | undefined => {
      const pct = Number.parseFloat(value);
      if (Number.isNaN(pct)) return undefined;
      return coverageHeatColor(pct) + '55';
    };
  }, [coverageMatrix]);

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
        )}
      </Box>

      {/* Sheet */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {activeAdapter ? (
          <SpreadsheetGrid
            key={matrixView === 'dsm' ? `dsm-${dsmLevel}` : matrixView}
            adapter={activeAdapter}
            isDark={isDark}
            t={sheetT}
            showApply={false}
            showRange={false}
            showToolbar={false}
            columnHeaders={activeColHeaders}
            rotateColumnHeaders={matrixView === 'dsm'}
            cellSize={matrixView === 'dsm' ? 28 : undefined}
            rowHeaders={activeRowHeaders}
            rowHeaderWidth={120}
            columnHeaderGroups={matrixView === 'dsm' && dsmPackageSpans ? [dsmPackageSpans] : undefined}
            rowHeaderGroups={matrixView === 'dsm' && dsmPackageSpans ? [dsmPackageSpans] : undefined}
            gridRows={gridDimensions.rows}
            gridCols={gridDimensions.cols}
            getCellBackground={
              matrixView === 'dsm' ? dsmCellBackground :
              matrixView === 'coverage' ? coverageCellBackground :
              undefined
            }
            getRowHeaderBackground={
              matrixView === 'dsm' ? dsmRowHeaderBackground :
              matrixView === 'coverage' ? coverageRowHeaderBackground :
              undefined
            }
            getColumnHeaderBackground={matrixView === 'dsm' ? dsmColHeaderBackground : undefined}
          />
        ) : matrixView === 'heatmap' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              {heatmapEnabled ? t('c4.heatmap.loading') : t('c4.heatmap.empty')}
            </Typography>
          </Box>
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
