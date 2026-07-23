import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Vector3, Quaternion, type Object3D } from 'three';
import gsap from 'gsap';
import { motion, screenAnchors, requestRender } from '../lib/motion';
import { prefersReducedMotion } from '../lib/scroll';
import { getBootState, reportProgress, finishBoot } from '../lib/loadProgress';
import { EXTRACT_VECTORS } from '../three/parts';
import { Preloader } from '../site/Preloader';
import { SceneBoundary } from '../site/SceneBoundary';
import { VersionSwitch } from '../site/chrome';
import {
  BRAND, PRODUCT_CODE, CHAPTERS, NAV, CTA,
} from '../content/product';

// 3D chunk download kicked at module-eval (parallel with hydration + the
// head-preloaded GLB). Browser-gated for the SSG pass; Scene still renders
// only after mount so prerender and hydration agree.
const scenePromise = typeof window !== 'undefined' ? import('./Scene') : null;
const Scene = lazy(() => scenePromise!);

/** Overview pose — model centered, front-facing, like the annotated diagram.
 *  look.y sits above center so the model drops below the page title. */
const OVERVIEW = { cam: [0, 0.4, -5.9] as const, look: [0, 0.28, 0] as const };

/** Portrait screens: pull part close-ups further back so the extracted part
 *  clears the bottom-sheet card (narrow horizontal field at fixed vFOV). */
function portraitPull(): number {
  const a = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.7;
  const t = Math.min(1, Math.max(0, (1.05 - a) / 0.55));
  return 1 + 0.3 * t;
}

/** Camera pose shifted toward where the part sits once extracted, pulled
 *  back ~12% for breathing room around the subject. */
function extractedPose(part: ExplorePart) {
  const v = EXTRACT_VECTORS[part.anchor] ?? [0, 0, 0];
  const look = [
    part.pose.look[0] + v[0] * 0.75,
    part.pose.look[1] + v[1] * 0.75,
    part.pose.look[2] + v[2] * 0.75,
  ] as const;
  const PULL = 1.28 * portraitPull();
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
  'pcb-core': 'jetson', // exposed carrier PCB → compute chapter
  'mount-detail': 'tof', // ToF carrier plate → ToF chapter
};

const partById = (id: string | null) => PARTS.find((p) => p.id === id) ?? null;
const chapterFor = (p: ExplorePart) => CHAPTERS.find((c) => c.id === p.chapter)!;

function resolvePartFromObject(obj: Object3D | null): string | null {
  let o: Object3D | null = obj;
  while (o) {
    if (o.name && NODE_TO_PART[o.name]) return NODE_TO_PART[o.name];
    o = o.parent;
  }
  return null;
}

