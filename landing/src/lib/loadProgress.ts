// Tiny progress store bridging the lazy 3D chunk (which knows real GLB bytes
// via drei's useProgress) and the page-owned boot overlay (which must render
// from the very first paint, so it cannot import drei/three). Same indirection
// idea as setRequestRender in ./motion.
//
// Value is monotonic 0..1 — late sources can only push it forward, so the bar
// never runs backwards when e.g. a second loader registers.

export type BootPhase = 'boot' | 'scene' | 'model' | 'compile' | 'done';

type State = { value: number; phase: BootPhase };

const state: State = { value: 0, phase: 'boot' };
const listeners = new Set<() => void>();

export function getBootState(): State {
  return state;
}

export function subscribeBoot(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const emit = () => listeners.forEach((fn) => fn());

const PHASE_RANK: Record<BootPhase, number> = {
  boot: 0,
  scene: 1,
  model: 2,
  compile: 3,
  done: 4,
};

/** Push progress forward. BOTH fields are monotonic: values below the current
 *  one are ignored, and the phase can never move backwards — a late re-report
 *  from an earlier stage (e.g. the model reporter re-firing after a Scene
 *  re-render) must not regress 'done', which would cancel the overlay's
 *  dismiss timer and strand the page behind the loader until the watchdog. */
export function reportProgress(value: number, phase?: BootPhase) {
  const v = Math.min(1, Math.max(state.value, value));
  const p = phase && PHASE_RANK[phase] > PHASE_RANK[state.phase] ? phase : state.phase;
  if (v === state.value && p === state.phase) return;
  state.value = v;
  state.phase = p;
  emit();
}

/** Mark boot finished: overlay fades, scroll unlocks. */
export function finishBoot() {
  reportProgress(1, 'done');
  document.documentElement.classList.remove('booting');
}
