export const FIGHT_CAMERA_Z = 9.2;
export const FIGHT_CAMERA_Y = 2.45;
export const FIGHT_LOOK_Y = 1.48;
export const CAMERA_PAN_MIN_X = -6.5;
export const CAMERA_PAN_MAX_X = 6.5;

export interface FixedZoomCameraTarget {
  x: number;
  y: number;
  z: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

export function clampCameraPanX(x: number): number {
  return Math.max(CAMERA_PAN_MIN_X, Math.min(CAMERA_PAN_MAX_X, x));
}

/**
 * Pure 2.5D fixed-zoom horizontal panning camera solver.
 * Tracks ONLY the horizontal midpoint between P1 and CPU, clamped to
 * [CAMERA_PAN_MIN_X, CAMERA_PAN_MAX_X]. Camera depth (z) and height (y)
 * remain strictly constant so fighter screen scale never zooms in or out.
 */
export function computeFixedZoomCameraTarget(
  p1X: number,
  p2X: number,
): FixedZoomCameraTarget {
  const clampedX = clampCameraPanX((p1X + p2X) * 0.5);
  return {
    x: clampedX,
    y: FIGHT_CAMERA_Y,
    z: FIGHT_CAMERA_Z,
    lookX: clampedX,
    lookY: FIGHT_LOOK_Y,
    lookZ: 0,
  };
}
