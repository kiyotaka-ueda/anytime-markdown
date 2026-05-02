import { useEffect, useRef, useState } from 'react';
import Sigma from 'sigma';
import { EdgeArrowProgram } from 'sigma/rendering';
import Graph from 'graphology';
import type { CodeGraph } from '@anytime-markdown/trail-core/codeGraph';
import type { CouplingDirection } from '@anytime-markdown/trail-core';
import { COMMUNITY_COLORS } from './communityColors';

export { COMMUNITY_COLORS };

const GHOST_EDGE_COMMIT_LIGHT = '#7c3aed';
const GHOST_EDGE_COMMIT_DARK = '#c4b5fd';
const GHOST_EDGE_SESSION_LIGHT = '#0891b2';
const GHOST_EDGE_SESSION_DARK = '#67e8f9';
// subagent_type 粒度。commit 紫・session シアンと区別するためエメラルド系を採用。
// ライトモード #047857 vs 白背景 = 5.5:1, ダークモード #6ee7b7 vs #1e1e1e ≒ 8.5:1（共に WCAG AA 4.5:1 達成）。
const GHOST_EDGE_SUBAGENT_LIGHT = '#047857';
const GHOST_EDGE_SUBAGENT_DARK = '#6ee7b7';

export type CodeGraphGhostEdgeGranularity = 'commit' | 'session' | 'subagentType';

export interface CodeGraphGhostEdge {
  readonly source: string;
  readonly target: string;
  readonly jaccard: number;
  readonly coChangeCount: number;
  readonly direction?: CouplingDirection;
  readonly confidenceForward?: number;
  readonly confidenceBackward?: number;
}

function riskColor(score: number, dark: boolean): string {
  if (score >= 0.7) return dark ? '#ef5350' : '#c62828';
  if (score >= 0.35) return dark ? '#ffa726' : '#f9a825';
  return dark ? '#66bb6a' : '#2e7d32';
}

interface CodeGraphCanvasProps {
  readonly graph: CodeGraph;
  readonly highlightedNodes?: ReadonlySet<string>;
  readonly onNodeClick?: (nodeId: string) => void;
  readonly isDark?: boolean;
  readonly ghostEdges?: ReadonlyArray<CodeGraphGhostEdge>;
  readonly ghostEdgeGranularity?: CodeGraphGhostEdgeGranularity;
  readonly riskMap?: ReadonlyMap<string, number> | null;
}

