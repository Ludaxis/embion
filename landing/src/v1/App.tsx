import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, N8AO } from '@react-three/postprocessing';
import { getGPUTier } from 'detect-gpu';
import { useGSAP } from '@gsap/react';
import { gsap, ScrollTrigger, initScroll, prefersReducedMotion } from '../lib/scroll';
import { motion } from '../lib/motion';
import { ModuleModel } from '../three/ModuleModel';
import { Stage } from '../three/Stage';
import { CameraRig } from '../three/CameraRig';
import { SensorFX } from '../three/SensorFX';
import { FrameloopGate } from './FrameloopGate';
import { Callouts } from './Callouts';
import { AfterTrack } from './Sections';
import {
  BRAND, PRODUCT_CODE, PRODUCT_NAME, HERO, PHILOSOPHY, STATS, CHAPTERS,
  BUILD_LOG_URL, CONTACT_MAILTO,
} from '../content/product';

gsap.registerPlugin(useGSAP);

const ACCENT = '#ff4d00';

/** Camera beats: hero, manifesto, then one per chapter. Front of device = -z. */
const BEATS: { cam: [number, number, number]; look: [number, number, number] }[] = [
  { cam: [-0.3, 0.02, -4.45], look: [0.42, 0.02, 0] },   // hero
  { cam: [0.55, 0.45, -4.7], look: [0, 0.1, 0] },      // manifesto (recede + dim)
  { cam: [-1.35, 1.15, -1.95], look: [0.03, 0.62, -0.55] },  // lidar
  { cam: [0.95, 1.9, -1.4], look: [0.02, 0.92, -0.58] },     // imu
  { cam: [0, 0.32, -3.15], look: [0, 0.0, -0.45] },          // mics
  { cam: [-1.2, -0.7, -1.8], look: [-0.02, -0.42, -0.6] },   // camera
  { cam: [0.9, -1.35, -1.75], look: [-0.02, -0.78, -0.7] },  // tof
  { cam: [-2.3, 0.85, 3.1], look: [0.45, -0.28, 0.55] },     // jetson (rear-left)
  { cam: [0, 0.5, 4.6], look: [0, 0, 0] },                   // fusion (spin π)
];

