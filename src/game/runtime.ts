import { TICK, WING_ARCHETYPES, fireAmbientC, SPIN, makeBagStock, type BagKind, type SkewerStyle, type WingId } from "./constants";
import { attachInput, sampleInput, setInjectedKeys, impulseSpin, setSkewerMode, resetWingNudge, setThrustHold } from "./input";
import { setSizzle, flareBoom, setAudioSuspended, steamPuff } from "./audio";
import { punch, shake } from "./juice";
import { buzz, buzzPattern } from "./haptics";
import {
  canAdvance,
  cookMinutesLabel,
  createSim,
  makeWing,
  nextPhase,
  resetCook,
  tickSim,
  type Phase,
  type Sim,
} from "./sim";
import { judge, type Verdict } from "./scoring";
import { loadSave, recordScore, writeSave } from "./save";
import { dailyBrief } from "./daily";

export interface HudSnap {
  phase: Phase;
  distance: number;
  angle: number;
  spin: number;
  heat: number;
  heats: number[];
  chars: number[];
  char: number;
  honey: number;
  moisture: number;
  even: number;
  sweet: boolean;
  leftSweet: boolean;
  roastPaused: boolean;
  wingCount: 1 | 2;
  glaze: "honey" | "soy";
  motion: boolean;
  motionDenied: boolean;
  time: number;
  thrust: number;
  extract: number;
  tutorial: boolean;
  best: number;
  daily: boolean;
  dailyLabel: string;
  windLabel: string;
  dailyBest: number;
  wind: number;
  history: number[];
  inBowl: boolean;
  overPlate: boolean;
  horizon: { x: number; y: number };
  cookLabel: string;
  coreTemp: number;
  skinTemp: number;
  fireC: number;
  hangDown: number;
  hangRisk: boolean;
  skewerLoose: boolean;
  faceA: number;
  faceB: number;
  needFlip: boolean;
  glazeEarly: boolean;
  oilWarn: boolean;
  fidget: boolean;
  openBag: BagKind | null;
  skewerStyle: SkewerStyle;
  marinated: boolean;
  cartilageHit: boolean;
  bagLeft: { marinated: number; plain: number };
  picked: number;
  freeSpin: boolean;
  drawnName: string;
  drawnGrams: number;
  drawnNote: string;
  skewerAim: number;
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      getPhase?: () => string;
      getCore?: () => number;
      getSkin?: () => number;
      getChar?: () => number;
      getCook?: () => number;
      getDist?: () => number;
      getThrust?: () => number;
      getWingCount?: () => number;
      getHang?: () => number;
      getLock?: () => number;
      getHangAngle?: () => number;
      getForkRoll?: () => number;
      setLock?: (v: number) => void;
      skip?: () => void;
      spin?: (v: number) => void;
      openBag?: (b: BagKind) => void;
      pickSlot?: (bag: BagKind, slot: number) => void;
      setSkewerStyle?: (s: SkewerStyle) => void;
      getSkewerStyle?: () => string;
      getMarinated?: () => boolean;
      getCartilage?: () => boolean;
      getOpenBag?: () => string | null;
      start?: () => void;
      setCount?: (n: 1 | 2, glaze?: "honey" | "soy") => void;
      drawRandom?: (b: BagKind) => void;
      setThrust?: (v: boolean) => void;
    };
  }
}

export class GameRuntime {
  sim: Sim = createSim();
  verdict: Verdict | null = null;
  hud: HudSnap;
  private acc = 0;
  private last = performance.now();
  private raf = 0;
  private detach: (() => void) | null = null;
  private listeners = new Set<() => void>();
  private _hudClock = 0;
  private horizon = { x: 0, y: 0 };
  private pendingPicks: Array<{ id: WingId; marinated: boolean }> = [];
  /** Edge-trigger: light reward when player re-enters the sweet roast zone. */
  private wasOutsideSweet = true;
  private lockHold = 0;

  constructor() {
    this.hud = this.snap();
  }

