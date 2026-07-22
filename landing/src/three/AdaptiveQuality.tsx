import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getGPUTier } from 'detect-gpu';
import { getBootState } from '../lib/loadProgress';

export type Quality = 'high' | 'medium' | 'low';

/** What each quality level enables. The single source of truth for the
 *  performance ladder — measured FPS moves pages up/down this ladder. */
export const QUALITY = {
  high: { dpr: [1, 1.75] as [number, number], composer: true, ao: true, floor: true },
  medium: { dpr: [1, 1.25] as [number, number], composer: true, ao: false, floor: false },
  low: { dpr: [0.85, 1] as [number, number], composer: false, ao: false, floor: false },
};

const STORE_KEY = 'embion-quality';

function storedQuality(): Quality | null {
  try {
    const q = localStorage.getItem(STORE_KEY);
    return q && q in QUALITY ? (q as Quality) : null;
  } catch {
    return null;
  }
}

/** Persist a settled tier so returning visitors mount at the right quality
 *  with zero mid-experience remounts. Called after the GPU probe and after
 *  PerformanceMonitor settles. */
export function persistQuality(q: Quality) {
  try {
    localStorage.setItem(STORE_KEY, q);
  } catch {
    /* private mode */
  }
}

/** Initial quality: forced (?perf=), else the persisted tier from a previous
 *  visit, else a synchronous cheap-signal seed (so a phone never renders its
 *  most expensive frames during the async GPU probe), refined by getGPUTier.
 *  The benchmark DB is self-hosted (/gpu-benchmarks) — no unpkg.com fetch. */
export function useInitialQuality(): [Quality | null, Dispatch<SetStateAction<Quality | null>>] {
  const [quality, setQuality] = useState<Quality | null>(() => {
    if (typeof location === 'undefined') return 'low';
    const forced = new URLSearchParams(location.search).get('perf') as Quality | null;
    if (forced && forced in QUALITY) return forced;
    const stored = storedQuality();
    if (stored) return stored;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const weak =
      (nav.deviceMemory != null && nav.deviceMemory <= 4) ||
      (nav.hardwareConcurrency != null && nav.hardwareConcurrency <= 4);
    return coarse || weak ? 'low' : 'medium';
  });

  useEffect(() => {
    const forced = new URLSearchParams(location.search).get('perf');
    if (forced && forced in QUALITY) return; // honour the seeded override
    let alive = true;
    getGPUTier({ benchmarksURL: '/gpu-benchmarks' })
      .then((t) => {
        if (!alive) return;
        const tier = t.tier ?? 0;
        const q: Quality = t.isMobile ? 'low' : tier >= 3 ? 'high' : tier === 2 ? 'medium' : 'low';
        setQuality((cur) => {
          const current = cur ?? 'medium';
          // Promotions remount the reflector floor + jump dpr — never do that
          // after the boot overlay has lifted. Demotions are always allowed.
          if (getBootState().phase === 'done' && rank(q) > rank(current)) return cur;
          persistQuality(q);
          return q;
        });
        console.info(`[embion] gpu tier ${tier}${t.isMobile ? ' (mobile)' : ''} → quality: ${q}`);
      })
      .catch(() => alive && setQuality((cur) => cur ?? 'medium'));
    return () => {
      alive = false;
    };
  }, []);

  return [quality, setQuality];
}

const rank = (q: Quality) => (q === 'high' ? 2 : q === 'medium' ? 1 : 0);

export const demote = (q: Quality): Quality => (q === 'high' ? 'medium' : 'low');
export const promote = (q: Quality): Quality => (q === 'low' ? 'medium' : 'high');
