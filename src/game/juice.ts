/** Presentation-only camera punch. Does not touch cook math.
 *  Trauma² shake (Eiserloh) — small hits subtle, big hits explosive.
 */

export interface Juice {
  shake: number;
  punch: number;
}

const state: Juice = { shake: 0, punch: 0 };
let trauma = 0;
let noiseT = 0;

export function prefersReducedMotion() {
  if (typeof matchMedia === "undefined") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function punch(amount = 0.35) {
  if (prefersReducedMotion()) return;
  state.punch = Math.min(1, state.punch + amount);
}

export function shake(amount = 0.2) {
  if (prefersReducedMotion()) return;
  trauma = Math.min(1, trauma + amount);
}

export function tickJuice(dt: number): Juice {
  trauma = Math.max(0, trauma - dt * 1.6);
  state.shake = trauma * trauma;
  state.punch = Math.max(0, state.punch - dt * 3.2);
  noiseT += dt;
  return state;
}

function noise(t: number) {
  return Math.sin(t * 37.1) * 0.55 + Math.sin(t * 19.7 + 1.3) * 0.45;
}

export function cameraOffset(): { x: number; y: number } {
  const s = state.shake;
  return {
    x: noise(noiseT) * s * 0.09,
    y: state.punch * 0.04 + noise(noiseT + 8) * s * 0.06,
  };
}
