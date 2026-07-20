import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Canvas, invalidate } from '@react-three/fiber';
import { Preload, PerformanceMonitor, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { QUALITY, useInitialQuality, demote, promote } from '../three/AdaptiveQuality';
import { setRequestRender } from '../lib/motion';
import { ModuleModel } from '../three/ModuleModel';
import { Stage } from '../three/Stage';
import { CameraRig } from '../three/CameraRig';
import { SensorFX } from '../three/SensorFX';
import { FrameloopGate } from './FrameloopGate';

const Composer = lazy(() => import('../three/Composer'));

const ACCENT = '#ff4d00';

/** Numeric loading overlay, gated on the GLB finishing (drei useProgress). */
function Preloader({ onDone }: { onDone: () => void }) {
  const { progress, active } = useProgress();
  const [gone, setGone] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!doneRef.current && progress >= 100 && !active) {
      doneRef.current = true;
      onDone();
      const t = setTimeout(() => setGone(true), 650);
      return () => clearTimeout(t);
    }
  }, [progress, active, onDone]);

  if (gone) return null;
  return (
    <div className={`preloader ${doneRef.current ? 'preloader-out' : ''}`}>
      <div className="preloader-brand">EMBION</div>
      <div className="preloader-value">{Math.round(progress)}</div>
      <div className="preloader-bar">
        <div className="preloader-fill" style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
    </div>
  );
}

/**
 * The full 3D layer (Canvas + studio + model + FX + camera + post). Lazy-loaded
 * by the page so first paint is hero DOM + poster off a tiny bundle, and the
 * ~three/drei/postprocessing chunk streams in after. Owns its own quality tier.
 */
export default function Scene({
  reduced,
  onLoaded,
  onCtxLost,
}: {
  reduced: boolean;
  onLoaded: () => void;
  onCtxLost: () => void;
}) {
  const [quality, setQuality] = useInitialQuality();
  const q = QUALITY[quality ?? 'medium'];

  // Let the DOM/scroll layer request demand-mode frames (reduced motion) without
  // importing fiber.
  useEffect(() => {
    setRequestRender(invalidate);
    return () => setRequestRender(() => {});
  }, []);

  // Cheaper CSS on weak machines (grain blend-mode compositing is costly).
  useEffect(() => {
    document.documentElement.classList.toggle('perf-low', quality === 'low');
  }, [quality]);

  return (
    <>
      <Preloader onDone={onLoaded} />
      <Canvas
        camera={{ fov: 35, position: [0, 0.05, -4.1], near: 0.1, far: 60 }}
        dpr={q.dpr}
        gl={{
          antialias: !q.composer, // SMAA covers AA when the composer runs
          powerPreference: 'high-performance',
          stencil: false,
          toneMapping: THREE.AgXToneMapping,
          toneMappingExposure: 1.26,
        }}
        frameloop={reduced ? 'demand' : 'always'}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            onCtxLost();
          });
        }}
      >
        {!reduced && (
          <PerformanceMonitor
            flipflops={2}
            onDecline={() => setQuality((cur) => demote(cur ?? 'medium'))}
            onIncline={() => setQuality((cur) => promote(cur ?? 'medium'))}
            onFallback={() => setQuality('low')}
          />
        )}
        <Suspense fallback={null}>
          <Stage theme="dark" floor={q.floor ? 'reflect' : 'none'} />
          <ModuleModel theme="dark" dimStyle="darken" />
          <SensorFX accent={ACCENT} />
          <CameraRig />
          <FrameloopGate />
          {q.composer && (
            <Suspense fallback={null}>
              <Composer ao={q.ao} />
            </Suspense>
          )}
          <Preload all />
        </Suspense>
      </Canvas>
      <div className="grain" />
    </>
  );
}
