import {
  COOK,
  EXTRACT,
  FIRE,
  HONEY,
  PLATE,
  SKEWER,
  SPIN,
  HANG,
  WIND,
  WING_ARCHETYPES,
  coreDoneness,
  fireAmbientC,
  makeBagStock,
  wingMass,
  type BagKind,
  type BagWing,
  type SkewerStyle,
  type WingId,
} from "./constants";

export interface WingAim {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
}

export function defaultWingAim(): WingAim {
  return { x: 0, y: 0, z: 0, pitch: -1.05, yaw: 0.38, roll: 0.08 };
}

export type Phase =
  | "title"
  | "count"
  | "pick"
  | "skewer"
  | "roast1"
  | "honey"
  | "roast2"
  | "plate"
  | "extract"
  | "score";

export interface WingState {
  id: WingId;
  name: string;
  size: number;
  fat: number;
  grams: number;
  /** 0..1 cooked through (core / meat), derived from coreTemp */
  heat: number;
  /** 0..1 surface char */
  char: number;
  moisture: number;
  honey: number;
  /** How evenly faces cooked 0..1 */
  evenness: number;
  faceA: number;
  faceB: number;
  onFork: boolean;
  onPlate: boolean;
  torn: number;
  skewerQuality: number;
  /** Meat centre °C */
  coreTemp: number;
  /** Skin °C */
  skinTemp: number;
  /** Game-seconds of fire after glaze was applied */
  glazeAge: number;
  /** Radians around the tine. 0 = 打橫; rest angle is comOffset (heavy meat down). */
  hang: number;
  hangVel: number;
  /** 0..1, 1 = heavy meat currently hanging toward the coals. */
  hangDown: number;
  /** Rest angle of the centre of mass (fatter wings sag further). */
  comOffset: number;
  /** From the 醃製袋. Starts with marinade coat. */
  marinated: boolean;
  /** lock = both tines ⊥ bone; parallel = one tine ∥ bone. */
  skewerStyle: SkewerStyle;
  /** Parallel pierce actually hit the knuckle cartilage. */
  cartilageHit: boolean;
}

export type GlazeType = "honey" | "soy";

export interface Sim {
  phase: Phase;
  wingCount: 1 | 2;
  wings: WingState[];
  glaze: GlazeType;
  distance: number;
  angle: number;
  spinAbs: number;
  forkSpin: number;
  /** Accumulated fork shaft roll (radians). Tines spin visually; wing hang is independent. */
  forkRoll: number;
  thrust: number;
  coat: number;
  plateAim: number;
  extractForce: number;
  timeInPhase: number;
  calibrated: boolean;
  motionEnabled: boolean;
  motionDenied: boolean;
  daily: boolean;
  dailyKey: string;
  wind: number;
  gust: number;
  cookClock: number;
  record: GhostSample[];
  ghost: GhostSample[] | null;
  fatDrip: number;
  /** Game-seconds since the wing actually turned (lock-weighted spin). */
  sinceSpin: number;
  /** Spin during the first moments of roast1 — fidget before skin sets. */
  earlyFidget: number;
  /** Which supermarket bag is open on the board. */
  openBag: BagKind | null;
  bagStock: Record<BagKind, BagWing[]>;
  /** Chosen pierce technique for the next thrust. */
  skewerStyle: SkewerStyle;
  /** Free-hand pose of the wing during the silent 吉 beat. */
  wingAim: WingAim;
  /** 0..1 how well tines line up with the two dimples. */
  skewerAim: number;
}

export interface GhostSample {
  t: number;
  distance: number;
  angle: number;
  spin: number;
}

