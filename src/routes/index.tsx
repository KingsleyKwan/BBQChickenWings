import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [game, setGame] = useState<null | (() => ReactNode)>(null);

  useEffect(() => {
    let alive = true;
    void import("@/App").then((m) => {
      if (!alive) return;
      const App = m.App;
      setGame(() => () => <App />);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!game) {
    return (
      <main className="app">
        <p className="brand" style={{ padding: 24, letterSpacing: "0.28em" }}>
          燒雞翼
        </p>
      </main>
    );
  }
  const Game = game;
  return <Game />;
}
