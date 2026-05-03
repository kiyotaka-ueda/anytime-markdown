import { useCallback, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { CodeGraph, CodeGraphNode } from '@anytime-markdown/trail-core/codeGraph';
import { CodeGraphCanvas, type CodeGraphGhostEdge } from './CodeGraphCanvas';
import { useCodeGraph } from '../hooks/useCodeGraph';
import { useTemporalCoupling } from '../c4/hooks/useTemporalCoupling';
import {
  TemporalCouplingControls,
  type TemporalCouplingControlsValue,
} from '../c4/components/TemporalCouplingControls';

function toCodeGraphNodeId(repoId: string, filePath: string): string {
  const cleaned = filePath.replace(/\.(tsx?|mdx?)$/, '');
  return `${repoId}:${cleaned}`;
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

interface CodeGraphPanelProps {
  readonly serverUrl: string;
  readonly isDark?: boolean;
}

export function CodeGraphPanel({ serverUrl, isDark }: Readonly<CodeGraphPanelProps>) {
  const { graph, loading, error, refetch } = useCodeGraph(serverUrl);
  const [query, setQuery] = useState('');
  const [highlightedNodes, setHighlightedNodes] = useState<ReadonlySet<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<CodeGraphNode | null>(null);
  const [repoFilter, setRepoFilter] = useState<string>('all');
  const [tcValue, setTcValue] = useState<TemporalCouplingControlsValue>(DEFAULT_TC_VALUE);

  const tcRepoId = useMemo<string | null>(() => {
    if (!graph || graph.repositories.length === 0) return null;
    if (repoFilter !== 'all') return repoFilter;
    return graph.repositories[0]?.id ?? null;
  }, [graph, repoFilter]);

  const {
    edges: rawGhostEdges,
    directional: tcDirectional,
    granularity: tcGranularity,
    loading: tcLoading,
  } = useTemporalCoupling({
    enabled: tcValue.enabled && !!tcRepoId,
    serverUrl,
    repoName: tcRepoId ?? '',
    windowDays: tcValue.windowDays,
    threshold: tcValue.threshold,
    topK: tcValue.topK,
    directional: tcValue.directional,
    confidenceThreshold: tcValue.confidenceThreshold,
    directionalDiff: tcValue.directionalDiff,
    granularity: tcValue.granularity,
  });

  // subagent × directional でデータが対称的（A→B エッジが 1 件も無い）場合、
  // 矢印が出ない原因をエンドユーザーに伝えるためのヒントを表示する。
  // 発生条件: subagent_type が 1 種類しかないとき、または各 type が触るファイル集合が
  // 完全に同じ・完全に独立している場合（数学的に diff=0 で必ず undirected になる）。
  const showSubagentDirectionalHint = useMemo<boolean>(() => {
    if (!tcValue.enabled) return false;
    if (tcGranularity !== 'subagentType') return false;
    if (!tcDirectional) return false;
    if (rawGhostEdges.length === 0) return false;
    return rawGhostEdges.every(
      (e) => !('direction' in e) || e.direction !== 'A→B',
    );
  }, [tcValue.enabled, tcGranularity, tcDirectional, rawGhostEdges]);

  const ghostEdges = useMemo<CodeGraphGhostEdge[]>(() => {
    if (!tcRepoId) return [];
    return rawGhostEdges.map((e) => {
      const base: CodeGraphGhostEdge = {
        source: toCodeGraphNodeId(tcRepoId, e.source),
        target: toCodeGraphNodeId(tcRepoId, e.target),
        jaccard: e.jaccard,
        coChangeCount: e.coChangeCount,
      };
      if ('direction' in e) {
        return {
          ...base,
          direction: e.direction,
          confidenceForward: e.confidenceForward,
          confidenceBackward: e.confidenceBackward,
        };
      }
      return base;
    });
  }, [rawGhostEdges, tcRepoId]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setHighlightedNodes(new Set());
      return;
    }
    try {
      const res = await fetch(`${serverUrl}/api/code-graph/query?q=${encodeURIComponent(query)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { nodes: string[] };
      setHighlightedNodes(new Set(data.nodes));
    } catch (err) {
      console.error('[CodeGraphPanel] search failed', err);
    }
  }, [serverUrl, query]);

  const handleNodeClick = useCallback(
    async (nodeId: string) => {
      try {
        const res = await fetch(`${serverUrl}/api/code-graph/explain?id=${encodeURIComponent(nodeId)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { node?: CodeGraphNode };
        setSelectedNode(data.node ?? null);
      } catch (err) {
        console.error('[CodeGraphPanel] explain failed', err);
      }
    },
    [serverUrl],
  );

  const handleGenerate = useCallback(() => {
    refetch();
  }, [refetch]);

  const communitySummary = selectedNode
    ? graph?.communitySummaries?.[selectedNode.community]
    : undefined;

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={20} />
        <Typography>グラフを読み込み中...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error}</Typography>
        <Button onClick={refetch}>再試行</Button>
      </Box>
    );
  }

  if (!graph) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography sx={{ mb: 2 }}>グラフがまだ生成されていません。</Typography>
        <Button variant="contained" onClick={handleGenerate}>
          Reload
        </Button>
      </Box>
    );
  }

  const repos = [{ id: 'all', label: 'All', path: '' }, ...graph.repositories];
  const filteredGraph: CodeGraph =
    repoFilter === 'all'
      ? graph
      : {
          ...graph,
          nodes: graph.nodes.filter((n) => n.repo === repoFilter),
          edges: graph.edges.filter((e) => {
            const sn = graph.nodes.find((n) => n.id === e.source);
            const tn = graph.nodes.find((n) => n.id === e.target);
            return sn?.repo === repoFilter && tn?.repo === repoFilter;
          }),
        };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        sx={{
          p: 1,
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          flexWrap: 'wrap',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <TextField
          size="small"
          placeholder="検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSearch();
          }}
          sx={{ minWidth: 200 }}
        />
        <Button size="small" variant="outlined" onClick={() => void handleSearch()}>
          検索
        </Button>
        <Button size="small" onClick={handleGenerate}>
          再読込
        </Button>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {repos.map((r) => (
            <Chip
              key={r.id}
              label={r.label}
              size="small"
              variant={repoFilter === r.id ? 'filled' : 'outlined'}
              onClick={() => setRepoFilter(r.id)}
            />
          ))}
        </Box>
      </Box>

      <TemporalCouplingControls
        value={tcValue}
        onChange={setTcValue}
        resultCount={ghostEdges.length}
        loading={tcLoading}
      />

      {showSubagentDirectionalHint && (
        <Alert severity="info" sx={{ mx: 1, mb: 1, py: 0 }}>
          subagent 粒度では複数の subagent_type が共通ファイルを触っていないと方向性
          （矢印）は出ません。現在のデータは対称的なため全エッジが無向です。期間
          （windowDays）を伸ばすか、別の subagent_type を含むセッションが取り込まれて
          いるか確認してください。
        </Alert>
      )}

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ flex: 1 }}>
          <CodeGraphCanvas
            graph={filteredGraph}
            highlightedNodes={highlightedNodes}
            onNodeClick={(n) => void handleNodeClick(n)}
            isDark={isDark}
            ghostEdges={tcValue.enabled ? ghostEdges : undefined}
            ghostEdgeGranularity={tcGranularity}
          />
        </Box>
        {selectedNode && (
          <Box
            sx={{
              width: 260,
              p: 2,
              borderLeft: 1,
              borderColor: 'divider',
              overflow: 'auto',
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {selectedNode.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {selectedNode.id}
            </Typography>
            <Typography variant="caption" display="block">
              リポジトリ: {selectedNode.repo}
            </Typography>
            <Typography variant="caption" display="block">
              コミュニティ: {communitySummary
                ? `${communitySummary.name} (${selectedNode.communityLabel})`
                : selectedNode.communityLabel}
            </Typography>
            {communitySummary?.summary && (
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ pl: 1.5, mt: 0.25 }}
              >
                {communitySummary.summary}
              </Typography>
            )}
            <Typography variant="caption" display="block">
              被参照数: {selectedNode.size}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
