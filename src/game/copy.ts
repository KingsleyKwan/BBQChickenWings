export const PHASE_COPY: Record<string, { kicker: string; hint: string; coach: string }> = {
  title: {
    kicker: "燒雞翼",
    hint: "袋入抽翼 · 吉叉 · 弱火轉勻",
    coach: "",
  },
  count: {
    kicker: "今晚搽咩醬",
    hint: "揀蜜糖定豉油。之後伸手入袋，隨機抽出一隻中翼。",
    coach: "新手先揀蜜糖。袋入面肥瘦都有，抽到邊隻就燒邊隻。",
  },
  pick: {
    kicker: "伸手入袋抽一隻",
    hint: "左邊醃製中翼、右邊鮮雞中翼。撳袋或者撳掣，隨機抽出一隻。畫面只會見到你抽到嗰隻。",
    coach: "醃過入味快；鮮雞要之後自己搽醬。大隻肉厚會垂，細隻外皮易燶。",
  },
  skewer: {
    kicker: "吉落長燒烤叉",
    hint: "對準骨位撳住「吉」；雙尖打橫鎖骨，或單尖搵軟骨。",
    coach: "",
  },
  roast1: {
    kicker: "第一次過火",
    hint: "弱火靠近炭爐，左右劃轉叉；肉心約 74°、皮金黃就可以去下一步。",
    coach: "",
  },
  honey: {
    kicker: "搽蜜糖",
    hint: "皮金黃帶燶邊先搽薄層；搽完就可以去下一步。",
    coach: "",
  },
  roast2: {
    kicker: "收汁過火",
    hint: "抬高半寸轉勻；蜜糖見火就焦，得就可以去下一步。",
    coach: "",
  },
  plate: {
    kicker: "上紙碟",
    hint: "將叉移去右邊報紙碟再確定。",
    coach: "手機右傾對準紙碟，撳確定或向上一彈。太熱會彈。",
  },
  extract: {
    kicker: "夾隻雞翼出嚟",
    hint: "夾嘴合埋，輕抽。",
    coach: "慢慢合鉗。大力一抽會撕皮。",
  },
  score: {
    kicker: "今晚成績",
    hint: "火位、翻面、吉叉鎖未鎖、翼大小、醬厚、收汁、定色、醃製全部入分。",
    coach: "睇建議再燒一轉。最高分會記住。",
  },
};

/** HK BBQ mid-wing drills — HolidaySmart / Shek O / charcoal two-zone. */
export const DRILLS: { id: string; title: string; body: string }[] = [
  {
    id: "bag",
    title: "袋入抽翼",
    body: "一袋醃製中翼、一袋鮮雞中翼。伸手入袋隨機抽一隻，抽到邊隻就燒邊隻。",
  },
  {
    id: "skewer",
    title: "打橫雙尖",
    body: "叉同骨垂直，兩個尖穿過隻翼，就算上重下輕都鎖得住，唔會自己反。",
  },
  {
    id: "parallel",
    title: "單尖軟骨",
    body: "叉同骨平行，只用一個尖。吉中軟骨先定；唔中就因為重量不平衡自己轉。",
  },
  {
    id: "swipe",
    title: "劃螢幕轉叉",
    body: "幾時都可以左右劃螢幕轉長燒烤叉，將淺色面轉落火。唔使撳住掣。",
  },
  {
    id: "rest",
    title: "先定色再轉",
    body: "開頭十數秒唔好狂轉，等皮定色；之後勤轉，將淺色面轉落火。",
  },
  {
    id: "hang",
    title: "厚肉會垂",
    body: "吉得鬆，點轉都係厚肉向下貼火。鎖住先將原先向上嗰面轉到落火。",
  },
  {
    id: "weak",
    title: "弱火靠近",
    body: "弱火可靠近炭爐（唔好貼住炭）。5–10 分鐘，每幾十秒反轉；避開油火否則燻黑。",
  },
  {
    id: "honey",
    title: "九成熟先搽",
    body: "金黃帶燶邊先搽蜜糖，每邊再收十秒。想蜜汁可再搽一次，最後唔好再搽。",
  },
];
