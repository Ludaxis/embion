// Single source of truth for which GLB variant a device should load.
// The SAME heuristic is inlined in index.html / v3/index.html so the browser
// can start preloading the right file at HTML-parse time, long before this
// module evaluates — keep the two in sync or the preload is wasted.
//
// Filenames are VERSIONED (…-v6) because /models/* ships with a 1-year
// immutable Cache-Control header: regenerating the model must change the URL
// or returning visitors keep the old geometry until the cache expires.

export const MODEL_URL = '/models/module-v6.glb';
export const MODEL_URL_MOBILE = '/models/module-mobile-v6.glb';

/** Coarse-pointer or low-spec device → serve the light mesh. */
export function isWeakDevice(): boolean {
  if (typeof matchMedia !== 'function') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (
    matchMedia('(pointer: coarse)').matches ||
    (nav.deviceMemory != null && nav.deviceMemory <= 4) ||
    (nav.hardwareConcurrency != null && nav.hardwareConcurrency <= 4)
  );
}

export function pickModelUrl(): string {
  return isWeakDevice() ? MODEL_URL_MOBILE : MODEL_URL;
}
