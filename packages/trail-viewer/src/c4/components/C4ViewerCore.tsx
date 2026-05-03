import type { GraphDocument, GraphNode } from '@anytime-markdown/graph-core';
import { engine, layoutWithSubgroups, MinimapCanvas, state as graphState } from '@anytime-markdown/graph-core';
import type { BoundaryInfo, C4Element, C4Model, C4ReleaseEntry, CommunityOverlayEntry, ComplexityMatrix, CoverageDiffMatrix, CoverageMatrix, DocLink, DsmMatrix, FeatureMatrix, HotspotMap, ImportanceMatrix, ManualGroup, MetricOverlay } from '@anytime-markdown/trail-core/c4';
import { aggregateDsmToC4ComponentLevel, aggregateDsmToC4ContainerLevel, aggregateDsmToC4SystemLevel, aggregateHotspotToC4, buildC4ElementById, buildCommunityTree, buildElementTree, buildLevelView, c4ToGraphDocument, collectDescendantIds, computeColorMap, computeCommunityOverlay, computeFileHotspot, filterDsmMatrix, filterModelForDrill, filterTreeByLevel, mapFileToC4Elements, sortDsmMatrixByName } from '@anytime-markdown/trail-core/c4';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import LayersIcon from '@mui/icons-material/Layers';
import LinkIcon from '@mui/icons-material/Link';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { useTrailI18n } from '../../i18n';
import { DOC_TYPE_COLORS, getC4Colors } from '../c4Theme';
import { useC4GhostEdges } from '../hooks/useC4GhostEdges';
import { useDefectRisk } from '../hooks/useDefectRisk';
import { useHotspot } from '../hooks/useHotspot';
import { useTemporalCoupling } from '../hooks/useTemporalCoupling';
import { useElementFunctions } from '../hooks/useElementFunctions';

const UNKNOWN_REPO_KEY = '__unknown__';
const CURRENT_RELEASE_TAG = 'current';
const SELECTED_ELEMENT_DETAILS_WIDTH = 240;
const SELECTED_ELEMENT_DETAILS_RIGHT_OFFSET = 8;
const TREND_CHART_POPUP_GAP = 8;
const TREND_CHART_POPUP_MAX_WIDTH = 1000;
const TREND_CHART_RESERVED_RIGHT_WIDTH =
  SELECTED_ELEMENT_DETAILS_WIDTH + SELECTED_ELEMENT_DETAILS_RIGHT_OFFSET + TREND_CHART_POPUP_GAP;

type OverlayCategory = 'none' | 'coverage' | 'dsm' | 'complexity' | 'importance' | 'hotspot' | 'fcmap';

// fcmap はサブ項目が MetricOverlay ではなくフィーチャー ID のため除外
const OVERLAY_CATEGORY_DEFAULTS: Record<Exclude<OverlayCategory, 'none' | 'fcmap'>, MetricOverlay> = {
  coverage: 'coverage-lines',
  dsm: 'dsm-out',
  complexity: 'complexity-most',
  importance: 'importance',
  hotspot: 'hotspot-frequency',
};

export function getActivityTrendChartWidth(hasSelectedElementDetails: boolean): string {
  return hasSelectedElementDetails
    ? `min(${TREND_CHART_POPUP_MAX_WIDTH}px, calc(100% - ${TREND_CHART_RESERVED_RIGHT_WIDTH}px))`
    : `min(${TREND_CHART_POPUP_MAX_WIDTH}px, calc(100% - 16px))`;
}

export function getActivityTrendChartPlacement() {
  return {
    position: 'absolute' as const,
    left: 8,
    bottom: 8,
    zIndex: 9,
  };
}

export function canShowManualContextActions(
  c4Model: C4Model | null,
  c4Id: string | null,
): boolean {
  if (!c4Model || !c4Id) return false;
  return c4Model.elements.some((element) => element.id === c4Id && element.manual === true);
}

const DEFAULT_TC_VALUE: TemporalCouplingControlsValue = {
  enabled: false,
  windowDays: 30,
  threshold: 0.5,
  topK: 50,
  directional: false,
  confidenceThreshold: 0.5,
  directionalDiff: 0.3,
  granularity: 'commit',
};

/** チェックボックス非表示フィルタ対象の型（system は常時表示のため除外） */
const FILTER_CHECKABLE_TYPES = new Set(['container', 'containerDb', 'component'] as const);
/** ドリルダウン時のスコープに含まれる型 */
const DRILL_SCOPE_TYPES = new Set(['system', 'container', 'containerDb', 'component'] as const);
function matchesDocScope(docScope: readonly string[], elementId: string): boolean {
  return docScope.some(scope => scope === elementId || scope.startsWith(`${elementId}/`));
}
function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}
import GroupWorkIcon from '@mui/icons-material/GroupWork';

import { communityColor } from '../../components/communityColors';
import { useCodeGraph } from '../../hooks/useCodeGraph';
import { computeClaudeActivityColorMap, computeConflictBorderMap,computeMultiAgentColorMap } from '../claudeActivityColorMap';
import { ActivityTrendChart } from './ActivityTrendChart';
import type { C4ElementKind, ElementFormData, RelationshipFormData } from './C4EditDialogs';
import { AddElementDialog, AddRelationshipDialog } from './C4EditDialogs';
import { C4ElementTree } from './C4ElementTree';
import { GraphCanvas } from './GraphCanvas';
import { HotspotControls, type HotspotControlsValue } from './HotspotControls';
import { type CommunityLegendItem,OverlayLegend } from './OverlayLegend';
import {
  TemporalCouplingSettingsPopup,
  applyGhostEdgeMode,
  type TemporalCouplingControlsValue,
} from './TemporalCouplingControls';

const { graphReducer, createInitialState } = graphState;
const { fitToContent } = engine;

/** Bounding box of a set of graph nodes */
function computeBounds(nodes: readonly GraphNode[]) {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }
  return { minX, minY, maxX, maxY };
}

export interface C4ViewerCoreProps {
  readonly isDark?: boolean;
  readonly c4Model: C4Model | null;
  readonly boundaries: readonly BoundaryInfo[];
  readonly featureMatrix: FeatureMatrix | null;
  readonly dsmMatrix: DsmMatrix | null;
  readonly coverageMatrix: CoverageMatrix | null;
  readonly coverageDiff: CoverageDiffMatrix | null;
  readonly complexityMatrix?: ComplexityMatrix | null;
  readonly importanceMatrix?: ImportanceMatrix | null;
  readonly docLinks?: readonly DocLink[];
  readonly connected?: boolean;
  readonly analysisProgress?: { phase: string; percent: number } | null;
  readonly onAddElement?: (data: ElementFormData) => void;
  readonly onUpdateElement?: (id: string, data: ElementFormData) => void;
  readonly onAddRelationship?: (data: RelationshipFormData) => void;
  readonly onRemoveElement?: (id: string) => void;
  readonly onPurgeDeleted?: () => void;
  readonly onDocLinkClick?: (doc: DocLink) => void;
  readonly onOpenFile?: (filePath: string) => void;
  /** L3 component 右クリックの「シーケンス表示」を選択したときのコールバック。 */
  readonly onShowSequence?: (elementId: string) => void;
  readonly containerHeight?: string;
  readonly releases?: readonly C4ReleaseEntry[];
  readonly selectedRelease?: string;
  readonly onReleaseSelect?: (release: string) => void;
  readonly selectedRepo?: string;
  readonly onRepoSelect?: (repo: string) => void;
  readonly serverUrl?: string;
  readonly claudeActivity?: import('../hooks/useC4DataSource').ClaudeActivityState | null;
  readonly multiAgentActivity?: import('../hooks/useC4DataSource').MultiAgentActivityState | null;
  readonly onResetClaudeActivity?: () => void;
  readonly manualGroups?: readonly ManualGroup[];
  /** 初期表示 C4 レベル（1=L1 Context, 2=L2 Container, 3=L3 Component, 4=L4 Code）*/
  readonly initialLevel?: number;
}

