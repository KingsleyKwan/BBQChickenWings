import { WING_ARCHETYPES, type WingId } from "./constants";

/** Hong Kong civil date YYYY-MM-DD (UTC+8). */
export function hkDateKey(now = Date.now()): string {
  const d = new Date(now + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashDate(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DailyBrief {
  key: string;
  wind: number;
  gust: number;
  wingCount: 1 | 2;
  wings: WingId[];
  label: string;
  windLabel: string;
}

export function dailyBrief(now = Date.now()): DailyBrief {
  const key = hkDateKey(now);
  const rand = mulberry32(hashDate(key));
  const wind = (rand() * 2 - 1) * 0.72;
  const gust = 0.15 + rand() * 0.45;
  const wingCount: 1 | 2 = 1;
  const wings: WingId[] = [WING_ARCHETYPES[Math.floor(rand() * WING_ARCHETYPES.length)]!.id];
  const dir = wind > 0.18 ? "東風" : wind < -0.18 ? "西風" : "微風";
  const force = Math.abs(wind) > 0.45 ? "急" : Math.abs(wind) > 0.22 ? "中" : "細";
  return {
    key,
    wind,
    gust,
    wingCount,
    wings,
    label: `${key.slice(5)} 檔口`,
    windLabel: `${dir}${force} · 袋入抽一隻`,
  };
}
