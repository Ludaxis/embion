import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { markDirty } from './motion';

gsap.registerPlugin(ScrollTrigger);

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;

/** Canonical wiring: Lenis rides native scroll, feeds ScrollTrigger, and GSAP's
 *  ticker is the single RAF owner. */
export function initScroll() {
  if (prefersReducedMotion()) return null;
  if (lenis) return lenis;
  lenis = new Lenis({ lerp: 0.11 });
  lenis.on('scroll', () => {
    ScrollTrigger.update();
    markDirty();
  });
  gsap.ticker.add((t) => {
    lenis!.raf(t * 1000);
  });
  gsap.ticker.lagSmoothing(0);
  if ('ontouchstart' in window) ScrollTrigger.normalizeScroll(true);
  if (import.meta.env.DEV) (window as unknown as { __lenis: Lenis }).__lenis = lenis;
  return lenis;
}

export { gsap, ScrollTrigger };
