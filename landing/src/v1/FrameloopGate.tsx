import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { ScrollTrigger, prefersReducedMotion } from '../lib/scroll';

/** Stops rendering while the canvas is fully covered by the opaque
 *  after-track sections. */
export function FrameloopGate() {
  const set = useThree((s) => s.set);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = document.getElementById('after-track');
    if (!el) return;
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'max',
      onToggle: (self) => set({ frameloop: self.isActive ? 'never' : 'always' }),
    });
    return () => st.kill();
  }, [set]);

  return null;
}
