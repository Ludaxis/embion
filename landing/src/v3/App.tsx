import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer, Bloom, Vignette, N8AO } from '@react-three/postprocessing';
import { getGPUTier } from 'detect-gpu';
import { motion, screenAnchors } from '../lib/motion';
import { prefersReducedMotion } from '../lib/scroll';
import { ModuleModel, EXTRACT_VECTORS } from '../three/ModuleModel';
import { Stage } from '../three/Stage';
import { CameraRig } from '../three/CameraRig';
import { SensorFX } from '../three/SensorFX';
import {
  BRAND, PRODUCT_CODE, CHAPTERS, BUILD_LOG_URL, CONTACT_MAILTO,
} from '../content/product';

const ACCENT = '#ff4d00';

/** Overview pose — model centered, front-facing, like the annotated diagram.
 *  look.y sits above center so the model drops below the page title. */
const OVERVIEW = { cam: [0, 0.4, -5.9] as const, look: [0, 0.28, 0] as const };

/** Camera pose shifted toward where the part sits once extracted, pulled
 *  back ~12% for breathing room around the subject. */
function extractedPose(part: ExplorePart) {
  const v = EXTRACT_VECTORS[part.anchor] ?? [0, 0, 0];
  const look = [
    part.pose.look[0] + v[0] * 0.75,
    part.pose.look[1] + v[1] * 0.75,
    part.pose.look[2] + v[2] * 0.75,
  ] as const;
  const PULL = 1.28;
  const cam = [
    look[0] + (part.pose.cam[0] + v[0] * 0.55 - look[0]) * PULL,
    look[1] + (part.pose.cam[1] + v[1] * 0.55 - look[1]) * PULL,
    look[2] + (part.pose.cam[2] + v[2] * 0.55 - look[2]) * PULL,
  ] as const;
  return { cam, look };
}

type ExplorePart = {
  id: string;
  /** CHAPTERS id for copy */
  chapter: string;
  /** node name used for focus dimming */
  anchor: string;
  /** node name the leader line points at */
  labelAnchor: string;
  label: string;
  side: 'left' | 'right';
  /** label rail position, % of viewport height */
  top: number;
  pose: { cam: [number, number, number]; look: [number, number, number] };
};

const PARTS: ExplorePart[] = [
  {
    id: 'imu', chapter: 'imu', anchor: 'imu', labelAnchor: 'imu',
    label: '10-axis IMU', side: 'left', top: 18,
    pose: { cam: [0.95, 1.9, -1.4], look: [0.02, 0.92, -0.58] },
  },
  {
    id: 'lidar', chapter: 'lidar', anchor: 'lidar-ld19', labelAnchor: 'lidar-ld19',
    label: 'FHL-LD19 2D LiDAR', side: 'left', top: 32,
    pose: { cam: [-1.35, 1.15, -1.95], look: [0.03, 0.62, -0.55] },
  },
  {
    id: 'mics', chapter: 'mics', anchor: 'mic-b', labelAnchor: 'mic-a',
    label: '3 directional microphones', side: 'left', top: 52,
    pose: { cam: [0, 0.32, -3.15], look: [0, 0.0, -0.45] },
  },
  {
    id: 'jetson', chapter: 'jetson', anchor: 'jetson', labelAnchor: 'jetson',
    label: 'Jetson Orin Nano Super 8GB', side: 'right', top: 36,
    pose: { cam: [-2.3, 0.85, 3.1], look: [0.45, -0.28, 0.55] },
  },
  {
    id: 'camera', chapter: 'camera', anchor: 'camera-ar0234', labelAnchor: 'camera-ar0234',
    label: 'AR0234 global-shutter camera', side: 'right', top: 56,
    pose: { cam: [-1.2, -0.7, -1.8], look: [-0.02, -0.42, -0.6] },
  },
  {
    id: 'tof', chapter: 'tof', anchor: 'tof-8x8', labelAnchor: 'tof-8x8',
    label: '8×8 ToF ranging sensor', side: 'right', top: 74,
    pose: { cam: [1.8, -0.85, -2.3], look: [-0.05, -0.92, -1.05] },
  },
];

