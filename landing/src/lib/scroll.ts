import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';
import { motion, requestRender } from './motion';

// No window during build-time prerendering — GSAP plumbing is browser-only.
const isBrowser = typeof window !== 'undefined';
if (isBrowser) {
  gsap.registerPlugin(ScrollTrigger, CustomEase);
  // Machined-part extraction: fast break-away, firm level arrival — none of
  // the power-out tail creep and no toy-like overshoot.
  CustomEase.create('embMech', 'M0,0 C0.2,0 0.1,1 1,1');
}

export const prefersReducedMotion = () =>
  isBrowser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const QA =
  isBrowser &&
  (import.meta.env.DEV || new URLSearchParams(location.search).get('qa') === '1');
if (QA) {
  (window as unknown as { __gsap: typeof gsap; __motion: typeof motion }).__gsap = gsap;
  (window as unknown as { __gsap: typeof gsap; __motion: typeof motion }).__motion = motion;
}

let lenis: Lenis | null = null;

/** Canonical wiring: Lenis rides native scroll, feeds ScrollTrigger, and GSAP's
 *  ticker is the single RAF owner. Touch scrolling stays NATIVE (compositor
 *  thread): normalizeScroll would re-drive scrollTop from JS and freeze
 *  scrolling behind any long task — the opposite of world-class on phones. */
export function initScroll() {
  if (prefersReducedMotion()) return null;
  if (lenis) return lenis;
  lenis = new Lenis({ lerp: 0.11 });
  lenis.on('scroll', () => {
    ScrollTrigger.update();
    requestRender(); // demand-frameloop: every scroll step renders
  });
  gsap.ticker.add((t) => {
    lenis!.raf(t * 1000);
  });
  // (default lagSmoothing kept: it hides load-time long frames from the scrub)
  ScrollTrigger.config({ ignoreMobileResize: true });
  if (QA) (window as unknown as { __lenis: Lenis }).__lenis = lenis;
  return lenis;
}

export { gsap, ScrollTrigger };
