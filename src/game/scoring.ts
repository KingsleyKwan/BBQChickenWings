import { HONEY, SCORE } from "./constants";
import type { Sim, WingState } from "./sim";

export interface WingScore {
  name: string;
  total: number;
  heat: number;
  char: number;
  moisture: number;
  even: number;
  honey: number;
  craft: number;
}

export interface Verdict {
  title: string;
  grade: string;
  overall: number;
  wings: WingScore[];
  comments: string[];
  tips: string[];
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function heatScore(h: number) {
  const d = Math.abs(h - SCORE.heatTarget);
  return clamp01(1 - d / 0.42);
}

function charScore(c: number) {
  if (c < 0.08) return 0.38;
  if (c <= SCORE.charCap) return 0.7 + (c / SCORE.charCap) * 0.3;
  return clamp01(1 - (c - SCORE.charCap) / 0.42);
}

function moistScore(m: number) {
  const d = Math.abs(m - SCORE.moistureTarget);
  return clamp01(1 - d / 0.4);
}

function honeyScore(h: number) {
  if (h < HONEY.idealMin) return clamp01(h / HONEY.idealMin) * 0.7;
  if (h <= HONEY.idealMax) return 0.85 + ((h - HONEY.idealMin) / (HONEY.idealMax - HONEY.idealMin)) * 0.15;
  return clamp01(1 - (h - HONEY.idealMax) / 0.38);
}

function gradeFor(n: number): string {
  if (n >= 92) return "傳奇街坊";
  if (n >= 84) return "燒味師父";
  if (n >= 74) return "識食";
  if (n >= 62) return "及格煲底";
  if (n >= 48) return "有心無力";
  return "炭多過肉";
}

function outcomeTitle(
  heat: number,
  char: number,
  moist: number,
  even: number,
  honey: number,
  glazeAge: number,
  fat: number,
): string {
  const raw = heat < 0.45;
  const just = heat >= 0.62 && heat <= 0.86;
  const over = heat > 0.95;
  const pale = char < 0.14;
  const crisp = char >= 0.22 && char <= 0.45;
  const burnt = char > 0.58;
  const faceGap = even < 0.32;

  if (burnt && raw) return "外燶內生";
  if (crisp && just && moist >= 0.32 && moist <= 0.58 && honey >= 0.28 && honey <= 0.82) return "外脆內嫩";
  if (faceGap && (burnt || char > 0.4)) return "一面焦一面生";
  if (honey > 0.78 && burnt) return "蜜糖焦黑";
  if (honey > 0.55 && glazeAge < 1.4 && just) return "糖漿未收";
  if (moist < 0.24) return "汁水走晒";
  if (pale && just) return "皮未定色";
  if (over) return "燒得過火";
  if (just) return "火候到位";
  return "再練習一轉";
}

function scoreWing(w: WingState, two: boolean, index: number): WingScore {
  const heat = heatScore(w.heat);
  const char = charScore(w.char);
  const moisture = moistScore(w.moisture);
  const even = clamp01(w.evenness * 0.75 + (1 - Math.abs(w.faceA - w.faceB)) * 0.25);
  const honey = honeyScore(w.honey);
  let craft = clamp01(w.skewerQuality * 0.55 + (1 - w.torn) * 0.45);
  if (two && index === 1) craft -= SCORE.twoWingBiasPenalty * Math.abs(w.heat - 0.74);
  if (w.char > 0.55 && w.heat < 0.5) craft -= 0.18;
  if (w.glazeAge > 0 && w.glazeAge < 1.2 && w.honey > 0.5) craft -= 0.08;
  if (w.coreTemp >= 72 && w.coreTemp <= 78 && w.char >= 0.22 && w.char <= 0.42) craft += 0.06;
  if (w.skewerStyle === "lock" && w.skewerQuality > 0.8) craft += 0.04;
  if (w.skewerStyle === "parallel" && !w.cartilageHit) craft -= 0.16;
  if (w.skewerStyle === "parallel" && w.cartilageHit) craft += 0.03;
  const total = heat * 30 + char * 18 + moisture * 14 + even * 14 + honey * 14 + craft * 10;
  return {
    name: w.name,
    total: Math.round(clamp01(total / 100) * 100),
    heat: Math.round(heat * 100),
    char: Math.round(char * 100),
    moisture: Math.round(moisture * 100),
    even: Math.round(even * 100),
    honey: Math.round(honey * 100),
    craft: Math.round(clamp01(craft) * 100),
  };
}

export function judge(sim: Sim): Verdict {
  const wings = sim.wings.map((w, i) => scoreWing(w, sim.wingCount === 2, i));
  const overall = Math.round(wings.reduce((s, w) => s + w.total, 0) / Math.max(1, wings.length));
  const comments: string[] = [];
  const tips: string[] = [];

  const avgHeat = sim.wings.reduce((s, w) => s + w.heat, 0) / Math.max(1, sim.wings.length);
  const avgChar = sim.wings.reduce((s, w) => s + w.char, 0) / Math.max(1, sim.wings.length);
  const avgMoist = sim.wings.reduce((s, w) => s + w.moisture, 0) / Math.max(1, sim.wings.length);
  const avgHoney = sim.wings.reduce((s, w) => s + w.honey, 0) / Math.max(1, sim.wings.length);
  const avgEven = sim.wings.reduce((s, w) => s + w.evenness, 0) / Math.max(1, sim.wings.length);
  const avgCore = sim.wings.reduce((s, w) => s + w.coreTemp, 0) / Math.max(1, sim.wings.length);
  const avgSkin = sim.wings.reduce((s, w) => s + w.skinTemp, 0) / Math.max(1, sim.wings.length);
  const avgGlazeAge = sim.wings.reduce((s, w) => s + w.glazeAge, 0) / Math.max(1, sim.wings.length);
  const avgFat = sim.wings.reduce((s, w) => s + w.fat, 0) / Math.max(1, sim.wings.length);
  const torn = sim.wings.reduce((s, w) => s + w.torn, 0);
  const grams = sim.wings.reduce((s, w) => s + w.grams, 0) / Math.max(1, sim.wings.length);
  const realMin = (sim.cookClock * 48) / 60;

  const title = outcomeTitle(avgHeat, avgChar, avgMoist, avgEven, avgHoney, avgGlazeAge, avgFat);

  if (avgChar > 0.58 && avgHeat < 0.5) {
    comments.push(
      `外皮已經燶（皮溫約 ${Math.round(avgSkin)}°），肉心先得 ${Math.round(avgCore)}°——火太近，熱傳唔入 ${grams.toFixed(0)}g 嘅肉。`,
    );
  } else if (avgHeat < 0.45) {
    comments.push(
      `肉心約 ${Math.round(avgCore)}°，未到 74°。${grams.toFixed(0)}g 中翼過火約 ${realMin.toFixed(1)} 分鐘偏短。`,
    );
  } else if (avgHeat > 0.95) {
    comments.push(`燒得過火，肉心 ${Math.round(avgCore)}°，肉質開始乾韌。`);
  } else {
    comments.push(`肉心約 ${Math.round(avgCore)}°，接近熟透，有炭香。`);
  }

  const glazeName = sim.glaze === "soy" ? "豉油" : "蜜糖";
  const glazeThin = sim.glaze === "soy" ? "豉油層太薄，鹹香出唔到來。" : "蜜糖層太薄，甜香出唔到來。";
  const glazeThick = sim.glaze === "soy" ? "豉油厚得滯，收汁時好易焦。" : "糖漿厚得滯，見高溫就焦，外燶內生風險好高。";
  const glazeGood = sim.glaze === "soy" ? "豉油收得靚，有光澤同鹹香。" : "蜜糖薄薄一層收得靚，有光澤。";
  const glazeBowl = sim.glaze === "soy" ? "豉油碗" : "蜜碗";

  if (avgChar > 0.58) comments.push(`外皮燶得滯，苦味搶咗${glazeName}。`);
  else if (avgChar < 0.12) comments.push("皮色偏淡，未有焦糖脆。離火太遠或者轉得太勤。");
  else comments.push("表皮有斑斕焦色，咬落有脆。");

  if (avgMoist < 0.28) comments.push("汁水走晒，咬落會柴。高溫太耐會逼乾。");
  else if (avgMoist > 0.68) comments.push("仲有多餘水氣，皮唔夠脆。肥翼要多逼一陣油。");
  else comments.push("汁水同外皮平衡得幾好。");

  if (avgHoney < 0.3) comments.push(glazeThin);
  else if (avgHoney > 0.85) comments.push(glazeThick);
  else comments.push(glazeGood);

  if (avgGlazeAge > 0 && avgGlazeAge < 1.5 && avgHoney > 0.4) {
    comments.push(`塗完${glazeName}只收咗 ${(avgGlazeAge * 48) / 60 < 1 ? "唔夠一分鐘" : `約 ${((avgGlazeAge * 48) / 60).toFixed(1)} 分鐘`}，糖漿未收乾。`);
  } else if (avgGlazeAge > 5 && avgChar > 0.5) {
    comments.push("收汁燒得太耐，糖已經炭化。");
  }

  if (avgEven < 0.4) comments.push("轉動唔夠，一面焦一面生。弱火都要每幾十秒反轉。");
  else comments.push("有轉叉，受熱比較均勻。");

  if (sim.earlyFidget > 0.7) {
    comments.push("開頭轉得太勤，皮未定色就反面，金黃出得慢。");
  } else if (avgChar >= 0.18 && sim.earlyFidget < 0.4) {
    comments.push("開頭有等皮定色，之後先轉，Maillard 金黃出得穩。");
  }

  const avgHang = sim.wings.reduce((s, w) => s + w.hangDown, 0) / Math.max(1, sim.wings.length);
  const avgLock = sim.wings.reduce((s, w) => s + w.skewerQuality, 0) / Math.max(1, sim.wings.length);
  const free = sim.wings.some((w) => w.skewerStyle === "parallel" && !w.cartilageHit);
  const locked = sim.wings.every((w) => w.skewerStyle === "lock" && w.skewerQuality > 0.7);
  const paraHit = sim.wings.some((w) => w.skewerStyle === "parallel" && w.cartilageHit);

  if (free) {
    comments.push("單尖冇吉中軟骨，重量不平衡令隻翼自己轉，點劃螢幕都鎖唔住。");
  } else if (avgLock < 0.45) {
    comments.push("吉叉冇鎖骨頭下底，翼自己下垂，厚肉一面長期貼火。");
  } else if (avgHang > 0.68 && avgEven < 0.5) {
    comments.push("厚肉垂低貼炭太耐，下面已經燶、上面仲淡。");
  } else if (locked) {
    comments.push("打橫雙尖穿過隻翼，鎖得住，劃螢幕轉叉先翻到面。");
  } else if (paraHit) {
    comments.push("單尖吉中軟骨，定得幾穩，不過始終冇雙尖咁死鎖。");
  }

  if (sim.wings.some((w) => w.marinated)) {
    comments.push("醃製袋嗰隻入味快啲，皮色出得早；鮮雞就要自己搽醬。");
  }

  if (sim.wingCount === 2 && sim.wings.length > 1) {
    const gap = Math.abs(sim.wings[0].heat - sim.wings[1].heat);
    if (gap > 0.22) comments.push("兩隻一齊燒時內外受熱唔同，貼火嗰隻搶咗火，入面嗰隻仲生。");
    else comments.push("一叉兩隻控制得穩，兩隻熟度接近。");
  }

  if (torn > 0.25) comments.push("夾出嚟時整損咗，賣相扣分。");

  if (sim.daily) {
    const side =
      sim.wind > 0.18 ? "東風將火推向紙碟側" : sim.wind < -0.18 ? `西風將火推向${glazeBowl}側` : "今晚山風好細";
    comments.push(`今日場地挑戰：${side}，火位同平時唔同。`);
  }

  if (avgHeat < 0.5 && avgChar > 0.5) tips.push("貼火只會燶皮。抬高返甜區，肥翼要多留幾分鐘等肉心跟上。");
  else if (avgHeat < 0.5) tips.push("第一次過火可以再停甜區耐啲。大隻翼肉厚，急唔來。");
  if (avgChar > 0.5) tips.push("距離炭爐太近會飆焦；蜜糖塗厚咗收汁時更易燶。");
  if (avgEven < 0.45) tips.push("弱火靠近，每幾十秒左右劃螢幕轉叉，將淺色嗰面轉落火。吉得準先轉得動。");
  if (free) {
    tips.push("單尖要對準骹位軟骨再吉。吉歪就因為重量自己轉。想鎖死就改打橫雙尖。");
  } else if (avgLock < 0.5 || avgHang > 0.65) {
    tips.push("打橫放、肉多向自己、兩個尖穿過骨頭下底嘅肉，先鎖得住。吉得鬆，點轉都係厚肉向下。");
  }
  if (sim.earlyFidget > 0.55) tips.push("開頭十數秒等皮定色，之後先勤轉。太早狂轉，金黃出得慢。");
  if (avgLock > 0.55 && avgHeat < 0.55) tips.push("厚肉位劃兩刀到骨，熱先入心，唔使貼火都熟得勻。");
  if (avgHoney < 0.35) tips.push(`塗${glazeName}時將叉放低浸入左邊碗，左右輕輕掃。`);
  if (avgHoney > 0.85) tips.push(`${glazeName}塗完抖一抖，多餘醬汁甩返落碗，收汁先唔會燶。`);
  if (avgGlazeAge < 1.6 && avgHoney > 0.35) tips.push("搽完蜜糖每邊再收十秒至兩分鐘，九成熟先搽，最後半分鐘唔好再搽。");
  if (sim.wingCount === 2) tips.push("燒兩隻時靠轉動同微側角度，補內側嗰隻。單尖只適合一隻。");
  if (torn > 0.2) tips.push("上碟同夾出嚟用輕力，唔好大力一抽。");
  if (tips.length === 0) tips.push(`保持甜區距離，左右劃螢幕轉叉，${glazeName}薄薄一層，肥翼就耐燒一陣。`);

  return {
    title: overall >= 84 && title === "外脆內嫩" ? "今晚呢碟得" : title,
    grade: gradeFor(overall),
    overall,
    wings,
    comments,
    tips,
  };
}
