"use client";

import { useEffect, useMemo, useState } from "react";
import { GameRuntime } from "./game/runtime";
import { GameCanvas } from "./game/scene/GameCanvas";
import { Overlays } from "./game/ui/overlays";

export function App() {
  const runtime = useMemo(() => new GameRuntime(), []);
  const [hud, setHud] = useState(runtime.hud);

  useEffect(() => {
    return runtime.onHud(() => setHud({ ...runtime.hud }));
  }, [runtime]);

  return (
    <div className="app">
      <GameCanvas key="voxel-wing-2" runtime={runtime} />
      <Overlays runtime={runtime} hud={hud} />
    </div>
  );
}
