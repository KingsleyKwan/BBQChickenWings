"use client";

import { useEffect, useState } from "react";
import { requestMotion, recenterGyro, setThrustHold, setForkHoldFreeze, setSpinHold } from "../input";
import { unlockAudio, tapBlip, toggleMute, isMuted } from "../audio";
import { writeSave, loadSave } from "../save";
import { shareVerdict } from "../shareCard";
import { PHASE_COPY } from "../copy";
import type { GameRuntime, HudSnap } from "../runtime";
import type { WingScore } from "../scoring";
import { BUILD_VERSION } from "../buildVersion";

const LIVE_COACH: { on: (hud: HudSnap) => boolean; text: string }[] = [
  { on: (h) => h.needFlip, text: "該反轉啦——左右劃，淺色面轉落火" },
  { on: (h) => h.hangRisk, text: "厚肉垂咗貼火，抬高再轉" },
  { on: (h) => h.skewerLoose || h.freeSpin, text: "吉得鬆／單尖未中軟骨——厚肉會自己轉向下貼火" },
  { on: (h) => h.glazeEarly, text: "未夠九成熟，唔好急住搽蜜" },
  { on: (h) => h.oilWarn, text: "油火嚟緊，側開／抬高" },
  { on: (h) => h.fidget, text: "開頭十數秒定色，唔好狂轉" },
];

function liveCoachLines(hud: HudSnap, max = 2): string[] {
  const lines: string[] = [];
  for (const row of LIVE_COACH) {
    if (!row.on(hud)) continue;
    lines.push(row.text);
    if (lines.length >= max) break;
  }
  return lines;
}

