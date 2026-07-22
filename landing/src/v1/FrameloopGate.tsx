import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { ScrollTrigger, prefersReducedMotion } from '../lib/scroll';

/** Stops rendering while the canvas is fully covered by the opaque
 *  after-track sections; restores the caller's base mode (always during the
 *  monitor window, demand after) when scrolled back up. */
export function FrameloopGate({ base }: { base: 'always' | 'demand' }) {
  const set = useThree((s) => s.set);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = document.getElementById('after-track');
    if (!el) return;
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'max',
      onToggle: (self) => set({ frameloop: self.isActive ? 'never' : base }),
    });
    // apply the current state immediately so a base change mid-scroll sticks
    set({ frameloop: st.isActive ? 'never' : base });
    return () => st.kill();
  }, [set, base]);

  return null;
}