/** mesh node name → explore part id (for hover/click raycasts) */
const NODE_TO_PART: Record<string, string> = {
  'lidar-ld19': 'lidar',
  imu: 'imu',
  'mic-a': 'mics',
  'mic-b': 'mics',
  'mic-c': 'mics',
  'camera-ar0234': 'camera',
  'tof-8x8': 'tof',
  jetson: 'jetson',
  'housing-rear': 'jetson',
  'shell-rear': 'jetson',
};

const partById = (id: string | null) => PARTS.find((p) => p.id === id) ?? null;
const chapterFor = (p: ExplorePart) => CHAPTERS.find((c) => c.id === p.chapter)!;

function resolvePartFromObject(obj: THREE.Object3D | null): string | null {
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (o.name && NODE_TO_PART[o.name]) return NODE_TO_PART[o.name];
    o = o.parent;
  }
  return null;
}

export function App() {
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [effectsOn, setEffectsOn] = useState(false);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    getGPUTier().then((t) => setEffectsOn((t.tier ?? 0) >= 2 && !t.isMobile));
  }, []);

  // pointer parallax (subtle, desktop only)
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    motion.parallax = 0.035;
    const onMove = (e: PointerEvent) => {
      motion.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      motion.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // initial pose + intro drift
  useEffect(() => {
    if (!loaded) return;
    motion.look.x = OVERVIEW.look[0];
    motion.look.y = OVERVIEW.look[1];
    motion.look.z = OVERVIEW.look[2];
    if (reduced) {
      motion.cam.x = OVERVIEW.cam[0];
      motion.cam.y = OVERVIEW.cam[1];
      motion.cam.z = OVERVIEW.cam[2];
      return;
    }
    gsap.fromTo(
      motion.cam,
      { x: 0.4, y: 1.1, z: -5.3 },
      { x: OVERVIEW.cam[0], y: OVERVIEW.cam[1], z: OVERVIEW.cam[2], duration: 1.7, ease: 'power3.out' },
    );
  }, [loaded, reduced]);

  const flyRef = useRef<{ proxy: { t: number } } | null>(null);

  const flyTo = useCallback(
    (pose: { cam: readonly [number, number, number]; look: readonly [number, number, number] }) => {
      gsap.killTweensOf(motion.cam);
      gsap.killTweensOf(motion.look);
      if (flyRef.current) gsap.killTweensOf(flyRef.current.proxy);
      const d = reduced ? 0 : 1.25;

      gsap.to(motion.look, {
        x: pose.look[0], y: pose.look[1], z: pose.look[2],
        duration: d, ease: 'power3.inOut',
      });

      const from = new THREE.Vector3(motion.cam.x, motion.cam.y, motion.cam.z);
      const to = new THREE.Vector3(pose.cam[0], pose.cam[1], pose.cam[2]);
      const pivot = new THREE.Vector3(
        (motion.look.x + pose.look[0]) / 2,
        (motion.look.y + pose.look[1]) / 2,
        (motion.look.z + pose.look[2]) / 2,
      );
      const a = from.clone().sub(pivot);
      const b = to.clone().sub(pivot);
      const angle = a.angleTo(b);

      if (reduced || angle < 0.9) {
        gsap.to(motion.cam, {
          x: to.x, y: to.y, z: to.z,
          duration: d, ease: 'power3.inOut',
        });
        return;
      }

      // Wide swing: quadratic-bezier arc through an outward control point so
      // the camera orbits AROUND the module instead of diving through it.
      const mid = a.clone().add(b).multiplyScalar(0.5);
      if (mid.length() < 0.4) mid.set(-a.z, Math.max(a.y, b.y), a.x); // near-opposite sides
      mid.setLength(Math.max(a.length(), b.length()) * 1.18).add(pivot);
      const proxy = { t: 0 };
      flyRef.current = { proxy };
      const p = new THREE.Vector3();
      gsap.to(proxy, {
        t: 1,
        duration: d * 1.2,
        ease: 'power2.inOut',
        onUpdate: () => {
          const t = proxy.t;
          const it = 1 - t;
          p.set(
            it * it * from.x + 2 * it * t * mid.x + t * t * to.x,
            it * it * from.y + 2 * it * t * mid.y + t * t * to.y,
            it * it * from.z + 2 * it * t * mid.z + t * t * to.z,
          );
          motion.cam.x = p.x;
          motion.cam.y = p.y;
          motion.cam.z = p.z;
        },
      });
    },
    [reduced],
  );

  const select = useCallback(
    (id: string | null) => {
      setSelected(id);
      setHovered(null);
      const part = partById(id);
      gsap.killTweensOf(motion, 'extract');
      if (part) {
        motion.focus = part.anchor;
        // extraction: tuck the previous part back in, then slide this one out
        const switching =
          motion.extractName && motion.extractName !== part.anchor && motion.extract > 0.01;
        const tl = gsap.timeline();
        if (switching) {
          tl.to(motion, { extract: 0, duration: reduced ? 0 : 0.35, ease: 'power2.in' });
          tl.call(() => { motion.extractName = part.anchor; });
        } else {
          motion.extractName = part.anchor;
        }
        tl.to(
          motion,
          { extract: 1, duration: reduced ? 0 : 1.2, ease: 'back.out(1.15)' },
          switching ? '>' : 0.3,
        );
        flyTo(extractedPose(part));
      } else {
        motion.focus = '';
        gsap.to(motion, { extract: 0, duration: reduced ? 0 : 0.75, ease: 'power3.inOut' });
        flyTo(OVERVIEW);
      }
    },
    [flyTo, reduced],
  );

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  const step = useCallback(
    (dir: 1 | -1) => {
      const idx = PARTS.findIndex((p) => p.id === selected);
      const next = PARTS[(idx + dir + PARTS.length) % PARTS.length];
      select(next.id);
    },
    [selected, select],
  );

  const selectedPart = partById(selected);

  return (
    <div
      className={`explorer ${selected ? 'has-selection' : ''} ${hovered ? 'has-hover' : ''}`}
      data-hovered={hovered ?? ''}
    >
      <Preloader onDone={() => setLoaded(true)} />

      <header className="site-header">
        <a className="brand" href="/v3/">
          {BRAND}<span className="brand-dot">·</span><span className="brand-code">{PRODUCT_CODE}</span>
        </a>
        <nav>
          <a href="/">Story</a>
          <a href="/v2/">Blueprint</a>
          <a href={BUILD_LOG_URL} target="_blank" rel="noreferrer">Build log</a>
        </nav>
        <a className="btn btn-small" href={CONTACT_MAILTO}>Early access</a>
      </header>

      <div className="stage-title">
        <p className="kicker">Hardware</p>
        <h1>Compute platform + sensors.</h1>
        <p className="stage-sub">Click any component to explore it.</p>
      </div>

      <div className="canvas-layer">
        <img
          className="poster"
          src="/posters/poster-dark.webp"
          alt=""
          fetchPriority="high"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          style={{ opacity: loaded ? 0 : 1 }}
        />
        <Canvas
          camera={{ fov: 35, position: [0, 0.12, -4.5], near: 0.1, far: 60 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false,
            toneMapping: THREE.AgXToneMapping,
            toneMappingExposure: 1.22,
          }}
          frameloop={reduced ? 'demand' : 'always'}
          onPointerMissed={() => selected && select(null)}
        >
          <Suspense fallback={null}>
            <Stage theme="dark" floor={effectsOn ? 'reflect' : 'none'} />
            <group
              onPointerMove={(e) => {
                e.stopPropagation();
                setHovered(resolvePartFromObject(e.object));
              }}
              onPointerOut={() => setHovered(null)}
              onClick={(e) => {
                e.stopPropagation();
                const id = resolvePartFromObject(e.object);
                if (id) select(id);
              }}
            >
              <ModuleModel theme="dark" dimStyle="darken" />
            </group>
            <SensorFX accent={ACCENT} />
            <CameraRig />
            {effectsOn && (
              <EffectComposer multisampling={4}>
                <N8AO halfRes aoRadius={0.4} intensity={3.2} distanceFalloff={0.5} />
                <Bloom mipmapBlur luminanceThreshold={1} intensity={0.5} />
                <Vignette darkness={0.5} offset={0.24} />
              </EffectComposer>
            )}
            <Preload all />
          </Suspense>
        </Canvas>
      </div>

      <div className="grain" aria-hidden="true" />

      <Callouts hovered={hovered} onHover={setHovered} onSelect={select} />

      {/* description card */}
      {selectedPart && (
        <aside className="part-card" key={selectedPart.id} aria-live="polite">
          <button className="card-close" onClick={() => select(null)} aria-label="Back to overview">
            ×
          </button>
          <p className="kicker">{chapterFor(selectedPart).kicker}</p>
          <h2>{chapterFor(selectedPart).title}</h2>
          <p className="card-body">{chapterFor(selectedPart).body}</p>
          <ul className="card-specs">
            {chapterFor(selectedPart).specs.map((s) => <li key={s}>{s}</li>)}
          </ul>
          <div className="card-nav">
            <button onClick={() => step(-1)} aria-label="Previous component">←</button>
            <span>{PARTS.findIndex((p) => p.id === selected) + 1} / {PARTS.length}</span>
            <button onClick={() => step(1)} aria-label="Next component">→</button>
          </div>
        </aside>
      )}

      {selected && (
        <button className="overview-pill" onClick={() => select(null)}>
          ← Overview
        </button>
      )}

      {/* SEO / screen-reader full parts list */}
      <section className="sr-only" aria-hidden="false">
        {PARTS.map((p) => {
          const c = chapterFor(p);
          return (
            <article key={p.id}>
              <h2>{p.label} — {c.title}</h2>
              <p>{c.body}</p>
            </article>
          );
        })}
      </section>

      <nav className="version-switch" aria-label="Page versions">
        <a href="/">01</a>
        <a href="/v2/">02</a>
        <span className="vs-active">03</span>
      </nav>
    </div>
  );
}

