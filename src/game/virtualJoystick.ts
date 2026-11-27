export const JOYSTICK_TOP_EXCLUSION_PX = 72;
export const JOYSTICK_IDLE_LEFT_PX = 84;
export const JOYSTICK_IDLE_BOTTOM_PX = 84;
export const JOYSTICK_IDLE_OPACITY = 0.25;
export const JOYSTICK_ACTIVE_OPACITY = 0.95;
export const JOYSTICK_MAX_RADIUS_PX = 52;
export const JOYSTICK_DEADZONE_PX = 10;

export interface JoystickAnchor {
  x: number;
  y: number;
}

export interface JoystickDirectionState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export interface JoystickOutput extends JoystickDirectionState {
  knobX: number;
  knobY: number;
  normX: number;
  normY: number;
  magnitude: number;
}

/**
 * Clamps a touch start position inside the viewport safely by the joystick's
 * visual outer radius (and below the top HUD bar exclusion band) so the
 * floating joystick ring never clips outside the screen edges.
 */
export function clampJoystickAnchor(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number,
  outerRadiusPx = JOYSTICK_MAX_RADIUS_PX,
  topExclusionPx = JOYSTICK_TOP_EXCLUSION_PX,
): JoystickAnchor {
  const safeWidth = Math.max(outerRadiusPx * 2 + 16, viewportWidth);
  const safeHeight = Math.max(topExclusionPx + outerRadiusPx * 2 + 16, viewportHeight);
  const margin = Math.max(8, outerRadiusPx + 6);
  const minX = margin;
  const maxX = Math.max(minX, safeWidth - margin);
  const minY = Math.max(margin, topExclusionPx + outerRadiusPx * 0.5);
  const maxY = Math.max(minY, safeHeight - margin);

  return {
    x: Math.max(minX, Math.min(maxX, clientX)),
    y: Math.max(minY, Math.min(maxY, clientY)),
  };
}

/**
 * Computes clamped thumb knob offset, normalized analog axes, and crisp
 * 4-way fighting inputs (walk/dash, jump, crouch/guard) with a responsive deadzone.
 */
export function computeJoystickOutput(
  originX: number,
  originY: number,
  clientX: number,
  clientY: number,
  maxRadiusPx = JOYSTICK_MAX_RADIUS_PX,
  deadzonePx = JOYSTICK_DEADZONE_PX,
): JoystickOutput {
  const safeMax = Math.max(16, maxRadiusPx);
  const safeDead = Math.max(0, Math.min(safeMax - 2, deadzonePx));

  let dx = clientX - originX;
  let dy = clientY - originY;
  const rawDist = Math.hypot(dx, dy);

  if (rawDist > safeMax && rawDist > 0) {
    const scale = safeMax / rawDist;
    dx *= scale;
    dy *= scale;
  }

  const clampedDist = Math.min(rawDist, safeMax);
  if (clampedDist < safeDead) {
    return {
      knobX: dx,
      knobY: dy,
      normX: 0,
      normY: 0,
      magnitude: 0,
      left: false,
      right: false,
      up: false,
      down: false,
    };
  }

  const normX = Math.abs(dx) < safeDead ? 0 : Math.max(-1, Math.min(1, dx / safeMax));
  const normY = Math.abs(dy) < safeDead ? 0 : Math.max(-1, Math.min(1, dy / safeMax));
  // Slightly stricter vertical threshold prevents accidental jumps during fast horizontal walks/dashes
  const verticalDead = safeDead * 1.35;

  return {
    knobX: dx,
    knobY: dy,
    normX,
    normY,
    magnitude: Math.min(1, clampedDist / safeMax),
    left: dx <= -safeDead,
    right: dx >= safeDead,
    up: dy <= -verticalDead,
    down: dy >= verticalDead,
  };
}
