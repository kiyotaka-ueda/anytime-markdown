import { specialShapes } from '../../engine/shapeRenderers';
import { setCurrentColors } from '../../engine/shapes';
import { GraphNode, DEFAULT_FRAGMENT_STYLE } from '../../types';
import type { CanvasColors } from '../../theme';

function createMockCtx(): CanvasRenderingContext2D & { fillTextCalls: string[] } {
  const fillTextCalls: string[] = [];
  const ctx: Record<string, unknown> = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    quadraticCurveTo: jest.fn(),
    bezierCurveTo: jest.fn(),
    arcTo: jest.fn(),
    closePath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    fillText: jest.fn((text: string) => {
      fillTextCalls.push(text);
    }),
    measureText: jest.fn().mockReturnValue({ width: 24 }),
    setLineDash: jest.fn(),
  };
  return Object.assign(ctx as unknown as CanvasRenderingContext2D, { fillTextCalls });
}

const colors: CanvasColors = {
  canvasBg: '#0D1117',
  canvasGrid: '#1a1a2e',
  canvasSelection: '#90CAF9',
  canvasSelectionFill: 'rgba(144,202,249,0.08)',
  canvasSnap: '#90CAF9',
  canvasSnapInner: '#0D1117',
  canvasSmartGuide: '#90CAF9',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0BEC5',
  textOnLight: '#263238',
  lockIcon: '#90CAF9',
  tooltipBg: '#1E1E2E',
  tooltipBorder: 'rgba(255,255,255,0.12)',
  tooltipText: '#FFFFFF',
  invalidTarget: '#F44336',
  handleFill: '#FFFFFF',
  edgeLabelBg: '#1E1E2E',
  docFill: '#1a1a2e',
  docStroke: 'rgba(255,255,255,0.24)',
  docIconColor: '#90CAF9',
  frameFill: '#1a1a2e',
  frameStroke: 'rgba(255,255,255,0.12)',
  frameTitleBg: '#1a1a2e',
  panelBg: '#1E1E2E',
  panelBorder: 'rgba(255,255,255,0.12)',
  modalBg: '#1E1E2E',
  accentColor: '#90CAF9',
  hoverBg: 'rgba(255,255,255,0.08)',
};

function makeFragmentNode(metadata: Record<string, string | number>): GraphNode {
  return {
    id: 'frag1',
    type: 'fragment',
    x: 10,
    y: 20,
    width: 200,
    height: 100,
    text: '',
    style: { ...DEFAULT_FRAGMENT_STYLE },
    metadata,
  };
}

describe('renderFragment', () => {
  beforeEach(() => {
    setCurrentColors(colors);
  });

  it('is registered as a special shape renderer for "fragment"', () => {
    expect(specialShapes.fragment).toBeDefined();
  });

  it('renders the "alt" label badge for fragmentKind=alt', () => {
    const ctx = createMockCtx();
    const node = makeFragmentNode({ fragmentKind: 'alt', condition: 'count > 0' });
    specialShapes.fragment!(ctx, node, false, false, '#000');

    expect(ctx.fillTextCalls).toContain('alt');
    expect(ctx.fillTextCalls.some((t) => t.includes('count > 0'))).toBe(true);
    expect(ctx.setLineDash).toHaveBeenCalled();
  });

  it('renders the "loop" label badge for fragmentKind=loop', () => {
    const ctx = createMockCtx();
    const node = makeFragmentNode({ fragmentKind: 'loop', condition: 'i < 10' });
    specialShapes.fragment!(ctx, node, false, false, '#000');

    expect(ctx.fillTextCalls).toContain('loop');
  });

  it('renders the "opt" label badge for fragmentKind=opt', () => {
    const ctx = createMockCtx();
    const node = makeFragmentNode({ fragmentKind: 'opt', condition: 'isReady' });
    specialShapes.fragment!(ctx, node, false, false, '#000');

    expect(ctx.fillTextCalls).toContain('opt');
  });

  it('falls back to "frag" label when fragmentKind is missing', () => {
    const ctx = createMockCtx();
    const node = makeFragmentNode({});
    specialShapes.fragment!(ctx, node, false, false, '#000');

    expect(ctx.fillTextCalls).toContain('frag');
  });

  it('renders only a divider line when role=fragment-divider', () => {
    const ctx = createMockCtx();
    const node = makeFragmentNode({ role: 'fragment-divider', condition: 'else' });
    specialShapes.fragment!(ctx, node, false, false, '#000');

    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    // No badge label rendered for divider
    expect(ctx.fillTextCalls).not.toContain('alt');
    expect(ctx.fillTextCalls).not.toContain('loop');
    expect(ctx.fillTextCalls).not.toContain('opt');
    // condition text rendered with [...] wrapping
    expect(ctx.fillTextCalls.some((t) => t.includes('else'))).toBe(true);
  });

  it('does not render condition text when condition is missing', () => {
    const ctx = createMockCtx();
    const node = makeFragmentNode({ fragmentKind: 'alt' });
    specialShapes.fragment!(ctx, node, false, false, '#000');

    expect(ctx.fillTextCalls).toContain('alt');
    expect(ctx.fillTextCalls.every((t) => !t.startsWith('['))).toBe(true);
  });
});
