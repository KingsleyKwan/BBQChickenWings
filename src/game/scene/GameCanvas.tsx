"use client";

import { useEffect, useRef } from "react";
import type { GameRuntime } from "../runtime";
import { tapBlip } from "../audio";
import { nudgeWing } from "../input";
import { StallScene } from "./stall";

export function GameCanvas({ runtime }: { runtime: GameRuntime | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sightA = useRef<HTMLSpanElement>(null);
  const sightB = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !runtime) return;
    let scene: StallScene;
    try {
      scene = new StallScene(canvas);
    } catch (err) {
      console.error("WebGL stall failed", err);
      return;
    }
    runtime.mount(canvas);
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      scene.sync(runtime.sim, dt);
      const [a, b] = scene.tineScreen;
      if (sightA.current) {
        sightA.current.style.opacity = a.visible ? "1" : "0";
        sightA.current.style.left = `${a.x}%`;
        sightA.current.style.top = `${a.y}%`;
      }
      if (sightB.current) {
        sightB.current.style.opacity = b.visible ? "1" : "0";
        sightB.current.style.left = `${b.x}%`;
        sightB.current.style.top = `${b.y}%`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let downX = 0;
    let downY = 0;
    const ptrs = new Map<number, { x: number; y: number }>();

    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* already */
      }
    };
    const onMove = (e: PointerEvent) => {
      if (runtime.sim.phase !== "skewer" || runtime.sim.wings[0]?.onFork) return;
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      p.x = e.clientX;
      p.y = e.clientY;
      if (ptrs.size === 1) {
        nudgeWing({ yaw: dx / w * 2.4, pitch: dy / h * 2.1 });
      } else if (ptrs.size >= 2) {
        nudgeWing({ x: dx / w * 0.55, y: -dy / h * 0.4, z: dy / h * 0.2 });
      }
    };
    const onUp = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      if (runtime.sim.phase !== "pick") return;
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (Math.hypot(dx, dy) > 14) return;
      const hit = scene.pickAt(e.clientX, e.clientY);
      if (!hit) return;
      tapBlip();
      runtime.drawRandomFromBag(hit.bag);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      runtime.unmount();
      scene.dispose();
    };
  }, [runtime]);

  return (
    <>
      <canvas
        ref={ref}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
        }}
      />
      <span ref={sightA} className="tine-sight" aria-hidden="true" />
      <span ref={sightB} className="tine-sight" aria-hidden="true" />
    </>
  );
}
