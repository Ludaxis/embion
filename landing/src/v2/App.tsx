import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { useGSAP } from '@gsap/react';
import { gsap, ScrollTrigger, initScroll, prefersReducedMotion } from '../lib/scroll';
import { motion } from '../lib/motion';
import { ModuleModel } from '../three/ModuleModel';
import { Stage } from '../three/Stage';
import { CameraRig } from '../three/CameraRig';
import { Callouts } from './Callouts';
import { AfterTrack } from '../v1/Sections';
import {
  BRAND, PRODUCT_CODE, PRODUCT_NAME, HERO, STATS, CHAPTERS,
  BUILD_LOG_URL, CONTACT_MAILTO,
} from '../content/product';

gsap.registerPlugin(useGSAP);

/** Beats: hero + 7 chapters. Camera stays on the front-left so the model
 *  sits right of the text rail; explode drives the story. */
const BEATS: {
  cam: [number, number, number];
  look: [number, number, number];
  explode: number;
}[] = [
  { cam: [-2.35, 0.42, -4.35], look: [0.28, 0.0, 0], explode: 0 },       // hero
  { cam: [-2.2, 1.0, -2.95], look: [0.1, 0.9, -0.7], explode: 0.45 },   // lidar
  { cam: [-1.9, 1.55, -2.6], look: [0.12, 1.6, -0.73], explode: 0.75 }, // imu
  { cam: [-2.6, 0.35, -3.6], look: [0.1, 0.05, -0.5], explode: 1 },     // mics
  { cam: [-1.85, -0.3, -2.75], look: [0.12, -0.42, -1.25], explode: 1 },// camera
  { cam: [-1.75, -0.95, -2.6], look: [0.12, -1.0, -1.55], explode: 1 }, // tof
  { cam: [2.6, 0.95, 3.55], look: [-1.35, 0.45, 1.35], explode: 1 },    // jetson (rear view)
  { cam: [-2.35, 0.42, -4.35], look: [0.28, 0.0, 0], explode: 0 },       // reassemble
];

