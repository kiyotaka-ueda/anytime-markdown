import { useState, useRef, useCallback } from 'react';
import type { ToolType, GraphDocument } from '@anytime-markdown/graph-core';
import { zoom as zoomViewport, fitToContent } from '@anytime-markdown/graph-core/engine';
import { useGraphState } from './hooks/useGraphState';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useVSCodeMessaging } from './hooks/useVSCodeMessaging';
import { GraphCanvas } from './components/GraphCanvas';
import { ToolBar } from './components/ToolBar';
import { TextEditOverlay } from './components/TextEditOverlay';

export function App() {
  const { state, dispatch } = useGraphState();
  const [tool, setTool] = useState<ToolType>('select');
  const [showGrid, setShowGrid] = useState(true);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { saveDocument } = useVSCodeMessaging({
    onLoad: useCallback((doc: GraphDocument) => {
      dispatch({ type: 'SET_DOCUMENT', doc });
    }, [dispatch]),
    onTheme: useCallback(() => {
      // Theme changes are handled via CSS variables automatically
    }, []),
  });

  // Auto-save debounced
  const scheduleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(state.document);
    }, 500);
  }, [saveDocument, state.document]);

  // Wrap dispatch to trigger auto-save on mutations
  const wrappedDispatch = useCallback((action: any) => {
    dispatch(action);
    if (action.type !== 'SET_DOCUMENT' && action.type !== 'SET_SELECTION' && action.type !== 'SET_VIEWPORT') {
      scheduleAutoSave();
    }
  }, [dispatch, scheduleAutoSave]);

  const {
    handleMouseDown, handleMouseMove, handleMouseUp,
    handleWheel, handleDoubleClick, previewRef,
  } = useCanvasInteraction({
    canvasRef,
    tool,
    nodes: state.document.nodes,
    edges: state.document.edges,
    viewport: state.document.viewport,
    selection: state.selection,
    dispatch: wrappedDispatch,
    onTextEdit: setEditingNodeId,
    showGrid,
  });

  const handleZoomIn = useCallback(() => {
    const vp = state.document.viewport;
    dispatch({ type: 'SET_VIEWPORT', viewport: zoomViewport(vp, window.innerWidth / 2, window.innerHeight / 2, -1) });
  }, [state.document.viewport, dispatch]);

  const handleZoomOut = useCallback(() => {
    const vp = state.document.viewport;
    dispatch({ type: 'SET_VIEWPORT', viewport: zoomViewport(vp, window.innerWidth / 2, window.innerHeight / 2, 1) });
  }, [state.document.viewport, dispatch]);

  const handleFitToContent = useCallback(() => {
    const nodes = state.document.nodes;
    if (nodes.length === 0) return;
    const minX = Math.min(...nodes.map(n => n.x));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxX = Math.max(...nodes.map(n => n.x + n.width));
    const maxY = Math.max(...nodes.map(n => n.y + n.height));
    dispatch({ type: 'SET_VIEWPORT', viewport: fitToContent(window.innerWidth, window.innerHeight - 40, { minX, minY, maxX, maxY }) });
  }, [state.document.nodes, dispatch]);

  const editingNode = editingNodeId ? state.document.nodes.find(n => n.id === editingNodeId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <ToolBar
        tool={tool}
        onToolChange={setTool}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(g => !g)}
        scale={state.document.viewport.scale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToContent={handleFitToContent}
        onUndo={() => wrappedDispatch({ type: 'UNDO' })}
        onRedo={() => wrappedDispatch({ type: 'REDO' })}
        onDelete={() => wrappedDispatch({ type: 'DELETE_SELECTED' })}
      />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <GraphCanvas
          nodes={state.document.nodes}
          edges={state.document.edges}
          viewport={state.document.viewport}
          selection={state.selection}
          showGrid={showGrid}
          previewRef={previewRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
        />
        {editingNode && (
          <TextEditOverlay
            node={editingNode}
            viewport={state.document.viewport}
            onCommit={(text) => {
              wrappedDispatch({ type: 'UPDATE_NODE', id: editingNode.id, changes: { text } });
              setEditingNodeId(null);
            }}
            onCancel={() => setEditingNodeId(null)}
          />
        )}
      </div>
    </div>
  );
}
