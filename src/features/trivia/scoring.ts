export const MAX_BASE_POINTS = 1000;
export const FIRST_CORRECT_BONUS = 500;

/**
 * Score a single answer. `responseMs` is the mesh-time difference between
 * the question reveal and the tap. Both are measured in mesh-time on the
 * same phone that tapped, so they're directly comparable.
 *
 * Base points decay 1 point per ms, so a 1 s response keeps 999 points and a
 * 30 s response is 0. Wrong answers always score 0 (no participation prize).
 */
export function basePoints(correct: boolean, responseMs: number): number {
  if (!correct) return 0;
  if (!Number.isFinite(responseMs) || responseMs < 0) return 0;
  return Math.max(0, MAX_BASE_POINTS - Math.round(responseMs));
}