export function makeWing(id: WingId, opts?: { marinated?: boolean; skewerStyle?: SkewerStyle }): WingState {
  const a = WING_ARCHETYPES.find((w) => w.id === id)!;
  const marinated = Boolean(opts?.marinated);
  return {
    id: a.id,
    name: marinated ? `醃·${a.name}` : a.name,
    size: a.size,
    fat: a.fat,
    grams: a.grams,
    heat: 0,
    char: 0,
    moisture: 0.78 + a.fat * 0.12 + (marinated ? 0.04 : 0),
    honey: marinated ? HONEY.bagStart : 0,
    evenness: 0.15,
    faceA: 0,
    faceB: 0,
    onFork: false,
    onPlate: false,
    torn: 0,
    skewerQuality: 0,
    coreTemp: COOK.startCoreC,
    skinTemp: COOK.startSkinC,
    glazeAge: 0,
    hang: 0,
    hangVel: 0,
    hangDown: 0,
    comOffset: a.id === "plump" ? 0.98 : a.id === "lean" ? 0.42 : 0.7,
    marinated,
    skewerStyle: opts?.skewerStyle ?? "lock",
    cartilageHit: true,
  };
}

export function createSim(): Sim {
  return {
    phase: "title",
    wingCount: 1,
    wings: [],
    glaze: "honey",
    distance: 0.7,
    angle: 0,
    spinAbs: 0,
    forkSpin: 0,
    forkRoll: 0,
    thrust: 0,
    coat: 0,
    plateAim: 0.5,
    extractForce: 0,
    timeInPhase: 0,
    calibrated: false,
    motionEnabled: false,
    motionDenied: false,
    daily: false,
    dailyKey: "",
    wind: 0,
    gust: 0,
    cookClock: 0,
    record: [],
    ghost: null,
    fatDrip: 0,
    sinceSpin: 0,
    earlyFidget: 0,
    openBag: null,
    bagStock: makeBagStock(),
    skewerStyle: "lock",
    wingAim: defaultWingAim(),
    skewerAim: 0,
  };
}

export function resetCook(sim: Sim) {
  sim.distance = 0.72;
  sim.angle = 0;
  sim.spinAbs = 0;
  sim.forkSpin = 0;
  sim.forkRoll = 0;
  sim.thrust = 0;
  sim.coat = 0;
  sim.plateAim = 0.5;
  sim.extractForce = 0;
  sim.timeInPhase = 0;
  sim.fatDrip = 0;
  sim.sinceSpin = 0;
  sim.earlyFidget = 0;
  sim.wingAim = defaultWingAim();
  sim.skewerAim = 0;
}

export function effectiveDistance(sim: Sim): number {
  const gust = Math.sin(sim.cookClock * (2.2 + sim.gust * 3)) * sim.gust * WIND.distancePush;
  return Math.max(0.05, Math.min(1.2, sim.distance + sim.wind * WIND.distancePush * 0.55 + gust));
}

/** Honey/soy bowl sits on the LEFT of the stall (player-visible). +angle = left. */
export function inHoneyBowl(sim: Sim): boolean {
  return sim.distance > 0.52 && sim.distance < 0.94 && sim.angle > 0.32;
}

/** Newspaper plate sits on the RIGHT. −angle = right. */
export function overPlate(sim: Sim): boolean {
  return sim.distance > 0.36 && sim.distance < 0.86 && sim.angle < -0.32;
}

