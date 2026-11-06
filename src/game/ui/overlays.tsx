"use client";

import { useState } from "react";
import { requestMotion, recenterGyro, setThrustHold } from "../input";
import { unlockAudio, tapBlip, toggleMute, isMuted } from "../audio";
import { writeSave, loadSave } from "../save";
import { shareVerdict } from "../shareCard";
import type { GameRuntime } from "../runtime";
import type { HudSnap } from "../runtime";
import type { WingScore } from "../scoring";

export function Overlays({ runtime, hud }: { runtime: GameRuntime | null; hud: HudSnap }) {
  const [mute, setMute] = useState(isMuted);
  const [panel, setPanel] = useState<"none" | "record" | "setting">("none");
  const silent = hud.phase === "pick" || hud.phase === "skewer";
  const title = hud.phase === "title";
  const roastHud =
    hud.phase === "roast1" ||
    hud.phase === "roast2" ||
    hud.phase === "honey" ||
    hud.phase === "plate" ||
    hud.phase === "extract";

  return (
    <div className={`ui ${silent ? "ui-silent" : ""} ${title ? "ui-title" : ""}`}>
      {title && (
        <header>
          <p className="brand">燒雞翼</p>
        </header>
      )}

      {roastHud && (
        <aside className="hud hud-thin" aria-hidden="true">
          <Meter value={hud.heat} warn={hud.heat < 0.45 || hud.heat > 0.92} />
          <Meter value={hud.char} warn={hud.char > 0.55} />
          <Meter value={hud.honey} warn={hud.honey > 0.85} />
        </aside>
      )}

      <footer>
        {title && (
          <div className="title-actions">
            <button
              className="title-btn primary"
              aria-label="Start Game"
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
              Start Game
            </button>
            <button
              className="title-btn"
              aria-label="Record"
              onClick={() => {
                tapBlip();
                setPanel(panel === "record" ? "none" : "record");
              }}
            >
              Record
            </button>
            <button
              className="title-btn"
              aria-label="Setting"
              onClick={() => {
                tapBlip();
                setPanel(panel === "setting" ? "none" : "setting");
              }}
            >
              Setting
            </button>
          </div>
        )}

        {hud.phase === "skewer" && runtime && (
          <JiButton locked={runtime.sim.wings[0]?.onFork ?? false} thrust={hud.thrust} />
        )}

        {roastHud && runtime && (
          <button
            className="next-dot"
            aria-label="下一步"
            onClick={() => {
              tapBlip();
              if (!runtime.tryAdvance()) runtime.skipAdvance();
            }}
          />
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

function JiButton({
  locked,
  thrust,
}: {
  locked: boolean;
  thrust: number;
}) {
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

function Meter({ value, warn }: { value: number; warn?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="meter">
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
    <div className="sheet" role="dialog" aria-label="Record">
      <p className="sheet-kicker">Record</p>
      <p className="sheet-big">{save.best || "—"}</p>
      <p className="mini">plays {save.plays}</p>
      <div className="spark" aria-hidden="true">
        {(hud.history.length ? hud.history : [0]).map((n, i) => (
          <i key={i} style={{ height: `${Math.max(8, n)}%` }} />
        ))}
      </div>
      <button className="ghost-btn" onClick={onClose}>
        Close
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
    <div className="sheet" role="dialog" aria-label="Setting">
      <p className="sheet-kicker">Setting</p>
      <div className="row">
        <button
          onClick={() => {
            const next = toggleMute();
            setMute(next);
          }}
        >
          {mute ? "Sound off" : "Sound on"}
        </button>
        <button
          onClick={async () => {
            const ok = await requestMotion();
            runtime?.markMotion(ok);
            if (ok) recenterGyro();
          }}
        >
          {hud.motion ? "Gyro on" : "Gyro"}
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
        Close
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