export function Overlays({ runtime, hud }: { runtime: GameRuntime | null; hud: HudSnap }) {
  const [mute, setMute] = useState(isMuted);
  const [panel, setPanel] = useState<"none" | "record" | "setting">("none");
  const [banner, setBanner] = useState<string | null>(null);
  const [advanceWarn, setAdvanceWarn] = useState<string | null>(null);
  const title = hud.phase === "title";
  const roastHud =
    hud.phase === "roast1" ||
    hud.phase === "roast2" ||
    hud.phase === "honey" ||
    hud.phase === "plate" ||
    hud.phase === "extract";
  const copy = PHASE_COPY[hud.phase];
  const showTeach = Boolean(copy) && hud.phase !== "score";
  const compactTeach =
    hud.phase === "roast1" ||
    hud.phase === "roast2" ||
    hud.phase === "honey" ||
    hud.phase === "skewer";
  const live = liveCoachLines(hud, compactTeach ? 1 : 2);
  const beforeFork = hud.phase === "skewer" && !(runtime?.sim.wings[0]?.onFork ?? false);

  useEffect(() => {
    if (!advanceWarn) return;
    const id = window.setTimeout(() => setAdvanceWarn(null), 2600);
    return () => window.clearTimeout(id);
  }, [advanceWarn]);

  useEffect(() => {
    if (hud.phase !== "skewer" || !hud.drawnName) {
      setBanner(null);
      return;
    }
    const note = hud.drawnNote ? `——${hud.drawnNote}` : "";
    const text = `${hud.drawnName} · 約 ${Math.round(hud.drawnGrams)}g${note}`;
    setBanner(text);
    const id = window.setTimeout(() => {
      setBanner((cur) => (cur === text ? null : cur));
    }, 4600);
    return () => window.clearTimeout(id);
  }, [hud.phase, hud.drawnName, hud.drawnGrams, hud.drawnNote]);

  return (
    <div className={`ui ${title ? "ui-title" : ""}`}>
      <div className="top-stack">
        {showTeach && copy && (
          <div className={`teach${compactTeach ? " teach-compact" : ""}${title ? " teach-title" : ""}`}>
            {title ? (
              <>
                <p className="brand">燒雞翼</p>
                <p className="hint title-tagline">{copy.hint}</p>
              </>
            ) : compactTeach ? (
              <>
                <p className="kicker">{copy.kicker}</p>
                {live[0] ? (
                  <p className="coach pulse" role="status">
                    {live[0]}
                  </p>
                ) : (
                  <p className="hint">{copy.hint}</p>
                )}
              </>
            ) : (
              <>
                <p className="kicker">{copy.kicker}</p>
                <p className="hint">{copy.hint}</p>
                {hud.tutorial && copy.coach ? <p className="coach">{copy.coach}</p> : null}
                {live.map((line) => (
                  <p key={line} className="coach pulse" role="status">
                    {line}
                  </p>
                ))}
              </>
            )}
          </div>
        )}

        {roastHud && (
          <aside className="hud hud-thin" aria-label="火候">
            <DonenessGlyph faceA={hud.faceA} faceB={hud.faceB} coreTemp={hud.coreTemp} heat={hud.heat} />
            <Meter label="火" value={hud.heat} warn={hud.heat < 0.45 || hud.heat > 0.92} />
            <Meter label="焦" value={hud.char} warn={hud.char > 0.55} />
            <Meter label="醬" value={hud.honey} warn={hud.honey > 0.85} />
            <p className="cook-readout">{hud.cookLabel}</p>
            <p className={`core-light ${hud.coreTemp < 74 ? "raw" : "ok"}`}>
              <i aria-hidden="true" />
              {hud.coreTemp < 74
                ? `未到安全熟度 · 肉心 ${Math.round(hud.coreTemp)}°`
                : `肉心 ${Math.round(hud.coreTemp)}°`}
            </p>
          </aside>
        )}
      </div>

      {banner && (
        <p className="wing-banner" role="status">
          {banner}
        </p>
      )}

      <footer>
        {title && (
          <div className="title-actions">
            <button
              className="title-btn primary"
              aria-label="開始訓練"
              onClick={async () => {
                if (!runtime) return;
                tapBlip();
                await unlockAudio();
                const ok = await requestMotion();
                runtime.markMotion(ok);
                recenterGyro();
                setPanel("none");
                runtime.startFromTitle();
              }}
            >
              開始訓練
            </button>
            <button
              className="title-btn"
              aria-label="成績"
              onClick={() => {
                tapBlip();
                setPanel(panel === "record" ? "none" : "record");
              }}
            >
              成績
            </button>
            <button
              className="title-btn"
              aria-label="設定"
              onClick={() => {
                tapBlip();
                setPanel(panel === "setting" ? "none" : "setting");
              }}
            >
              設定
            </button>
          </div>
        )}

        {hud.phase === "pick" && runtime && (
          <div className="bag-pick picks" role="group" aria-label="揀袋">
            <button
              type="button"
              className="bag-btn marinade"
              aria-label="醃製中翼"
              onClick={() => {
                tapBlip();
                runtime.openBag?.("marinated");
              }}
            >
              醃製中翼
              <em>左邊 · 入味快</em>
            </button>
            <button
              type="button"
              className="bag-btn fresh"
              aria-label="鮮雞中翼"
              onClick={() => {
                tapBlip();
                runtime.openBag?.("plain");
              }}
            >
              鮮雞中翼
              <em>右邊 · 之後搽醬</em>
            </button>
          </div>
        )}

        {beforeFork && runtime && (
          <div className="skewer-styles" role="group" aria-label="吉法">
            <button
              type="button"
              className={hud.skewerStyle === "lock" ? "on" : ""}
              aria-pressed={hud.skewerStyle === "lock"}
              onClick={() => {
                tapBlip();
                runtime.setSkewerStyle("lock");
              }}
            >
              打橫雙尖
            </button>
            <button
              type="button"
              className={hud.skewerStyle === "parallel" ? "on" : ""}
              aria-pressed={hud.skewerStyle === "parallel"}
              onClick={() => {
                tapBlip();
                runtime.setSkewerStyle("parallel");
              }}
            >
              單尖軟骨
            </button>
          </div>
        )}

        {hud.phase === "skewer" && runtime && (
          <JiButton locked={runtime.sim.wings[0]?.onFork ?? false} thrust={hud.thrust} />
        )}

        {(hud.phase === "roast1" || hud.phase === "roast2" || hud.phase === "honey") && (
          <SpinPad />
        )}

        {roastHud && runtime && (
          <NextControl runtime={runtime} hud={hud} warn={advanceWarn} setWarn={setAdvanceWarn} />
        )}
      </footer>

      {panel === "record" && title && <RecordPanel onClose={() => setPanel("none")} hud={hud} />}
      {panel === "setting" && title && (
        <SettingPanel
          runtime={runtime}
          hud={hud}
          mute={mute}
          setMute={setMute}
          onClose={() => setPanel("none")}
        />
      )}

      <p className="build-stamp" aria-hidden="true">
        {BUILD_VERSION}
      </p>

      {hud.phase === "score" && runtime?.verdict && (
        <div className="scorecard" role="dialog" aria-label="今晚成績">
          <span className="chop" aria-hidden="true">
            {runtime.verdict.grade}
          </span>
          <p className="grade">{runtime.verdict.grade}</p>
          <p className="big">{runtime.verdict.overall}</p>
          <p className="title">{runtime.verdict.title}</p>
          <div className="radars">
            {runtime.verdict.wings.map((w) => (
              <Radar key={w.name} wing={w} />
            ))}
          </div>
          <ul>
            {runtime.verdict.comments.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {runtime.verdict.tips.length > 0 && (
            <>
              <p className="tips-label">下次可以</p>
              <ul>
                {runtime.verdict.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </>
          )}
          <div className="row">
            {hud.best > 0 && <p className="mini">最高 {hud.best} 分</p>}
            <button
              aria-label="再燒一轉"
              onClick={() => {
                writeSave({ tutorialDone: true });
                runtime?.restart();
              }}
            >
              再燒一轉
            </button>
            <button
              aria-label="分享成績"
              onClick={async () => {
                const v = runtime?.verdict;
                if (!v) return;
                await shareVerdict(v, hud.glaze);
              }}
            >
              分享成績
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NextControl({
  runtime,
  hud,
  warn,
  setWarn,
}: {
  runtime: GameRuntime;
  hud: HudSnap;
  warn: string | null;
  setWarn: (v: string | null) => void;
}) {
  const gated = hud.phase === "roast1" || hud.phase === "roast2" || hud.phase === "honey";

  useEffect(() => {
    return () => setForkHoldFreeze(false);
  }, []);

  const freeze = (on: boolean) => setForkHoldFreeze(on);

  return (
    <>
      {warn && (
        <p className="coach coach-pause advance-warn" role="status">
          {warn}
        </p>
      )}
      <button
        type="button"
        className={`next-btn${warn ? " warn" : ""}${gated ? " gated" : ""}`}
        aria-label="下一步"
        onPointerDown={(e) => {
          e.stopPropagation();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* already captured */
          }
          freeze(true);
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
          freeze(false);
        }}
        onPointerCancel={() => freeze(false)}
        onLostPointerCapture={() => freeze(false)}
        onClick={() => {
          tapBlip();
          freeze(false);
          if (gated) {
            if (runtime.tryAdvance()) {
              setWarn(null);
              return;
            }
            if (hud.phase === "roast1" || hud.phase === "roast2") {
              setWarn(
                hud.coreTemp < 72
                  ? "肉心約 74°、皮金黃就可以去下一步——而家會用而家狀態計分。"
                  : "過火再耐少少會更好——而家會用而家狀態計分。",
              );
            } else {
              setWarn("薄薄一層蜜糖就可以去下一步——而家會用而家狀態計分。");
            }
            runtime.abandonPractice();
            return;
          }
          if (runtime.tryAdvance()) {
            setWarn(null);
            return;
          }
          runtime.skipAdvance();
        }}
      >
        <strong>下一步</strong>
        {gated ? <em>可提早跳過／計分</em> : <em>繼續</em>}
      </button>
    </>
  );
}

function lerpHex(a: number, b: number, t: number) {
  const u = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * u);
  const g = Math.round(ag + (bg - ag) * u);
  const bc = Math.round(ab + (bb - ab) * u);
  return `#${((r << 16) | (g << 8) | bc).toString(16).padStart(6, "0")}`;
}

function skinFaceColor(face: number) {
  const t = Math.max(0, Math.min(1, face / 1.15));
  if (t < 0.45) return lerpHex(0xefb197, 0xd4a05a, t / 0.45);
  return lerpHex(0xd4a05a, 0x4a2414, (t - 0.45) / 0.55);
}

function coreMeatColor(temp: number, heat: number) {
  if (temp < 62) return lerpHex(0xd45a5a, 0xe0a04a, Math.max(0, (temp - 20) / 42));
  if (temp < 74) return lerpHex(0xe0a04a, 0xc8d45a, (temp - 62) / 12);
  return lerpHex(0xc8d45a, 0x7dff9a, Math.min(1, (temp - 74) / 12 + heat * 0.2));
}

function DonenessGlyph({
  faceA,
  faceB,
  coreTemp,
  heat,
}: {
  faceA: number;
  faceB: number;
  coreTemp: number;
  heat: number;
}) {
  const a = skinFaceColor(faceA);
  const b = skinFaceColor(faceB);
  const c = coreMeatColor(coreTemp, heat);
  return (
    <svg className="doneness" viewBox="0 0 52 40" aria-hidden="true">
      <path d="M8 20c0 10 8 16 18 16s18-6 18-16" fill={b} />
      <path d="M8 20c0-10 8-16 18-16s18 6 18 16" fill={a} />
      <ellipse cx="26" cy="20" rx="9" ry="7" fill={c} stroke="rgba(12,8,6,0.35)" strokeWidth="0.6" />
      <text x="3" y="11" fontSize="6" fill="currentColor">
        皮
      </text>
      <text x="26" y="22.5" fontSize="5.5" textAnchor="middle" fill="rgba(12,8,6,0.72)">
        肉心
      </text>
    </svg>
  );
}


function SpinPad() {
  const hold = (dir: number) => (e: { preventDefault(): void; stopPropagation(): void; currentTarget: HTMLButtonElement; pointerId: number }) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* already captured */
    }
    setSpinHold(dir);
  };
  const release = (e: { currentTarget: HTMLButtonElement; pointerId: number }) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setSpinHold(0);
  };
  return (
    <div className="spin-pad" role="group" aria-label="轉叉">
      <button
        type="button"
        aria-label="向左轉叉"
        onPointerDown={hold(1)}
        onPointerUp={release}
        onPointerCancel={() => setSpinHold(0)}
        onLostPointerCapture={() => setSpinHold(0)}
        onContextMenu={(e) => e.preventDefault()}
      >
        ← 轉叉
      </button>
      <p className="spin-label">左右劃／撳住轉</p>
      <button
        type="button"
        aria-label="向右轉叉"
        onPointerDown={hold(-1)}
        onPointerUp={release}
        onPointerCancel={() => setSpinHold(0)}
        onLostPointerCapture={() => setSpinHold(0)}
        onContextMenu={(e) => e.preventDefault()}
      >
        轉叉 →
      </button>
    </div>
  );
}

function JiButton({ locked, thrust }: { locked: boolean; thrust: number }) {
  return (
    <button
      type="button"
      className={`ji-btn ${locked ? "locked" : ""}`}
      aria-label="吉"
      disabled={locked}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (locked) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        tapBlip();
        setThrustHold(true);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        setThrustHold(false);
      }}
      onPointerCancel={() => setThrustHold(false)}
      onLostPointerCapture={() => setThrustHold(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <i style={{ transform: `scaleY(${0.12 + thrust * 0.88})` }} />
      <span>吉</span>
    </button>
  );
}

function Meter({ value, warn, label }: { value: number; warn?: boolean; label: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="meter">
      <span>{label}</span>
      <i>
        <b
          style={{
            width: `${v * 100}%`,
            background: warn && (v < 0.25 || v > 0.9) ? "var(--color-warn)" : "var(--color-ember-soft)",
          }}
        />
      </i>
    </div>
  );
}

function RecordPanel({ onClose, hud }: { onClose: () => void; hud: HudSnap }) {
  const save = loadSave();
  return (
    <div className="sheet" role="dialog" aria-label="成績">
      <p className="sheet-kicker">成績</p>
      <p className="sheet-big">{save.best || "—"}</p>
      <p className="mini">玩過 {save.plays} 轉</p>
      <div className="spark" aria-hidden="true">
        {(hud.history.length ? hud.history : [0]).map((n, i) => (
          <i key={i} style={{ height: `${Math.max(8, n)}%` }} />
        ))}
      </div>
      <button className="ghost-btn" onClick={onClose}>
        關閉
      </button>
    </div>
  );
}

function SettingPanel({
  runtime,
  hud,
  mute,
  setMute,
  onClose,
}: {
  runtime: GameRuntime | null;
  hud: HudSnap;
  mute: boolean;
  setMute: (v: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet" role="dialog" aria-label="設定">
      <p className="sheet-kicker">設定</p>
      <div className="row">
        <button
          onClick={() => {
            const next = toggleMute();
            setMute(next);
          }}
        >
          {mute ? "靜音" : "開聲"}
        </button>
        <button
          onClick={async () => {
            const ok = await requestMotion();
            runtime?.markMotion(ok);
            if (ok) recenterGyro();
          }}
        >
          {hud.motion ? "體感開咗" : "體感"}
        </button>
      </div>
      <div className="row">
        <button
          className={hud.glaze === "honey" ? "on" : ""}
          onClick={() => runtime?.setGlaze("honey")}
        >
          蜜糖
        </button>
        <button className={hud.glaze === "soy" ? "on" : ""} onClick={() => runtime?.setGlaze("soy")}>
          豉油
        </button>
      </div>
      <button className="ghost-btn" onClick={onClose}>
        關閉
      </button>
    </div>
  );
}

function Radar({ wing }: { wing: WingScore }) {
  const axes = [
    { k: "火", v: wing.heat },
    { k: "焦", v: wing.char },
    { k: "汁", v: wing.moisture },
    { k: "勻", v: wing.even },
    { k: "醬", v: wing.honey },
    { k: "功", v: wing.craft },
  ];
  const cx = 56;
  const cy = 56;
  const r = 36;
  const pt = (i: number, scale: number) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
    return [cx + Math.cos(a) * r * scale, cy + Math.sin(a) * r * scale] as const;
  };
  const poly = axes.map((ax, i) => pt(i, Math.max(0.08, ax.v / 100)).join(",")).join(" ");
  const ring = axes.map((_, i) => pt(i, 1).join(",")).join(" ");
  return (
    <svg className="radar" viewBox="0 0 112 112" aria-hidden="true">
      <polygon points={ring} fill="none" stroke="rgba(244,230,212,0.18)" />
      <polygon points={axes.map((_, i) => pt(i, 0.5).join(",")).join(" ")} fill="none" stroke="rgba(244,230,212,0.1)" />
      {axes.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(244,230,212,0.12)" />;
      })}
      <polygon points={poly} fill="rgba(224,122,50,0.45)" stroke="#e07a32" />
      {axes.map((ax, i) => {
        const [x, y] = pt(i, 1.22);
        return (
          <text key={ax.k} x={x} y={y} textAnchor="middle" dominantBaseline="middle">
            {ax.k}
          </text>
        );
      })}
    </svg>
  );
}