  private installProbe() {
    if (typeof window === "undefined") return;
    window.__controlsTest = {
      getYaw: () => this.sim.angle,
      getSpeed: () => Math.max(0, 0.72 - this.sim.distance),
      setKeys: (codes: string[]) => setInjectedKeys(codes),
      getPhase: () => this.sim.phase,
      getCore: () => this.sim.wings[0]?.coreTemp ?? -1,
      getSkin: () => this.sim.wings[0]?.skinTemp ?? -1,
      getChar: () => this.sim.wings[0]?.char ?? -1,
      getCook: () => this.sim.cookClock,
      getDist: () => this.sim.distance,
      getThrust: () => this.sim.thrust,
      getWingCount: () => this.sim.wings.length,
      getHang: () => this.sim.wings[0]?.hangDown ?? 0,
      getLock: () => this.sim.wings[0]?.skewerQuality ?? 0,
      getHangAngle: () => this.sim.wings[0]?.hang ?? 0,
      getForkRoll: () => this.sim.forkRoll,
      setLock: (v: number) => {
        this.sim.wings.forEach((w) => {
          w.skewerQuality = Math.max(0.12, Math.min(1, v));
          w.onFork = true;
          if (v < 0.3) {
            w.skewerStyle = "parallel";
            w.cartilageHit = false;
          } else {
            w.skewerStyle = "lock";
            w.cartilageHit = true;
          }
        });
      },
      skip: () => {
        this.skipAdvance();
      },
      spin: (v: number) => impulseSpin(v),
      openBag: (b: BagKind) => this.drawRandomFromBag(b),
      pickSlot: (bag: BagKind, slot: number) => this.pickFromBag(bag, slot),
      setSkewerStyle: (s: SkewerStyle) => this.setSkewerStyle(s),
      getSkewerStyle: () => this.sim.skewerStyle,
      getMarinated: () => this.sim.wings[0]?.marinated ?? false,
      getCartilage: () => this.sim.wings[0]?.cartilageHit ?? false,
      getOpenBag: () => this.sim.openBag,
      start: () => this.startFromTitle(),
      setCount: (n: 1 | 2, glaze?: "honey" | "soy") => this.setCount(n, glaze),
      drawRandom: (b: BagKind) => this.drawRandomFromBag(b),
      setThrust: (v: boolean) => setThrustHold(Boolean(v)),
    };
  }

