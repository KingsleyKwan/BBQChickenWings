import type { GhostSample } from "./sim";

const KEY = "siu-wing-save-v2";
const SAVE_VERSION = 2;

export interface SaveData {
  version: number;
  best: number;
  plays: number;
  tutorialDone: boolean;
  dailyKey: string;
  dailyBest: number;
  ghost: GhostSample[] | null;
  ghostScore: number;
  history: number[];
}

function empty(): SaveData {
  return {
    version: SAVE_VERSION,
    best: 0,
    plays: 0,
    tutorialDone: false,
    dailyKey: "",
    dailyBest: 0,
    ghost: null,
    ghostScore: 0,
    history: [],
  };
}

function migrate(raw: Partial<SaveData> & { version?: number }): SaveData {
  const s = { ...empty(), ...raw };
  if (!Array.isArray(s.history)) s.history = [];
  s.version = SAVE_VERSION;
  return s;
}

export function loadSave(): SaveData {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem("siu-wing-save-v1");
    if (!raw) return empty();
    return migrate(JSON.parse(raw) as Partial<SaveData>);
  } catch {
    return empty();
  }
}

export function writeSave(patch: Partial<SaveData>) {
  const next = { ...loadSave(), ...patch, version: SAVE_VERSION };
  if (typeof localStorage === "undefined") return next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function recordScore(
  overall: number,
  opts?: { daily?: boolean; dailyKey?: string; record?: GhostSample[] },
) {
  const s = loadSave();
  const history = [...s.history, overall].slice(-10);
  const patch: Partial<SaveData> = {
    best: Math.max(s.best, overall),
    plays: s.plays + 1,
    tutorialDone: true,
    history,
  };
  if (opts?.record && opts.record.length > 4 && overall >= s.ghostScore) {
    patch.ghost = opts.record.slice(0, 240);
    patch.ghostScore = overall;
  }
  if (opts?.daily && opts.dailyKey) {
    if (s.dailyKey !== opts.dailyKey) {
      patch.dailyKey = opts.dailyKey;
      patch.dailyBest = overall;
    } else {
      patch.dailyKey = opts.dailyKey;
      patch.dailyBest = Math.max(s.dailyBest, overall);
    }
  }
  return writeSave(patch);
}
