import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, ScrollTrigger, initScroll, prefersReducedMotion } from '../lib/scroll';
import { motion, requestRender } from '../lib/motion';
import { EXTRACT_VECTORS } from '../three/parts';
import { Callouts } from './Callouts';
import { AfterTrack } from './Sections';
import { track, VersionSwitch } from '../site/chrome';
import {
  BRAND, PRODUCT_CODE, PRODUCT_NAME, HERO, PHILOSOPHY, STATS, CHAPTERS,
  NAV, CTA,
} from '../content/product';

// The whole 3D layer is lazy so first paint = hero DOM + poster off a tiny
// bundle; the ~three/drei/postprocessing chunk streams in after. It renders
// only after mount (see `mounted`), which also keeps the build-time prerender
// and the client's hydration pass in agreement: neither renders the Suspense
// boundary, so renderToString never emits an errored boundary marker.
const Scene = lazy(() => import('./Scene'));

gsap.registerPlugin(useGSAP);

const ACCENT = '#ff4d00';

/** Extraction-adjusted chapter shot (same math the scrub timeline uses). */
function staticTarget(b: { cam: [number, number, number]; look: [number, number, number] }, i: number) {
  const cam = vec(b.cam);
  const look = vec(b.look);
  const anchor = i >= 2 ? CHAPTERS[i - 2]?.anchor : undefined;
  const ev = anchor && anchor !== 'chassis-upper' ? EXTRACT_VECTORS[anchor] : undefined;
  if (ev) {
    cam.x += ev[0] * 0.33; cam.y += ev[1] * 0.33; cam.z += ev[2] * 0.33;
    look.x += ev[0] * 0.47; look.y += ev[1] * 0.47; look.z += ev[2] * 0.47;
  }
  return { cam, look };
}

/** Camera beats: hero, manifesto, then one per chapter. Front of device = -z. */
const BEATS: { cam: [number, number, number]; look: [number, number, number] }[] = [
  { cam: [-0.35, 0.05, -5.8], look: [0.42, 0.0, 0] },    // hero
  { cam: [0.6, 0.5, -5.7], look: [0, 0.1, 0] },        // manifesto (recede + dim)
  { cam: [-1.35, 1.15, -1.95], look: [0.03, 0.62, -0.55] },  // lidar
  { cam: [0.95, 1.9, -1.4], look: [0.02, 0.92, -0.58] },     // imu
  { cam: [0, 0.32, -3.15], look: [0, 0.0, -0.45] },          // mics
  { cam: [-1.2, -0.7, -1.8], look: [-0.02, -0.42, -0.6] },   // camera
  { cam: [0.9, -1.35, -1.75], look: [-0.02, -0.78, -0.7] },  // tof
  { cam: [-2.3, 0.85, 3.1], look: [0.45, -0.28, 0.55] },     // jetson (rear-left)
  { cam: [0, 0.55, 5.4], look: [0, 0, 0] },                  // fusion (spin π)
];

