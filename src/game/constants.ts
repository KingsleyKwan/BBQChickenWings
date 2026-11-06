/** Tuning knobs — hourly reviews start here. */

export const TICK = 1 / 60;

export const FIRE = {
  /** Optimal distance from coals (world units). */
  sweetMin: 0.38,
  sweetMax: 0.62,
  tooClose: 0.22,
  tooFar: 0.95,
  /** Kept as HUD / wind helpers; cook now uses fireAmbientC(). */
  heatGainClose: 1.15,
  heatGainSweet: 1.05,
  heatGainFar: 0.28,
  charAccelClose: 3.4,
  charAccelSweet: 0.72,
  charAccelFar: 0.12,
  moistureLossSweet: 0.28,
  moistureLossClose: 1.15,
  moistureLossFar: 0.08,
};

export const COOK = {
  /** 1 game-second ≈ this many real seconds. HUD shows 約 N 分. */
  realSecPerGameSec: 48,
  /** Interior doneness target (~74°C chicken). */
  coreTarget: 0.74,
  /** Golden-crisp skin, not black. */
  skinTarget: 0.34,
  /** Fridge-cold mid-wing start (°C). */
  startCoreC: 8,
  startSkinC: 12,
  /** Core doneness maps (coreTemp - 15) / 80 so 74°C ≈ 0.74. */
  coreOffsetC: 15,
  coreSpanC: 80,
  /** Skin follows fire air temp (game seconds). */
  skinTau: 0.9,
  /** Core lag multiplier × mass. Classic ~14s to approach 74°C in the sweet zone. */
  coreTauMass: 14,
  /** Maillard browning starts; carbon/char after this. */
  maillardC: 128,
  charC: 165,
  sugarBurnC: 175,
  /** Roast1 can-advance floor (seconds). Bigger wings still need longer in the sweet zone. */
  roast1Floor: 3.6,
  roast2Floor: 2.4,
};

export const SPIN = {
  evennessPerRev: 0.16,
  deadZone: 0.08,
  /** Swipe-to-spin rate. Left swipe = + (same sign as Q). */
  swipeGain: 22,
  /** Hold-to-spin leftover (Q/E keyboard). */
  holdRate: 2.6,
  /** Game-seconds without a real turn before the 「該反轉」 coach. ~30 real sec. */
  flipRemind: 0.65,
};

export const HONEY = {
  coatPerSecond: 0.42,
  dripIfTooMuch: 0.12,
  idealMin: 0.38,
  idealMax: 0.72,
  /** Thick glaze chars faster on roast2 and slightly insulates the core. */
  burnMul: 1.85,
  insulate: 0.14,
  /** Pre-marinated bag wings start with this coat. */
  bagStart: 0.34,
};

export const SKEWER = {
  thrustNeed: 0.72,
  missPenalty: 0.18,
  twoWingGap: 0.16,
  /** Aim above this (0..1) counts as hitting cartilage on a parallel pierce. */
  cartilageAim: 0.62,
  /** A miss still pierces, but quality stays loose so the meat sags. Lined-up 吉 approaches 1. */
  lockFloor: 0.4,
  /** Slow 吉 hold. ~1.7s to lock. */
  thrustPerSec: 0.42,
  /** Release before lock retracts the whole fork. */
  retractPerSec: 1.85,
};

/** Gravity sag after 吉叉. Unlocked wings (poor 骨頭下底 lock) always hang meat-down. */
export const HANG = {
  /** Pendulum pull toward the heavy side. Scaled by mass and (1 − lock). */
  gravity: 16,
  damping: 3.2,
  /** Extra damping when the skewer actually locked under the bone. */
  lockDamp: 7.4,
  /** How much Q/E / swipe fork spin transfers into the wing (rest is lock). */
  spinUnlock: 0.14,
  spinLock: 0.92,
  /** Extra closeness to coals for the hanging-down face. */
  distDrop: 0.16,
  /** evenness drain per second while sagged and poorly locked. */
  evenLoss: 0.1,
  /** Extra char on the down face. */
  charMul: 0.42,
};

export const PLATE = {
  dropNeed: 0.55,
  bounceIfHot: 0.2,
};

export const EXTRACT = {
  gentleMax: 0.42,
  yankTear: 0.7,
};

export const SCORE = {
  heatTarget: 0.74,
  charCap: 0.38,
  moistureTarget: 0.46,
  twoWingBiasPenalty: 0.12,
};

/** Night-market crosswind: positive = flames lean +X (toward plate). */
export const WIND = {
  distancePush: 0.07,
  anglePush: 0.12,
  emberDrift: 0.18,
};

export const STALL = {
  moths: { count: 8, radius: 0.22, hideIfReduceMotion: true },
  lanternFlicker: 0.22,
  heatShimmer: 10,
};

export const WING_ARCHETYPES = [
  { id: "plump", name: "肥嘟嘟中翼", size: 1.1, fat: 0.72, grams: 118, note: "118g，肉厚，火要夠耐" },
  { id: "lean", name: "精瘦中翼", size: 0.9, fat: 0.3, grams: 78, note: "78g，瘦，太近火會燶" },
  { id: "classic", name: "街坊中翼", size: 1.0, fat: 0.5, grams: 96, note: "96g，最穩陣嗰隻" },
] as const;

export type WingId = (typeof WING_ARCHETYPES)[number]["id"];

export type BagKind = "marinated" | "plain";
export type SkewerStyle = "lock" | "parallel";

export interface BagWing {
  id: WingId;
  taken: boolean;
}

/** Two supermarket 膠袋. Reach in; one random mid-wing comes out. */
export function makeBagStock(): Record<BagKind, BagWing[]> {
  const pack = (ids: WingId[]): BagWing[] => ids.map((id) => ({ id, taken: false }));
  return {
    marinated: pack(["plump", "classic", "lean", "plump", "classic", "lean", "plump", "classic"]),
    plain: pack(["classic", "lean", "plump", "classic", "lean", "plump", "classic", "lean"]),
  };
}

export function wingMass(size: number, fat: number) {
  return size * (0.82 + fat * 0.45);
}

/** Air temperature next to the wing (°C), from fork height over the charcoal. */
export function fireAmbientC(distance: number): number {
  const d = Math.max(0.08, Math.min(1.35, distance));
  return 26 + 510 * Math.exp(-2.05 * d);
}

export function coreDoneness(tempC: number): number {
  return Math.max(0, Math.min(1.25, (tempC - COOK.coreOffsetC) / COOK.coreSpanC));
}