export function App() {
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (reduced) document.documentElement.classList.add('reduced');
  }, [reduced]);

  // Drag-to-rotate on the hero (pointer: fine and coarse both welcome).
  useEffect(() => {
    if (reduced) return;
    const hero = document.querySelector<HTMLElement>('.v2-hero');
    if (!hero) return;
    let dragging = false;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('a, button')) return;
      dragging = true;
      lastX = e.clientX;
      hero.classList.add('dragging');
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      motion.spinDrag += (e.clientX - lastX) * 0.006;
      lastX = e.clientX;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      hero.classList.remove('dragging');
      gsap.to(motion, { spinDrag: 0, duration: 1.1, ease: 'power3.out' });
    };
    hero.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    return () => {
      hero.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [reduced]);

  useGSAP(
    () => {
      if (!loaded || reduced) return;
      initScroll();

      gsap.fromTo(
        motion.cam,
        { x: -3.4, y: 1.3, z: -4.6 },
        { ...vec(BEATS[0].cam), duration: 1.6, ease: 'power3.out' },
      );
      gsap.set(motion.look, vec(BEATS[0].look));

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#track',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
          snap: {
            snapTo: 'labelsDirectional',
            duration: { min: 0.2, max: 0.5 },
            delay: 0.12,
            ease: 'power2.inOut',
          },
        },
      });
      tl.addLabel('beat0', 0);
      BEATS.forEach((b, i) => {
        if (i === 0) return;
        tl.to(motion.cam, { ...vec(b.cam), duration: 0.62, ease: 'power2.inOut' }, i - 0.62);
        tl.to(motion.look, { ...vec(b.look), duration: 0.62, ease: 'power2.inOut' }, '<');
        tl.to(motion, { explode: b.explode, duration: 0.62, ease: 'power2.inOut' }, '<');
        tl.addLabel(`beat${i}`, i);
      });
      tl.to({}, { duration: 0.001 }, BEATS.length - 1);

      gsap.to('.v2-hero-inner', {
        opacity: 0,
        y: -50,
        ease: 'none',
        scrollTrigger: { trigger: '.v2-hero', start: 'top top', end: '70% top', scrub: true },
      });

      gsap.utils.toArray<HTMLElement>('.step').forEach((section) => {
        const anchor = section.dataset.anchor!;
        ScrollTrigger.create({
          trigger: section,
          start: 'top 62%',
          end: 'bottom 42%',
          onToggle: (self) => {
            if (self.isActive) {
              motion.focus = anchor;
              section.classList.add('active');
            } else {
              section.classList.remove('active');
              if (motion.focus === anchor) motion.focus = '';
            }
          },
        });
      });

      ScrollTrigger.create({
        start: 'top -120',
        toggleClass: { targets: 'body', className: 'scrolled' },
      });

      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 30,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
        });
      });

      ScrollTrigger.refresh();
    },
    { scope: rootRef, dependencies: [loaded, reduced] },
  );

  return (
    <div ref={rootRef}>
      <Preloader onDone={() => setLoaded(true)} />
      <a className="skip-link" href="#after-track">Skip 3D tour</a>

      <header className="site-header">
        <a className="brand" href="/v2/">
          {BRAND}<span className="brand-dot">/</span><span className="brand-code">{PRODUCT_CODE} · REV A</span>
        </a>
        <nav>
          <a href="#specs">Specs</a>
          <a href="#faq">FAQ</a>
          <a href="/v3/">Explore 3D</a>
          <a href={BUILD_LOG_URL} target="_blank" rel="noreferrer">Build log</a>
        </nav>
        <a className="btn btn-small" href={CONTACT_MAILTO}>Early access</a>
      </header>

      <div className="canvas-layer" aria-hidden="true">
        <img
          className="poster"
          src="/posters/poster-light.webp"
          alt=""
          fetchPriority="high"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          style={{ opacity: loaded ? 0 : 1 }}
        />
        <Canvas
          camera={{ fov: 35, position: [-2.4, 0.35, -3.4], near: 0.1, far: 60 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false,
            toneMapping: THREE.NeutralToneMapping,
          }}
          frameloop={reduced ? 'demand' : 'always'}
        >
          <Suspense fallback={null}>
            <Stage theme="light" />
            <ModuleModel theme="light" dimStyle="fade" />
            <CameraRig />
            <Preload all />
          </Suspense>
        </Canvas>
        {/* drafting registration marks */}
        <div className="reg-mark reg-tl">+</div>
        <div className="reg-mark reg-tr">+</div>
        <div className="reg-mark reg-bl">+</div>
        <div className="reg-mark reg-br">+</div>
      </div>

      <Callouts />

      <main id="track">
        <section className="beat v2-hero">
          <div className="v2-hero-inner">
            <div className="titleblock">
              <span>DWG {PRODUCT_CODE}-A</span>
              <span>SCALE 1:1</span>
              <span>SHEET 1/2</span>
            </div>
            <p className="hero-kicker">{PRODUCT_CODE} · {PRODUCT_NAME}</p>
            <h1>
              {HERO.h1a} {HERO.h1b}
            </h1>
            <p className="hero-sub">{HERO.sub}</p>
            <div className="hero-ctas">
              <a className="btn" href={CONTACT_MAILTO}>{HERO.ctaPrimary}</a>
              <a className="btn btn-ghost" href={BUILD_LOG_URL} target="_blank" rel="noreferrer">
                {HERO.ctaSecondary}
              </a>
            </div>
            <p className="drag-hint">[ drag model to rotate · scroll to disassemble ]</p>
            <div className="hero-stats">
              {STATS.map((s) => (
                <div className="hstat" key={s.label}>
                  <span className="hstat-num">{s.value}{s.unit && <em>{s.unit}</em>}</span>
                  <span className="hstat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {CHAPTERS.map((c, i) => (
          <section className="beat step" key={c.id} data-anchor={c.anchor} data-chapter={c.id}>
            <div className="step-card">
              <div className="step-head">
                <span className="step-index">{String(i + 1).padStart(2, '0')} / {String(CHAPTERS.length).padStart(2, '0')}</span>
                <span className="step-ref">REF {c.anchor.toUpperCase()}</span>
              </div>
              <h2>{c.title}</h2>
              <p className="step-body">{c.body}</p>
              <table className="step-specs">
                <tbody>
                  {c.specs.map((s, j) => (
                    <tr key={s}>
                      <td>{String.fromCharCode(65 + j)}</td>
                      <td>{s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </main>

      <AfterTrack />

      <nav className="version-switch" aria-label="Page versions">
        <a className="vs-other" href="/">01</a>
        <span className="vs-current">02 Blueprint</span>
        <a className="vs-other" href="/v3/">03</a>
      </nav>
    </div>
  );
}

function vec(a: [number, number, number]) {
  return { x: a[0], y: a[1], z: a[2] };
}

function Preloader({ onDone }: { onDone: () => void }) {
  const { progress, active } = useProgress();
  const [gone, setGone] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!doneRef.current && progress >= 100 && !active) {
      doneRef.current = true;
      onDone();
      const t = setTimeout(() => setGone(true), 600);
      return () => clearTimeout(t);
    }
  }, [progress, active, onDone]);

  if (gone) return null;
  return (
    <div className={`preloader ${doneRef.current ? 'preloader-out' : ''}`}>
      <div className="preloader-brand">{BRAND} / {PRODUCT_CODE}</div>
      <div className="preloader-value">{String(Math.round(progress)).padStart(3, '0')}</div>
      <div className="preloader-bar">
        <div className="preloader-fill" style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
    </div>
  );
}