export function CodeGraphCanvas({
  graph,
  highlightedNodes,
  onNodeClick,
  isDark,
  ghostEdges,
  ghostEdgeGranularity = 'commit',
  riskMap,
}: Readonly<CodeGraphCanvasProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const [containerReady, setContainerReady] = useState(false);

  // タブが display:none の間はコンテナの幅が 0 になり sigma 初期化が失敗する。
  // ResizeObserver で可視サイズを検知してから初期化する。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const update = () => {
      const ready = el.clientWidth > 0 && el.clientHeight > 0;
      setContainerReady((prev) => (prev === ready ? prev : ready));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!containerReady || !containerRef.current) return undefined;

    const g = new Graph();
    let invalidCoordCount = 0;
    for (const node of graph.nodes) {
      // x/y が欠けているグラフ（レイアウト未実行の中間形式）でも壊さないよう、
      // 円周上に等間隔配置するフォールバックを用意する。
      const hasValidXY =
        typeof node.x === 'number' && Number.isFinite(node.x) &&
        typeof node.y === 'number' && Number.isFinite(node.y);
      if (!hasValidXY) invalidCoordCount++;
      const fallbackAngle = (g.order / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
      const x = hasValidXY ? node.x : Math.cos(fallbackAngle);
      const y = hasValidXY ? node.y : Math.sin(fallbackAngle);
      const community = Number.isFinite(node.community) ? node.community : 0;
      g.addNode(node.id, {
        label: node.label,
        x,
        y,
        size: Math.max(3, Math.min((node.size ?? 0) + 4, 20)),
        color: COMMUNITY_COLORS[community % COMMUNITY_COLORS.length],
        community,
      });
    }
    if (invalidCoordCount > 0) {
      console.warn(
        `[CodeGraphCanvas] ${invalidCoordCount} / ${graph.nodes.length} nodes had invalid x/y; ` +
          `placed on a fallback circle. Run "Anytime Trail: Generate Code Graph" to fix.`,
      );
    }
    for (const edge of graph.edges) {
      if (g.hasNode(edge.source) && g.hasNode(edge.target) && !g.hasEdge(edge.source, edge.target)) {
        g.addEdge(edge.source, edge.target, { color: isDark ? '#444' : '#ccc' });
      }
    }

    const isSubagent = ghostEdgeGranularity === 'subagentType';
    const isSession = ghostEdgeGranularity === 'session';
    const ghostColor = isSubagent
      ? (isDark ? GHOST_EDGE_SUBAGENT_DARK : GHOST_EDGE_SUBAGENT_LIGHT)
      : isSession
        ? (isDark ? GHOST_EDGE_SESSION_DARK : GHOST_EDGE_SESSION_LIGHT)
        : (isDark ? GHOST_EDGE_COMMIT_DARK : GHOST_EDGE_COMMIT_LIGHT);
    const jaccardLabelPrefix = isSubagent ? 'Subagent J' : isSession ? 'Session J' : 'Temporal J';
    const confLabelPrefix = isSubagent ? 'Subagent' : isSession ? 'Session' : 'Conf';
    let ghostRendered = 0;
    for (const ge of ghostEdges ?? []) {
      if (
        !g.hasNode(ge.source) ||
        !g.hasNode(ge.target) ||
        g.hasEdge(ge.source, ge.target) ||
        g.hasEdge(ge.target, ge.source)
      ) continue;

      const conf = ge.confidenceForward;
      const sizeBase = conf ?? ge.jaccard;
      const baseAttrs = {
        color: ghostColor,
        size: 1 + sizeBase * 3,
        forceLabel: true,
        temporal: true,
      };
      if (ge.direction === 'A→B' && conf !== undefined) {
        g.addDirectedEdge(ge.source, ge.target, {
          ...baseAttrs,
          type: 'arrow',
          label: `${confLabelPrefix} ${conf.toFixed(2)} →`,
        });
      } else if (ge.direction === 'undirected' && conf !== undefined) {
        g.addEdge(ge.source, ge.target, {
          ...baseAttrs,
          label: `${confLabelPrefix} ${conf.toFixed(2)} ↔`,
        });
      } else {
        g.addEdge(ge.source, ge.target, {
          ...baseAttrs,
          size: 1 + ge.jaccard * 3,
          label: `${jaccardLabelPrefix}=${ge.jaccard.toFixed(2)}`,
        });
      }
      ghostRendered++;
    }

    if (riskMap) {
      g.forEachNode((nodeId) => {
        const score = riskMap.get(nodeId);
        if (score !== undefined) {
          g.setNodeAttribute(nodeId, 'color', riskColor(score, isDark ?? false));
        }
      });
    }

    const sigma = new Sigma(g, containerRef.current, {
      renderEdgeLabels: ghostRendered > 0,
      defaultEdgeColor: isDark ? '#444' : '#ccc',
      allowInvalidContainer: true,
      edgeProgramClasses: {
        arrow: EdgeArrowProgram,
      },
    });

    if (onNodeClick) {
      sigma.on('clickNode', ({ node }) => onNodeClick(node));
    }

    sigmaRef.current = sigma;
    return () => {
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [containerReady, graph, isDark, onNodeClick, ghostEdges, ghostEdgeGranularity, riskMap]);

  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;
    const g = sigma.getGraph();
    g.forEachNode((node) => {
      const community = (g.getNodeAttribute(node, 'community') as number | undefined) ?? 0;
      const fullColor = COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
      const dimmed = isDark ? '#333' : '#eee';
      const highlighted =
        !highlightedNodes || highlightedNodes.size === 0 || highlightedNodes.has(node);
      g.setNodeAttribute(node, 'color', highlighted ? fullColor : dimmed);
    });
    sigma.refresh();
  }, [highlightedNodes, isDark]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
