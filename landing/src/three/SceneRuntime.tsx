import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { gsap } from '../lib/scroll';
import { motion } from '../lib/motion';
import { reportProgress } from '../lib/loadProgress';

/** Feeds real GLB byte progress into the page-owned boot overlay.
 *  0.12 = scene chunk arrived (reported by the page); model bytes fill to 0.86. */
export function LoadReporter({ onDone }: { onDone: () => void }) {
  const { progress, active } = useProgress();
  const doneRef = useRef(false);

  useEffect(() => {
    reportProgress(0.12 + (progress / 100) * 0.74, 'model');
    if (!doneRef.current && progress >= 100 && !active) {
      doneRef.current = true;
      onDone();
    }
  }, [progress, active, onDone]);

  return null;
}

/** Compiles every shader asynchronously while the boot overlay still covers
 *  the page, so the reveal never hits a compile stall; fires only after a real
 *  frame rendered with warm shaders. */
export function CompileGate({ onDone }: { onDone: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const [compiled, setCompiled] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    let alive = true;
    const done = () => alive && setCompiled(true);
    // Escape hatch: a slow or stuck async compile (headless GL, quirky
    // drivers) must not hold the reveal hostage — after 4s proceed anyway and
    // let any remaining compiles hitch behind the overlay fade instead.
    const t = setTimeout(done, 4000);
    if (typeof gl.compileAsync === 'function') {
      gl.compileAsync(scene, camera).then(done, done);
    } else {
      done();
    }
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [gl, scene, camera]);

  // Demand-frameloop: under reduced motion NOTHING else schedules a frame
  // after the GLB Suspense commit, so guarantee the handshake frame here. This
  // effect runs after the commit that flipped `compiled`, so the frame it
  // schedules always observes the new value (invalidating from the promise
  // callback would race React's commit and could consume the frame early).
  useEffect(() => {
    if (compiled) invalidate();
  }, [compiled, invalidate]);

  useFrame(() => {
    if (compiled && !fired.current) {
      fired.current = true;
      onDone();
    }
  });

  return null;
}

/** Demand-frameloop driver: renders while GSAP is animating anything, plus a
 *  30fps heartbeat for the idle micro-motion. Scroll and pointer input request
 *  frames directly (lib/scroll.ts + the pages' pointermove handlers). */
export function DemandDriver({ enabled }: { enabled: boolean }) {
  const inv = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.hidden) return;
      // isActive() only — ScrollTrigger parks its scrub animations PAUSED in
      // the global timeline forever, so a bare length check is permanently
      // true on v1 and the demand loop would never idle.
      if (gsap.globalTimeline.getChildren(true, true, true).some((a) => a.isActive())) inv();
    };
    gsap.ticker.add(tick);
    const id = window.setInterval(() => {
      if (!document.hidden && motion.idle > 0) inv();
    }, 33);
    return () => {
      gsap.ticker.remove(tick);
      clearInterval(id);
    };
  }, [enabled, inv]);
  return null;
}
