import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, ScrollTrigger, initScroll, prefersReducedMotion } from '../lib/scroll';
import { motion, requestRender } from '../lib/motion';
import { getBootState, reportProgress, finishBoot } from '../lib/loadProgress';
import { EXTRACT_VECTORS } from '../three/parts';
import { Callouts } from './Callouts';
import { AfterTrack } from './Sections';
import { Preloader } from '../site/Preloader';
import { SceneBoundary } from '../site/SceneBoundary';
import { track, VersionSwitch } from '../site/chrome';
import {
  BRAND, PRODUCT_CODE, PRODUCT_NAME, HERO, PHILOSOPHY, STATS, CHAPTERS,
  NAV, CTA,
} from '../content/product';

// The 3D chunk download is kicked at module-eval — in parallel with hydration
// and (thanks to the head preload) with the GLB itself — instead of waiting
// for the post-mount lazy() render. Browser-gated: the SSG pass must not pull
// three into the server module graph. Scene still RENDERS only after mount so
// the prerender and hydration agree.
const scenePromise = typeof window !== 'undefined' ? import('./Scene') : null;
const Scene = lazy(() => scenePromise!);

gsap.registerPlugin(useGSAP);

/** Aspect-aware hero framing. Wide screens: the module sits clearly in the
 *  RIGHT half, fully clear of the left text column. Portrait phones: the text
 *  is full-width on top, so the module centers in the lower two-thirds.
 *  Interpolated between aspect 0.8 (portrait pose) and 1.5 (wide pose). */
function heroPose(): { cam: [number, number, number]; look: [number, number, number] } {
  const a = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.7;
  const t = Math.min(1, Math.max(0, (a - 0.8) / 0.7));
  const l = (p: number, q: number) => p + (q - p) * t;
  return {
    cam: [l(0, -0.2), 0.1, l(-7.0, -6.0)],
    look: [l(0, 1.15), l(0.55, 0.02), 0],
  };
}

/** Portrait screens see a much narrower horizontal field (fixed vertical
 *  FOV) — dolly chapter close-ups OUT and lift the aim so featured parts stay
 *  in frame above the bottom-sheet card instead of cropping off-screen. */
