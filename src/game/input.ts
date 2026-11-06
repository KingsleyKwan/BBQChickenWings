import { SPIN } from "./constants";

export interface CookInput {
  distance: number;
  angle: number;
  spinRate: number;
  confirm: boolean;
  thrust: boolean;
  plateAim: number;
  motionLive: boolean;
  horizon: { x: number; y: number };
  wingYaw: number;
  wingPitch: number;
  wingX: number;
  wingY: number;
  wingZ: number;
}

const keys = new Set<string>();
let injectedKeys: string[] | null = null;
let pointerY = 0.35;
let pointerX = 0;
let pinchAngle = 0;
let lastPinch = 0;
let flickUp = false;
let tapConfirm = false;
let gyro: { b: number; g: number; a: number } | null = null;
let gyroZero: { b: number; g: number; a: number } | null = null;
let lastAlpha: number | null = null;
let alphaRate = 0;
let motionAccelY = 0;
let spinHold = 0;
/** Decaying swipe impulse. Left swipe → +. Same sign as Q. */
let swipeSpin = 0;
let thrustHold = false;
let skewerMode = false;
let wingYaw = 0;
let wingPitch = 0;
let wingX = 0;
let wingY = 0;
let wingZ = 0;

/** Degrees of raw beta/gamma ignored before response. Tuned 1.6 after
 *  typical iPhone 14/15 resting noise (~0.8–1.4°) + margin; was 2.4. */
const GYRO_DEADZONE = 1.6;

function held(): Set<string> {
  return injectedKeys ? new Set(injectedKeys) : keys;
}

function onKey(e: KeyboardEvent, down: boolean) {
  if (down) keys.add(e.code);
  else keys.delete(e.code);
  if (["Space", "KeyF", "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(e.code)) {
    e.preventDefault();
  }
}

export function attachInput(el: HTMLElement) {
  const kd = (e: KeyboardEvent) => onKey(e, true);
  const ku = (e: KeyboardEvent) => onKey(e, false);
  const blur = () => {
    keys.clear();
    spinHold = 0;
    swipeSpin = 0;
  };
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", blur);

  const onOri = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    gyro = { b: e.beta, g: e.gamma, a: e.alpha ?? 0 };
    if (!gyroZero) gyroZero = { ...gyro };
    if (lastAlpha != null) {
      let da = gyro.a - lastAlpha;
      if (da > 180) da -= 360;
      if (da < -180) da += 360;
      alphaRate = alphaRate * 0.6 + da * 0.4;
    }
    lastAlpha = gyro.a;
  };
  window.addEventListener("deviceorientation", onOri);
  startCapacitorMotion();

  const onMotion = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const y = a.y ?? 0;
    // Upward flick of the phone = 吉叉 / 夾翼.
    if (y - motionAccelY > 7.5 && y > 4) flickUp = true;
    motionAccelY = y * 0.4 + motionAccelY * 0.6;
    const ua = e.acceleration;
    if (ua && (ua.y ?? 0) > 4.8) flickUp = true;
  };
  window.addEventListener("devicemotion", onMotion);

  const ptrs = new Map<number, { x: number; y: number }>();
  const swipePtrs = new Map<number, { x: number; y: number }>();

  const applySwipe = (dx: number, dy: number, width: number) => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX > 4 && absX > absY * 0.72) {
      swipeSpin += (-dx / Math.max(1, width)) * SPIN.swipeGain;
      return true;
    }
    return false;
  };

  const down = (e: PointerEvent) => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* already captured */
    }
  };
  const move = (e: PointerEvent) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    if (ptrs.size === 1) {
      const dy = e.clientY - p.y;
      const dx = e.clientX - p.x;
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      // Horizontal swipe is handled on window (anywhere). Slow / vertical still aims.
      if (!(absX > 5 && absX > absY * 0.82)) {
        pointerX = Math.max(-1, Math.min(1, pointerX + dx / (w * 0.45)));
      }
      pointerY = Math.max(0, Math.min(1, pointerY - dy / (h * 0.7)));
      if (dy < -28 && absY > absX * 1.4) flickUp = true;
      p.x = e.clientX;
      p.y = e.clientY;
    } else if (ptrs.size >= 2) {
      const pts = [...ptrs.values()];
      const ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      if (lastPinch) pinchAngle += (ang - lastPinch) * 1.65;
      lastPinch = ang;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  };
  const up = (e: PointerEvent) => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) lastPinch = 0;
  };
  const click = () => {
    tapConfirm = true;
  };

  const winDown = (e: PointerEvent) => {
    swipePtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const winMove = (e: PointerEvent) => {
    const p = swipePtrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    applySwipe(dx, dy, window.innerWidth);
    p.x = e.clientX;
    p.y = e.clientY;
  };
  const winUp = (e: PointerEvent) => {
    swipePtrs.delete(e.pointerId);
  };

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("click", click);
  window.addEventListener("pointerdown", winDown, { passive: true });
  window.addEventListener("pointermove", winMove, { passive: true });
  window.addEventListener("pointerup", winUp, { passive: true });
  window.addEventListener("pointercancel", winUp, { passive: true });

  return () => {
    window.removeEventListener("keydown", kd);
    window.removeEventListener("keyup", ku);
    window.removeEventListener("blur", blur);
    document.removeEventListener("visibilitychange", blur);
    window.removeEventListener("deviceorientation", onOri);
    window.removeEventListener("devicemotion", onMotion);
    void capOri?.remove?.();
    void capAccel?.remove?.();
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    el.removeEventListener("click", click);
    window.removeEventListener("pointerdown", winDown);
    window.removeEventListener("pointermove", winMove);
    window.removeEventListener("pointerup", winUp);
    window.removeEventListener("pointercancel", winUp);
  };
}

