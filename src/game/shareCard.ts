import type { Verdict } from "./scoring";

export async function makeShareCard(verdict: Verdict, glaze: "honey" | "soy"): Promise<Blob | null> {
  const w = 1080;
  const h = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#1a120e");
  g.addColorStop(1, "#110c09");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#e07a32";
  ctx.font = "500 36px 'Noto Sans HK', sans-serif";
  ctx.fillText("燒雞翼", 80, 120);

  ctx.fillStyle = "#f4e6d4";
  ctx.font = "600 48px 'Noto Serif HK', serif";
  ctx.fillText(verdict.grade, 80, 200);

  ctx.font = "600 220px 'Noto Serif HK', serif";
  ctx.fillText(String(verdict.overall), 80, 430);

  ctx.fillStyle = "#c9b39a";
  ctx.font = "400 36px 'Noto Sans HK', sans-serif";
  ctx.fillText(verdict.title, 80, 500);
  ctx.fillText(glaze === "soy" ? "豉油" : "蜜糖", 80, 560);

  ctx.font = "400 30px 'Noto Sans HK', sans-serif";
  let y = 660;
  for (const c of verdict.comments.slice(0, 4)) {
    ctx.fillText(c, 80, y, 920);
    y += 52;
  }

  ctx.fillStyle = "#e07a32";
  ctx.font = "500 28px 'Noto Sans HK', sans-serif";
  ctx.fillText("建議", 80, y + 30);
  ctx.fillStyle = "#c9b39a";
  y += 80;
  for (const t of verdict.tips.slice(0, 3)) {
    ctx.fillText(t, 80, y, 920);
    y += 48;
  }

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88);
  });
}

export async function shareVerdict(verdict: Verdict, glaze: "honey" | "soy") {
  const text = `燒雞翼 ${verdict.overall}分 · ${verdict.grade}\n${verdict.comments[0] ?? ""}`;
  const blob = await makeShareCard(verdict, glaze);
  try {
    if (blob && navigator.share && navigator.canShare) {
      const file = new File([blob], "siu-wing.jpg", { type: "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: "燒雞翼", text, files: [file] });
        return;
      }
    }
    if (navigator.share) {
      await navigator.share({ title: "燒雞翼", text });
      return;
    }
    await navigator.clipboard.writeText(text);
  } catch {
    /* cancelled */
  }
}
