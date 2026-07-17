import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getGPUTier } from 'detect-gpu';

export type Quality = 'high' | 'medium' | 'low';

/** What each quality level enables. The single source of truth for the
 *  performance ladder — measured FPS moves pages up/down this ladder. */
export const QUALITY = {
  high: { dpr: [1, 1.75] as [number, number], composer: true, ao: true, floor: true },
  medium: { dpr: [1, 1.25] as [number, number], composer: true, ao: false, floor: false },
  low: { dpr: [0.85, 1] as [number, number], composer: false, ao: false, floor: false },
};

/** Initial quality from GPU tier (before any FPS measurement):
 *  tier 3 (discrete/Apple silicon) → high, tier 2 → medium, else → low.
 *  `?perf=low|medium|high` forces a level for debugging. */
export function useInitialQuality(): [Quality | null, Dispatch<SetStateAction<Quality | null>>] {
  const [quality, setQuality] = useState<Quality | null>(null);

  useEffect(() => {
    const forced = new URLSearchParams(location.search).get('perf') as Quality | null;
    if (forced && forced in QUALITY) {
      setQuality(forced);
      return;
    }
    let alive = true;
    getGPUTier()
      .then((t) => {
        if (!alive) return;
        const tier = t.tier ?? 0;
        const q: Quality = t.isMobile ? 'low' : tier >= 3 ? 'high' : tier === 2 ? 'medium' : 'low';
        setQuality(q);
        console.info(`[embion] gpu tier ${tier}${t.isMobile ? ' (mobile)' : ''} → quality: ${q}`);
      })
      .catch(() => alive && setQuality('medium'));
    return () => {
      alive = false;
    };
  }, []);

  return [quality, setQuality];
}

export const demote = (q: Quality): Quality => (q === 'high' ? 'medium' : 'low');
export const promote = (q: Quality): Quality => (q === 'low' ? 'medium' : 'high');
