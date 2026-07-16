import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '../lib/scroll';
import { screenAnchors } from '../lib/motion';

/** Blueprint-style leader line: square terminal, right-angle elbow, ink stroke. */
export function Callouts() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const svg = svgRef.current!;
    const path = pathRef.current!;
    const dot = dotRef.current!;
    let opacity = 0;

    const tick = () => {
      const section = document.querySelector<HTMLElement>('.step.active');
      const anchorName = section?.dataset.anchor;
      const anchor = anchorName ? screenAnchors[anchorName] : undefined;
      const card = section?.querySelector<HTMLElement>('.step-card');
      const targetOpacity = section && anchor?.visible && card ? 1 : 0;
      opacity += (targetOpacity - opacity) * 0.14;
      svg.style.opacity = String(opacity);
      if (opacity < 0.02 || !card || !anchor) return;

      const rect = card.getBoundingClientRect();
      const x1 = rect.right + 12;
      const y1 = rect.top + 34;
      const elbowX = x1 + Math.max(24, (anchor.x - x1) * 0.35);
      path.setAttribute(
        'd',
        `M ${x1} ${y1} H ${elbowX} L ${anchor.x} ${anchor.y}`,
      );
      dot.setAttribute('x', String(anchor.x - 3.5));
      dot.setAttribute('y', String(anchor.y - 3.5));
    };

    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  return (
    <svg ref={svgRef} className="callout-layer" aria-hidden="true">
      <path ref={pathRef} className="callout-path" fill="none" />
      <rect ref={dotRef} className="callout-dot" width="7" height="7" />
    </svg>
  );
}
