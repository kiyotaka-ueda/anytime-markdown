import { easeOutCubic, interpolateViewport, ViewportAnimation } from '../../engine/animation';

describe('easeOutCubic', () => {
  it('should return 0 at t=0', () => {
    expect(easeOutCubic(0)).toBe(0);
  });
  it('should return 1 at t=1', () => {
    expect(easeOutCubic(1)).toBe(1);
  });
  it('should be > 0.5 at t=0.5 (decelerating curve)', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
  it('should be monotonically increasing', () => {
    const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map(easeOutCubic);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});

describe('interpolateViewport', () => {
  const anim: ViewportAnimation = {
    from: { offsetX: 0, offsetY: 0, scale: 1 },
    to: { offsetX: 100, offsetY: 200, scale: 2 },
    startTime: 1000,
    duration: 200,
  };

  it('should return from viewport at start', () => {
    const { viewport, done } = interpolateViewport(anim, 1000);
    expect(viewport.offsetX).toBe(0);
    expect(viewport.offsetY).toBe(0);
    expect(viewport.scale).toBe(1);
    expect(done).toBe(false);
  });

  it('should return to viewport when elapsed >= duration', () => {
    const { viewport, done } = interpolateViewport(anim, 1200);
    expect(viewport.offsetX).toBe(100);
    expect(viewport.offsetY).toBe(200);
    expect(viewport.scale).toBe(2);
    expect(done).toBe(true);
  });

  it('should interpolate at midpoint', () => {
    const { viewport, done } = interpolateViewport(anim, 1100);
    expect(viewport.offsetX).toBeGreaterThan(0);
    expect(viewport.offsetX).toBeLessThan(100);
    // easeOutCubic(0.5) = 0.875 → offsetX ≈ 87.5
    expect(viewport.offsetX).toBeGreaterThan(50);
    expect(done).toBe(false);
  });

  it('should handle overshoot time as done', () => {
    const { viewport, done } = interpolateViewport(anim, 2000);
    expect(viewport).toEqual(anim.to);
    expect(done).toBe(true);
  });
});
