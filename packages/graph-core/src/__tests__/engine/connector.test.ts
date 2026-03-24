import {
  nodeCenter,
  rectIntersection,
  ellipseIntersection,
  resolveConnectorEndpoints,
  computeBezierPath,
  getConnectionPoints,
} from '../../engine/connector';
import { GraphNode, GraphEdge, DEFAULT_NODE_STYLE, DEFAULT_EDGE_STYLE } from '../../types';

function makeNode(id: string, x: number, y: number, w: number = 200, h: number = 100): GraphNode {
  return { id, type: 'rect', x, y, width: w, height: h, text: '', style: { ...DEFAULT_NODE_STYLE } };
}

const rectNode: GraphNode = {
  id: 'r1',
  type: 'rect',
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  text: '',
  style: DEFAULT_NODE_STYLE,
};
const ellipseNode: GraphNode = {
  id: 'e1',
  type: 'ellipse',
  x: 400,
  y: 0,
  width: 200,
  height: 100,
  text: '',
  style: DEFAULT_NODE_STYLE,
};

describe('nodeCenter', () => {
  it('should return center of node', () => {
    expect(nodeCenter(rectNode)).toEqual({ x: 100, y: 50 });
  });
});

describe('rectIntersection', () => {
  it('should intersect right edge when target is to the right', () => {
    const pt = rectIntersection(rectNode, 500, 50);
    expect(pt.x).toBe(200);
    expect(pt.y).toBe(50);
  });
  it('should intersect top edge when target is above', () => {
    const pt = rectIntersection(rectNode, 100, -200);
    expect(pt.y).toBe(0);
  });
});

describe('ellipseIntersection', () => {
  it('should intersect at right when target is directly right', () => {
    const pt = ellipseIntersection(ellipseNode, 900, 50);
    expect(pt.x).toBeCloseTo(600);
    expect(pt.y).toBeCloseTo(50);
  });
});

describe('resolveConnectorEndpoints', () => {
  it('should resolve endpoints between two nodes', () => {
    const edge: GraphEdge = {
      id: 'c1',
      type: 'connector',
      from: { nodeId: 'r1', x: 0, y: 0 },
      to: { nodeId: 'e1', x: 0, y: 0 },
      style: DEFAULT_EDGE_STYLE,
    };
    const result = resolveConnectorEndpoints(edge, [rectNode, ellipseNode]);
    expect(result.from.x).toBe(200);
    expect(result.to.x).toBeCloseTo(400);
  });
  it('should use raw coordinates when no node attached', () => {
    const edge: GraphEdge = {
      id: 'c2',
      type: 'line',
      from: { x: 10, y: 20 },
      to: { x: 30, y: 40 },
      style: DEFAULT_EDGE_STYLE,
    };
    const result = resolveConnectorEndpoints(edge, []);
    expect(result.from).toEqual({ x: 10, y: 20 });
    expect(result.to).toEqual({ x: 30, y: 40 });
  });
});

describe('computeBezierPath', () => {
  it('should return start, cp1, cp2, end for two horizontally separated nodes', () => {
    const from = makeNode('a', 0, 0, 100, 80);
    const to = makeNode('b', 300, 0, 100, 80);
    const path = computeBezierPath(from, to);
    expect(path).toHaveLength(4); // [start, cp1, cp2, end]
    // start should be on right side of 'from'
    expect(path[0].x).toBe(100); // x + width
    expect(path[0].y).toBe(40); // y + height/2
    // end should be on left side of 'to'
    expect(path[3].x).toBe(300);
    expect(path[3].y).toBe(40);
    // control points should be between start and end
    expect(path[1].x).toBeGreaterThan(path[0].x);
    expect(path[1].x).toBeLessThan(path[3].x);
    expect(path[2].x).toBeGreaterThan(path[0].x);
    expect(path[2].x).toBeLessThan(path[3].x);
  });

  it('should return path for vertically separated nodes', () => {
    const from = makeNode('a', 0, 0, 100, 80);
    const to = makeNode('b', 0, 300, 100, 80);
    const path = computeBezierPath(from, to);
    expect(path).toHaveLength(4);
    // start on bottom, end on top
    expect(path[0].y).toBe(80);
    expect(path[3].y).toBe(300);
  });
});

describe('getConnectionPoints with extraConnectionPoints', () => {
  it('should return 4 default points when no extras', () => {
    const node = makeNode('n1', 0, 0, 200, 100);
    const points = getConnectionPoints(node);
    expect(points).toHaveLength(4);
  });

  it('should include extra points in normalized coordinates', () => {
    const node: GraphNode = {
      ...makeNode('n1', 100, 200, 200, 100),
      extraConnectionPoints: [{ x: 0.25, y: 0 }, { x: 0.75, y: 1 }],
    };
    const points = getConnectionPoints(node);
    expect(points).toHaveLength(6); // 4 default + 2 extra
    // Extra point at x=0.25, y=0 → world: 100 + 200*0.25 = 150, 200 + 100*0 = 200
    const extra1 = points.find(p => p.x === 150 && p.y === 200);
    expect(extra1).toBeDefined();
    // Extra point at x=0.75, y=1 → world: 100 + 200*0.75 = 250, 200 + 100*1 = 300
    const extra2 = points.find(p => p.x === 250 && p.y === 300);
    expect(extra2).toBeDefined();
  });
});