/** Rail labels + hairline leader lines to the live projected part anchors. */
function Callouts({
  hovered,
  onHover,
  onSelect,
}: {
  hovered: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lineRefs = useRef<Record<string, SVGLineElement | null>>({});
  const dotRefs = useRef<Record<string, SVGCircleElement | null>>({});

  useEffect(() => {
    const tick = () => {
      for (const part of PARTS) {
        const label = labelRefs.current[part.id];
        const line = lineRefs.current[part.id];
        const dot = dotRefs.current[part.id];
        const anchor = screenAnchors[part.labelAnchor];
        if (!label || !line || !dot || !anchor) continue;
        const rect = label.getBoundingClientRect();
        const x1 = part.side === 'left' ? rect.right + 10 : rect.left - 10;
        const y1 = rect.top + rect.height / 2;
        const visible = anchor.visible ? 1 : 0;
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(anchor.x));
        line.setAttribute('y2', String(anchor.y));
        line.style.opacity = String(visible);
        dot.setAttribute('cx', String(anchor.x));
        dot.setAttribute('cy', String(anchor.y));
        dot.style.opacity = String(visible);
      }
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  return (
    <div className="callouts">
      <svg ref={svgRef} className="callout-lines" aria-hidden="true">
        {PARTS.map((p) => (
          <g key={p.id} className={`callout-g ${hovered === p.id ? 'hovered' : ''}`}>
            <line ref={(el) => { lineRefs.current[p.id] = el; }} />
            <circle ref={(el) => { dotRefs.current[p.id] = el; }} r="3" />
          </g>
        ))}
      </svg>
      {PARTS.map((p) => (
        <button
          key={p.id}
          ref={(el) => { labelRefs.current[p.id] = el; }}
          className={`callout-label side-${p.side} ${hovered === p.id ? 'hovered' : ''}`}
          style={{ top: `${p.top}%` }}
          onMouseEnter={() => onHover(p.id)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(p.id)}
          onBlur={() => onHover(null)}
          onClick={() => onSelect(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

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