export function App() {
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHoveredState] = useState<string | null>(null);
  const [ctxLost, setCtxLost] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Card display state is decoupled from selection so the glass panel can
  // animate OUT (and crossfade its content on part switches) instead of
  // hard-cutting while the camera glides back.
  const [displayed, setDisplayed] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const swapRef = useRef<HTMLDivElement>(null);
  const prevDisplayedRef = useRef<string | null>(null);
  const leaveTimerRef = useRef(0);
  const extractSeqRef = useRef<gsap.core.Timeline | null>(null);
  const reduced = prefersReducedMotion();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (reduced) document.documentElement.classList.add('reduced');
    motion.idle = reduced ? 0 : 1;
  }, [reduced]);

  // Boot progress before the 3D chunk reports real bytes.
  useEffect(() => {
    reportProgress(0.04, 'boot');
    scenePromise?.then(() => reportProgress(0.12, 'scene'));
    const id = setInterval(() => {
      const s = getBootState();
      if (s.phase !== 'boot' || s.value >= 0.1) {
        clearInterval(id);
        return;
      }
      reportProgress(s.value + 0.008);
    }, 250);
    return () => clearInterval(id);
  }, []);

  // pointer parallax (subtle, desktop only)
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    motion.parallax = 0.035;
    const onMove = (e: PointerEvent) => {
      motion.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      motion.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      requestRender(); // full-rate parallax under the demand frameloop
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // initial pose + intro drift; the boot overlay lifts as the drift begins
  useEffect(() => {
    if (!loaded) return;
    motion.look.x = OVERVIEW.look[0];
    motion.look.y = OVERVIEW.look[1];
    motion.look.z = OVERVIEW.look[2];
    if (reduced) {
      motion.cam.x = OVERVIEW.cam[0];
      motion.cam.y = OVERVIEW.cam[1];
      motion.cam.z = OVERVIEW.cam[2];
      requestRender(); // demand-mode: force the static overview frame
      finishBoot();
      return;
    }
    gsap.fromTo(
      motion.cam,
      { x: 0.4, y: 1.1, z: -5.3 },
      {
        x: OVERVIEW.cam[0], y: OVERVIEW.cam[1], z: OVERVIEW.cam[2],
        delay: 0.15, duration: 2.1, ease: 'power2.out',
      },
    );
    gsap.set(motion.cam, { x: 0.4, y: 1.1, z: -5.3 });
    finishBoot();
  }, [loaded, reduced]);

  /** hover: DOM state + the 3D material lift share one entry point */
  const setHovered = useCallback((id: string | null) => {
    setHoveredState(id);
    motion.hoverName = id ? partById(id)?.anchor ?? '' : '';
    requestRender();
  }, []);

  const flyRef = useRef<{ proxy: { t: number } } | null>(null);

  const flyTo = useCallback(
    (pose: { cam: readonly [number, number, number]; look: readonly [number, number, number] }) => {
      gsap.killTweensOf(motion.cam);
      gsap.killTweensOf(motion.look);
      if (flyRef.current) gsap.killTweensOf(flyRef.current.proxy);
      const d = reduced ? 0 : 1.25;

      const from = new Vector3(motion.cam.x, motion.cam.y, motion.cam.z);
      const to = new Vector3(pose.cam[0], pose.cam[1], pose.cam[2]);
      const pivot = new Vector3(
        (motion.look.x + pose.look[0]) / 2,
        (motion.look.y + pose.look[1]) / 2,
        (motion.look.z + pose.look[2]) / 2,
      );
      const a = from.clone().sub(pivot);
      const b = to.clone().sub(pivot);
      const angle = a.angleTo(b);
      const wide = !reduced && angle >= 0.9;
      // Aim and position settle on the SAME frame with the SAME velocity
      // profile (the wide orbit runs power2.inOut, so the look tween must
      // too, or the subject drifts off-frame mid-arc).
      const dur = wide ? d * 1.2 : d;

      gsap.to(motion.look, {
        x: pose.look[0], y: pose.look[1], z: pose.look[2],
        duration: dur, ease: wide ? 'power2.inOut' : 'power3.inOut',
      });

      if (!wide) {
        gsap.to(motion.cam, {
          x: to.x, y: to.y, z: to.z,
          duration: dur, ease: 'power3.inOut',
        });
        return;
      }

      // Wide swing: a TRUE constant-radius orbit around the module — slerp the
      // pivot-relative offset direction and lerp the radius separately.
      const lenA = a.length();
      const lenB = b.length();
      const dirA = a.clone().normalize();
      const dirB = b.clone().normalize();
      const axis = new Vector3().crossVectors(dirA, dirB);
      if (axis.lengthSq() < 1e-6) axis.set(0, 1, 0);
      else axis.normalize();
      const q = new Quaternion();
      const dir = new Vector3();
      const proxy = { t: 0 };
      flyRef.current = { proxy };
      gsap.to(proxy, {
        t: 1,
        duration: dur,
        ease: 'power2.inOut',
        onUpdate: () => {
          q.setFromAxisAngle(axis, angle * proxy.t);
          dir.copy(dirA).applyQuaternion(q);
          const r = lenA + (lenB - lenA) * proxy.t;
          motion.cam.x = pivot.x + dir.x * r;
          motion.cam.y = pivot.y + dir.y * r;
          motion.cam.z = pivot.z + dir.z * r;
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
      // One owner for the extraction sequence: killing the whole timeline also
      // kills any pending .call(), which used to survive killTweensOf and pop
      // the WRONG part out during rapid clicks.
      extractSeqRef.current?.kill();
      const seq = gsap.timeline();
      extractSeqRef.current = seq;
      // any user drag eases home so selection poses stay calibrated
      gsap.to(motion, { spinDrag: 0, duration: reduced ? 0 : 0.8, ease: 'power3.out' });
      if (part) {
        motion.focus = part.anchor;
        const switching =
          motion.extractName && motion.extractName !== part.anchor && motion.extract > 0.01;
        if (switching) {
          seq.to(motion, { extract: 0, duration: reduced ? 0 : 0.5, ease: 'power2.inOut' });
          seq.call(() => { motion.extractName = part.anchor; });
        } else {
          motion.extractName = part.anchor;
        }
        seq.to(
          motion,
          // decisive machined move: fast break-away, firm level arrival
          { extract: 1, duration: reduced ? 0 : 1.05, ease: 'embMech' },
          switching ? '>' : 0.3,
        );
        flyTo(extractedPose(part));
      } else {
        motion.focus = '';
        seq.to(motion, { extract: 0, duration: reduced ? 0 : 0.9, ease: 'power3.inOut' });
        flyTo(OVERVIEW);
      }

      // ---- card display choreography ----
      window.clearTimeout(leaveTimerRef.current);
      if (id) {
        setLeaving(false);
        if (displayed && displayed !== id && swapRef.current && !reduced) {
          // crossfade content inside the persistent glass shell; kill any
          // in-flight swap tween first so rapid clicks can't queue stale
          // setDisplayed calls or fight the fade-in
          gsap.killTweensOf(swapRef.current);
          gsap.to(swapRef.current, {
            autoAlpha: 0,
            y: -8,
            duration: 0.16,
            ease: 'power1.in',
            overwrite: 'auto',
            onComplete: () => setDisplayed(id),
          });
        } else {
          setDisplayed(id);
        }
      } else if (displayed) {
        setLeaving(true);
        leaveTimerRef.current = window.setTimeout(() => {
          setDisplayed(null);
          setLeaving(false);
        }, reduced ? 0 : 280);
      }
    },
    [flyTo, reduced, displayed, setHovered],
  );

  // content fade-in after a crossfade swap (not on first mount — the card's
  // own entrance animation covers that)
  useEffect(() => {
    const prev = prevDisplayedRef.current;
    prevDisplayedRef.current = displayed;
    if (!displayed || !prev || prev === displayed || !swapRef.current || reduced) return;
    gsap.killTweensOf(swapRef.current);
    gsap.fromTo(
      swapRef.current,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [displayed, reduced]);

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

  // ---- drag-to-orbit (overview only) ----
  const dragRef = useRef({ active: false, lastX: 0, moved: 0, captured: false });
  const canDrag = !selected && !reduced;
  const onDragDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canDrag || !loaded) return;
      dragRef.current = { active: true, lastX: e.clientX, moved: 0, captured: false };
      gsap.killTweensOf(motion, 'spinDrag');
    },
    [canDrag, loaded],
  );
  const onDragMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.lastX;
    d.lastX = e.clientX;
    d.moved += Math.abs(dx);
    // Capture only once it's clearly a drag: capturing on pointerdown would
    // retarget pointerup away from the canvas and kill R3F click selection;
    // capturing here keeps the drag alive across the overlay UI it crosses.
    if (!d.captured && d.moved > 4) {
      d.captured = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    motion.spinDrag += dx * 0.005;
    requestRender();
  }, []);
  const onDragEnd = useCallback(() => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    // ease home so labels/poses stay calibrated; a tap (no travel) does nothing
    gsap.to(motion, { spinDrag: 0, duration: 1.6, ease: 'power3.out', delay: 0.6 });
    // the click event (if any) fires after pointerup in the same task —
    // clear the drag flag right after so it can't suppress FUTURE clicks
    setTimeout(() => {
      dragRef.current.moved = 0;
    }, 0);
  }, []);
  /** clicks that were actually drags must not select a part */
  const wasDrag = () => dragRef.current.moved > 6;

  const displayedPart = partById(displayed);

  return (
    <div
      className={`explorer ${selected ? 'has-selection' : ''} ${hovered ? 'has-hover' : ''} ${canDrag ? 'can-drag' : ''}`}
      data-hovered={hovered ?? ''}
    >
      <Preloader brand={BRAND} />
      <header className="site-header">
        <a className="brand" href="/v3/">
          {BRAND}<span className="brand-dot">·</span><span className="brand-code">{PRODUCT_CODE}</span>
        </a>
        <nav>
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>{item.label}</a>
          ))}
        </nav>
        <a className="btn btn-small" href={CTA.primaryHref}>{CTA.primaryShort}</a>
      </header>

      <div className="stage-title">
        <p className="kicker">Hardware</p>
        <h1>Compute platform + sensors.</h1>
        <p className="stage-sub">Click any component to explore it. Drag to rotate.</p>
      </div>

      <div
        className="canvas-layer"
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerLeave={onDragEnd}
      >
        <img
          className="poster"
          src="/posters/explorer.v7.webp"
          alt=""
          fetchPriority="high"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          style={{ opacity: loaded && !ctxLost ? 0 : 1 }}
        />
        {mounted && (
          <SceneBoundary
            onFail={() => {
              // degraded mode: poster + labels stay; the overlay lifts
              setCtxLost(true);
              setLoaded(true);
            }}
          >
            <Suspense fallback={null}>
              <Scene
                reduced={reduced}
                onLoaded={() => setLoaded(true)}
                onCtxLost={() => setCtxLost(true)}
                onCtxRestored={() => setCtxLost(false)}
                onPointerMissed={() => !wasDrag() && selected && select(null)}
                onHoverObject={(obj) => {
                  if (!dragRef.current.active) setHovered(resolvePartFromObject(obj));
                }}
                onClickObject={(obj) => {
                  if (wasDrag()) return;
                  const id = resolvePartFromObject(obj);
                  if (id) select(id);
                }}
              />
            </Suspense>
          </SceneBoundary>
        )}
      </div>

      <div className="grain" aria-hidden="true" />

      <Callouts hovered={hovered} onHover={setHovered} onSelect={select} />

      {/* description card — persistent shell, animated exit, content crossfade */}
      {displayedPart && (
        <aside className={`part-card ${leaving ? 'leaving' : ''}`} aria-live="polite">
          <button className="card-close" onClick={() => select(null)} aria-label="Back to overview">
            ×
          </button>
          <div className="card-swap" ref={swapRef}>
            <p className="kicker">{chapterFor(displayedPart).kicker}</p>
            <h2>{chapterFor(displayedPart).title}</h2>
            <p className="card-body">{chapterFor(displayedPart).body}</p>
            <ul className="card-specs">
              {chapterFor(displayedPart).specs.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
          <div className="card-nav">
            <button onClick={() => step(-1)} aria-label="Previous component">←</button>
            <span>
              {Math.max(1, PARTS.findIndex((p) => p.id === (selected ?? displayed)) + 1)} / {PARTS.length}
            </span>
            <button onClick={() => step(1)} aria-label="Next component">→</button>
          </div>
        </aside>
      )}

      {displayedPart && (
        <button
          className={`overview-pill ${leaving ? 'leaving' : ''}`}
          onClick={() => select(null)}
        >
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

      <VersionSwitch current="explorer" />
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
  const edgeRefs = useRef<Record<string, { x1: number; y1: number }>>({});
  const opRefs = useRef<Record<string, number>>({});
  const lastT = useRef(0);

  // Label rail positions are static except on resize/hover, so measure the
  // leader-line start points on layout change — not every frame (was a
  // getBoundingClientRect per part per frame = 6 forced layouts/frame).
  useEffect(() => {
    const measure = () => {
      for (const part of PARTS) {
        const label = labelRefs.current[part.id];
        if (!label) continue;
        const rect = label.getBoundingClientRect();
        edgeRefs.current[part.id] = {
          x1: part.side === 'left' ? rect.right + 10 : rect.left - 10,
          y1: rect.top + rect.height / 2,
        };
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('resize', measure);
    // remeasure once fonts settle so the edge points aren't off by the FOUT
    document.fonts?.ready.then(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [hovered]);

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - (lastT.current || now)) / 1000);
      lastT.current = now;
      for (const part of PARTS) {
        const line = lineRefs.current[part.id];
        const dot = dotRefs.current[part.id];
        const anchor = screenAnchors[part.labelAnchor];
        const edge = edgeRefs.current[part.id];
        if (!line || !dot || !anchor || !edge) continue;
        // Damped fade, not a binary opacity pop, when a part rotates behind the
        // module. Time-based so the feel is identical at 60 and 120 Hz.
        const target = anchor.visible ? 1 : 0;
        const cur = opRefs.current[part.id] ?? 0;
        const op = cur + (target - cur) * (1 - Math.exp(-dt * 11));
        opRefs.current[part.id] = op;
        line.setAttribute('x1', String(edge.x1));
        line.setAttribute('y1', String(edge.y1));
        line.setAttribute('x2', String(anchor.x));
        line.setAttribute('y2', String(anchor.y));
        line.style.opacity = op.toFixed(3);
        dot.setAttribute('cx', String(anchor.x));
        dot.setAttribute('cy', String(anchor.y));
        dot.style.opacity = op.toFixed(3);
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
