import type { Keyframe } from './animation-model.ts';

/**
 * Bezier Easing Model v1
 * 
 * Cubic Bezier curve interpolation for animation keyframes.
 * Supports preset easing functions and custom curve editing.
 */

export interface BezierCurve {
  /** Control point 1: x (0-1), y (0-1) */
  cp1: { x: number; y: number };
  /** Control point 2: x (0-1), y (0-1) */
  cp2: { x: number; y: number };
}

export interface EasingPreset {
  name: string;
  curve: BezierCurve;
  icon?: string;
}

/** Predefined easing curves */
export const EASING_PRESETS: Record<string, EasingPreset> = {
  linear: {
    name: 'Linear',
    curve: { cp1: { x: 0, y: 0 }, cp2: { x: 1, y: 1 } },
  },
  easeIn: {
    name: 'Ease In',
    curve: { cp1: { x: 0.42, y: 0 }, cp2: { x: 1, y: 1 } },
  },
  easeOut: {
    name: 'Ease Out',
    curve: { cp1: { x: 0, y: 0 }, cp2: { x: 0.58, y: 1 } },
  },
  easeInOut: {
    name: 'Ease In Out',
    curve: { cp1: { x: 0.42, y: 0 }, cp2: { x: 0.58, y: 1 } },
  },
  easeInQuad: {
    name: 'Ease In Quad',
    curve: { cp1: { x: 0.55, y: 0.085 }, cp2: { x: 0.68, y: 0.53 } },
  },
  easeOutQuad: {
    name: 'Ease Out Quad',
    curve: { cp1: { x: 0.25, y: 0.46 }, cp2: { x: 0.45, y: 0.94 } },
  },
  easeInCubic: {
    name: 'Ease In Cubic',
    curve: { cp1: { x: 0.55, y: 0.055 }, cp2: { x: 0.675, y: 0.19 } },
  },
  easeOutCubic: {
    name: 'Ease Out Cubic',
    curve: { cp1: { x: 0.215, y: 0.61 }, cp2: { x: 0.355, y: 1 } },
  },
  elasticOut: {
    name: 'Elastic Out',
    curve: { cp1: { x: 0.175, y: 0.885 }, cp2: { x: 0.32, y: 1.275 } },
  },
  backOut: {
    name: 'Back Out',
    curve: { cp1: { x: 0.175, y: 0.885 }, cp2: { x: 0.32, y: 1.275 } },
  },
};

/**
 * Cubic Bezier evaluation using De Casteljau's algorithm
 * t: time (0-1)
 * p0, p1, p2, p3: control points
 */
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

/**
 * Evaluate easing curve at time t
 * Returns interpolated y value (0-1) for given x time (0-1)
 */
export function sampleBezierCurve(curve: BezierCurve, t: number): number {
  // Clamp to bounds
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  // Binary search to find x on the curve that matches t
  let low = 0, high = 1, mid = t;
  for (let i = 0; i < 30; i++) {
    const x = cubicBezier(mid, 0, curve.cp1.x, curve.cp2.x, 1);
    if (x < t) {
      low = mid;
    } else {
      high = mid;
    }
    mid = (low + high) / 2;
  }

  // Evaluate y at that point
  return cubicBezier(mid, 0, curve.cp1.y, curve.cp2.y, 1);
}

/**
 * Create a keyframe with bezier easing
 */
export interface KeyframeWithBezier extends Keyframe {
  bezierCurve?: BezierCurve;
}

/**
 * Apply easing to interpolation between two values
 */
export function applyEasing(
  start: number,
  end: number,
  t: number,
  curve?: BezierCurve
): number {
  const easeT = curve ? sampleBezierCurve(curve, t) : t;
  return start + (end - start) * easeT;
}

/**
 * Generate curve data for visualization (SVG path or canvas drawing)
 * Returns array of { x, y } points on the curve
 */
export function generateCurvePoints(curve: BezierCurve, steps: number = 50): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = sampleBezierCurve(curve, t);
    points.push({ x: t, y });
  }
  return points;
}

/**
 * Convert curve points to SVG path string
 * Assumes viewBox="0 0 1 1" for normalized curves
 */
export function curveToSvgPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  // Flip y because SVG has y=0 at top
  const start = points[0];
  let path = `M ${start.x} ${1 - start.y}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    path += ` L ${p.x} ${1 - p.y}`;
  }
  return path;
}

/**
 * Validate a bezier curve (control points within 0-1)
 */
export function validateBezierCurve(curve: BezierCurve): string[] {
  const errors: string[] = [];
  if (!curve || !curve.cp1 || !curve.cp2 || ![curve.cp1.x,curve.cp1.y,curve.cp2.x,curve.cp2.y].every(Number.isFinite)) return ['Käyrän pisteiden tulee olla äärellisiä lukuja.'];
  if (curve.cp1.x < 0 || curve.cp1.x > 1) errors.push('cp1.x must be in [0, 1]');
  if (curve.cp1.y < -0.5 || curve.cp1.y > 1.5) errors.push('cp1.y should be in [-0.5, 1.5]');
  if (curve.cp2.x < 0 || curve.cp2.x > 1) errors.push('cp2.x must be in [0, 1]');
  if (curve.cp2.y < -0.5 || curve.cp2.y > 1.5) errors.push('cp2.y should be in [-0.5, 1.5]');
  return errors;
}

/**
 * Clone a bezier curve
 */
export function cloneBezierCurve(curve: BezierCurve): BezierCurve {
  return {
    cp1: { ...curve.cp1 },
    cp2: { ...curve.cp2 },
  };
}
