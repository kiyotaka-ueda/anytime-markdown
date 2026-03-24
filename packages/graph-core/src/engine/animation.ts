import { Viewport } from '../types';

/** Cubic ease-out: fast start, slow finish */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Viewport animation descriptor */
export interface ViewportAnimation {
  from: Viewport;
  to: Viewport;
  startTime: number;
  duration: number;
}

/** Interpolate between two viewports using easeOutCubic */
export function interpolateViewport(
  anim: ViewportAnimation,
  now: number,
): { viewport: Viewport; done: boolean } {
  const elapsed = now - anim.startTime;
  if (elapsed >= anim.duration) {
    return { viewport: { ...anim.to }, done: true };
  }
  const t = easeOutCubic(elapsed / anim.duration);
  return {
    viewport: {
      offsetX: anim.from.offsetX + (anim.to.offsetX - anim.from.offsetX) * t,
      offsetY: anim.from.offsetY + (anim.to.offsetY - anim.from.offsetY) * t,
      scale: anim.from.scale + (anim.to.scale - anim.from.scale) * t,
    },
    done: false,
  };
}