function wrapPi(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function isFreeSpin(w: WingState) {
  return w.skewerStyle === "parallel" && !w.cartilageHit;
}

/** Heavy meat seeks world-down around the tine. Poor lock = slips; good lock follows the twist. */
export function tickHang(sim: Sim, dt: number) {
  sim.wings.forEach((w) => {
    if (!w.onFork) {
      w.hangVel *= Math.exp(-8 * dt);
      w.hangDown = 0.5 + 0.5 * Math.cos(w.hang - w.comOffset);
      return;
    }
    const mass = wingMass(w.size, w.fat);
    const free = isFreeSpin(w);
    const lock = free ? Math.min(0.16, Math.max(0.06, w.skewerQuality)) : Math.max(0.12, Math.min(1, w.skewerQuality));
    const spinXfer = free ? 0.03 : HANG.spinUnlock + lock * (HANG.spinLock - HANG.spinUnlock);
    w.hangVel += sim.forkSpin * spinXfer;
    const g = HANG.gravity * mass * (free ? 1.62 : 1.08 - lock * 0.82);
    w.hangVel += -Math.sin(w.hang - w.comOffset) * g * dt;
    const damp = free ? HANG.damping * 0.26 : HANG.damping + lock * HANG.lockDamp;
    w.hangVel *= Math.exp(-damp * dt);
    w.hang = wrapPi(w.hang + w.hangVel * dt);
    w.hangDown = 0.5 + 0.5 * Math.cos(w.hang - w.comOffset);
  });
}

export function tickSim(
  sim: Sim,
  dt: number,
  inputs: { confirm: boolean; thrust: boolean },
  opts?: { pauseRoast?: boolean },
) {
  const roast = sim.phase === "roast1" || sim.phase === "roast2";
  const paused = Boolean(opts?.pauseRoast && roast);

  if (!paused) {
    sim.timeInPhase += dt;
  }

  tickHang(sim, dt);
  sim.forkRoll = (sim.forkRoll ?? 0) + sim.forkSpin * dt;

  if (roast && !paused) {
    sim.cookClock += dt;
    const dist = effectiveDistance(sim);
    const ambient = fireAmbientC(dist);
    const windLean = sim.wind * WIND.anglePush;
    const angleBias = Math.max(-1, Math.min(1, sim.angle + windLean));
    const glazePhase = sim.phase === "roast2";

    sim.wings.forEach((w, i) => {
      const mass = wingMass(w.size, w.fat);
      const pairBias = sim.wingCount === 2 ? (i === 0 ? 1.08 : 0.82 + Math.abs(angleBias) * 0.18) : 1;
      const evenMul = 0.78 + w.evenness * 0.35;
      const glaze = Math.max(0, w.honey);
      const sugar = glazePhase ? 1 + glaze * HONEY.burnMul : 1 + glaze * 0.22;
      const thick = Math.max(0, glaze - HONEY.idealMax);
      const insulate = 1 + thick * HONEY.insulate * 5;

      const skinTau = COOK.skinTau / pairBias;
      const sag = w.hangDown;
      const sagDist = Math.max(0.08, dist - sag * HANG.distDrop * (0.45 + (1 - w.skewerQuality) * 0.7));
      const sagAmbient = fireAmbientC(sagDist);
      let targetSkin = (ambient * (1 - sag * 0.45) + sagAmbient * sag * 0.45) * (0.9 + (1 - w.evenness) * 0.1);
      if (glazePhase && glaze > 0.2 && ambient > 150) {
        targetSkin += glaze * 18;
      }
      w.skinTemp += (targetSkin - w.skinTemp) * Math.min(1, dt / skinTau);

      const coreTau =
        mass *
        COOK.coreTauMass *
        insulate *
        (w.skinTemp > 240 ? 1.3 + (w.skinTemp - 240) / 220 : 1) *
        (w.skewerQuality > 0.68 ? 0.9 : 1) *
        (w.marinated ? 0.92 : 1);
      w.coreTemp += ((w.skinTemp - w.coreTemp) / coreTau) * dt * evenMul * pairBias;
      w.heat = coreDoneness(w.coreTemp);

      const facePush = 0.5 + angleBias * 0.5;
      // hang=0: +Y (厚肉，原先向上) away from coals; hang=π: originally-up faces the fire.
      const cHang = Math.cos(w.hang);
      const fireA = 0.5 - 0.5 * cHang;
      const fireB = 0.5 + 0.5 * cHang;
      w.faceA = Math.min(1.35, w.faceA + dt * (w.skinTemp / 230) * (0.22 + fireA * 1.2) * facePush);
      w.faceB = Math.min(1.35, w.faceB + dt * (w.skinTemp / 230) * (0.22 + fireB * 1.2) * (1.15 - facePush));
      const uneven = 1 + Math.abs(w.faceA - w.faceB) * 0.45 + sag * (1 - w.skewerQuality) * 0.35;

      if (w.skinTemp > COOK.charC) {
        const over = (w.skinTemp - COOK.charC) / 48;
        w.char = Math.min(
          1,
          w.char + dt * 0.068 * Math.pow(Math.max(0.15, over), 1.28) * sugar * uneven * pairBias * (1 + sag * HANG.charMul),
        );
      } else if (w.skinTemp > COOK.maillardC && w.char < 0.28) {
        const rest = sim.phase === "roast1" && sim.earlyFidget > 0.55 ? 0.62 : 1;
        w.char = Math.min(0.28, w.char + dt * 0.042 * ((w.skinTemp - COOK.maillardC) / 32) * rest);
      }

      let dry = 0.035;
      if (w.skinTemp > 190) dry += 0.11 * ((w.skinTemp - 190) / 80);
      if (w.coreTemp > 78) dry += 0.085 * ((w.coreTemp - 78) / 18);
      if (dist < FIRE.tooClose) dry += 0.06;
      w.moisture = Math.max(0.05, w.moisture - dt * dry * (0.62 + (1 - w.fat) * 0.48));

      if (glazePhase) {
        w.glazeAge += dt;
        if (glaze > 0.1 && w.skinTemp > 148) {
          const burn = 0.028 + Math.max(0, w.skinTemp - COOK.sugarBurnC) * 0.0018;
          w.honey = Math.max(0.05, w.honey - dt * burn);
        }
      }

      if (sim.phase === "roast1" && dist < 0.34 && w.fat > 0.38 && w.skinTemp > 135) {
        sim.fatDrip = Math.min(1, sim.fatDrip + dt * 0.55 * w.fat);
      }

      if (sag > 0.58 && w.skewerQuality < 0.72) {
        w.evenness = Math.max(0.04, w.evenness - dt * HANG.evenLoss * sag * (1 - w.skewerQuality));
      }
    });
    sim.fatDrip = Math.max(0, sim.fatDrip - dt * 0.55);

    const spinInc = Math.abs(sim.forkSpin) > SPIN.deadZone ? Math.abs(sim.forkSpin) * dt : 0;
    sim.spinAbs += spinInc;
    let turned = 0;
    if (spinInc > 0) {
      sim.wings.forEach((w) => {
        const free = isFreeSpin(w);
        const lock = Math.max(0.12, w.skewerQuality);
        const actual = spinInc * (free ? 0.04 : 0.12 + lock * 0.88);
        turned += actual;
        w.evenness = Math.min(1, w.evenness + actual * SPIN.evennessPerRev);
        if (lock > 0.42 && !free) {
          const avg = (w.faceA + w.faceB) / 2;
          w.faceA += (avg - w.faceA) * actual * 0.4;
          w.faceB += (avg - w.faceB) * actual * 0.4;
        }
        w.skinTemp = Math.max(ambient * 0.55, w.skinTemp - actual * 9);
        if (w.char > 0.18) w.char = Math.max(0.08, w.char - actual * 0.014);
      });
    }
    if (turned > 0.004) sim.sinceSpin = 0;
    else sim.sinceSpin += dt;
    if (sim.phase === "roast1" && sim.timeInPhase < 0.55 && spinInc > 0) {
      sim.earlyFidget = (sim.earlyFidget ?? 0) + spinInc;
    }
  }

  if (sim.phase === "skewer") {
    const locked = sim.wings.length > 0 && sim.wings.every((w) => w.onFork);
    if (inputs.thrust && !locked) {
      sim.thrust = Math.min(1, sim.thrust + dt * SKEWER.thrustPerSec);
      if (sim.thrust >= SKEWER.thrustNeed) {
        sim.wings.forEach((w, i) => {
          const poseAim = 1 - Math.min(1, Math.abs(sim.angle) * 0.9 + Math.abs(sim.distance - 0.55) * 0.5);
          const aim = Math.max(0.08, Math.min(1, sim.skewerAim > 0.02 ? sim.skewerAim : poseAim));
          const extra = sim.wingCount === 2 && i === 1 ? 0.86 : 1;
          const style: SkewerStyle = sim.wingCount === 2 ? "lock" : sim.skewerStyle;
          w.skewerStyle = style;
          if (style === "lock") {
            w.cartilageHit = true;
            w.skewerQuality = Math.max(SKEWER.lockFloor, SKEWER.lockFloor + aim * (1 - SKEWER.lockFloor)) * extra;
          } else {
            const hit = aim >= SKEWER.cartilageAim;
            w.cartilageHit = hit;
            w.skewerQuality = hit ? Math.max(0.42, aim * 0.72) * extra : 0.08 + aim * 0.08;
          }
          w.onFork = true;
        });
      }
    } else if (!inputs.thrust && !locked) {
      sim.thrust = Math.max(0, sim.thrust - dt * SKEWER.retractPerSec);
    }
  }

  if (sim.phase === "honey") {
    if (inHoneyBowl(sim)) {
      sim.coat = Math.min(1.15, sim.coat + dt * HONEY.coatPerSecond);
      sim.wings.forEach((w) => {
        w.honey = Math.min(1.1, w.honey + dt * HONEY.coatPerSecond * (0.8 + w.evenness * 0.3));
        w.glazeAge = 0;
      });
    } else if (sim.coat > HONEY.idealMax || sim.wings.some((w) => w.honey > HONEY.idealMax)) {
      sim.wings.forEach((w) => {
        if (w.honey > HONEY.idealMax) {
          w.honey = Math.max(HONEY.idealMin * 0.8, w.honey - dt * HONEY.dripIfTooMuch);
          if (sim.distance < 0.42) {
            sim.fatDrip = Math.min(1, sim.fatDrip + dt * 0.35);
          }
        }
      });
    }
  }

  if (sim.phase === "plate" && (inputs.confirm || inputs.thrust)) {
    if (overPlate(sim)) {
      const aim = 1 - Math.min(1, Math.abs(sim.angle + 0.62) * 1.1 + Math.abs(sim.distance - 0.55) * 0.45);
      sim.wings.forEach((w) => {
        w.onPlate = aim > PLATE.dropNeed * 0.45;
        if (w.heat > 0.95) w.torn += PLATE.bounceIfHot * (1 - aim);
      });
    }
  }

  if (sim.phase === "extract" && inputs.thrust) {
    sim.extractForce = Math.min(1, sim.extractForce + dt * 2.2);
    sim.wings.forEach((w) => {
      if (sim.extractForce > EXTRACT.yankTear) {
        w.torn = Math.min(1, w.torn + dt * 1.4);
      }
    });
  }
}

export function canAdvance(sim: Sim): boolean {
  switch (sim.phase) {
    case "skewer":
      return sim.wings.length > 0 && sim.wings.every((w) => w.onFork);
    case "roast1":
      return sim.timeInPhase > COOK.roast1Floor;
    case "honey":
      return sim.wings.some((w) => w.honey > 0.12);
    case "roast2":
      return sim.timeInPhase > COOK.roast2Floor;
    case "plate":
      return sim.wings.some((w) => w.onPlate);
    case "extract":
      return sim.extractForce > EXTRACT.gentleMax * 0.5 || sim.timeInPhase > 1.2;
    default:
      return true;
  }
}

export const PHASE_ORDER: Phase[] = [
  "title",
  "count",
  "pick",
  "skewer",
  "roast1",
  "honey",
  "roast2",
  "plate",
  "extract",
  "score",
];

export function nextPhase(p: Phase): Phase {
  const i = PHASE_ORDER.indexOf(p);
  return PHASE_ORDER[Math.min(PHASE_ORDER.length - 1, i + 1)];
}

export function cookMinutesLabel(cookClock: number, fireC?: number) {
  const realMin = (cookClock * COOK.realSecPerGameSec) / 60;
  const time = realMin < 0.4 ? "過火未夠一分鐘" : `過火約 ${realMin.toFixed(1)} 分鐘`;
  if (fireC === undefined) return time;
  return `${time} · 火旁 ${Math.round(fireC)}°`;
}