type CapHandle = { remove: () => Promise<void> } | void;
let capOri: CapHandle;
let capAccel: CapHandle;

function applyOrientationSample(beta: number, gamma: number, alpha: number) {
  gyro = { b: beta, g: gamma, a: alpha };
  if (!gyroZero) gyroZero = { ...gyro };
  if (lastAlpha != null) {
    let da = gyro.a - lastAlpha;
    if (da > 180) da -= 360;
    if (da < -180) da += 360;
    alphaRate = alphaRate * 0.6 + da * 0.4;
  }
  lastAlpha = gyro.a;
}

/** Native Capacitor Motion plugin when WKWebView DeviceOrientation is noisy. */
async function startCapacitorMotion() {
  const w = window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: {
        Motion?: {
          addListener: (ev: string, cb: (e: Record<string, number>) => void) => Promise<{ remove: () => Promise<void> }>;
        };
      };
    };
  };
  const motion = w.Capacitor?.isNativePlatform?.() ? w.Capacitor.Plugins?.Motion : undefined;
  if (!motion?.addListener) return;
  try {
    capOri = await motion.addListener("orientation", (e) => {
      applyOrientationSample(e.beta ?? 0, e.gamma ?? 0, e.alpha ?? 0);
    });
    capAccel = await motion.addListener("accel", (e) => {
      const y = e.y ?? 0;
      if (y > 4.8) flickUp = true;
    });
  } catch {
    /* plugin missing — web events stay in charge */
  }
}

export async function requestMotion(): Promise<boolean> {
  const DOE = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  const DME = DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  try {
    if (typeof DOE.requestPermission === "function") {
      const r = await DOE.requestPermission();
      if (r !== "granted") {
        await startCapacitorMotion();
        await new Promise((r) => setTimeout(r, 80));
        return gyro != null;
      }
    }
    if (typeof DME.requestPermission === "function") {
      try {
        await DME.requestPermission();
      } catch {
        /* orientation alone is enough */
      }
    }
    await startCapacitorMotion();
    await new Promise((r) => setTimeout(r, 120));
    if (gyro) gyroZero = { ...gyro };
    return true;
  } catch {
    return false;
  }
}

/** Soft-knee deadzone: zero inside z, then quadratic ramp so small
 *  tilts feel responsive without jump. Scale still maps ±50° → ±1. */
function deadzone(v: number, z: number) {
  const a = Math.abs(v);
  if (a < z) return 0;
  const s = Math.sign(v);
  const t = (a - z) / (50 - z);
  // t² soft start, still reaches 1 at edge
  return s * (t * t);
}