export function App() {
  const [loaded, setLoaded] = useState(false);
  const [ctxLost, setCtxLost] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
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
      if (!loaded) return;
      if (reduced) {
        // Static mode: no smoothing, no scrub — each chapter instantly
        // composes its shot so the page still tells the story.
        gsap.set(motion.cam, vec(BEATS[0].cam));
        gsap.set(motion.look, vec(BEATS[0].look));
        requestRender();
        gsap.utils.toArray<HTMLElement>('.chapter').forEach((section, ci) => {
          const anchor = section.dataset.anchor!;
          ScrollTrigger.create({
            trigger: section,
            start: 'top 62%',
            end: 'bottom 42%',
            onToggle: (self) => {
              if (!self.isActive) return;
              motion.focus = anchor;
              motion.extractName = anchor !== 'chassis-upper' ? anchor : '';
              motion.extract = anchor !== 'chassis-upper' ? 0.55 : 0;
              const b = BEATS[ci + 2];
              const { cam, look } = staticTarget(b, ci + 2);
              gsap.set(motion.cam, cam);
              gsap.set(motion.look, look);
              requestRender();
            },
          });
        });
        return;
      }
      initScroll();

      // Intro flight into the hero pose. The scrub timeline kills it on its
      // first update, or the intro's tail would stomp scrolled camera values.
      const introCam = gsap.fromTo(
        motion.cam,
        { x: 0.9, y: 1.7, z: -6.8 },
        { ...vec(BEATS[0].cam), duration: 1.9, ease: 'power3.out' },
      );
      const introLook = gsap.fromTo(
        motion.look,
        { x: 0, y: 0.4, z: 0 },
        { ...vec(BEATS[0].look), duration: 1.9, ease: 'power3.out' },
      );

      // Master camera timeline scrubbed across the whole track.
      // ?qa=1 disables snapping so QA can freeze arbitrary scrub states.
      const qa = new URLSearchParams(location.search).get('qa') === '1';
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#track',
          start: 'top top',
          end: 'bottom bottom',
          // Lighter than the old scrub:1 so the camera catch-up (already smoothed
          // once by Lenis lerp:0.11) doesn't compound into elastic latency.
          scrub: 0.6,
          onUpdate: (self) => {
            // On the first REAL scroll, hand the intro off to the scrub by simply
            // killing it (leaving the camera where it is) rather than force-
            // completing to progress(1), which teleported the hero pose in one
            // frame. Gated on progress so a load-time refresh() can't nuke it.
            if (self.progress > 0.0002 && (introCam.isActive() || introLook.isActive())) {
              introCam.kill();
              introLook.kill();
            }
          },
          snap: qa
            ? undefined
            : {
                snapTo: 'labelsDirectional',
                // Later + shorter so the snap settles AFTER the scrub catch-up
                // instead of fighting it (the old delay:0.12 yanked mid-read).
                duration: { min: 0.2, max: 0.4 },
                delay: 0.3,
                ease: 'power2.inOut',
              },
        },
      });
      tl.addLabel('beat0', 0);
      // Chapters extract their part by 0.55 along its explode vector, so the
      // camera must aim at the EXTRACTED position, not the seated one.
      const EXTRACT_K = 0.55;
      const chapterTarget = (b: (typeof BEATS)[number], i: number) => {
        const cam = vec(b.cam);
        const look = vec(b.look);
        const anchor = i >= 2 ? CHAPTERS[i - 2]?.anchor : undefined;
        const ev = anchor && anchor !== 'chassis-upper' ? EXTRACT_VECTORS[anchor] : undefined;
        if (ev) {
          cam.x += ev[0] * EXTRACT_K * 0.6;
          cam.y += ev[1] * EXTRACT_K * 0.6;
          cam.z += ev[2] * EXTRACT_K * 0.6;
          look.x += ev[0] * EXTRACT_K * 0.85;
          look.y += ev[1] * EXTRACT_K * 0.85;
          look.z += ev[2] * EXTRACT_K * 0.85;
        }
        return { cam, look };
      };
      BEATS.forEach((b, i) => {
        if (i === 0) return;
        const { cam, look } = chapterTarget(b, i);
        if (i === 7) {
          // tof -> jetson crosses to the rear: sweep AROUND the left side
          // instead of cutting through the module's near field.
          tl.to(motion.cam, { x: -3.4, y: -0.2, z: 0.7, duration: 0.32, ease: 'power1.in' }, i - 0.62);
          tl.to(motion.cam, { ...cam, duration: 0.3, ease: 'power1.out' }, i - 0.3);
        } else {
          tl.to(motion.cam, { ...cam, duration: 0.6, ease: 'power2.inOut' }, i - 0.6);
        }
        tl.to(motion.look, { ...look, duration: 0.6, ease: 'power2.inOut' }, i - 0.6);
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
              gsap.killTweensOf(motion, 'extract');
              if (anchor !== 'chassis-upper') {
                // the featured part slides out for its chapter; if another
                // part is still out, seat it smoothly FIRST (never teleport)
                const swap = motion.extractName !== anchor && motion.extract > 0.01;
                const seq = gsap.timeline();
                if (swap) {
                  seq.to(motion, { extract: 0, duration: 0.45, ease: 'power2.inOut' });
                  seq.call(() => { motion.extractName = anchor; });
                } else {
                  motion.extractName = anchor;
                }
                seq.to(motion, { extract: 0.55, duration: 1.1, ease: 'power3.out' });
              } else {
                gsap.to(motion, { extract: 0, duration: 0.8, ease: 'power3.inOut' });
              }
            } else {
              section.classList.remove('active');
              if (motion.focus === anchor) motion.focus = '';
              if (motion.extractName === anchor) {
                gsap.killTweensOf(motion, 'extract');
                gsap.to(motion, { extract: 0, duration: 0.8, ease: 'power3.inOut' });
              }
            }
          },
        });
      });

      // Manifesto reveal + stat count-up.
      let statsCounted = false;
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
          if (statsCounted) return; // count once, not on every scroll re-entry
          statsCounted = true;
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
      <a className="skip-link" href="#after-track">Skip 3D tour</a>

      <header className="site-header">
        <a className="brand" href="/">
          {BRAND}<span className="brand-dot">·</span><span className="brand-code">{PRODUCT_CODE}</span>
        </a>
        <nav>
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.href === '/' ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a className="btn btn-small" href={CTA.primaryHref}>{CTA.primaryShort}</a>
      </header>

      {/* Fixed 3D layer */}
      <div className="canvas-layer" aria-hidden="true">
        <img
          className="poster"
          src="/posters/poster-dark.webp"
          alt=""
          fetchPriority="high"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          style={{ opacity: loaded && !ctxLost ? 0 : 1 }}
        />
        {mounted && (
          <Suspense fallback={null}>
            <Scene
              reduced={reduced}
              onLoaded={() => setLoaded(true)}
              onCtxLost={() => setCtxLost(true)}
            />
          </Suspense>
        )}
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
              <a className="btn" href={HERO.ctaPrimaryHref}>{HERO.ctaPrimary}</a>
              <a
                className="btn btn-ghost"
                href={HERO.ctaSecondaryHref}
                onClick={() => track('docs_click')}
              >
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

      <VersionSwitch current="noir" />
    </div>
  );
}

function vec(a: [number, number, number]) {
  return { x: a[0], y: a[1], z: a[2] };
}