export function C4ViewerCore({
  isDark = false,
  c4Model,
  boundaries: boundaryInfos,
  featureMatrix,
  dsmMatrix,
  coverageMatrix,
  complexityMatrix,
  importanceMatrix,
  docLinks,
  connected,
  analysisProgress,
  onAddElement,
  onUpdateElement,
  onAddRelationship,
  onRemoveElement,
  onPurgeDeleted,
  onDocLinkClick,
  onOpenFile,
  onShowSequence,
  containerHeight = '100vh',
  releases = [],
  selectedRelease = CURRENT_RELEASE_TAG,
  onReleaseSelect,
  selectedRepo: selectedRepoProp,
  onRepoSelect,
  serverUrl = '',
  claudeActivity,
  multiAgentActivity,
  onResetClaudeActivity,
  manualGroups,
  initialLevel,
}: Readonly<C4ViewerCoreProps>) {
  const { t } = useTrailI18n();
  const colors = useMemo(() => getC4Colors(isDark), [isDark]);

  // リリース entry と current entry 両方からリポジトリを収集する
  const repoOptions = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const r of releases) {
      const key = r.repoName ?? (r.tag === CURRENT_RELEASE_TAG ? '' : UNKNOWN_REPO_KEY);
      if (!key) continue;
      if (!seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    }
    return order;
  }, [releases]);

  const [selectedRepoInternal, setSelectedRepoInternal] = useState<string>(() => repoOptions[0] ?? '');
  const selectedRepo = selectedRepoProp ?? selectedRepoInternal;

  useEffect(() => {
    if (repoOptions.length === 0) {
      if (selectedRepo !== '') {
        setSelectedRepoInternal('');
        onRepoSelect?.('');
      }
      return;
    }
    if (!repoOptions.includes(selectedRepo)) {
      const next = repoOptions[0];
      setSelectedRepoInternal(next);
      onRepoSelect?.(next);
    }
  }, [repoOptions, selectedRepo, onRepoSelect]);

  const visibleReleases = useMemo(() => {
    if (releases.length === 0) return [];
    // current エントリに repoName が付いている行が1件でもあれば「複数リポジトリ対応モード」として扱う
    const hasRepoTaggedCurrent = releases.some(
      (r) => r.tag === CURRENT_RELEASE_TAG && r.repoName != null && r.repoName !== '',
    );
    const out: C4ReleaseEntry[] = [];
    for (const r of releases) {
      if (r.tag === CURRENT_RELEASE_TAG) {
        if (hasRepoTaggedCurrent) {
          // 複数リポジトリ対応: 選択中の repo と一致する current のみ表示
          if ((r.repoName ?? '') === selectedRepo) {
            out.push(r);
          }
        } else {
          // レガシー互換: repoName を持たない current は常に表示
          out.push(r);
        }
        continue;
      }
      if (selectedRepo === '') continue;
      if ((r.repoName ?? UNKNOWN_REPO_KEY) === selectedRepo) {
        out.push(r);
      }
    }
    return out;
  }, [releases, selectedRepo]);

  const handleRepoChange = useCallback((next: string): void => {
    setSelectedRepoInternal(next);
    onRepoSelect?.(next);
  }, [onRepoSelect]);

  const handleReleaseChange = useCallback((next: string): void => {
    onReleaseSelect?.(next);
  }, [onReleaseSelect]);

  const [state, dispatch] = useReducer(graphReducer, createInitialState());
  const [fullDoc, setFullDoc] = useState<GraphDocument | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number>(initialLevel ?? 1);

  const [showCoverage, setShowCoverage] = useState(false);
  const [showAncestorEdges, setShowAncestorEdges] = useState(true);
  const [metricOverlay, setMetricOverlay] = useState<MetricOverlay>('none');
  const [selectedFcmapFeatureId, setSelectedFcmapFeatureId] = useState<string | null>(null);
  const [overlayCategory, setOverlayCategory] = useState<OverlayCategory>('none');
  const [drWindowDays, setDrWindowDays] = useState(90);
  const [tcValue, setTcValue] = useState<TemporalCouplingControlsValue>(DEFAULT_TC_VALUE);
  const [hotspotValue, setHotspotValue] = useState<HotspotControlsValue>({
    period: '30d',
    granularity: 'commit',
  });
  const isHotspotOverlay = metricOverlay === 'hotspot-frequency' || metricOverlay === 'hotspot-risk';
  const { data: hotspotResponse, loading: hotspotLoading } = useHotspot({
    enabled: isHotspotOverlay,
    serverUrl,
    period: hotspotValue.period,
    granularity: hotspotValue.granularity,
    repo: selectedRepo || undefined,
  });
  const { entries: drEntries } = useDefectRisk({
    enabled: metricOverlay === 'defect-risk',
    serverUrl,
    windowDays: drWindowDays,
    halfLifeDays: 90,
    repo: selectedRepo || undefined,
  });
  const [dsmLevel, setDsmLevel] = useState<'component' | 'package'>('component');
  const {
    edges: rawTcEdges,
    granularity: tcGranularity,
    loading: tcLoading,
  } = useTemporalCoupling({
    enabled: tcValue.enabled && !!selectedRepo,
    serverUrl,
    repoName: selectedRepo ?? '',
    windowDays: tcValue.windowDays,
    threshold: tcValue.threshold,
    topK: tcValue.topK,
    directional: false,
    granularity: tcValue.granularity,
  });
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<readonly string[]>([]);
  const [drillStack, setDrillStack] = useState<readonly { readonly element: C4Element; readonly prevLevel: number; readonly prevCheckedIds: ReadonlySet<string> | null }[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    readonly x: number;
    readonly y: number;
    readonly c4Id: string;
    readonly nodeType: string;
  } | null>(null);
  const [checkedPackageIds, setCheckedPackageIds] = useState<ReadonlySet<string> | null>(null);
  const [soloFrameId, setSoloFrameId] = useState<string | null>(null);
  const [centerOnSelect, setCenterOnSelect] = useState(false);

  // --- Community overlay state ---
  const [showCommunity, setShowCommunity] = useState(false);
  const [codeGraphEnabled, setCodeGraphEnabled] = useState(false);
  const [showActivityTrend, setShowActivityTrend] = useState(true);
  const { graph: codeGraph } = useCodeGraph(serverUrl, { enabled: showCommunity || codeGraphEnabled || currentLevel >= 2 });

  // --- Flow mode state ---
  const ghostEdges = useC4GhostEdges(
    rawTcEdges,
    c4Model,
    currentLevel as 1 | 2 | 3 | 4,
    selectedRepo ?? null,
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // L1/L2/L3/L4 切り替え後に Fit を適用する残り回数。
  // 0 = Fit 不要。正値の間は SET_DOCUMENT に fit viewport を埋め込む。
  // setTimeout は React スケジューラと競合するため使わず、カウントダウン方式にする。
  const pendingFitCountRef = useRef(0);

  // --- Editing state ---
  const [addElementType, setAddElementType] = useState<C4ElementKind | null>(null);
  const [editElement, setEditElement] = useState<{ id: string; type: C4ElementKind; name: string; description: string; external: boolean; parentId?: string | null } | null>(null);
  const [addRelOpen, setAddRelOpen] = useState(false);

  const handleOverlayCategoryChange = useCallback((cat: OverlayCategory) => {
    setOverlayCategory(cat);
    if (cat === 'none') {
      setMetricOverlay('none');
    } else if (cat === 'fcmap') {
      setMetricOverlay('fcmap');
    } else {
      setMetricOverlay(OVERLAY_CATEGORY_DEFAULTS[cat]);
    }
  }, []);

  useEffect(() => {
    if (!featureMatrix && overlayCategory === 'fcmap') {
      handleOverlayCategoryChange('none');
    }
  }, [featureMatrix, overlayCategory, handleOverlayCategoryChange]);

  // リポジトリ切替時は overlay 関連の選択を初期化する
  // （前のリポジトリ向けの選択が新リポジトリで無効になり、ユーザーに混乱を与えるため）
  useEffect(() => {
    setOverlayCategory('none');
    setMetricOverlay('none');
    setSelectedFcmapFeatureId(null);
  }, [selectedRepo]);



  const handleElementSelect = useCallback((id: string) => {
    setCenterOnSelect(true);
    setSelectedElementId(id);
  }, []);

  const handleAddElement = useCallback((data: ElementFormData) => {
    onAddElement?.(data);
  }, [onAddElement]);

  const handleUpdateElement = useCallback((data: ElementFormData) => {
    if (!editElement) return;
    onUpdateElement?.(editElement.id, data);
    setEditElement(null);
  }, [editElement, onUpdateElement]);

  const handleAddRelationship = useCallback((data: RelationshipFormData) => {
    onAddRelationship?.(data);
  }, [onAddRelationship]);

  const handleDeleteElement = useCallback((elementId: string) => {
    if (!c4Model) return;
    const elem = c4Model.elements.find(e => e.id === elementId);
    if (elem?.manual) {
      onRemoveElement?.(elementId);
      if (selectedElementId === elementId) setSelectedElementId(null);
    }
    setContextMenu(null);
  }, [c4Model, onRemoveElement, selectedElementId]);

  const selectedSystemId = useMemo(() => {
    if (!selectedElementId || !c4Model) return null;
    const elem = c4Model.elements.find(e => e.id === selectedElementId);
    return elem?.type === 'system' ? elem.id : null;
  }, [selectedElementId, c4Model]);

  useEffect(() => {
    if (!c4Model) return;

    const currentDrillRoot = drillStack.at(-1)?.element ?? null;
    let filteredModel = currentDrillRoot
      ? filterModelForDrill(c4Model, currentDrillRoot.id)
      : c4Model;

    if (checkedPackageIds) {
      const excluded = new Set<string>();
      for (const elem of filteredModel.elements) {
        if (FILTER_CHECKABLE_TYPES.has(elem.type as 'container') && !checkedPackageIds.has(elem.id)) {
          excluded.add(elem.id);
          for (const id of collectDescendantIds(filteredModel.elements, elem.id)) {
            excluded.add(id);
          }
        }
      }
      if (excluded.size > 0) {
        filteredModel = {
          ...filteredModel,
          elements: filteredModel.elements.filter(e => !excluded.has(e.id)),
          relationships: filteredModel.relationships.filter(
            r => !excluded.has(r.from) && !excluded.has(r.to),
          ),
        };
      }
    }

    // soloFrameId フィルタ: フレームとその全子孫のみ表示
    if (soloFrameId) {
      const keepIds = new Set<string>([soloFrameId]);
      for (const id of collectDescendantIds(filteredModel.elements, soloFrameId)) {
        keepIds.add(id);
      }
      filteredModel = {
        ...filteredModel,
        elements: filteredModel.elements.filter(e => keepIds.has(e.id)),
        relationships: filteredModel.relationships.filter(
          r => keepIds.has(r.from) && keepIds.has(r.to),
        ),
      };
    }

    const doc = c4ToGraphDocument(filteredModel, boundaryInfos, manualGroups);
    layoutWithSubgroups(doc, 'TB', 180, 60);
    setFullDoc(doc);
    let viewDoc = currentLevel < 4 || !showAncestorEdges
      ? (() => {
        const v = buildLevelView(doc, currentLevel, { showAncestorEdges });
        layoutWithSubgroups(v, 'TB', 180, 60);
        return v;
      })()
      : doc;

    // L1/L2/L3/L4 切り替え時に Fit を実行する。
    // viewport を doc に埋め込んで SET_DOCUMENT で確実に適用する（別途 SET_VIEWPORT を
    // 発行すると後続の SET_DOCUMENT で上書きされるため）。
    // setFullDoc() によるstate更新がエフェクトを再実行させるため、
    // カウントダウン方式で複数回の実行に対応する（setTimeout は React スケジューラと競合する）。
    if (pendingFitCountRef.current > 0) {
      pendingFitCountRef.current--;
      const canvas = canvasRef.current;
      if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        const bounds = computeBounds(viewDoc.nodes);
        const viewport = fitToContent(canvas.clientWidth, canvas.clientHeight, bounds);
        viewDoc = { ...viewDoc, viewport };
      }
    }

    dispatch({ type: 'SET_DOCUMENT', doc: viewDoc });
  }, [c4Model, boundaryInfos, drillStack, currentLevel, checkedPackageIds, soloFrameId, manualGroups, showAncestorEdges]);

  /** 右クリックメニューを表示する */
  const handleNodeContextMenu = useCallback(
    (c4Id: string, x: number, y: number, nodeType: string) => {
      setContextMenu({ x, y, c4Id, nodeType });
    },
    [],
  );

  /** コンテキストメニューを閉じる */
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /** フレームのみ表示 */
  const handleShowOnlyFrame = useCallback((c4Id: string) => {
    setSoloFrameId(c4Id);
    setContextMenu(null);
  }, []);

  /** 要素のパスをクリップボードにコピーする */
  const handleCopyPath = useCallback(() => {
    if (!contextMenu) return;
    const id = contextMenu.c4Id;
    let path: string;
    if (id.startsWith('pkg_')) {
      // pkg_web-app → packages/web-app
      // pkg_web-app/engine → packages/web-app/src/engine
      const inner = id.slice(4);
      const slash = inner.indexOf('/');
      if (slash === -1) {
        path = `packages/${inner}`;
      } else {
        path = `packages/${inner.slice(0, slash)}/src/${inner.slice(slash + 1)}`;
      }
    } else if (id.startsWith('file::')) {
      // file::packages/web-app/src/index.ts → packages/web-app/src/index.ts
      const withoutPrefix = id.slice(6);
      const colonIdx = withoutPrefix.indexOf('::');
      path = colonIdx === -1 ? withoutPrefix : withoutPrefix.slice(0, colonIdx);
    } else {
      path = id;
    }
    navigator.clipboard.writeText(path).catch(() => {});
    setContextMenu(null);
  }, [contextMenu])

  const handleOpenFile = useCallback(() => {
    if (!contextMenu) return;
    const id = contextMenu.c4Id;
    // file::packages/web-app/src/index.ts → packages/web-app/src/index.ts
    const withoutPrefix = id.slice(6);
    const colonIdx = withoutPrefix.indexOf('::');
    const filePath = colonIdx === -1 ? withoutPrefix : withoutPrefix.slice(0, colonIdx);
    onOpenFile?.(filePath);
    setContextMenu(null);
  }, [contextMenu, onOpenFile]);

  /** フレームフィルタを解除する */
  const handleClearFrameFilter = useCallback(() => {
    setSoloFrameId(null);
    setContextMenu(null);
  }, []);

  /** ドリルダウン時に子要素が見えるよう最低限必要なレベルを返す */
  const drillTargetLevel = useCallback((type: string): number => {
    if (type === 'system') return 2;
    if (type === 'container') return 3;
    return 4;
  }, []);

  const handleDrillDown = useCallback(
    (c4Id: string) => {
      if (!c4Model) return;
      const element = c4Model.elements.find(e => e.id === c4Id);
      if (element) {
        const prevLevel = currentLevel;
        const minLevel = drillTargetLevel(element.type);
        setDrillStack((prev) => [...prev, { element, prevLevel, prevCheckedIds: checkedPackageIds }]);
        if (currentLevel < minLevel) {
          setCurrentLevel(minLevel);
        }
        const elementById = new Map(c4Model.elements.map(e => [e.id, e]));
        const inScope = new Set<string>();
        if (DRILL_SCOPE_TYPES.has(element.type as 'system')) inScope.add(element.id);
        for (const id of collectDescendantIds(c4Model.elements, element.id)) {
          const el = elementById.get(id);
          if (el && DRILL_SCOPE_TYPES.has(el.type as 'system')) inScope.add(id);
        }
        const expandIds = new Set<string>([element.id]);
        let parentId = element.boundaryId;
        while (parentId) {
          expandIds.add(parentId);
          parentId = elementById.get(parentId)?.boundaryId;
        }
        setCheckedPackageIds(null);
        setCheckReset(prev => ({ key: prev.key + 1, ids: inScope, expanded: expandIds }));
      }
      setSelectedElementId(null);
      setSelectedElementIds([]);
      setSoloFrameId(null);
      setContextMenu(null);
    },
    [c4Model, currentLevel, drillTargetLevel, checkedPackageIds],
  );

  const handleDrillUp = useCallback(() => {
    const entry = drillStack.at(-1);
    if (entry?.prevLevel !== undefined) setCurrentLevel(entry.prevLevel);
    setDrillStack((prev) => prev.slice(0, -1));
    setCheckedPackageIds(null);
    setCheckReset(prev => ({ key: prev.key + 1, ids: entry?.prevCheckedIds ?? null, expanded: null }));
    setSoloFrameId(null);
    setContextMenu(null);
  }, [drillStack]);

  const handleSetLevel = useCallback((level: number) => {
    pendingFitCountRef.current = 5;
    setCurrentLevel(level);
    setDrillStack([]);
    setCheckedPackageIds(null);
    setCheckReset(prev => ({ key: prev.key + 1, ids: null, expanded: null }));
    if (level <= 2) {
      setDsmLevel('package');
    } else {
      setDsmLevel('component');
    }
  }, []);

  const handleFit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = computeBounds(state.document.nodes);
    const viewport = fitToContent(canvas.clientWidth, canvas.clientHeight, bounds);
    dispatch({ type: 'SET_VIEWPORT', viewport });
  }, [state.document.nodes]);


  const elementTree = useMemo(() => {
    if (!c4Model) return [];
    const fullTree = buildElementTree(c4Model, boundaryInfos);
    return filterTreeByLevel(fullTree, currentLevel);
  }, [c4Model, boundaryInfos, currentLevel]);

  const [checkReset, setCheckReset] = useState<{
    readonly key: number;
    readonly ids: ReadonlySet<string> | null;
    readonly expanded: ReadonlySet<string> | null;
  }>({ key: 0, ids: null, expanded: null });

  const deletedIds = useMemo(() => {
    if (!c4Model) return undefined;
    const ids = new Set<string>();
    for (const el of c4Model.elements) {
      if (el.deleted) ids.add(el.id);
    }
    return ids.size > 0 ? ids : undefined;
  }, [c4Model]);

  const filteredDsmMatrix = useMemo(() => {
    if (!dsmMatrix) return null;
    let m = dsmMatrix;
    if (currentLevel === 1 && c4Model) {
      m = aggregateDsmToC4SystemLevel(dsmMatrix, c4Model.elements);
    } else if (currentLevel === 2 && c4Model) {
      m = aggregateDsmToC4ContainerLevel(dsmMatrix, c4Model.elements);
    } else if (currentLevel === 3 && c4Model) {
      m = aggregateDsmToC4ComponentLevel(dsmMatrix, c4Model.elements);
    }
    m = sortDsmMatrixByName(m);
    if (checkedPackageIds) {
      if (currentLevel === 4 && c4Model) {
        // L4 では DSM ノードがファイル（code 要素）のため、
        // checkedPackageIds に含まれるコンテナ/コンポーネント ID を
        // その配下のファイル ID へ展開してからフィルタリングする。
        const elementById = new Map(c4Model.elements.map(e => [e.id, e]));
        const fileIdsToKeep = new Set<string>();
        for (const node of m.nodes) {
          let current = elementById.get(node.id);
          while (current) {
            if (checkedPackageIds.has(current.id)) {
              fileIdsToKeep.add(node.id);
              break;
            }
            if (!current.boundaryId) break;
            current = elementById.get(current.boundaryId);
          }
        }
        m = filterDsmMatrix(m, fileIdsToKeep);
      } else {
        m = filterDsmMatrix(m, checkedPackageIds);
      }
    }
    return m;
  }, [dsmMatrix, currentLevel, c4Model, checkedPackageIds]);

  // importanceMatrix は WebSocket でリポジトリ非依存に push されるため、
  // 現在の c4Model.elements とキーが一致するかでデータの有無を判定する
  const hasImportanceData = useMemo(() => {
    if (!importanceMatrix || !c4Model) return false;
    const ids = new Set(c4Model.elements.map((e) => e.id));
    return Object.keys(importanceMatrix).some((id) => ids.has(id));
  }, [importanceMatrix, c4Model]);

  const isCategoryDataAvailable = useMemo(() => {
    // 空 entries / 空 nodes も「データなし」として扱う（サーバーが空マトリクスを返すケースに備える）
    if (overlayCategory === 'coverage') return !!coverageMatrix && coverageMatrix.entries.length > 0;
    if (overlayCategory === 'dsm') return !!filteredDsmMatrix && filteredDsmMatrix.nodes.length > 0;
    if (overlayCategory === 'complexity') return !!complexityMatrix && complexityMatrix.entries.length > 0;
    if (overlayCategory === 'importance') return hasImportanceData;
    return true;
  }, [overlayCategory, coverageMatrix, filteredDsmMatrix, complexityMatrix, hasImportanceData]);

  useEffect(() => {
    if (!isCategoryDataAvailable) {
      setMetricOverlay('none');
    }
  }, [isCategoryDataAvailable]);

  const elementTypeById = useMemo<ReadonlyMap<string, string>>(
    () => new Map((c4Model?.elements ?? []).map((e) => [e.id, e.type])),
    [c4Model],
  );

  // L1=Context(system), L2=Container(container), L3=Component(component), L4=Code(code)
  const levelTargetType = useMemo(() => {
    return currentLevel === 1 ? 'system'
      : currentLevel === 2 ? 'container'
      : currentLevel === 3 ? 'component'
      : 'code';
  }, [currentLevel]);

  const levelFilteredImportanceMatrix = useMemo(() => {
    if (!importanceMatrix || !c4Model) return importanceMatrix ?? null;
    const filtered: ImportanceMatrix = {};
    for (const [id, score] of Object.entries(importanceMatrix)) {
      if (elementTypeById.get(id) === levelTargetType) filtered[id] = score;
    }
    return filtered;
  }, [importanceMatrix, c4Model, elementTypeById, levelTargetType]);

  const levelFilteredComplexityMatrix = useMemo(() => {
    if (!complexityMatrix || !c4Model) return complexityMatrix ?? null;
    const entries = complexityMatrix.entries.filter((e) => elementTypeById.get(e.elementId) === levelTargetType);
    return { ...complexityMatrix, entries };
  }, [complexityMatrix, c4Model, elementTypeById, levelTargetType]);

  // currentLevel に合わせて coverage エントリを対象タイプに絞る（boundary 除外）
  const levelFilteredCoverageMatrix = useMemo(() => {
    if (!coverageMatrix || !c4Model) return coverageMatrix ?? null;
    const targetType = currentLevel === 2 ? 'container'
      : currentLevel === 3 ? 'component'
      : 'code';
    const typeById = new Map(c4Model.elements.map((e) => [e.id, e.type]));
    const entries = coverageMatrix.entries.filter((e) => typeById.get(e.elementId) === targetType);
    return { ...coverageMatrix, entries };
  }, [coverageMatrix, c4Model, currentLevel]);

  const defectRiskMap = useMemo<ReadonlyMap<string, number> | null>(() => {
    if (metricOverlay !== 'defect-risk' || drEntries.length === 0 || !c4Model) return null;
    const elementById = buildC4ElementById(c4Model.elements);
    const map = new Map<string, number>();
    for (const entry of drEntries) {
      for (const m of mapFileToC4Elements(entry.filePath, elementById)) {
        map.set(m.elementId, Math.max(map.get(m.elementId) ?? 0, entry.score));
      }
    }
    return map;
  }, [metricOverlay, drEntries, c4Model]);

  const levelFilteredDefectRiskMap = useMemo<ReadonlyMap<string, number> | null>(() => {
    if (!defectRiskMap || !c4Model) return defectRiskMap;
    const filtered = new Map<string, number>();
    for (const [id, score] of defectRiskMap) {
      if (elementTypeById.get(id) === levelTargetType) filtered.set(id, score);
    }
    return filtered;
  }, [defectRiskMap, c4Model, elementTypeById, levelTargetType]);

  const hotspotMap = useMemo<HotspotMap | null>(() => {
    if (!isHotspotOverlay || !hotspotResponse || !c4Model) return null;
    const fileHotspots = computeFileHotspot(hotspotResponse.files);
    return aggregateHotspotToC4(fileHotspots, c4Model, complexityMatrix ?? null);
  }, [isHotspotOverlay, hotspotResponse, c4Model, complexityMatrix]);

  const levelFilteredHotspotMap = useMemo<HotspotMap | null>(() => {
    if (!hotspotMap || !c4Model) return hotspotMap;
    const filtered = new Map<string, ReturnType<HotspotMap['get']> & object>();
    for (const [id, entry] of hotspotMap) {
      if (entry && elementTypeById.get(id) === levelTargetType) filtered.set(id, entry);
    }
    return filtered;
  }, [hotspotMap, c4Model, elementTypeById, levelTargetType]);

  const overlayMap = useMemo(
    () => computeColorMap(metricOverlay, levelFilteredCoverageMatrix, filteredDsmMatrix, levelFilteredComplexityMatrix, levelFilteredImportanceMatrix, levelFilteredDefectRiskMap, levelFilteredHotspotMap),
    [metricOverlay, levelFilteredCoverageMatrix, filteredDsmMatrix, levelFilteredComplexityMatrix, levelFilteredImportanceMatrix, levelFilteredDefectRiskMap, levelFilteredHotspotMap],
  );

  // F-cMap overlay: 選択フィーチャーの P/S/D ロールをノード色として返す
  const fcmapColorMap = useMemo<ReadonlyMap<string, string>>(() => {
    if (metricOverlay !== 'fcmap' || !featureMatrix || !selectedFcmapFeatureId) return new Map();
    const ROLE_COLORS: Record<string, string> = { primary: '#e53935', secondary: '#1e88e5', dependency: '#fb8c00' };
    const map = new Map<string, string>();
    for (const m of featureMatrix.mappings) {
      if (m.featureId === selectedFcmapFeatureId) {
        map.set(m.elementId, ROLE_COLORS[m.role] ?? '#616161');
      }
    }
    return map;
  }, [metricOverlay, featureMatrix, selectedFcmapFeatureId]);

  const effectiveOverlayMap = useMemo(
    () => (metricOverlay === 'fcmap' ? fcmapColorMap : overlayMap),
    [metricOverlay, fcmapColorMap, overlayMap],
  );

  // Community overlay: L3/L4 のみ。トグル ON かつ codeGraph が取得済みのときのみ計算する
  const communityOverlay = useMemo<ReadonlyMap<string, CommunityOverlayEntry> | null>(() => {
    if (!showCommunity || !codeGraph || !c4Model) return null;
    if (currentLevel !== 3 && currentLevel !== 4) return null;
    return computeCommunityOverlay(c4Model, codeGraph, currentLevel as 3 | 4, selectedRepo || null);
  }, [showCommunity, codeGraph, c4Model, currentLevel, selectedRepo]);

  // Community タブ用: showCommunity トグル不要、L2/L3/L4 で常に L3 ベースで計算
  const communityOverlayL3 = useMemo<ReadonlyMap<string, CommunityOverlayEntry> | null>(() => {
    if (!codeGraph || !c4Model) return null;
    if (currentLevel === 1) return null;
    return computeCommunityOverlay(c4Model, codeGraph, 3, selectedRepo || null);
  }, [codeGraph, c4Model, currentLevel, selectedRepo]);

  const communityTree = useMemo(() => {
    if (!communityOverlayL3 || !codeGraph || !c4Model) return undefined;
    const maxDepth = currentLevel === 2 ? 'container' : currentLevel === 3 ? 'component' : 'code';
    return buildCommunityTree({
      c4Model,
      communityOverlay: communityOverlayL3,
      communities: codeGraph.communities,
      communitySummaries: codeGraph.communitySummaries,
      maxDepth,
    });
  }, [communityOverlayL3, codeGraph, c4Model, currentLevel]);

  const selectedCommunityInfo = useMemo(() => {
    if (!selectedElementId?.startsWith('community:')) return null;
    const cid = Number.parseInt(selectedElementId.slice('community:'.length), 10);
    if (Number.isNaN(cid)) return null;
    const node = communityTree?.find(n => n.communityId === cid) ?? null;
    if (!node) return null;
    const summary = codeGraph?.communitySummaries?.[cid];
    const fallbackLabel = codeGraph?.communities[cid];
    return {
      cid,
      displayName: summary?.name ?? fallbackLabel ?? `#${cid}`,
      color: communityColor(cid),
      nodeCount: node.nodeCount ?? 0,
      summaryText: summary?.summary ?? node.description,
      children: node.children,
    };
  }, [selectedElementId, communityTree, codeGraph]);

  const communityMap = useMemo(() => {
    if (!communityOverlay) return null;
    const map = new Map<string, { color: string; isGodNode: boolean }>();
    for (const [elementId, entry] of communityOverlay) {
      map.set(elementId, { color: communityColor(entry.dominantCommunity), isGodNode: entry.isGodNode });
    }
    return map.size > 0 ? map : null;
  }, [communityOverlay]);

  const communityLegend = useMemo<readonly CommunityLegendItem[] | null>(() => {
    if (!communityOverlay || !codeGraph) return null;
    const seen = new Set<number>();
    const items: CommunityLegendItem[] = [];
    for (const entry of communityOverlay.values()) {
      if (seen.has(entry.dominantCommunity)) continue;
      seen.add(entry.dominantCommunity);
      const summary = entry.communitySummary;
      const fallbackName = codeGraph.communities[entry.dominantCommunity];
      items.push({
        community: entry.dominantCommunity,
        color: communityColor(entry.dominantCommunity),
        name: summary?.name ?? fallbackName ?? `#${entry.dominantCommunity}`,
        summary: summary?.summary,
      });
    }
    // 同名ラベル重複時は曖昧性解消のためコミュニティ番号を付与する。
    // GraphClusterer のラベルは pkg_*/component の component 名で多数決するため、
    // 異なるパッケージが同じ component 名（"engine" 等）を持つと衝突しうる。
    const nameCount = new Map<string, number>();
    for (const item of items) nameCount.set(item.name, (nameCount.get(item.name) ?? 0) + 1);
    const disambiguated = items.map((item) =>
      (nameCount.get(item.name) ?? 0) > 1
        ? { ...item, name: `${item.name} #${item.community}` }
        : item,
    );
    disambiguated.sort((a, b) => a.community - b.community);
    return disambiguated.length > 0 ? disambiguated : null;
  }, [communityOverlay, codeGraph]);

  const claudeActivityMap = useMemo(() => {
    // マルチエージェントモード
    if (multiAgentActivity && multiAgentActivity.agents.length > 0) {
      const agentsForLevel = multiAgentActivity.agents.map((agent) => {
        if (!c4Model) return agent;
        return {
          ...agent,
          activeElementIds: agent.activeElementIds.filter((id) => elementTypeById.get(id) === levelTargetType),
          touchedElementIds: agent.touchedElementIds.filter((id) => elementTypeById.get(id) === levelTargetType),
          plannedElementIds: agent.plannedElementIds.filter((id) => elementTypeById.get(id) === levelTargetType),
        };
      });
      const hasAny = agentsForLevel.some((a) =>
        a.activeElementIds.length > 0 || a.touchedElementIds.length > 0 || a.plannedElementIds.length > 0);
      if (!hasAny) return null;
      return computeMultiAgentColorMap(agentsForLevel, isDark);
    }
    // 単一エージェントモード（後方互換）
    if (!claudeActivity) return null;
    const { activeElementIds, touchedElementIds, plannedElementIds } = claudeActivity;
    if (activeElementIds.length === 0 && touchedElementIds.length === 0 && plannedElementIds.length === 0) return null;
    if (c4Model) {
      const filteredActive = activeElementIds.filter((id) => elementTypeById.get(id) === levelTargetType);
      const filteredTouched = touchedElementIds.filter((id) => elementTypeById.get(id) === levelTargetType);
      const filteredPlanned = plannedElementIds.filter((id) => elementTypeById.get(id) === levelTargetType);
      if (filteredActive.length === 0 && filteredTouched.length === 0 && filteredPlanned.length === 0) return null;
      return computeClaudeActivityColorMap(filteredActive, filteredTouched, filteredPlanned, isDark);
    }
    return computeClaudeActivityColorMap(activeElementIds, touchedElementIds, plannedElementIds, isDark);
  }, [multiAgentActivity, claudeActivity, c4Model, elementTypeById, levelTargetType, isDark]);

  const conflictBorderMap = useMemo(() => {
    if (!multiAgentActivity?.conflicts?.length) return null;
    if (!c4Model) return computeConflictBorderMap(multiAgentActivity.conflicts);
    const filtered = multiAgentActivity.conflicts.map((c) => ({
      ...c,
      elementIds: c.elementIds.filter((id) => elementTypeById.get(id) === levelTargetType),
    })).filter((c) => c.elementIds.length > 0);
    if (filtered.length === 0) return null;
    return computeConflictBorderMap(filtered);
  }, [multiAgentActivity, c4Model, elementTypeById, levelTargetType]);

  const claudeActivityMapWithConflicts = useMemo(() => {
    if (!claudeActivityMap && !conflictBorderMap) return null;
    const map = new Map(claudeActivityMap ?? []);
    if (conflictBorderMap) {
      for (const [id, color] of conflictBorderMap) {
        map.set(id, color);
      }
    }
    return map.size > 0 ? map : null;
  }, [claudeActivityMap, conflictBorderMap]);

  const dsmMax = useMemo(() => {
    if ((metricOverlay !== 'dsm-out' && metricOverlay !== 'dsm-in') || !filteredDsmMatrix) return undefined;
    let max = 0;
    for (let i = 0; i < filteredDsmMatrix.nodes.length; i++) {
      const count = metricOverlay === 'dsm-out'
        ? filteredDsmMatrix.adjacency[i].reduce((s: number, v: number) => s + (v > 0 ? 1 : 0), 0)
        : filteredDsmMatrix.adjacency.reduce((s: number, row: readonly number[]) => s + (row[i] > 0 ? 1 : 0), 0);
      if (count > max) max = count;
    }
    return max;
  }, [metricOverlay, filteredDsmMatrix]);

  const excludedDescendantIds = useMemo(() => {
    if (!c4Model || !checkedPackageIds) return null;
    const excluded = new Set<string>();
    for (const elem of c4Model.elements) {
      const isCheckable = FILTER_CHECKABLE_TYPES.has(elem.type as 'container');
      if (isCheckable && !checkedPackageIds.has(elem.id)) {
        const descendants = collectDescendantIds(c4Model.elements, elem.id);
        for (const id of descendants) excluded.add(id);
        excluded.add(elem.id);
      }
    }
    return excluded.size > 0 ? excluded : null;
  }, [c4Model, checkedPackageIds]);

  const selectedScopeIds = useMemo(() => {
    if (!c4Model || !selectedElementId) return null;
    const selectedElement = c4Model.elements.find(e => e.id === selectedElementId);
    const isBoundary = boundaryInfos.some(b => b.id === selectedElementId);
    const isContainer = selectedElement && (selectedElement.type === 'container' || selectedElement.type === 'containerDb');
    const isComponent = selectedElement && selectedElement.type === 'component';
    if (isBoundary || isContainer || isComponent) {
      return collectDescendantIds(c4Model.elements, selectedElementId);
    }
    return null;
  }, [c4Model, boundaryInfos, selectedElementId]);

  const selectedElementInfo = useMemo(() => {
    if (!c4Model || !selectedElementId) return null;
    const element = c4Model.elements.find(e => e.id === selectedElementId);
    if (!element) return null;
    let incoming = 0;
    let outgoing = 0;
    for (const rel of c4Model.relationships) {
      if (rel.to === element.id) incoming++;
      if (rel.from === element.id) outgoing++;
    }
    const documents = (docLinks ?? []).filter(doc => matchesDocScope(doc.c4Scope, element.id));
    const coverage = coverageMatrix?.entries.find(entry => entry.elementId === element.id) ?? null;
    const complexity = complexityMatrix?.entries.find(entry => entry.elementId === element.id) ?? null;
    const importance = importanceMatrix?.[element.id] ?? null;
    const defectRisk = defectRiskMap?.get(element.id) ?? null;
    const community = (() => {
      const direct = communityOverlayL3?.get(element.id) ?? null;
      if (direct) return direct;
      if (element.type !== 'container' || !communityOverlayL3) return null;
      const counts = new Map<number, number>();
      for (const child of c4Model.elements) {
        if (child.boundaryId !== element.id || child.type !== 'component') continue;
        const entry = communityOverlayL3.get(child.id);
        if (!entry) continue;
        for (const { community: cid, count } of entry.breakdown) {
          counts.set(cid, (counts.get(cid) ?? 0) + count);
        }
      }
      if (counts.size === 0) return null;
      const breakdown = Array.from(counts, ([community, count]) => ({ community, count }))
        .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.community - b.community));
      const total = breakdown.reduce((sum, e) => sum + e.count, 0);
      const dominant = breakdown[0];
      return {
        elementId: element.id,
        dominantCommunity: dominant.community,
        dominantRatio: dominant.count / total,
        breakdown,
        isGodNode: false,
        communitySummary: codeGraph?.communitySummaries?.[dominant.community],
      } as CommunityOverlayEntry;
    })();
    const steps = (() => {
      if (!coverageMatrix) return null;
      if (element.type === 'code') return coverage?.lines.total ?? null;
      const descendantIds = collectDescendantIds(c4Model.elements, element.id);
      let total = 0;
      let hasData = false;
      for (const id of descendantIds) {
        const desc = c4Model.elements.find(e => e.id === id);
        if (desc?.type !== 'code') continue;
        const entry = coverageMatrix.entries.find(e => e.elementId === id);
        if (entry) { total += entry.lines.total; hasData = true; }
      }
      return hasData ? total : null;
    })();
    return { element, incoming, outgoing, documents, coverage, complexity, importance, defectRisk, community, steps };
  }, [c4Model, complexityMatrix, coverageMatrix, defectRiskMap, docLinks, importanceMatrix, selectedElementId, communityOverlayL3, codeGraph]);

  const { data: elementFunctions, loading: elementFunctionsLoading } = useElementFunctions({
    serverUrl,
    elementId: selectedElementInfo?.element.type === 'code' ? selectedElementId : null,
    enabled: selectedElementInfo?.element.type === 'code' && !!selectedElementId,
  });

  const toolbarButtonSx = {
    textTransform: 'none', color: colors.accent, borderColor: colors.border,
    fontWeight: 600, fontSize: '0.875rem', borderRadius: '8px',
    transition: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': { bgcolor: colors.hover },
    '&:focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: '2px' },
    '&:disabled': { color: colors.textMuted },
  } as const;

  const toolbarButtonActiveBg = colors.focus;

  const levelButtonSx = {
    textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', minWidth: 36,
    borderColor: colors.border, color: colors.textSecondary,
    transition: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': { bgcolor: colors.hover },
    '&:focus-visible': { outline: `2px solid ${colors.accent}`, outlineOffset: '2px' },
  } as const;

  const levelButtonActiveSx = {
    ...levelButtonSx,
    bgcolor: `${colors.accent} !important`,
    color: isDark ? `${colors.bg} !important` : '#fff !important',
    borderColor: `${colors.accent} !important`,
  } as const;

  // コンテキストメニュー表示時の情報計算
  // boundaryId で親子関係が表現されているため、children ではなく boundaryId で子の有無を判定する
  // 現在のドリルルートへの再ドリルは防ぐ
  const canDrillDown = contextMenu !== null &&
    contextMenu.nodeType !== 'frame' &&
    drillStack.at(-1)?.element.id !== contextMenu.c4Id &&
    (c4Model?.elements.some(e => e.boundaryId === contextMenu.c4Id) ?? false);
  const canDrillUp = contextMenu !== null &&
    contextMenu.nodeType === 'frame' &&
    drillStack.length > 0;
  const canShowOnlyFrame = contextMenu !== null &&
    contextMenu.nodeType === 'frame';
  const canCopyPath = contextMenu !== null &&
    (contextMenu.c4Id.startsWith('pkg_') || contextMenu.c4Id.startsWith('file::'));
  const canOpenFile = contextMenu !== null && contextMenu.c4Id.startsWith('file::');
  const canShowSequence = contextMenu !== null
    && contextMenu.nodeType === 'component'
    && onShowSequence !== undefined;
  const canShowManualActions = canShowManualContextActions(c4Model, contextMenu?.c4Id ?? null);
  const showContextMenu = contextMenu !== null && (
    canDrillDown ||
    canDrillUp ||
    canShowOnlyFrame ||
    canOpenFile ||
    canCopyPath ||
    canShowSequence ||
    canShowManualActions
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: containerHeight, bgcolor: colors.bg }}>
      {isHotspotOverlay && (
        <HotspotControls
          value={hotspotValue}
          onChange={setHotspotValue}
          loading={hotspotLoading}
        />
      )}
      {analysisProgress && (
        <Box
          role="dialog"
          aria-label="Analysis in progress"
          aria-live="polite"
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <Box sx={{
            bgcolor: colors.bgSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: 2,
            px: 4,
            py: 3,
            minWidth: 360,
            maxWidth: 480,
            textAlign: 'center',
          }}>
            <Typography variant="subtitle1" sx={{ color: colors.text, fontWeight: 600, mb: 1 }}>
              Analyzing Workspace
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
              {analysisProgress.phase}
            </Typography>
            <LinearProgress
              variant={analysisProgress.percent >= 0 ? 'determinate' : 'indeterminate'}
              value={analysisProgress.percent >= 0 ? analysisProgress.percent : undefined}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: colors.hover,
                '& .MuiLinearProgress-bar': { bgcolor: colors.accent, borderRadius: 3 },
              }}
            />
            <Typography variant="caption" sx={{ color: colors.textMuted, mt: 1, display: 'block' }}>
              {analysisProgress.percent >= 0 ? `${analysisProgress.percent}%` : ''}
            </Typography>
          </Box>
        </Box>
      )}
      <Box ref={containerRef} sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 要素ツリーパネル（左側固定表示） */}
        {elementTree.length > 0 && (
          <C4ElementTree
            tree={elementTree}
            dispatch={dispatch}
            onSelect={handleElementSelect}
            repoOptions={repoOptions}
            selectedRepo={selectedRepo}
            onRepoChange={handleRepoChange}
            releaseOptions={visibleReleases}
            selectedRelease={selectedRelease}
            onReleaseChange={handleReleaseChange}
            currentLevel={currentLevel}
            selectedSystemId={selectedSystemId}
            onAddElement={(type) => setAddElementType(type)}
            onCheckedChange={setCheckedPackageIds}
            checkReset={checkReset}
            onRemoveElement={onRemoveElement}
            onPurgeDeleted={onPurgeDeleted}
            isDark={isDark}
            communityTree={communityTree}
            onCommunityTabOpen={() => setCodeGraphEnabled(true)}
          />
        )}
        {/* C4 Graph */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 100, position: 'relative' }}>
            <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <GraphCanvas
                isDark={isDark}
                document={state.document}
                viewport={state.document.viewport}
                dispatch={dispatch}
                canvasRef={canvasRef}
                selectedNodeId={selectedElementId ? (state.document.nodes.find(n => n.metadata?.c4Id === selectedElementId)?.id ?? null) : null}
                centerOnSelect={centerOnSelect}
                overlayMap={effectiveOverlayMap.size > 0 ? effectiveOverlayMap : null}
                claudeActivityMap={claudeActivityMapWithConflicts}
                communityMap={communityMap}
                ghostEdges={
                  tcValue.enabled && (currentLevel === 3 || currentLevel === 4)
                    ? ghostEdges.map((e) => ({
                      source: e.source,
                      target: e.target,
                      jaccard: e.jaccard,
                      direction: e.direction,
                      confidenceForward: e.confidenceForward,
                    }))
                    : undefined
                }
                ghostEdgeGranularity={tcGranularity}
                onNodeSelect={(id) => { setCenterOnSelect(false); setSelectedElementId(id); setSelectedElementIds([]); }}
                onMultiNodeSelect={(ids) => {
                  if (ids.length === 1) {
                    setSelectedElementId(ids[0]);
                    setSelectedElementIds([]);
                  } else if (ids.length === 0) {
                    setSelectedElementId(null);
                    setSelectedElementIds([]);
                  } else {
                    setSelectedElementId(null);
                    setSelectedElementIds(ids);
                  }
                }}
                onNodeDoubleClick={(nodeId) => {
                  if (!c4Model) return;
                  const elem = c4Model.elements.find(e => e.id === nodeId);
                  const editableTypes: readonly string[] = ['person', 'system', 'container', 'component'];
                  if (elem?.manual && editableTypes.includes(elem.type)) {
                    setEditElement({ id: elem.id, type: elem.type as C4ElementKind, name: elem.name, description: elem.description ?? '', external: elem.external ?? false });
                  }
                }}
                onNodeContextMenu={handleNodeContextMenu}
              />
              {/* 左側パネル: 全体マップ + C4 ビュー設定コントロール群 */}
              <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* 全体マップ（ミニマップ） */}
                <MinimapCanvas
                  nodes={state.document.nodes}
                  viewport={state.document.viewport}
                  mainCanvasRef={canvasRef}
                  onViewportChange={(vp) => dispatch({ type: 'SET_VIEWPORT', viewport: vp })}
                  isDark={isDark}
                  onFit={handleFit}
                  containerStyle={{ position: 'static', width: 220 }}
                />
                {/* メインコントロールパネル */}
                <Box
                  role="group"
                  aria-label="C4 ビュー設定"
                  sx={{
                    width: 220,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    bgcolor: isDark ? 'rgba(18,18,18,0.92)' : 'rgba(251,249,243,0.94)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                    backdropFilter: 'blur(10px)',
                    px: 1.5,
                    py: 1.25,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  {/* L1/L2/L3/L4 */}
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.65rem', mb: 0.5 }}>
                      C4 Level
                    </Typography>
                    <ButtonGroup size="small" fullWidth>
                      {([1, 2, 3, 4] as const).map(level => (
                        <Button
                          key={level}
                          onClick={() => handleSetLevel(level)}
                          aria-pressed={currentLevel === level}
                          aria-label={`Level ${level}: ${({ 1: 'Context', 2: 'Container', 3: 'Component', 4: 'Code' } as const)[level]}`}
                          title={({ 1: 'Context', 2: 'Container', 3: 'Component', 4: 'Code' } as const)[level]}
                          sx={currentLevel === level ? levelButtonActiveSx : levelButtonSx}
                        >
                          L{level}
                        </Button>
                      ))}
                    </ButtonGroup>
                  </Box>
                  {/* Community */}
                  <Button
                    size="small"
                    startIcon={<GroupWorkIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setShowCommunity(prev => !prev)}
                    disabled={currentLevel < 3 || (showCommunity && !codeGraph)}
                    aria-pressed={showCommunity}
                    aria-label="Toggle community overlay"
                    title={
                      currentLevel < 3
                        ? t('c4.community.disabledLevel')
                        : showCommunity && !codeGraph
                          ? t('c4.community.disabledNoData')
                          : t('c4.community.toggle')
                    }
                    fullWidth
                    sx={{
                      ...toolbarButtonSx,
                      fontSize: '0.75rem',
                      justifyContent: 'flex-start',
                      ...(showCommunity && currentLevel >= 3 && { bgcolor: toolbarButtonActiveBg }),
                    }}
                  >
                    {t('c4.community.toggle')}
                  </Button>
                  {/* Ghost Edges トグル */}
                  <Button
                    size="small"
                    fullWidth
                    startIcon={<TimelineIcon sx={{ fontSize: 16 }} />}
                    onClick={() => {
                      setTcValue(prev => {
                        const nextMode = prev.enabled ? 'none' : prev.granularity === 'session' ? 'session' : 'commit';
                        return applyGhostEdgeMode(prev, nextMode);
                      });
                    }}
                    aria-pressed={tcValue.enabled}
                    sx={{
                      ...toolbarButtonSx,
                      fontSize: '0.75rem',
                      justifyContent: 'flex-start',
                      ...(tcValue.enabled && { bgcolor: toolbarButtonActiveBg }),
                    }}
                  >
                    Ghost Edges
                  </Button>
                  {/* Activity Trend */}
                  <Button
                    size="small"
                    fullWidth
                    startIcon={<TrendingUpIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setShowActivityTrend(prev => !prev)}
                    aria-pressed={showActivityTrend}
                    aria-label="Toggle Activity Trend chart"
                    title="Toggle Activity Trend chart"
                    sx={{
                      ...toolbarButtonSx,
                      fontSize: '0.75rem',
                      justifyContent: 'flex-start',
                      ...(showActivityTrend && { bgcolor: toolbarButtonActiveBg }),
                    }}
                  >
                    Activity Trend
                  </Button>
                  {/* Upper Lines */}
                  <Button
                    size="small"
                    startIcon={<LayersIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setShowAncestorEdges(prev => !prev)}
                    disabled={currentLevel === 1}
                    aria-pressed={showAncestorEdges}
                    aria-label="Toggle upper C4 layer relationships"
                    title="Toggle upper C4 layer relationships"
                    fullWidth
                    sx={{
                      ...toolbarButtonSx,
                      fontSize: '0.75rem',
                      justifyContent: 'flex-start',
                      ...(showAncestorEdges && currentLevel !== 1 && { bgcolor: toolbarButtonActiveBg }),
                    }}
                  >
                    Upper Lines
                  </Button>
                  {/* Clear Edit History */}
                  <Button
                    size="small"
                    fullWidth
                    startIcon={<DeleteSweepIcon sx={{ fontSize: 16 }} />}
                    disabled={
                      !(claudeActivity && (claudeActivity.activeElementIds.length > 0 || claudeActivity.touchedElementIds.length > 0 || claudeActivity.plannedElementIds.length > 0)) &&
                      !(multiAgentActivity && multiAgentActivity.agents.length > 0)
                    }
                    onClick={onResetClaudeActivity}
                    sx={{ ...toolbarButtonSx, fontSize: '0.75rem', justifyContent: 'flex-start' }}
                  >
                    {t('c4.claudeActivity.reset')}
                  </Button>
                  {/* Overlay ドロップダウン */}
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.65rem', mb: 0.5 }}>
                      {t('c4.overlay.label')}
                    </Typography>
                    <Select
                      size="small"
                      fullWidth
                      value={overlayCategory}
                      onChange={(e) => { handleOverlayCategoryChange(e.target.value as OverlayCategory); }}
                      sx={{ fontSize: '0.75rem', height: 28, '.MuiSelect-select': { py: 0, px: 1 } }}
                      aria-label={t('c4.overlay.label')}
                    >
                      <MenuItem value="none" sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.none')}</MenuItem>
                      <MenuItem value="coverage" sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.groupCoverage')}</MenuItem>
                      <MenuItem value="dsm" sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.groupDsm')}</MenuItem>
                      <MenuItem value="complexity" sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.groupComplexity')}</MenuItem>
                      <MenuItem value="importance" sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.groupImportance')}</MenuItem>
                      <MenuItem value="hotspot" sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.groupHotspot')}</MenuItem>
                      {featureMatrix && <MenuItem value="fcmap" sx={{ fontSize: '0.75rem' }}>F-cMap</MenuItem>}
                    </Select>
                  </Box>
                  {overlayCategory !== 'none' && (
                    <Box>
                      <Select
                        size="small"
                        fullWidth
                        disabled={!isCategoryDataAvailable}
                        value={!isCategoryDataAvailable ? '' : overlayCategory === 'fcmap'
                          ? (selectedFcmapFeatureId ?? featureMatrix?.features[0]?.id ?? '')
                          : metricOverlay
                        }
                        onChange={(e) => {
                          if (overlayCategory === 'fcmap') {
                            setSelectedFcmapFeatureId(e.target.value);
                          } else {
                            setMetricOverlay(e.target.value as MetricOverlay);
                          }
                        }}
                        sx={{ fontSize: '0.75rem', height: 28, '.MuiSelect-select': { py: 0, px: 1 } }}
                        aria-label="overlay-sub"
                      >
                        {!isCategoryDataAvailable && (
                          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>-</MenuItem>
                        )}
                        {overlayCategory === 'coverage' && isCategoryDataAvailable && [
                          <MenuItem key="lines" value="coverage-lines" disabled={!coverageMatrix} sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.coverageLines')}</MenuItem>,
                          <MenuItem key="branches" value="coverage-branches" disabled={!coverageMatrix} sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.coverageBranches')}</MenuItem>,
                          <MenuItem key="functions" value="coverage-functions" disabled={!coverageMatrix} sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.coverageFunctions')}</MenuItem>,
                        ]}
                        {overlayCategory === 'dsm' && isCategoryDataAvailable && [
                          <MenuItem key="out" value="dsm-out" disabled={!filteredDsmMatrix} sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.dsmOut')}</MenuItem>,
                          <MenuItem key="in" value="dsm-in" disabled={!filteredDsmMatrix} sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.dsmIn')}</MenuItem>,
                          <MenuItem key="cyclic" value="dsm-cyclic" disabled={!filteredDsmMatrix} sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.dsmCyclic')}</MenuItem>,
                        ]}
                        {overlayCategory === 'complexity' && isCategoryDataAvailable && [
                          <MenuItem key="most" value="complexity-most" disabled={!complexityMatrix} sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.complexityMost')}</MenuItem>,
                          <MenuItem key="highest" value="complexity-highest" disabled={!complexityMatrix} sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.complexityHighest')}</MenuItem>,
                        ]}
                        {overlayCategory === 'importance' && [
                          <MenuItem key="importance" value="importance" disabled={!importanceMatrix} sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.importance')}</MenuItem>,
                          <MenuItem key="defect-risk" value="defect-risk" sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.defectRisk')}</MenuItem>,
                        ]}
                        {overlayCategory === 'hotspot' && [
                          <MenuItem key="frequency" value="hotspot-frequency" sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.hotspotFrequency')}</MenuItem>,
                          <MenuItem key="risk" value="hotspot-risk" disabled={!complexityMatrix} sx={{ fontSize: '0.75rem' }}>{t('c4.overlay.hotspotRisk')}</MenuItem>,
                        ]}
                        {overlayCategory === 'fcmap' && featureMatrix?.features.map((f) => (
                          <MenuItem key={f.id} value={f.id} sx={{ fontSize: '0.75rem' }}>{f.name}</MenuItem>
                        ))}
                      </Select>
                    </Box>
                  )}
                  <OverlayLegend
                    overlay={metricOverlay}
                    isDark={isDark}
                    dsmMax={dsmMax}
                    inline
                  />
                  <Box sx={{ borderTop: `1px solid ${colors.border}`, mx: -1.5 }} />
                  {soloFrameId !== null && (
                    <Button size="small" fullWidth startIcon={<FilterAltOffIcon sx={{ fontSize: 14 }} />} onClick={handleClearFrameFilter} sx={{ ...toolbarButtonSx, fontSize: '0.75rem', justifyContent: 'flex-start', color: colors.accent }}>
                      {t('c4.frameFilter.reset')}
                    </Button>
                  )}
                  {multiAgentActivity && multiAgentActivity.agents.length > 1 && (
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.65rem' }}>
                      {multiAgentActivity.agents.length} {t('c4.multiAgent.badge')}
                      {multiAgentActivity.conflicts && multiAgentActivity.conflicts.length > 0 && (
                        <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'error.main', fontWeight: 'bold' }}>
                          {multiAgentActivity.conflicts.length} {t('c4.multiAgent.conflicts')}
                        </Typography>
                      )}
                    </Typography>
                  )}
                </Box>
                {/* Ghost Edges 詳細設定（有効時のみ表示） */}
                <TemporalCouplingSettingsPopup
                  value={tcValue}
                  onChange={setTcValue}
                  resultCount={ghostEdges.length}
                  loading={tcLoading}
                  isDark={isDark}
                  sx={{ position: 'static' }}
                />
              </Box>
              {selectedElementIds.length > 1 && c4Model && (
                <Box
                  role="dialog"
                  aria-label="Multiple C4 elements selected"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: SELECTED_ELEMENT_DETAILS_WIDTH,
                    maxHeight: 'calc(100% - 20px)',
                    overflow: 'auto',
                    zIndex: 10,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    bgcolor: isDark ? 'rgba(18,18,18,0.92)' : 'rgba(251,249,243,0.94)',
                    color: colors.text,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                    backdropFilter: 'blur(10px)',
                    px: 1.5,
                    py: 1.25,
                  }}
                >
                  <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.65rem', textTransform: 'uppercase', mb: 0.75 }}>
                    {selectedElementIds.length} elements selected
                  </Typography>
                  {selectedElementIds.map(id => {
                    const elem = c4Model.elements.find(e => e.id === id);
                    if (!elem) return null;
                    return (
                      <Box key={id} sx={{ py: 0.5, borderBottom: `1px solid ${colors.border}`, '&:last-child': { borderBottom: 'none' } }}>
                        <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase' }}>
                          {elem.type}
                        </Typography>
                        <Typography variant="body2" sx={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600, wordBreak: 'break-word' }}>
                          {elem.name}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
              {selectedElementInfo && (
                <Box
                  role="dialog"
                  aria-label="Selected C4 element details"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: SELECTED_ELEMENT_DETAILS_WIDTH,
                    maxHeight: 'calc(100% - 20px)',
                    overflow: 'auto',
                    zIndex: 10,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    bgcolor: isDark ? 'rgba(18,18,18,0.92)' : 'rgba(251,249,243,0.94)',
                    color: colors.text,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                    backdropFilter: 'blur(10px)',
                    px: 1.5,
                    py: 1.25,
                  }}
                >
                  <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                    {selectedElementInfo.element.type}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ color: colors.text, fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.3, mt: 0.25, wordBreak: 'break-word' }}>
                    {selectedElementInfo.element.name}
                  </Typography>
                  {selectedElementInfo.element.technology && (
                    <Typography variant="caption" sx={{ display: 'block', color: colors.accent, fontSize: '0.7rem', mt: 0.5, wordBreak: 'break-word' }}>
                      {selectedElementInfo.element.technology}
                    </Typography>
                  )}
                  {selectedElementInfo.element.description && (
                    <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.72rem', lineHeight: 1.45, mt: 1, wordBreak: 'break-word' }}>
                      {selectedElementInfo.element.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1.25 }}>
                    <Box sx={{ borderTop: `1px solid ${colors.border}`, pt: 0.75 }}>
                      <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.62rem' }}>
                        In
                      </Typography>
                      <Typography variant="body2" sx={{ color: colors.text, fontSize: '0.8rem', fontWeight: 700 }}>
                        {selectedElementInfo.incoming}
                      </Typography>
                    </Box>
                    <Box sx={{ borderTop: `1px solid ${colors.border}`, pt: 0.75 }}>
                      <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.62rem' }}>
                        Out
                      </Typography>
                      <Typography variant="body2" sx={{ color: colors.text, fontSize: '0.8rem', fontWeight: 700 }}>
                        {selectedElementInfo.outgoing}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.62rem', mt: 1, wordBreak: 'break-all' }}>
                    {selectedElementInfo.element.id}
                  </Typography>
                  <Box sx={{ borderTop: `1px solid ${colors.border}`, mt: 1.25, pt: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', color: colors.textSecondary, fontSize: '0.68rem', fontWeight: 700, mb: 0.75 }}>
                      {t('c4.popup.metrics')}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                      <Box sx={{ gridColumn: '1 / -1' }}>
                        <Typography variant="caption" sx={{ display: 'block', color: colors.textSecondary, fontSize: '0.62rem', fontWeight: 600, mb: 0.5 }}>
                          {t('c4.popup.coverage')}
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5 }}>
                          {(['coverage', 'branches', 'functions'] as const).map((key, i) => {
                            const pct = selectedElementInfo.coverage
                              ? (i === 0 ? selectedElementInfo.coverage.lines.pct : i === 1 ? selectedElementInfo.coverage.branches.pct : selectedElementInfo.coverage.functions.pct)
                              : null;
                            return (
                              <Box key={key}>
                                <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.58rem' }}>
                                  {t(`c4.popup.metric.${key}`)}
                                </Typography>
                                <Typography variant="body2" sx={{ color: colors.text, fontSize: '0.72rem', fontWeight: 700 }}>
                                  {pct != null ? formatPct(pct) : '-'}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.6rem' }}>
                          {t('c4.popup.metric.complexity')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: colors.text, fontSize: '0.72rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedElementInfo.complexity?.highest ?? '-'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.6rem' }}>
                          {t('c4.popup.metric.importance')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: colors.text, fontSize: '0.72rem', fontWeight: 700 }}>
                          {selectedElementInfo.importance != null ? Math.round(selectedElementInfo.importance) : '-'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.6rem' }}>
                          {t('c4.popup.metric.defectRisk')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: colors.text, fontSize: '0.72rem', fontWeight: 700 }}>
                          {selectedElementInfo.defectRisk != null ? Math.round(selectedElementInfo.defectRisk) : '-'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.6rem' }}>
                          {t('c4.popup.metric.steps')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: colors.text, fontSize: '0.72rem', fontWeight: 700 }}>
                          {selectedElementInfo.steps ?? '-'}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  {selectedElementInfo.community && (() => {
                    const community = selectedElementInfo.community;
                    const summary = community.communitySummary;
                    const fallbackName = codeGraph?.communities[community.dominantCommunity];
                    const displayName = summary?.name ?? fallbackName ?? `#${community.dominantCommunity}`;
                    const dominantColor = communityColor(community.dominantCommunity);
                    const showBreakdown = community.breakdown.length > 1;
                    const topThree = community.breakdown.slice(0, 3);
                    const otherCount = community.breakdown.slice(3).reduce((sum, e) => sum + e.count, 0);
                    const totalCount = community.breakdown.reduce((sum, e) => sum + e.count, 0);
                    return (
                      <Box sx={{ borderTop: `1px solid ${colors.border}`, mt: 1.25, pt: 1 }}>
                        <Typography variant="caption" sx={{ display: 'block', color: colors.textSecondary, fontSize: '0.68rem', fontWeight: 700, mb: 0.5 }}>
                          {t('c4.community.title')}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: dominantColor, flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ color: colors.text, fontSize: '0.74rem', fontWeight: 600, wordBreak: 'break-word' }}>
                            {displayName}
                          </Typography>
                        </Box>
                        {summary?.summary && (
                          <Typography variant="caption" sx={{ display: 'block', color: colors.textSecondary, fontSize: '0.66rem', mt: 0.5, lineHeight: 1.4 }}>
                            {summary.summary}
                          </Typography>
                        )}
                        {community.isGodNode && (
                          <Typography variant="caption" sx={{ display: 'inline-block', mt: 0.5, px: 0.5, py: 0.125, borderRadius: '4px', bgcolor: colors.accent, color: isDark ? colors.bg : '#fff', fontSize: '0.6rem', fontWeight: 700 }}>
                            ★ {t('c4.community.hubNode')}
                          </Typography>
                        )}
                        {showBreakdown && (
                          <Box sx={{ mt: 0.75 }}>
                            <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.6rem', mb: 0.25 }}>
                              {t('c4.community.breakdown')}
                            </Typography>
                            {topThree.map(entry => {
                              const entrySummary = codeGraph?.communitySummaries?.[entry.community];
                              const entryFallback = codeGraph?.communities[entry.community];
                              const entryName = entrySummary?.name ?? entryFallback ?? `#${entry.community}`;
                              const tooltipLabel = (
                                <Box>
                                  <Box sx={{ fontWeight: 700, fontSize: '0.72rem' }}>
                                    {entryName} <Box component="span" sx={{ opacity: 0.7, fontWeight: 400 }}>#{entry.community}</Box>
                                  </Box>
                                  {entrySummary?.summary && (
                                    <Box sx={{ fontSize: '0.66rem', mt: 0.25, opacity: 0.85, maxWidth: 240 }}>
                                      {entrySummary.summary}
                                    </Box>
                                  )}
                                  <Box sx={{ fontSize: '0.66rem', mt: 0.25, opacity: 0.85 }}>
                                    {entry.count} / {totalCount} ({Math.round((entry.count / totalCount) * 100)}%)
                                  </Box>
                                </Box>
                              );
                              return (
                                <Tooltip key={entry.community} title={tooltipLabel} arrow placement="left">
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25, cursor: 'help' }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: communityColor(entry.community), flexShrink: 0 }} />
                                    <Box sx={{ flex: 1, height: 4, bgcolor: colors.hover, borderRadius: '2px', overflow: 'hidden' }}>
                                      <Box sx={{ width: `${(entry.count / totalCount) * 100}%`, height: '100%', bgcolor: communityColor(entry.community) }} />
                                    </Box>
                                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.6rem', minWidth: 32, textAlign: 'right' }}>
                                      {Math.round((entry.count / totalCount) * 100)}%
                                    </Typography>
                                  </Box>
                                </Tooltip>
                              );
                            })}
                            {otherCount > 0 && (() => {
                              const otherEntries = community.breakdown.slice(3);
                              const otherTooltip = (
                                <Box sx={{ maxWidth: 260 }}>
                                  <Box sx={{ fontWeight: 700, fontSize: '0.72rem', mb: 0.25 }}>
                                    {t('c4.community.other')} ({otherEntries.length})
                                  </Box>
                                  {otherEntries.map(e => {
                                    const s = codeGraph?.communitySummaries?.[e.community];
                                    const f = codeGraph?.communities[e.community];
                                    const n = s?.name ?? f ?? `#${e.community}`;
                                    return (
                                      <Box key={e.community} sx={{ fontSize: '0.66rem', opacity: 0.85 }}>
                                        ● {n} #{e.community} — {e.count} ({Math.round((e.count / totalCount) * 100)}%)
                                      </Box>
                                    );
                                  })}
                                </Box>
                              );
                              return (
                                <Tooltip title={otherTooltip} arrow placement="left">
                                  <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.58rem', cursor: 'help' }}>
                                    {t('c4.community.other')}: {Math.round((otherCount / totalCount) * 100)}%
                                  </Typography>
                                </Tooltip>
                              );
                            })()}
                          </Box>
                        )}
                      </Box>
                    );
                  })()}
                  {selectedElementInfo.element.type === 'code' && (
                    <Box sx={{ borderTop: `1px solid ${colors.border}`, mt: 1.25, pt: 1 }}>
                      <Typography variant="caption" sx={{ display: 'block', color: colors.textSecondary, fontSize: '0.68rem', fontWeight: 700, mb: 0.5 }}>
                        {t('c4.popup.functions')}
                      </Typography>
                      {elementFunctionsLoading ? (
                        <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.65rem' }}>
                          ...
                        </Typography>
                      ) : !elementFunctions || elementFunctions.symbols.length === 0 ? (
                        <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.65rem' }}>
                          {t('c4.popup.functions.empty')}
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          {elementFunctions.symbols.map(sym => (
                            <Box key={sym.id} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                              <Typography
                                component="span"
                                sx={{
                                  fontSize: '0.58rem',
                                  fontWeight: 700,
                                  color: isDark ? '#7ec8e3' : '#0070c0',
                                  flexShrink: 0,
                                  textTransform: 'uppercase',
                                }}
                              >
                                {sym.kind.slice(0, 2)}
                              </Typography>
                              <Typography
                                component="span"
                                sx={{
                                  fontSize: '0.68rem',
                                  color: colors.text,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                }}
                              >
                                {sym.name}
                              </Typography>
                              <Typography
                                component="span"
                                sx={{ fontSize: '0.58rem', color: colors.textMuted, flexShrink: 0 }}
                              >
                                :{sym.line + 1}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                  <Box sx={{ borderTop: `1px solid ${colors.border}`, mt: 1.25, pt: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', color: colors.textSecondary, fontSize: '0.68rem', fontWeight: 700, mb: 0.5 }}>
                      Documents
                    </Typography>
                    {selectedElementInfo.documents.length === 0 ? (
                      <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.68rem' }}>
                        No linked documents
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {selectedElementInfo.documents.map(doc => (
                          <Button
                            key={doc.path}
                            size="small"
                            onClick={() => onDocLinkClick?.(doc)}
                            sx={{
                              justifyContent: 'flex-start',
                              minHeight: 26,
                              px: 0.5,
                              py: 0.25,
                              color: colors.text,
                              textTransform: 'none',
                              '&:hover': { bgcolor: colors.hover },
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                height: 16,
                                px: 0.5,
                                mr: 0.75,
                                borderRadius: '4px',
                                bgcolor: DOC_TYPE_COLORS[doc.type] ?? '#757575',
                                color: '#000',
                                fontSize: '0.58rem',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {doc.type}
                            </Box>
                            <Typography component="span" sx={{ fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.title}
                            </Typography>
                          </Button>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
              {selectedCommunityInfo && !selectedElementInfo && (
                <Box
                  role="dialog"
                  aria-label="Selected community details"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: SELECTED_ELEMENT_DETAILS_WIDTH,
                    maxHeight: 'calc(100% - 20px)',
                    overflow: 'auto',
                    zIndex: 10,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    bgcolor: isDark ? 'rgba(18,18,18,0.92)' : 'rgba(251,249,243,0.94)',
                    color: colors.text,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                    backdropFilter: 'blur(10px)',
                    px: 1.5,
                    py: 1.25,
                  }}
                >
                  <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                    {t('c4.community.title')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: selectedCommunityInfo.color, flexShrink: 0 }} />
                    <Typography variant="subtitle2" sx={{ color: colors.text, fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.3, wordBreak: 'break-word' }}>
                      {selectedCommunityInfo.displayName}
                    </Typography>
                  </Box>
                  {selectedCommunityInfo.summaryText && (
                    <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.72rem', lineHeight: 1.45, mt: 1, wordBreak: 'break-word' }}>
                      {selectedCommunityInfo.summaryText}
                    </Typography>
                  )}
                  <Box sx={{ borderTop: `1px solid ${colors.border}`, mt: 1.25, pt: 0.75 }}>
                    <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.62rem' }}>
                      {t('c4.community.nodeCount')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: colors.text, fontSize: '0.8rem', fontWeight: 700 }}>
                      {selectedCommunityInfo.nodeCount}
                    </Typography>
                  </Box>
                  {selectedCommunityInfo.children.length > 0 && (
                    <Box sx={{ borderTop: `1px solid ${colors.border}`, mt: 1.25, pt: 0.75 }}>
                      <Typography variant="caption" sx={{ display: 'block', color: colors.textSecondary, fontSize: '0.68rem', fontWeight: 700, mb: 0.5 }}>
                        {t('c4.community.containers')}
                      </Typography>
                      {selectedCommunityInfo.children.slice(0, 8).map(child => (
                        <Typography key={child.id} variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.65rem', py: 0.125, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          • {child.name}
                        </Typography>
                      ))}
                      {selectedCommunityInfo.children.length > 8 && (
                        <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.62rem', mt: 0.25 }}>
                          + {selectedCommunityInfo.children.length - 8}
                        </Typography>
                      )}
                    </Box>
                  )}
                  <Typography variant="caption" sx={{ display: 'block', color: colors.textMuted, fontSize: '0.62rem', mt: 1 }}>
                    #{selectedCommunityInfo.cid}
                  </Typography>
                </Box>
              )}
              {showContextMenu && contextMenu && (
                <>
                  {/* オーバーレイ: メニュー外クリックで閉じる */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
                    onMouseDown={handleCloseContextMenu}
                  />
                  {/* コンテキストメニュー本体 */}
                  <div
                    style={{
                      position: 'fixed',
                      top: contextMenu.y,
                      left: contextMenu.x,
                      zIndex: 1001,
                      background: isDark ? '#2d2d2d' : '#ffffff',
                      border: `1px solid ${isDark ? '#555' : '#ccc'}`,
                      borderRadius: 4,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      minWidth: 140,
                      padding: '4px 0',
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {canDrillDown && (
                      <button
                        type="button"
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '6px 16px',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 14,
                          color: isDark ? '#e0e0e0' : '#333',
                        }}
                        onClick={() => handleDrillDown(contextMenu.c4Id)}
                      >
                        {t('c4.drillDown')}
                      </button>
                    )}
                    {canDrillUp && (
                      <button
                        type="button"
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '6px 16px',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 14,
                          color: isDark ? '#e0e0e0' : '#333',
                        }}
                        onClick={handleDrillUp}
                      >
                        {t('c4.drillUp')}
                      </button>
                    )}
                    {canShowOnlyFrame && (
                      <button
                        type="button"
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '6px 16px',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 14,
                          color: isDark ? '#e0e0e0' : '#333',
                        }}
                        onClick={() =>
                          soloFrameId === contextMenu.c4Id
                            ? handleClearFrameFilter()
                            : handleShowOnlyFrame(contextMenu.c4Id)
                        }
                      >
                        {soloFrameId === contextMenu.c4Id
                          ? t('c4.clearFrameFilter')
                          : t('c4.showOnlyThisFrame')}
                      </button>
                    )}
                    {canOpenFile && (
                      <button
                        type="button"
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '6px 16px',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 14,
                          color: isDark ? '#e0e0e0' : '#333',
                        }}
                        onClick={handleOpenFile}
                      >
                        {t('c4.openFile')}
                      </button>
                    )}
                    {canShowSequence && (
                      <button
                        type="button"
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '6px 16px',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 14,
                          color: isDark ? '#e0e0e0' : '#333',
                        }}
                        onClick={() => {
                          onShowSequence?.(contextMenu.c4Id);
                          setContextMenu(null);
                        }}
                      >
                        {t('c4.showSequence')}
                      </button>
                    )}
                    {canCopyPath && (
                      <button
                        type="button"
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '6px 16px',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 14,
                          color: isDark ? '#e0e0e0' : '#333',
                        }}
                        onClick={handleCopyPath}
                      >
                        {t('c4.copyPath')}
                      </button>
                    )}
                    {canShowManualActions && (
                      <>
                        <button
                          type="button"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '6px 16px',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 14,
                            color: isDark ? '#e0e0e0' : '#333',
                          }}
                          onClick={() => {
                            setSelectedElementId(contextMenu.c4Id);
                            setAddRelOpen(true);
                            setContextMenu(null);
                          }}
                        >
                          <LinkIcon sx={{ fontSize: 16 }} />
                          Rel
                        </button>
                        <button
                          type="button"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '6px 16px',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 14,
                            color: '#ef5350',
                          }}
                          onClick={() => handleDeleteElement(contextMenu.c4Id)}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                          Del
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </Box>
            {showActivityTrend && (
            <Box
              role="dialog"
              aria-label="Activity Trend"
              sx={{
                ...getActivityTrendChartPlacement(),
                width: getActivityTrendChartWidth(!!selectedElementInfo),
                minWidth: 0,
                maxWidth: `${TREND_CHART_POPUP_MAX_WIDTH}px`,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                bgcolor: isDark ? 'rgba(18,18,18,0.92)' : 'rgba(251,249,243,0.94)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                backdropFilter: 'blur(10px)',
                overflow: 'hidden',
                transition: 'width 150ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <ActivityTrendChart
                elementId={selectedElementId}
                serverUrl={serverUrl}
                repoName={selectedRepo || undefined}
                isDark={isDark}
              />
            </Box>
            )}
          </Box>
      </Box>
      <AddElementDialog
        open={addElementType !== null && !editElement}
        elementType={addElementType ?? 'person'}
        initial={addElementType === 'container' && selectedSystemId ? { parentId: selectedSystemId } : undefined}
        onSubmit={handleAddElement}
        onClose={() => setAddElementType(null)}
        parentCandidates={
          addElementType === 'component'
            ? (c4Model?.elements.filter(e => e.type === 'container').map(e => ({ id: e.id, name: e.name })) ?? [])
            : undefined
        }
      />
      <AddElementDialog
        open={editElement !== null}
        elementType={editElement?.type ?? 'person'}
        initial={editElement ?? undefined}
        onSubmit={handleUpdateElement}
        onClose={() => setEditElement(null)}
        parentCandidates={
          editElement?.type === 'container'
            ? (c4Model?.elements.filter(e => e.type === 'system').map(e => ({ id: e.id, name: e.name })) ?? [])
            : editElement?.type === 'component'
            ? (c4Model?.elements.filter(e => e.type === 'container').map(e => ({ id: e.id, name: e.name })) ?? [])
            : undefined
        }
      />
      {selectedElementId && (
        <AddRelationshipDialog
          open={addRelOpen}
          from={selectedElementId}
          fromName={c4Model?.elements.find(e => e.id === selectedElementId)?.name ?? selectedElementId}
          candidates={c4Model?.elements.filter(e => e.id !== selectedElementId && (e.type === 'person' || e.type === 'system' || e.type === 'container')).map(e => ({ id: e.id, name: e.name })) ?? []}
          onSubmit={handleAddRelationship}
          onClose={() => setAddRelOpen(false)}
        />
      )}
    </Box>
  );
}