export function App() {
  const [loaded, setLoaded] = useState(false);
  const [effectsOn, setEffectsOn] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    getGPUTier().then((t) => setEffectsOn((t.tier ?? 0) >= 2 && !t.isMobile));
    if (reduced) document.documentElement.classList.add('reduced');
  }, [reduced]);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const onMove = (e: PointerEvent) => {
      motion.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      motion.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useGSAP(
    () => {
      if (!loaded || reduced) return;
      initScroll();

      // Intro flight into the hero pose.
      gsap.fromTo(
        motion.cam,
        { x: 0.9, y: 1.7, z: -5.4 },
        { ...vec(BEATS[0].cam), duration: 1.9, ease: 'power3.out' },
      );
      gsap.fromTo(
        motion.look,
        { x: 0, y: 0.4, z: 0 },
        { ...vec(BEATS[0].look), duration: 1.9, ease: 'power3.out' },
      );

      // Master camera timeline scrubbed across the whole track.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#track',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
          snap: {
            snapTo: 'labelsDirectional',
            duration: { min: 0.2, max: 0.55 },
            delay: 0.12,
            ease: 'power2.inOut',
          },
        },
      });
      tl.addLabel('beat0', 0);
      BEATS.forEach((b, i) => {
        if (i === 0) return;
        tl.to(motion.cam, { ...vec(b.cam), duration: 0.6, ease: 'power2.inOut' }, i - 0.6);
        tl.to(motion.look, { ...vec(b.look), duration: 0.6, ease: 'power2.inOut' }, '<');
        tl.addLabel(`beat${i}`, i);
      });
      // Fusion turntable: the module turns to face you (beat 7 → 8 only).
      tl.to(motion, { spin: Math.PI, duration: 1, ease: 'power1.inOut' }, BEATS.length - 2);
      tl.to({}, { duration: 0.001 }, BEATS.length - 1); // pad so last label sticks

      // Hero copy fades up and away.
      gsap.to('.hero-inner', {
        opacity: 0,
        y: -70,
        ease: 'none',
        scrollTrigger: { trigger: '.beat-hero', start: 'top top', end: '75% top', scrub: true },
      });

      // Chapter activation: focus part + reveal card.
      gsap.utils.toArray<HTMLElement>('.chapter').forEach((section) => {
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

      // Manifesto reveal + stat count-up.
      ScrollTrigger.create({
        trigger: '.beat-manifesto',
        start: 'top 60%',
        end: 'bottom 40%',
        onToggle: (self) => {
          document.querySelector('.manifesto')?.classList.toggle('active', self.isActive);
          // '__dim__' matches no part, so the whole module recedes.
          if (self.isActive) motion.focus = '__dim__';
          else if (motion.focus === '__dim__') motion.focus = '';
        },
        onEnter: () => {
          gsap.utils.toArray<HTMLElement>('.stat-value').forEach((el) => {
            const target = parseFloat(el.dataset.value!);
            const obj = { v: 0 };
            gsap.to(obj, {
              v: target,
              duration: 1.1,
              ease: 'power2.out',
              onUpdate: () => { el.textContent = String(Math.round(obj.v)); },
            });
          });
        },
        once: false,
      });

      // Header goes solid after the hero.
      ScrollTrigger.create({
        start: 'top -120',
        toggleClass: { targets: 'body', className: 'scrolled' },
      });

      // After-track reveals.
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 42,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none reverse' },
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
        <a className="brand" href="/">
          {BRAND}<span className="brand-dot">·</span><span className="brand-code">{PRODUCT_CODE}</span>
        </a>
        <nav>
          <a href="#specs">Specs</a>
          <a href="#faq">FAQ</a>
          <a href="/v3/">Explore 3D</a>
          <a href={BUILD_LOG_URL} target="_blank" rel="noreferrer">Build log</a>
        </nav>
        <a className="btn btn-small" href={CONTACT_MAILTO}>Early access</a>
      </header>

      {/* Fixed 3D layer */}
      <div className="canvas-layer" aria-hidden="true">
        <img
          className="poster"
          src="/posters/poster-dark.webp"
          alt=""
          fetchPriority="high"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          style={{ opacity: loaded ? 0 : 1 }}
        />
        <Canvas
          camera={{ fov: 35, position: [0, 0.05, -4.1], near: 0.1, far: 60 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false,
            toneMapping: THREE.AgXToneMapping,
            toneMappingExposure: 1.22,
          }}
          frameloop={reduced ? 'demand' : 'always'}
        >
          <Suspense fallback={null}>
            <Stage theme="dark" floor={effectsOn ? 'reflect' : 'none'} />
            <ModuleModel theme="dark" dimStyle="darken" />
            <SensorFX accent={ACCENT} />
            <CameraRig />
            <FrameloopGate />
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
        <div className="grain" />
      </div>

      <Callouts />

      {/* ---- Scroll track: 9 beats ---- */}
      <main id="track">
        <section className="beat beat-hero">
          <div className="hero-inner">
            <p className="hero-kicker">{PRODUCT_CODE} · {PRODUCT_NAME}</p>
            <h1>
              <span>{HERO.h1a}</span>
              <span className="hero-accent">{HERO.h1b}</span>
            </h1>
            <p className="hero-sub">{HERO.sub}</p>
            <div className="hero-ctas">
              <a className="btn" href={CONTACT_MAILTO}>{HERO.ctaPrimary}</a>
              <a className="btn btn-ghost" href={BUILD_LOG_URL} target="_blank" rel="noreferrer">
                {HERO.ctaSecondary}
              </a>
            </div>
            <div className="scroll-hint" aria-hidden="true">
              <span>Scroll</span>
              <div className="scroll-hint-line" />
            </div>
          </div>
        </section>

        <section className="beat beat-manifesto">
          <div className="manifesto">
            <p className="kicker">{PHILOSOPHY.kicker}</p>
            <p className="manifesto-line">{PHILOSOPHY.line}</p>
            <div className="stats-row">
              {STATS.map((s) => (
                <div className="stat" key={s.label}>
                  <div className="stat-num">
                    <span className="stat-value" data-value={s.value}>{s.value}</span>
                    <span className="stat-unit">{s.unit}</span>
                  </div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {CHAPTERS.map((c) => (
          <section className={`beat chapter side-${c.side}`} key={c.id} data-anchor={c.anchor} data-chapter={c.id}>
            <div className="chapter-card">
              <p className="kicker">{c.kicker}</p>
              <h2>{c.title}</h2>
              <p className="chapter-body">{c.body}</p>
              <ul className="chapter-specs">
                {c.specs.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          </section>
        ))}
      </main>

      <AfterTrack />

      <nav className="version-switch" aria-label="Page versions">
        <span className="vs-current">01 Noir</span>
        <a className="vs-other" href="/v2/">02</a>
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
