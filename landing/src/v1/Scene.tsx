import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Canvas, invalidate } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { QUALITY, useInitialQuality, demote, promote, persistQuality } from '../three/AdaptiveQuality';
import { setRequestRender } from '../lib/motion';
import { reportProgress } from '../lib/loadProgress';
import { LoadReporter, CompileGate, DemandDriver } from '../three/SceneRuntime';
import { ModuleModel } from '../three/ModuleModel';
import { Stage } from '../three/Stage';
import { CameraRig } from '../three/CameraRig';
import { SensorFX } from '../three/SensorFX';
import { FrameloopGate } from './FrameloopGate';

// Kicked at module-eval so the postprocessing chunk downloads in parallel with
// the GLB instead of serially after the Canvas mounts.
const composerPromise = import('../three/Composer');
const Composer = lazy(() => composerPromise);

const ACCENT = '#ff4d00';

/**
 * The full 3D layer (Canvas + studio + model + FX + camera + post). The chunk
 * download is kicked at page module-eval (see App.tsx) and the GLB is
 * preloaded from the HTML head, so by the time this mounts the heavy bytes are
 * already in flight. Owns its own quality tier.
 */
export default function Scene({
  reduced,
  onLoaded,
  onCtxLost,
  onCtxRestored,
}: {
  reduced: boolean;
  onLoaded: () => void;
  onCtxLost: () => void;
  onCtxRestored: () => void;
}) {
  const [quality, setQuality] = useInitialQuality();
  const q = QUALITY[quality ?? 'medium'];
  const qRef = useRef(quality);
  qRef.current = quality;

  // boot → monitor (PerformanceMonitor samples on a continuous frameloop)
  // → settled (demand rendering; monitor unmounted).
  const [phase, setPhase] = useState<'boot' | 'monitor' | 'settled'>('boot');
  const [glbDone, setGlbDone] = useState(false);
  const [compiled, setCompiled] = useState(false);
  const [composerReady, setComposerReady] = useState(false);
  const [ctxGen, setCtxGen] = useState(0);
  const loadedFired = useRef(false);

  useEffect(() => {
    composerPromise.then(() => setComposerReady(true));
  }, []);

  // Reveal when model + shaders are ready; give the post-processing chunk at
  // most 2.5s more — a slow network must not hold the whole page hostage (the
  // composer pops in behind the fade if it's late).
  const [composerWaived, setComposerWaived] = useState(false);
  useEffect(() => {
    if (!glbDone || !compiled) return;
    const t = setTimeout(() => setComposerWaived(true), 2500);
    return () => clearTimeout(t);
  }, [glbDone, compiled]);
  useEffect(() => {
    if (loadedFired.current) return;
    if (!glbDone || !compiled) return;
    if (q.composer && !composerReady && !composerWaived) return;
    loadedFired.current = true;
    onLoaded();
    setPhase('monitor');
  }, [glbDone, compiled, composerReady, composerWaived, q.composer, onLoaded]);

  useEffect(() => {
    if (phase !== 'monitor') return;
    const t = setTimeout(() => {
      setPhase('settled');
      if (qRef.current) persistQuality(qRef.current);
    }, 6000);
    return () => clearTimeout(t);
  }, [phase]);

  // Let the DOM/scroll layer request demand-mode frames without importing fiber.
  useEffect(() => {
    setRequestRender(invalidate);
    return () => setRequestRender(() => {});
  }, []);

  // Cheaper CSS on weak machines (grain blend-mode compositing is costly).
  useEffect(() => {
    document.documentElement.classList.toggle('perf-low', quality === 'low');
  }, [quality]);

  const frameloop = reduced || phase === 'settled' ? 'demand' : 'always';

  return (
    <>
      <Canvas
        camera={{ fov: 35, position: [0, 0.05, -4.1], near: 0.1, far: 60 }}
        dpr={q.dpr}
        gl={{
          // MSAA stays on for the composer-less low tier AND after demotions;
          // composer tiers additionally run SMAA (context attrs are fixed at
          // creation, so this must not depend on the mutable tier).
          antialias: true,
          powerPreference: 'high-performance',
          stencil: false,
          toneMapping: THREE.AgXToneMapping,
          toneMappingExposure: 1.26,
        }}
        frameloop={frameloop}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault(); // enables three's automatic context restore
            onCtxLost();
          });
          gl.domElement.addEventListener('webglcontextrestored', () => {
            setCtxGen((g) => g + 1); // rebake env + shadows
            onCtxRestored();
            invalidate();
          });
        }}
      >
        <LoadReporter onDone={() => setGlbDone(true)} />
        {!reduced && phase === 'monitor' && (
          <PerformanceMonitor
            flipflops={2}
            onDecline={() => setQuality((cur) => demote(cur ?? 'medium'))}
            onIncline={() => setQuality((cur) => promote(cur ?? 'medium'))}
            onFallback={() => setQuality('low')}
          />
        )}
        <Suspense fallback={null}>
          <Stage key={ctxGen} theme="dark" floor={q.floor ? 'reflect' : 'none'} />
          <ModuleModel theme="dark" dimStyle="darken" />
          <SensorFX accent={ACCENT} />
          <CameraRig />
          <FrameloopGate base={frameloop} />
          {q.composer && (
            <Suspense fallback={null}>
              <Composer ao={q.ao} />
            </Suspense>
          )}
          <CompileGate
            onDone={() => {
              reportProgress(0.94, 'compile');
              setCompiled(true);
            }}
          />
        </Suspense>
        <DemandDriver enabled={frameloop === 'demand' && !reduced} />
      </Canvas>
      <div className="grain" />
    </>
  );
}