export function sampleInput(dt: number): CookInput {
  const k = held();
  let distance = 1 - pointerY;
  let angle = pointerX;
  let spinRate = 0;

  // A = left (+angle), D = right (−angle). W approaches the fire.
  if (!skewerMode) {
    if (k.has("KeyW") || k.has("ArrowUp")) distance -= 0.7 * dt;
    if (k.has("KeyS") || k.has("ArrowDown")) distance += 0.7 * dt;
    if (k.has("KeyA") || k.has("ArrowLeft")) angle += 0.9 * dt;
    if (k.has("KeyD") || k.has("ArrowRight")) angle -= 0.9 * dt;
    if (k.has("KeyQ")) spinRate += 2.4;
    if (k.has("KeyE")) spinRate -= 2.4;
    spinRate += spinHold * 2.6;
    spinRate += swipeSpin;
  }
  swipeSpin *= Math.exp(-3.8 * dt);
  if (Math.abs(swipeSpin) < 0.03) swipeSpin = 0;
  distance = Math.max(0.05, Math.min(1.15, distance));
  angle = Math.max(-1.2, Math.min(1.2, angle));
  pointerY = 1 - distance;
  pointerX = angle;

  let motionLive = false;
  let horizon = { x: 0, y: 0 };
  if (gyro && gyroZero) {
    motionLive = true;
    const rawB = Math.max(-50, Math.min(50, gyro.b - gyroZero.b));
    const rawG = Math.max(-50, Math.min(50, gyro.g - gyroZero.g));
    const dBeta = deadzone(rawB, GYRO_DEADZONE);
    const dGamma = deadzone(rawG, GYRO_DEADZONE);
    // Slightly higher gain after soft-knee so full tilt still reaches edges
    distance = Math.max(0.05, Math.min(1.15, 0.62 + dBeta * 0.95));
    angle = Math.max(-1.2, Math.min(1.2, dGamma * 1.45));
    spinRate += -alphaRate * 0.12 + pinchAngle * 1.15;
    horizon = {
      x: Math.max(-1, Math.min(1, rawG / 28)),
      y: Math.max(-1, Math.min(1, rawB / 38)),
    };
  } else {
    spinRate += pinchAngle * 1.8;
  }
  pinchAngle *= 0.32;
  alphaRate *= 0.85;

  const confirm = k.has("Space") || tapConfirm;
  const thrust = k.has("KeyF") || flickUp || (skewerMode && thrustHold);
  tapConfirm = false;
  flickUp = false;

  if (skewerMode) {
    if (k.has("KeyA") || k.has("ArrowLeft")) wingYaw += 0.9 * dt;
    if (k.has("KeyD") || k.has("ArrowRight")) wingYaw -= 0.9 * dt;
    if (k.has("KeyW") || k.has("ArrowUp")) wingPitch -= 0.7 * dt;
    if (k.has("KeyS") || k.has("ArrowDown")) wingPitch += 0.7 * dt;
  }

  return {
    distance,
    angle,
    spinRate: skewerMode ? 0 : spinRate,
    confirm,
    thrust,
    plateAim: (angle + 1.2) / 2.4,
    motionLive,
    horizon,
    wingYaw,
    wingPitch,
    wingX,
    wingY,
    wingZ,
  };
}

export function setInjectedKeys(codes: string[]) {
  injectedKeys = codes.length ? [...codes] : null;
}

/** -1..+1 held 轉叉 pad. Left = +, right = − (same sign as Q / E). */
export function setSpinHold(v: number) {
  spinHold = Math.max(-1, Math.min(1, v));
}

/** Instant swipe impulse. Positive = left / Q. */
export function impulseSpin(v: number) {
  swipeSpin += v;
}

export function setThrustHold(v: boolean) {
  thrustHold = v;
}

export function setSkewerMode(on: boolean) {
  skewerMode = on;
  if (!on) {
    wingYaw = 0;
    wingPitch = 0;
    wingX = 0;
    wingY = 0;
    wingZ = 0;
  }
}

/** One-finger rotate / two-finger translate the wing on the 吉 beat. */
export function nudgeWing(delta: {
  yaw?: number;
  pitch?: number;
  roll?: number;
  x?: number;
  y?: number;
  z?: number;
}) {
  if (delta.yaw) wingYaw += delta.yaw;
  if (delta.pitch) wingPitch += delta.pitch;
  if (delta.x) wingX += delta.x;
  if (delta.y) wingY += delta.y;
  if (delta.z) wingZ += delta.z;
  wingYaw = Math.max(-1.4, Math.min(1.4, wingYaw));
  wingPitch = Math.max(-1.1, Math.min(1.1, wingPitch));
  wingX = Math.max(-0.22, Math.min(0.22, wingX));
  wingY = Math.max(-0.16, Math.min(0.16, wingY));
  wingZ = Math.max(-0.22, Math.min(0.22, wingZ));
}

export function resetWingNudge() {
  wingYaw = 0;
  wingPitch = 0;
  wingX = 0;
  wingY = 0;
  wingZ = 0;
}

export function recenterGyro() {
  if (gyro) {
    if (gyroZero) {
      gyroZero = {
        b: gyroZero.b * 0.35 + gyro.b * 0.65,
        g: gyroZero.g * 0.35 + gyro.g * 0.65,
        a: gyro.a,
      };
    } else {
      gyroZero = { ...gyro };
    }
  }
  lastAlpha = gyro?.a ?? null;
  alphaRate = 0;
  pointerY = 0.38;
  pointerX = 0;
}

export function hasGyroSample() {
  return gyro != null;
}

export function gyroHorizon(): { x: number; y: number } {
  if (!gyro || !gyroZero) return { x: 0, y: 0 };
  return {
    x: Math.max(-1, Math.min(1, (gyro.g - gyroZero.g) / 28)),
    y: Math.max(-1, Math.min(1, (gyro.b - gyroZero.b) / 38)),
  };
}
