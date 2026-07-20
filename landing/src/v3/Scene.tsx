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
import { BRAND } from '../content/product';

const Composer = lazy(() => import('../three/Composer'));

const ACCENT = '#ff4d00';

function Preloader({ onDone }: { onDone: () => void }) {
  const { progress, active } = useProgress();
  const [gone, setGone] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!doneRef.current && progress >= 100 && !active) {
      doneRef.current = true;
      onDone();
      const t = setTimeout(() => setGone(true), 550);
      return () => clearTimeout(t);
    }
  }, [progress, active, onDone]);

  if (gone) return null;
  return (
    <div className={`preloader ${doneRef.current ? 'preloader-out' : ''}`}>
      <div className="preloader-brand">{BRAND}</div>
      <div className="preloader-value">{Math.round(progress)}</div>
    </div>
  );
}

/** The full 3D layer for the Explorer, lazy-loaded so first paint is the DOM +
 *  poster off a tiny bundle. Pointer picking is threaded up through props so the
 *  interaction/selection logic can stay in the page. */
export default function Scene({
  reduced,
  onLoaded,
  onCtxLost,
  onPointerMissed,
  onHoverObject,
  onClickObject,
}: {
  reduced: boolean;
  onLoaded: () => void;
  onCtxLost: () => void;
  onPointerMissed: () => void;
  onHoverObject: (obj: THREE.Object3D | null) => void;
  onClickObject: (obj: THREE.Object3D) => void;
}) {
  const [quality, setQuality] = useInitialQuality();
  const q = QUALITY[quality ?? 'medium'];

  useEffect(() => {
    setRequestRender(invalidate);
    return () => setRequestRender(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('perf-low', quality === 'low');
  }, [quality]);

  return (
    <>
      <Preloader onDone={onLoaded} />
      <Canvas
        camera={{ fov: 35, position: [0, 0.12, -4.5], near: 0.1, far: 60 }}
        dpr={q.dpr}
        gl={{
          antialias: !q.composer,
          powerPreference: 'high-performance',
          stencil: false,
          toneMapping: THREE.AgXToneMapping,
          toneMappingExposure: 1.26,
        }}
        frameloop={reduced ? 'demand' : 'always'}
        onPointerMissed={onPointerMissed}
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
            <ModuleModel theme="dark" dimStyle="darken" />
          </group>
          <SensorFX accent={ACCENT} />
          <CameraRig />
          {q.composer && (
            <Suspense fallback={null}>
              <Composer ao={q.ao} />
            </Suspense>
          )}
          <Preload all />
        </Suspense>
      </Canvas>
    </>
  );
}