function portraitComp(): { dolly: number; lift: number } {
  const a = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.7;
  const t = Math.min(1, Math.max(0, (1.05 - a) / 0.55)); // 0 at ≥1.05, 1 at ≤0.5
  return { dolly: 1 + 0.32 * t, lift: 0.14 * t };
}
function applyComp(
  pose: { cam: { x: number; y: number; z: number }; look: { x: number; y: number; z: number } },
) {
  const { dolly, lift } = portraitComp();
  if (dolly === 1) return pose;
  const { cam, look } = pose;
  cam.x = look.x + (cam.x - look.x) * dolly;
  cam.y = look.y + (cam.y - look.y) * dolly;
  cam.z = look.z + (cam.z - look.z) * dolly;
  look.y += lift;
  cam.y += lift;
  return pose;
}

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
  { cam: [-0.2, 0.1, -6.0], look: [1.15, 0.02, 0] },   // hero (wide default — see heroPose)
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
    motion.idle = reduced ? 0 : 1;
  }, [reduced]);

  // Boot progress before the 3D chunk can report real bytes: a small kick at
  // mount, a gentle trickle so slow networks still show life, and a step when
  // the Scene chunk lands.
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

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const onMove = (e: PointerEvent) => {
      motion.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      motion.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      requestRender(); // full-rate parallax under the demand frameloop
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useGSAP(
    () => {
      if (!loaded) return;
      const HERO = heroPose();
      if (reduced) {
        // Static mode: no smoothing, no scrub — each chapter instantly
        // composes its shot so the page still tells the story.
        gsap.set(motion.cam, vec(HERO.cam));
        gsap.set(motion.look, vec(HERO.look));
        requestRender();
        gsap.utils.toArray<HTMLElement>('.chapter').forEach((section, ci) => {
          const anchor = section.dataset.anchor!;
          ScrollTrigger.create({
            trigger: section,
            start: 'top 62%',
            end: 'bottom 62%',
            onToggle: (self) => {
              if (!self.isActive) return;
              motion.focus = anchor;
              motion.extractName = anchor !== 'chassis-upper' ? anchor : '';
              motion.extract = anchor !== 'chassis-upper' ? 0.55 : 0;
              const b = BEATS[ci + 2];
              const { cam, look } = applyComp(staticTarget(b, ci + 2));
              gsap.set(motion.cam, cam);
              gsap.set(motion.look, look);
              requestRender();
            },
          });
        });
        // Scrolling back above the first chapter must restore the hero shot —
        // without this the last chapter's extraction/framing sits under the
        // hero copy.
        ScrollTrigger.create({
          trigger: '.chapter',
          start: 'top 62%',
          onLeaveBack: () => {
            motion.focus = '';
            motion.extractName = '';
            motion.extract = 0;
            gsap.set(motion.cam, vec(HERO.cam));
            gsap.set(motion.look, vec(HERO.look));
            requestRender();
          },
        });
        if (document.documentElement.classList.contains('booting')) window.scrollTo(0, 0);
        finishBoot();
        return;
      }
      initScroll();

      // ---- Reveal choreography ----
      // Everything below is created while the boot overlay still covers the
      // page; the reveal (finishBoot at the end) always starts at the hero, so
      // no ScrollTrigger can fire mid-load. The intro flight + hero copy
      // cascade begin a beat into the overlay fade so their motion is SEEN
      // (the old flight burned ~70% of its travel behind the fade).
      const introCam = gsap.fromTo(
        motion.cam,
        { x: 0.9, y: 1.7, z: -6.8 },
        { ...vec(HERO.cam), delay: 0.35, duration: 2.4, ease: 'power2.out' },
      );
      const introLook = gsap.fromTo(
        motion.look,
        { x: 0, y: 0.4, z: 0 },
        { ...vec(HERO.look), delay: 0.35, duration: 2.4, ease: 'power2.out' },
      );
      gsap.set(motion.cam, { x: 0.9, y: 1.7, z: -6.8 }); // pose the covered frame
      gsap.from(['.hero-kicker', 'h1 > span', '.hero-sub', '.hero-ctas', '.scroll-hint'], {
        y: 26,
        autoAlpha: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.09,
        delay: 0.5,
        clearProps: 'all',
      });

      // Master camera timeline scrubbed across the whole track.
      // ?qa=1 disables snapping so QA can freeze arbitrary scrub states.
      const qa = new URLSearchParams(location.search).get('qa') === '1';
      let introDone = false;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#track',
          start: 'top top',
          end: 'bottom bottom',
          // Lighter than the old scrub:1 so the camera catch-up (already smoothed
          // once by Lenis lerp:0.11) doesn't compound into elastic latency.
          scrub: 0.6,
          onUpdate: (self) => {
            // On the first REAL scroll, hand the intro off to the scrub: kill
            // the flight wherever it is (including its pre-delay window) and
            // converge to the hero pose so the scrub's first tween captures a
            // composed start, never an arbitrary mid-flight freeze.
            if (self.progress > 0.0002 && !introDone) {
              introDone = true;
              introCam.kill();
              introLook.kill();
              // Converge only inside the timeline's dead zone (its first cam
              // tween starts at t=0.4): later-created tweens outrank the
              // timeline while active, then expire — no overwrite, so the
              // timeline's own tweens are never killed.
              if (self.progress < 0.06) {
                gsap.to(motion.cam, { ...vec(HERO.cam), duration: 0.4, ease: 'power2.out' });
                gsap.to(motion.look, { ...vec(HERO.look), duration: 0.4, ease: 'power2.out' });
              }
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
        // i>=2 are part close-ups; hero/manifesto handle their own framing
        return i >= 2 ? applyComp({ cam, look }) : { cam, look };
      };
      BEATS.forEach((b, i) => {
        if (i === 0) return;
        const { cam, look } = chapterTarget(b, i);
        if (i === 1) {
          // Pin the first segment's start values: a native scroll jump
          // (scrollbar drag, End key, the skip-link) can land the first
          // onUpdate past the 0.06 convergence window, and lazy capture would
          // then freeze the off-stage intro pose as the hero framing forever.
          // immediateRender:false so the posed covered frame isn't stomped.
          tl.fromTo(
            motion.cam,
            vec(HERO.cam),
            { ...cam, duration: 0.6, ease: 'power2.inOut', immediateRender: false },
            i - 0.6,
          );
          tl.fromTo(
            motion.look,
            vec(HERO.look),
            { ...look, duration: 0.6, ease: 'power2.inOut', immediateRender: false },
            i - 0.6,
          );
        } else if (i === 7) {
          // tof -> jetson crosses to the rear: sweep AROUND the left side
          // instead of cutting through the module's near field.
          tl.to(motion.cam, { x: -3.4, y: -0.2, z: 0.7, duration: 0.32, ease: 'power1.in' }, i - 0.62);
          tl.to(motion.cam, { ...cam, duration: 0.3, ease: 'power1.out' }, i - 0.3);
        } else {
          tl.to(motion.cam, { ...cam, duration: 0.6, ease: 'power2.inOut' }, i - 0.6);
        }
        if (i !== 1) {
          tl.to(motion.look, { ...look, duration: 0.6, ease: 'power2.inOut' }, i - 0.6);
        }
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

      // Single owner for the extraction sequence: killing the WHOLE timeline
      // on re-entry (not just its tweens) also kills the pending .call() that
      // used to survive and pop the WRONG part out during fast scrubbing.
      let extractSeq: gsap.core.Timeline | null = null;
      const setExtraction = (anchor: string | null) => {
        extractSeq?.kill();
        extractSeq = gsap.timeline();
        if (anchor) {
          // the featured part slides out for its chapter; if another part is
          // still out, seat it smoothly FIRST (never teleport)
          const swap = motion.extractName !== anchor && motion.extract > 0.01;
          if (swap) {
            extractSeq.to(motion, { extract: 0, duration: 0.45, ease: 'power2.inOut' });
            extractSeq.call(() => { motion.extractName = anchor; });
          } else {
            motion.extractName = anchor;
          }
          extractSeq.to(motion, { extract: 0.55, duration: 1.05, ease: 'embMech' });
        } else {
          extractSeq.to(motion, { extract: 0, duration: 0.8, ease: 'power3.inOut' });
        }
      };

      // Chapter activation: focus part + reveal card. start/end share the same
      // 62% line so handoffs are EXCLUSIVE — the old 62/42 windows kept two
      // chapters (two cards, two anchors) active for 20vh of every transition.
      gsap.utils.toArray<HTMLElement>('.chapter').forEach((section) => {
        const anchor = section.dataset.anchor!;
        ScrollTrigger.create({
          trigger: section,
          start: 'top 62%',
          end: 'bottom 62%',
          onToggle: (self) => {
            if (self.isActive) {
              motion.focus = anchor;
              section.classList.add('active');
              setExtraction(anchor !== 'chassis-upper' ? anchor : null);
            } else {
              section.classList.remove('active');
              if (motion.focus === anchor) motion.focus = '';
              if (motion.extractName === anchor) setExtraction(null);
            }
          },
        });
      });

      // Manifesto reveal + stat count-up (starts after the line lands).
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
              delay: 0.3,
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

      // After-track reveals: grids cascade item-by-item, singles fade as blocks.
      gsap.utils.toArray<HTMLElement>('.steps, .cases-grid').forEach((grid) => {
        gsap.from(grid.children, {
          opacity: 0,
          y: 36,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.08,
          scrollTrigger: { trigger: grid, start: 'top 85%', toggleActions: 'play none none reverse' },
        });
      });
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

      // The reveal: still under the overlay, pin the story to its start, then
      // lift the cover + unlock scroll. The intro flight plays through the fade.
      // (If the watchdog already lifted the overlay — degraded slow-network
      // path — the user may be mid-page: don't yank them to the top.)
      if (document.documentElement.classList.contains('booting')) window.scrollTo(0, 0);
      finishBoot();
    },
    { scope: rootRef, dependencies: [loaded, reduced] },
  );

  return (
    <div ref={rootRef}>
      <Preloader brand={BRAND} />
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
        <picture>
          {/* portrait phones get a portrait-composed poster (cover-cropping the
              16:9 shot pushed the module half off-frame) */}
          <source media="(max-aspect-ratio: 9/10)" srcSet="/posters/poster-dark-portrait.webp" />
          <img
            className="poster"
            src="/posters/poster-dark.webp"
            alt=""
            fetchPriority="high"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            style={{ opacity: loaded && !ctxLost ? 0 : 1 }}
          />
        </picture>
        {mounted && (
          <SceneBoundary
            onFail={() => {
              // degraded 2D mode: poster stays, and `loaded` still flips so the
              // scroll story (cards, reveals, unlock) runs without the canvas
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
              />
            </Suspense>
          </SceneBoundary>
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
