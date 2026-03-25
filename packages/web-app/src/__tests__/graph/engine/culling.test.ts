import { getVisibleBounds, isNodeVisible, isEdgeVisible } from '@anytime-markdown/graph-core/engine';
import { Viewport, GraphNode, GraphEdge, DEFAULT_NODE_STYLE, DEFAULT_EDGE_STYLE } from '@anytime-markdown/graph-core';

function makeNode(id: string, x: number, y: number, w: number = 150, h: number = 100): GraphNode {
  return { id, type: 'rect', x, y, width: w, height: h, text: '', style: { ...DEFAULT_NODE_STYLE } };
}

function makeEdge(id: string, fx: number, fy: number, tx: number, ty: number): GraphEdge & { waypoints?: { x: number; y: number }[] } {
  return { id, type: 'line', from: { x: fx, y: fy }, to: { x: tx, y: ty }, style: { ...DEFAULT_EDGE_STYLE } };
}

describe('getVisibleBounds', () => {
  it('should compute world-space bounds from viewport', () => {
    const vp: Viewport = { offsetX: 0, offsetY: 0, scale: 1 };
    const bounds = getVisibleBounds(vp, 800, 600);
    expect(bounds.minX).toBe(-50);
    expect(bounds.minY).toBe(-50);
    expect(bounds.maxX).toBe(850);
    expect(bounds.maxY).toBe(650);
  });

  it('should account for scale', () => {
    const vp: Viewport = { offsetX: 0, offsetY: 0, scale: 2 };
    const bounds = getVisibleBounds(vp, 800, 600);
    expect(bounds.minX).toBe(-50);
    expect(bounds.maxX).toBe(450);
  });

  it('should account for offset', () => {
    const vp: Viewport = { offsetX: -200, offsetY: -100, scale: 1 };
    const bounds = getVisibleBounds(vp, 800, 600);
    expect(bounds.minX).toBe(150);
    expect(bounds.minY).toBe(50);
  });

  it('should accept custom margin', () => {
    const vp: Viewport = { offsetX: 0, offsetY: 0, scale: 1 };
    const bounds = getVisibleBounds(vp, 800, 600, 0);
    expect(bounds.minX).toBeCloseTo(0);
    expect(bounds.maxX).toBeCloseTo(800);
  });
});

describe('isNodeVisible', () => {
  const bounds = { minX: 0, minY: 0, maxX: 800, maxY: 600 };

  it('should return true for node inside bounds', () => {
    expect(isNodeVisible(makeNode('a', 100, 100), bounds)).toBe(true);
  });

  it('should return true for node partially overlapping', () => {
    expect(isNodeVisible(makeNode('b', -100, 100), bounds)).toBe(true);
  });

  it('should return false for node fully outside right', () => {
    expect(isNodeVisible(makeNode('c', 900, 100), bounds)).toBe(false);
  });

  it('should return false for node fully outside left', () => {
    expect(isNodeVisible(makeNode('d', -200, 100), bounds)).toBe(false);
  });

  it('should return false for node fully above', () => {
    expect(isNodeVisible(makeNode('e', 100, -200), bounds)).toBe(false);
  });

  it('should return false for node fully below', () => {
    expect(isNodeVisible(makeNode('f', 100, 700), bounds)).toBe(false);
  });
});

describe('isEdgeVisible', () => {
  const bounds = { minX: 0, minY: 0, maxX: 800, maxY: 600 };

  it('should return true for edge inside bounds', () => {
    expect(isEdgeVisible(makeEdge('e1', 100, 100, 200, 200), bounds)).toBe(true);
  });

  it('should return true for edge crossing bounds', () => {
    expect(isEdgeVisible(makeEdge('e2', -100, 300, 100, 300), bounds)).toBe(true);
  });

  it('should return false for edge fully outside', () => {
    expect(isEdgeVisible(makeEdge('e3', -200, -200, -100, -100), bounds)).toBe(false);
  });

  it('should use waypoints when available', () => {
    const edge = { ...makeEdge('e4', -200, -200, -100, -100), waypoints: [{ x: 400, y: 300 }] };
    expect(isEdgeVisible(edge, bounds)).toBe(true);
  });
});
