import { Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { ModuleModel } from '../three/ModuleModel';
import { Stage } from '../three/Stage';
import { SensorFX } from '../three/SensorFX';
import { motion } from '../lib/motion';

// Stills: no idle life — no yaw/bob drift between capture frames, no idle
// LiDAR sweep ring in poster compositions, steady LED intensity.
motion.idle = 0;

/**
 * Offline render rig for high-quality stills.
 *   /render/?shot=hero&theme=dark&w=1920&h=1080&dpr=2&capture=1&name=hero-dark
 * capture=1 auto-downloads a PNG once the scene has settled.
 */

const params = new URLSearchParams(location.search);
const theme = (params.get('theme') ?? 'dark') as 'dark' | 'light';
const w = parseInt(params.get('w') ?? '1920', 10);
const h = parseInt(params.get('h') ?? '1080', 10);
const dpr = parseFloat(params.get('dpr') ?? '2');
const shot = params.get('shot') ?? 'hero';
const capture = params.get('capture') === '1';
const name = params.get('name') ?? `${shot}-${theme}`;
const noFx = params.get('fx') === '0';
const modelUrl = params.get('model') ?? undefined; // e.g. /models/module-new.glb

const SHOTS: Record<string, { cam: [number, number, number]; look: [number, number, number]; fov?: number }> = {
  // matches the LIVE V1 hero beats (heroPose() in src/v1/App.tsx) so the
  // posters crossfade seamlessly into frame 1 of the real scene
  hero: { cam: [2.4, 0.7, -4.6], look: [1.0, -0.05, 0] },
  'hero-portrait': { cam: [1.5, 0.6, -6.6], look: [0, 0.4, 0] },
  // matches the V3 Explorer OVERVIEW pose (src/v3/App.tsx)
  'v3-overview': { cam: [0, 0.4, -5.9], look: [0, 0.28, 0] },
  // matches the V2 hero beat
  'hero-v2': { cam: [-2.35, 0.42, -4.35], look: [0.28, 0, 0] },
  'three-quarter': { cam: [-2.6, 0.9, -3.1], look: [0, -0.02, 0] },
  'three-quarter-r': { cam: [2.6, 0.9, -3.1], look: [0, -0.02, 0] },
  front: { cam: [0, 0.0, -3.9], look: [0, 0, 0] },
  top: { cam: [-1.4, 2.9, -2.3], look: [0, 0.1, 0] },
  back: { cam: [-2.3, 0.85, 3.1], look: [0, -0.15, 0.3] },
  lidar: { cam: [-1.15, 1.05, -1.75], look: [0.03, 0.62, -0.6], fov: 30 },
  camera: { cam: [-1.05, -0.62, -1.65], look: [-0.02, -0.42, -0.6], fov: 30 },
};

const conf = SHOTS[shot] ?? SHOTS.hero;
// ?cam=x,y,z&look=x,y,z override any preset (framing checks / custom shots)
const parseV3 = (s: string | null): [number, number, number] | null => {
  if (!s) return null;
  const p = s.split(',').map(Number);
  return p.length === 3 && p.every((n) => Number.isFinite(n)) ? (p as [number, number, number]) : null;
};
conf.cam = parseV3(params.get('cam')) ?? conf.cam;
conf.look = parseV3(params.get('look')) ?? conf.look;

function Capturer({ onReady, composerRef }: { onReady: () => void; composerRef: { current: unknown } }) {
  const gl = useThree((s) => s.gl);
  const { progress, active } = useProgress();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || progress < 100 || active) return;
    fired.current = true;
    // let a few frames render (env, shadows, transmission settle)
    setTimeout(() => {
      // expose the postprocessing composer so an external driver can force a
      // fully-composited render (AO/bloom/vignette) in a hidden/throttled tab.
      (window as unknown as { __composer: unknown }).__composer = composerRef.current;
      onReady();
      // ?post=1 → POST the frame to a local capture sink (headless automation:
      // download clicks don't work there, and data-URLs can't be ferried out).
      if (params.get('post') === '1') {
        setTimeout(() => {
          // Explicit GL submission before readback: timer-driven/headless
          // pages may never run the R3F loop, and the backbuffer reads black
          // without it. Render twice so ping-pong AO/bloom targets settle.
          const w = window as unknown as {
            __scene?: THREE.Scene;
            __cam?: THREE.Camera;
          };
          const comp = composerRef.current as { render?: (dt: number) => void } | null;
          for (let i = 0; i < 2; i++) {
            if (comp?.render) comp.render(0.016);
            else if (w.__scene && w.__cam) gl.render(w.__scene, w.__cam);
          }
          gl.domElement.toBlob((blob) => {
            if (!blob) return;
            fetch(`http://localhost:9977/shot?name=${encodeURIComponent(name)}`, {
              method: 'POST',
              body: blob,
            }).then(() => { document.title = 'POSTED'; });
          }, 'image/png');
        }, 1200);
      }
      if (!capture) return;
      setTimeout(() => {
        const url = gl.domElement.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.png`;
        a.click();
        document.title = 'CAPTURED';
      }, 900);
    }, 1200);
  }, [progress, active, gl, onReady]);

  return null;
}

function App() {
  const [ready, setReady] = useState(false);
  const composerRef = useRef<unknown>(null);
  return (
    <div
      style={{
        width: w,
        height: h,
        background: theme === 'dark' ? '#0a0a0b' : '#fcfcfa',
        position: 'relative',
      }}
      data-ready={ready ? '1' : '0'}
      id="rig"
    >
      <Canvas
        camera={{ fov: conf.fov ?? 35, position: conf.cam, near: 0.1, far: 60 }}
        dpr={dpr}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
          toneMapping:
            params.get('tm') === 'aces'
              ? THREE.ACESFilmicToneMapping
              : theme === 'dark'
                ? THREE.AgXToneMapping
                : THREE.NeutralToneMapping,
          toneMappingExposure: parseFloat(params.get('exp') ?? (theme === 'dark' ? '1.26' : '1.0')),
        }}
        onCreated={({ camera, scene, gl }) => {
          const w = window as unknown as { __scene: THREE.Scene; __cam: THREE.Camera; __gl: THREE.WebGLRenderer };
          w.__scene = scene;
          w.__cam = camera;
          w.__gl = gl; // lets an external driver force a render + readback in a hidden tab
          camera.lookAt(new THREE.Vector3(...conf.look));
          if (params.get('bg') !== 'transparent') {
            scene.background = new THREE.Color(theme === 'dark' ? '#0a0a0b' : '#fcfcfa');
          }
        }}
      >
        <Suspense fallback={null}>
          <Stage theme={theme} floor={theme === 'dark' && params.get('floor') !== '0' ? 'reflect' : 'none'} bakeFrames={Infinity} />
          <ModuleModel theme={theme} url={modelUrl} />
          {/* status LEDs etc. — posters must match frame 1 of the live pages */}
          {theme === 'dark' && !noFx && <SensorFX accent="#ff4d00" />}
          {/* mirrors the live Composer stack (three/Composer.tsx): the AGX
              ToneMapping effect is mandatory — EffectComposer disables the
              renderer's own tonemap — and the vignette lives in page CSS, so
              captures here get none (add it in post if a still needs it) */}
          {theme === 'dark' && !noFx && (
            <EffectComposer ref={composerRef as never} multisampling={4}>
              <N8AO aoRadius={0.5} intensity={3.8} distanceFalloff={0.5} />
              <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.3} intensity={0.5} />
              <ToneMapping mode={ToneMappingMode.AGX} />
            </EffectComposer>
          )}
          <Capturer composerRef={composerRef} onReady={() => setReady(true)} />
        </Suspense>
      </Canvas>
    </div>
  );
}

window.addEventListener('error', (e) => {
  document.title = 'ERR: ' + e.message;
  const pre = document.createElement('pre');
  pre.id = 'errlog';
  pre.textContent = String(e.error?.stack ?? e.message);
  document.body.appendChild(pre);
});
window.addEventListener('unhandledrejection', (e) => {
  document.title = 'REJ: ' + ((e.reason as Error)?.message ?? String(e.reason));
  const pre = document.createElement('pre');
  pre.id = 'errlog';
  pre.textContent = String((e.reason as Error)?.stack ?? e.reason);
  document.body.appendChild(pre);
});

document.body.style.margin = '0';
createRoot(document.getElementById('root')!).render(<App />);
