import { useEffect, useState, useSyncExternalStore } from 'react';
import { getBootState, subscribeBoot } from '../lib/loadProgress';

/**
 * Page-owned boot overlay. Rendered by BOTH the build-time prerender and the
 * client's first paint (identical visible markup, so hydration agrees), which
 * means it covers the page from HTML-parse time — before any JS — and the
 * scroll track can never be seen half-loaded. Dismissal is a client-only state
 * change driven by the loadProgress store.
 *
 * Failsafe: static CSS hides the overlay after ~14s (see styles) in case the
 * app JS never boots; hydrated clients cancel that by adding `.js`.
 */
export function Preloader({ brand }: { brand: string }) {
  const value = useSyncExternalStore(
    subscribeBoot,
    () => getBootState().value,
    () => 0,
  );
  const phase = useSyncExternalStore(
    subscribeBoot,
    () => getBootState().phase,
    () => 'boot' as const,
  );
  const [hydrated, setHydrated] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    setHydrated(true);
    // If hydration arrived AFTER the 14s CSS failsafe already dissolved the
    // overlay, adding .js would cancel the animation and RESURRECT it over
    // content the user is reading — stay gone instead.
    if (performance.now() > 13500 && getBootState().phase !== 'done') {
      setGone(true);
      document.documentElement.classList.remove('booting');
    }
  }, []);

  // Watchdog: the overlay must never persist forever. If the 3D layer hasn't
  // finished after 18s (stalled GLB, dead GPU process, anything), lift the
  // cover and unlock scroll — the poster + DOM story remain, and the scene
  // keeps loading behind and fades in whenever it does arrive.
  useEffect(() => {
    const t = setTimeout(() => {
      if (getBootState().phase !== 'done') {
        setGone(true);
        document.documentElement.classList.remove('booting');
      }
    }, 18000);
    return () => clearTimeout(t);
  }, []);

  const done = phase === 'done';
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 700);
    return () => clearTimeout(t);
  }, [done]);

  if (gone) return null;
  const pct = Math.round(value * 100);
  // Honest phase captions: the top of the bar is shader compilation, not a
  // stalled download — say so instead of sitting silently at a high number.
  const caption =
    phase === 'model' ? 'loading model'
    : phase === 'compile' ? 'preparing shaders'
    : phase === 'done' ? 'ready'
    : 'loading';
  return (
    <div
      className={`preloader ${hydrated ? 'js' : ''} ${done ? 'preloader-out' : ''}`}
      aria-hidden="true"
    >
      <div className="preloader-brand">{brand}</div>
      <div className="preloader-value">{pct}</div>
      <div className="preloader-bar">
        <div className="preloader-fill" style={{ transform: `scaleX(${value})` }} />
      </div>
      <div className="preloader-phase">{caption}</div>
    </div>
  );
}
