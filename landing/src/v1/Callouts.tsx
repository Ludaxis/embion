import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '../lib/scroll';
import { screenAnchors } from '../lib/motion';

/**
 * DOM overlay drawing a leader line from the active chapter card to the
 * projected screen position of its 3D anchor. Updated on the gsap ticker —
 * no React state on the scroll path.
 */
export function Callouts() {
  const svgRef = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const svg = svgRef.current!;
    const line = lineRef.current!;
    const dot = dotRef.current!;
    const halo = haloRef.current!;
    let opacity = 0;
    let last = 0;
    let lastAnchor = '';
    let switchUntil = 0;
    const draw = { t: 1 };

    const tick = () => {
      // time-based fade so the feel is identical at 60 and 120 Hz.
      const now = performance.now();
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const section = document.querySelector<HTMLElement>('.chapter.active');
      const anchorName = section?.dataset.anchor ?? '';
      const anchor = anchorName ? screenAnchors[anchorName] : undefined;
      const card = section?.querySelector<HTMLElement>('.chapter-card');

      // Chapter handoff: dip the line out at the old anchor and DRAW it back
      // on at the new one, instead of teleporting x2/y2 across the screen at
      // full opacity (visible on every chapter transition).
      if (anchorName && anchorName !== lastAnchor) {
        if (lastAnchor) switchUntil = now + 170;
        lastAnchor = anchorName;
        gsap.killTweensOf(draw);
        draw.t = 0;
        gsap.to(draw, { t: 1, duration: 0.4, delay: 0.17, ease: 'power2.out' });
      }
      const switching = now < switchUntil;

      const targetOpacity = section && anchor?.visible && card && !switching ? 1 : 0;
      opacity += (targetOpacity - opacity) * (1 - Math.exp(-dt * (switching ? 16 : 8)));
      svg.style.opacity = String(opacity);
      // pause the halo pulse while the layer is invisible (compositor hygiene)
      halo.style.animationPlayState = opacity > 0.05 ? 'running' : 'paused';
      if (opacity < 0.02 || !card || !anchor) return;

      const rect = card.getBoundingClientRect();
      const fromLeftSide = anchor.x > rect.right;
      const x1 = fromLeftSide ? rect.right + 14 : rect.left - 14;
      const y1 = rect.top + Math.min(rect.height * 0.32, 120);
      const len = Math.hypot(anchor.x - x1, anchor.y - y1);
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(anchor.x));
      line.setAttribute('y2', String(anchor.y));
      // draw-on from the card edge toward the part
      line.style.strokeDasharray = `${len}`;
      line.style.strokeDashoffset = `${len * (1 - draw.t)}`;
      dot.setAttribute('cx', String(anchor.x));
      dot.setAttribute('cy', String(anchor.y));
      dot.style.opacity = String(draw.t);
      halo.setAttribute('cx', String(anchor.x));
      halo.setAttribute('cy', String(anchor.y));
      halo.style.opacity = String(draw.t);
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      gsap.killTweensOf(draw);
    };
  }, []);

  return (
    <svg ref={svgRef} className="callout-layer" aria-hidden="true">
      <line ref={lineRef} className="callout-line" />
      <circle ref={haloRef} className="callout-halo" r="11" />
      <circle ref={dotRef} className="callout-dot" r="3.5" />
    </svg>
  );
}
