/** Web vibrate; Capacitor Haptics if the iOS wrap injected the plugin. */

type CapHaptics = {
  impact: (opts: { style: string }) => Promise<void>;
};

function plugin(): CapHaptics | null {
  const w = window as unknown as { Capacitor?: { Plugins?: { Haptics?: CapHaptics } } };
  return w.Capacitor?.Plugins?.Haptics ?? null;
}

export function buzz(ms = 18) {
  const style = ms >= 28 ? "HEAVY" : ms >= 16 ? "MEDIUM" : "LIGHT";
  void plugin()?.impact({ style });
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

export function buzzPattern(pattern: number[]) {
  void plugin()?.impact({ style: "MEDIUM" });
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
