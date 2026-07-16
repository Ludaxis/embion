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

    const tick = () => {
      const section = document.querySelector<HTMLElement>('.chapter.active');
      const anchorName = section?.dataset.anchor;
      const anchor = anchorName ? screenAnchors[anchorName] : undefined;
      const card = section?.querySelector<HTMLElement>('.chapter-card');
      const targetOpacity = section && anchor?.visible && card ? 1 : 0;
      opacity += (targetOpacity - opacity) * 0.12;
      svg.style.opacity = String(opacity);
      if (opacity < 0.02 || !card || !anchor) return;

      const rect = card.getBoundingClientRect();
      const fromLeftSide = anchor.x > rect.right;
      const x1 = fromLeftSide ? rect.right + 14 : rect.left - 14;
      const y1 = rect.top + Math.min(rect.height * 0.32, 120);
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(anchor.x));
      line.setAttribute('y2', String(anchor.y));
      dot.setAttribute('cx', String(anchor.x));
      dot.setAttribute('cy', String(anchor.y));
      halo.setAttribute('cx', String(anchor.x));
      halo.setAttribute('cy', String(anchor.y));
    };

    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  return (
    <svg ref={svgRef} className="callout-layer" aria-hidden="true">
      <line ref={lineRef} className="callout-line" />
      <circle ref={haloRef} className="callout-halo" r="11" />
      <circle ref={dotRef} className="callout-dot" r="3.5" />
    </svg>
  );
}
