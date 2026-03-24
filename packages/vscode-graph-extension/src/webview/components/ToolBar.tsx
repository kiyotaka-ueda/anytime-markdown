import type { ToolType } from '@anytime-markdown/graph-core';

interface ToolBarProps {
  tool: ToolType;
  onToolChange: (tool: ToolType) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToContent: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
}

const TOOL_GROUPS: { label: string; tools: { type: ToolType; label: string; shortcut?: string }[] }[] = [
  {
    label: 'Selection',
    tools: [
      { type: 'select', label: 'Select', shortcut: 'V' },
      { type: 'pan', label: 'Pan', shortcut: 'H' },
    ],
  },
  {
    label: 'Shapes',
    tools: [
      { type: 'rect', label: 'Rect', shortcut: 'R' },
      { type: 'ellipse', label: 'Ellipse', shortcut: 'O' },
      { type: 'diamond', label: 'Diamond' },
      { type: 'parallelogram', label: 'Pgram' },
      { type: 'cylinder', label: 'Cylinder' },
      { type: 'sticky', label: 'Sticky', shortcut: 'S' },
      { type: 'text', label: 'Text', shortcut: 'T' },
    ],
  },
  {
    label: 'Edges',
    tools: [
      { type: 'line', label: 'Line', shortcut: 'L' },
      { type: 'arrow', label: 'Arrow', shortcut: 'A' },
      { type: 'connector', label: 'Connect', shortcut: 'C' },
    ],
  },
];

const btnStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid var(--vscode-button-border, transparent)',
  borderRadius: '3px',
  cursor: 'pointer',
  fontSize: '11px',
  fontFamily: 'var(--vscode-font-family)',
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
};

const activeBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 20,
  background: 'var(--vscode-panel-border, #444)',
  margin: '0 4px',
};

export function ToolBar({
  tool, onToolChange, showGrid, onToggleGrid,
  scale, onZoomIn, onZoomOut, onFitToContent,
  onUndo, onRedo, onDelete,
}: ToolBarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      padding: '4px 8px',
      borderBottom: '1px solid var(--vscode-panel-border)',
      background: 'var(--vscode-editor-background)',
      flexWrap: 'wrap',
    }}>
      {TOOL_GROUPS.map((group, gi) => (
        <div key={group.label} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {gi > 0 && <div style={separatorStyle} />}
          {group.tools.map(t => (
            <button
              key={t.type}
              style={tool === t.type ? activeBtnStyle : btnStyle}
              onClick={() => onToolChange(t.type)}
              title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
            >
              {t.label}
            </button>
          ))}
        </div>
      ))}

      <div style={separatorStyle} />

      <button style={btnStyle} onClick={onUndo} title="Undo (Ctrl+Z)">Undo</button>
      <button style={btnStyle} onClick={onRedo} title="Redo (Ctrl+Y)">Redo</button>

      <div style={separatorStyle} />

      <button
        style={showGrid ? activeBtnStyle : btnStyle}
        onClick={onToggleGrid}
        title="Toggle Grid"
      >
        Grid
      </button>

      <div style={separatorStyle} />

      <button style={btnStyle} onClick={onZoomOut} title="Zoom Out">-</button>
      <span style={{ fontSize: '11px', minWidth: '36px', textAlign: 'center' }}>
        {Math.round(scale * 100)}%
      </span>
      <button style={btnStyle} onClick={onZoomIn} title="Zoom In">+</button>
      <button style={btnStyle} onClick={onFitToContent} title="Fit to Content">Fit</button>

      <div style={separatorStyle} />

      <button style={btnStyle} onClick={onDelete} title="Delete Selected (Del)">Delete</button>
    </div>
  );
}