  private startLoop() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.acc += dt;
      while (this.acc >= TICK) {
        this.step(TICK);
        this.acc -= TICK;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  mount(el: HTMLElement) {
    this.detach?.();
    this.installProbe();
    const onVis = () => setAudioSuspended(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const inputDetach = attachInput(el);
    this.detach = () => {
      document.removeEventListener("visibilitychange", onVis);
      inputDetach();
    };
    this.startLoop();
  }

  unmount() {
    this.detach?.();
    this.detach = null;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  onHud(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.hud = this.snap();
    this.listeners.forEach((f) => f());
  }

  private snap(): HudSnap {
    const w = this.sim.wings[0];
    const tutorial = !loadSave().tutorialDone;
    const leftSweet =
      (this.sim.phase === "roast1" || this.sim.phase === "roast2") &&
      (this.sim.distance < 0.38 || this.sim.distance > 0.62);
    const save = loadSave();
    const fireC = fireAmbientC(this.sim.distance);
    const left = (bag: BagKind) => this.sim.bagStock[bag].filter((x) => !x.taken).length;
    const freeSpin = Boolean(w?.onFork && w.skewerStyle === "parallel" && !w.cartilageHit);
    const arch = w ? WING_ARCHETYPES.find((a) => a.id === w.id) : undefined;
    return {
      phase: this.sim.phase,
      distance: this.sim.distance,
      angle: this.sim.angle,
      spin: this.sim.forkSpin,
      heat: w?.heat ?? 0,
      heats: this.sim.wings.map((x) => x.heat),
      chars: this.sim.wings.map((x) => x.char),
      char: w?.char ?? 0,
      honey: w?.honey ?? 0,
      moisture: w?.moisture ?? 0,
      even: w?.evenness ?? 0,
      sweet: this.sim.distance >= 0.38 && this.sim.distance <= 0.62,
      leftSweet,
      roastPaused: false,
      wingCount: 1,
      glaze: this.sim.glaze,
      motion: this.sim.motionEnabled,
      motionDenied: this.sim.motionDenied,
      time: this.sim.timeInPhase,
      thrust: this.sim.thrust,
      extract: this.sim.extractForce,
      tutorial,
      best: save.best,
      daily: this.sim.daily,
      dailyLabel: this.sim.daily ? this.sim.dailyKey.slice(5) : "",
      windLabel: this.sim.daily
        ? this.sim.wind >= 0.18
          ? "東風"
          : this.sim.wind <= -0.18
            ? "西風"
            : "微風"
        : "",
      dailyBest: save.dailyKey === this.sim.dailyKey ? save.dailyBest : 0,
      wind: this.sim.wind,
      history: save.history,
      inBowl: this.sim.phase === "honey" && this.sim.angle > 0.32 && this.sim.distance > 0.52,
      overPlate: this.sim.phase === "plate" && this.sim.angle < -0.32,
      horizon: this.horizon,
      cookLabel: cookMinutesLabel(this.sim.cookClock, fireC),
      coreTemp: w?.coreTemp ?? 8,
      skinTemp: w?.skinTemp ?? 12,
      fireC,
      hangDown: w?.hangDown ?? 0,
      hangRisk:
        (this.sim.phase === "roast1" || this.sim.phase === "roast2") &&
        (w?.hangDown ?? 0) > 0.62 &&
        (w?.onFork ?? false),
      skewerLoose:
        (this.sim.phase === "skewer" || this.sim.phase === "roast1" || this.sim.phase === "roast2") &&
        (w?.onFork ?? false) &&
        ((w?.skewerQuality ?? 1) < 0.48 || freeSpin),
      faceA: w?.faceA ?? 0,
      faceB: w?.faceB ?? 0,
      needFlip:
        (this.sim.phase === "roast1" || this.sim.phase === "roast2") &&
        this.sim.sinceSpin > SPIN.flipRemind &&
        (w?.evenness ?? 0) < 0.72,
      glazeEarly: this.sim.phase === "honey" && (w?.heat ?? 0) < 0.52,
      oilWarn:
        (this.sim.phase === "roast1" || this.sim.phase === "roast2" || this.sim.phase === "honey") &&
        this.sim.fatDrip > 0.32,
      fidget: this.sim.phase === "roast1" && this.sim.timeInPhase < 0.7 && this.sim.earlyFidget > 0.28,
      openBag: this.sim.openBag,
      skewerStyle: this.sim.skewerStyle,
      marinated: w?.marinated ?? false,
      cartilageHit: w?.cartilageHit ?? true,
      bagLeft: { marinated: left("marinated"), plain: left("plain") },
      picked: this.sim.wings.length,
      freeSpin,
      drawnName: w?.name ?? "",
      drawnGrams: w?.grams ?? 0,
      drawnNote: arch?.note ?? "",
      skewerAim: this.sim.skewerAim,
    };
  }

  private step(dt: number) {
    const aiming = this.sim.phase === "skewer" && !this.sim.wings[0]?.onFork;
    setSkewerMode(aiming);
    const input = sampleInput(dt);
    this.horizon = input.horizon;
    if (input.motionLive) {
      this.sim.motionEnabled = true;
      this.sim.motionDenied = false;
    }

    const skewering = this.sim.phase === "skewer";
    const frozen = input.holdFrozen;
    if (skewering) {
      if (frozen) {
        // Keep last yaw/pitch/roll so 吉 hold + gyro/swipe jitter cannot twist the 雞中翼.
        this.sim.wingAim.x = input.wingX;
        this.sim.wingAim.y = input.wingY;
        this.sim.wingAim.z = input.wingZ;
      } else {
        this.sim.wingAim.pitch = -1.05 + input.wingPitch + input.horizon.y * 0.28;
        this.sim.wingAim.yaw = 0.38 + input.wingYaw + input.horizon.x * 0.36;
        this.sim.wingAim.roll = 0.08;
        this.sim.wingAim.x = input.wingX;
        this.sim.wingAim.y = input.wingY;
        this.sim.wingAim.z = input.wingZ;
      }
    } else {
      this.sim.distance = this.sim.distance * 0.35 + input.distance * 0.65;
      this.sim.angle = this.sim.angle * 0.4 + input.angle * 0.6;
      this.sim.forkSpin = frozen ? 0 : input.spinRate;
      this.sim.plateAim = input.plateAim;
    }

    const beforeThrust = this.sim.thrust;
    const beforeExtract = this.sim.extractForce;
    const beforeChar = this.sim.wings[0]?.char ?? 0;
    const beforeOnPlate = this.sim.wings.some((w) => w.onPlate);
    const beforeHang = this.sim.wings[0]?.hangDown ?? 0;

    const leftSweet =
      (this.sim.phase === "roast1" || this.sim.phase === "roast2") &&
      (this.sim.distance < 0.38 || this.sim.distance > 0.62);
    const pauseRoast = false;

    if ((this.sim.phase === "roast1" || this.sim.phase === "roast2") && !leftSweet && this.wasOutsideSweet) {
      buzz(11);
      punch(0.14);
    }
    this.wasOutsideSweet = leftSweet || this.sim.phase === "count" || this.sim.phase === "pick" || this.sim.phase === "title";

    tickSim(this.sim, dt, { confirm: input.confirm, thrust: input.thrust }, { pauseRoast });

    if (this.sim.phase === "skewer" && this.sim.wings[0]?.onFork) {
      this.lockHold += dt;
      if (this.lockHold > 0.65) {
        this.lockHold = 0;
        this.tryAdvance();
      }
    } else {
      this.lockHold = 0;
    }

    const roastLive = this.sim.phase === "roast1" || this.sim.phase === "roast2";
    if (roastLive && !pauseRoast && this._hudClock % 6 === 0) {
      this.sim.record.push({
        t: this.sim.cookClock,
        distance: this.sim.distance,
        angle: this.sim.angle,
        spin: this.sim.forkSpin,
      });
      if (this.sim.record.length > 240) this.sim.record.shift();
    }

    if (this.sim.phase === "skewer" && this.sim.thrust >= 0.72 && beforeThrust < 0.72) {
      buzzPattern([12, 30, 24]);
      punch(0.45);
    }
    if (
      (this.sim.phase === "roast1" || this.sim.phase === "roast2" || this.sim.phase === "skewer") &&
      (this.sim.wings[0]?.hangDown ?? 0) > 0.72 &&
      beforeHang <= 0.72 &&
      (this.sim.wings[0]?.onFork ?? false)
    ) {
      buzz(10);
    }
    if (
      (this.sim.phase === "roast1" || this.sim.phase === "roast2") &&
      (this.sim.wings[0]?.char ?? 0) > 0.55 &&
      beforeChar <= 0.55
    ) {
      buzz(30);
      shake(0.55);
    }
    if (
      ((this.sim.phase === "roast1" || this.sim.phase === "roast2") &&
        this.sim.distance < 0.26 &&
        (this.sim.wings[0]?.fat ?? 0) > 0.4 &&
        this._hudClock % 40 === 0) ||
      (this.sim.phase === "honey" && this.sim.fatDrip > 0.45 && this.sim.distance < 0.4 && this._hudClock % 55 === 0)
    ) {
      flareBoom();
      buzz(14);
    }
    if (this.sim.phase === "extract" && this.sim.extractForce > 0.7 && beforeExtract <= 0.7) {
      buzz(22);
      shake(0.3);
    }
    if (this.sim.wings.some((w) => w.onPlate) && !beforeOnPlate) {
      steamPuff();
      buzzPattern([8, 18, 12]);
    }

    const nearFire = this.sim.phase === "roast1" || this.sim.phase === "roast2";
    setSizzle(nearFire ? Math.max(0, 1.1 - this.sim.distance) * 0.8 + (this.sim.wings[0]?.char ?? 0) * 0.2 : 0);

    if (this._hudClock++ % 5 === 0) this.emit();
  }

  setCount(_n: 1 | 2, glaze: "honey" | "soy" = "honey") {
    this.sim.wingCount = 1;
    this.sim.glaze = glaze;
    this.sim.phase = "pick";
    this.sim.timeInPhase = 0;
    this.sim.openBag = null;
    this.sim.bagStock = makeBagStock();
    this.sim.skewerStyle = "lock";
    this.pendingPicks = [];
    this.emit();
  }

  setGlaze(glaze: "honey" | "soy") {
    this.sim.glaze = glaze;
    this.emit();
  }

  openBag(bag: BagKind) {
    this.drawRandomFromBag(bag);
  }

  closeBag() {
    this.sim.openBag = null;
    this.emit();
  }

  setSkewerStyle(style: SkewerStyle) {
    this.sim.skewerStyle = style;
    this.sim.wings.forEach((w) => {
      if (!w.onFork) w.skewerStyle = this.sim.skewerStyle;
    });
    this.emit();
  }

  pickWings(ids: Array<WingId>) {
    this.sim.wingCount = 1;
    this.sim.wings = ids.slice(0, 1).map((id) => makeWing(id));
    this.sim.phase = "skewer";
    this.sim.openBag = null;
    resetCook(this.sim);
    this.sim.ghost = loadSave().ghost;
    this.emit();
  }

  drawRandomFromBag(bag: BagKind) {
    const stock = this.sim.bagStock[bag];
    if (!stock.length) return;
    if (stock.every((item) => item.taken)) {
      stock.forEach((item) => {
        item.taken = false;
      });
    }
    const pool = stock.map((item, i) => (item.taken ? -1 : i)).filter((i) => i >= 0);
    const slot = pool[Math.floor(Math.random() * pool.length)] ?? 0;
    this.pickFromBag(bag, slot);
  }

  pickFromBag(bag: BagKind, slot: number) {
    const item = this.sim.bagStock[bag][slot];
    if (!item || item.taken) return;
    item.taken = true;
    this.sim.wingCount = 1;
    this.sim.wings = [makeWing(item.id, { marinated: bag === "marinated", skewerStyle: this.sim.skewerStyle })];
    this.sim.phase = "skewer";
    this.sim.openBag = null;
    this.pendingPicks = [];
    resetCook(this.sim);
    resetWingNudge();
    this.sim.ghost = loadSave().ghost;
    buzzPattern([10, 24, 16]);
    punch(0.22);
    this.emit();
  }

  pickFromBoard(id: WingId) {
    this.drawRandomFromBag(this.sim.openBag ?? "plain");
    void id;
  }

  skipTutorial() {
    writeSave({ tutorialDone: true });
    this.emit();
  }

  startFromTitle() {
    this.sim.phase = "pick";
    this.sim.timeInPhase = 0;
    this.sim.wingCount = 1;
    this.sim.openBag = null;
    this.sim.bagStock = makeBagStock();
    this.sim.skewerStyle = "lock";
    this.pendingPicks = [];
    this.emit();
  }

  markMotion(ok: boolean) {
    this.sim.motionEnabled = ok;
    this.sim.motionDenied = !ok;
    this.emit();
  }

  startDaily() {
    const brief = dailyBrief();
    const save = loadSave();
    this.sim = createSim();
    this.sim.daily = true;
    this.sim.dailyKey = brief.key;
    this.sim.wind = brief.wind;
    this.sim.gust = brief.gust;
    this.sim.wingCount = 1;
    this.sim.glaze = (brief.key.charCodeAt(brief.key.length - 1) & 1) === 0 ? "soy" : "honey";
    this.sim.ghost = save.ghost;
    const marinated = this.sim.glaze === "honey";
    const id = brief.wings[0] ?? "classic";
    this.sim.wings = [makeWing(id, { marinated })];
    this.sim.phase = "skewer";
    this.sim.skewerStyle = "lock";
    resetCook(this.sim);
    this.verdict = null;
    this.installProbe();
    this.emit();
  }

  skipAdvance() {
    if (this.sim.phase === "pick" && this.sim.wings.length === 0) {
      this.drawRandomFromBag("plain");
      return true;
    }
    if ((this.sim.phase === "skewer" || this.sim.phase === "roast1") && this.sim.wings.length === 0) {
      this.sim.wings = [makeWing("classic")];
    }
    this.sim.wings.forEach((w) => {
      if (!w.onFork) {
        w.skewerStyle = this.sim.skewerStyle;
        if (this.sim.skewerStyle === "lock") {
          w.cartilageHit = true;
          w.skewerQuality = 0.55;
        } else {
          w.cartilageHit = false;
          w.skewerQuality = 0.12;
        }
        w.onFork = true;
      }
      if (this.sim.phase === "plate") w.onPlate = true;
    });
    if (this.sim.phase === "extract") this.sim.extractForce = Math.max(this.sim.extractForce, 0.4);
    if (this.sim.phase === "honey") {
      this.sim.wings.forEach((w) => {
        w.honey = Math.max(w.honey, 0.16);
      });
    }
    if (this.sim.phase === "roast1" || this.sim.phase === "roast2") {
      this.sim.timeInPhase = Math.max(this.sim.timeInPhase, 4);
    }
    // Debug / stuck-state escape. The roast HUD does not call this; it uses abandonPractice.
    return this.commitAdvance();
  }

  tryAdvance() {
    if (!canAdvance(this.sim)) return false;
    return this.commitAdvance();
  }

  /**
   * Leave roast or honey on purpose, with the wing as it is.
   * Does not invent cook time, glaze, or doneness.
   */
  abandonPractice() {
    const phase = this.sim.phase;
    if (phase !== "roast1" && phase !== "roast2" && phase !== "honey") return false;
    return this.commitAdvance();
  }

  private commitAdvance() {
    const n = nextPhase(this.sim.phase);
    if (n === "score") {
      this.verdict = judge(this.sim);
      recordScore(this.verdict.overall, {
        daily: this.sim.daily,
        dailyKey: this.sim.dailyKey,
        record: this.sim.record,
      });
    }
    if (n === "roast1" || n === "honey" || n === "roast2" || n === "plate" || n === "extract") {
      this.sim.timeInPhase = 0;
      this.sim.spinAbs = 0;
    }
    this.sim.phase = n;
    this.emit();
    return true;
  }

  restart() {
    const wasDaily = this.sim.daily;
    this.sim = createSim();
    this.verdict = null;
    resetWingNudge();
    this.lockHold = 0;
    this.installProbe();
    if (wasDaily) {
      this.startDaily();
      return;
    }
    this.emit();
  }
}
