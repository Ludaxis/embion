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

// Kicked at module-eval so the postprocessing chunk downloads in parallel with
// the GLB instead of serially after the Canvas mounts.
const composerPromise = import('../three/Composer');
const Composer = lazy(() => composerPromise);

const ACCENT = '#ff4d00';

/** The full 3D layer for the Explorer. Pointer picking is threaded up through
 *  props so the interaction/selection logic can stay in the page; raycasts are
 *  BVH-accelerated (the desktop mesh is ~300k tris). */
export default function Scene({
  reduced,
  onLoaded,
  onCtxLost,
  onCtxRestored,
  onPointerMissed,
  onHoverObject,
  onClickObject,
}: {
  reduced: boolean;
  onLoaded: () => void;
  onCtxLost: () => void;
  onCtxRestored: () => void;
  onPointerMissed: () => void;
  onHoverObject: (obj: THREE.Object3D | null) => void;
  onClickObject: (obj: THREE.Object3D) => void;
}) {
  const [quality, setQuality] = useInitialQuality();
  const q = QUALITY[quality ?? 'medium'];
  const qRef = useRef(quality);
  qRef.current = quality;

  const [phase, setPhase] = useState<'boot' | 'monitor' | 'settled'>('boot');
  const [glbDone, setGlbDone] = useState(false);
  const [compiled, setCompiled] = useState(false);
  const [composerReady, setComposerReady] = useState(false);
  const [ctxGen, setCtxGen] = useState(0);
  const loadedFired = useRef(false);

  useEffect(() => {
    composerPromise.then(() => setComposerReady(true));
  }, []);

  useEffect(() => {
    if (loadedFired.current) return;
    if (!glbDone || !compiled) return;
    if (q.composer && !composerReady) return;
    loadedFired.current = true;
    onLoaded();
    setPhase('monitor');
  }, [glbDone, compiled, composerReady, q.composer, onLoaded]);

  useEffect(() => {
    if (phase !== 'monitor') return;
    const t = setTimeout(() => {
      setPhase('settled');
      if (qRef.current) persistQuality(qRef.current);
    }, 6000);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    setRequestRender(invalidate);
    return () => setRequestRender(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('perf-low', quality === 'low');
  }, [quality]);

  const frameloop = reduced || phase === 'settled' ? 'demand' : 'always';

  return (
    <>
      <Canvas
        camera={{ fov: 35, position: [0, 0.12, -4.5], near: 0.1, far: 60 }}
        dpr={q.dpr}
        gl={{
          antialias: true, // stable at creation; SMAA stacks on composer tiers
          powerPreference: 'high-performance',
          stencil: false,
          toneMapping: THREE.AgXToneMapping,
          toneMappingExposure: 1.26,
        }}
        frameloop={frameloop}
        onPointerMissed={onPointerMissed}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault(); // enables three's automatic context restore
            onCtxLost();
          });
          gl.domElement.addEventListener('webglcontextrestored', () => {
            setCtxGen((g) => g + 1);
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
          <group
            onPointerMove={(e) => {
              e.stopPropagation();
              onHoverObject(e.object);
            }}
            onPointerOut={() => onHoverObject(null)}
            onClick={(e) => {
              e.stopPropagation();
              onClickObject(e.object);
            }}
          >
            <ModuleModel theme="dark" dimStyle="darken" bvhRaycast />
          </group>
          <SensorFX accent={ACCENT} />
          <CameraRig />
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
    </>
  );
}
