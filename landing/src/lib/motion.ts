// Single shared mutable state bridging GSAP (DOM/scroll world) and R3F (three world).
// GSAP tweens these plain values; useFrame reads and applies them. No React state
// is touched on the scroll path.

export type Vec3 = { x: number; y: number; z: number };

export const motion = {
  cam: { x: 0, y: 0.05, z: -4.1 } as Vec3,
  look: { x: 0, y: 0.05, z: 0 } as Vec3,
  /** product yaw, radians (fusion turntable) */
  spin: 0,
  /** additive user yaw from drag-to-inspect, radians */
  spinDrag: 0,
  /** 0..1 exploded-view progress (V2) */
  explode: 0,
  /** node name of the focused part, '' = none */
  focus: '',
  /** pointer parallax input, -1..1 */
  pointer: { x: 0, y: 0 },
  /** parallax amplitude, radians-ish world units */
  parallax: 0.06,
  /** set true by any driver that wants frames rendered */
  dirty: true,
};

/** Screen-space projections of part anchors, written by the three side each
 *  frame, read by the DOM callout layer on the gsap ticker. */
export const screenAnchors: Record<
  string,
  { x: number; y: number; visible: boolean }
> = {};

export function markDirty() {
  motion.dirty = true;
}
