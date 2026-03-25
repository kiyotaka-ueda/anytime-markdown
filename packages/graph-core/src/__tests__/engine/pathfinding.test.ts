import { computeAvoidancePath } from '../../engine/pathfinding';

describe('computeAvoidancePath', () => {
  it('should return a direct orthogonal path with no obstacles', () => {
    const path = computeAvoidancePath(
      { x: 0, y: 50 }, 'right',
      { x: 300, y: 50 }, 'left',
      [],
    );
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual({ x: 0, y: 50 });
    expect(path[path.length - 1]).toEqual({ x: 300, y: 50 });
  });

  it('should route around a blocking obstacle', () => {
    const path = computeAvoidancePath(
      { x: 0, y: 50 }, 'right',
      { x: 300, y: 50 }, 'left',
      [{ x: 100, y: 0, width: 100, height: 100 }],
      20,
    );
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual({ x: 0, y: 50 });
    expect(path[path.length - 1]).toEqual({ x: 300, y: 50 });
    // Path should not pass through the obstacle
    for (const pt of path) {
      const inside = pt.x > 100 && pt.x < 200 && pt.y > 0 && pt.y < 100;
      expect(inside).toBe(false);
    }
  });

  it('should simplify redundant waypoints into straight segments', () => {
    const path = computeAvoidancePath(
      { x: 0, y: 0 }, 'right',
      { x: 200, y: 0 }, 'left',
      [],
      20,
    );
    // A straight horizontal path should have 2-4 points max
    expect(path.length).toBeLessThanOrEqual(4);
  });

  it('should handle vertical routing', () => {
    const path = computeAvoidancePath(
      { x: 50, y: 0 }, 'bottom',
      { x: 50, y: 300 }, 'top',
      [{ x: 0, y: 100, width: 100, height: 100 }],
      20,
    );
    expect(path[0]).toEqual({ x: 50, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 50, y: 300 });
    for (const pt of path) {
      const inside = pt.x > 0 && pt.x < 100 && pt.y > 100 && pt.y < 200;
      expect(inside).toBe(false);
    }
  });
});
