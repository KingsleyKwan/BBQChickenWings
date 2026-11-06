/** Tiny procedural stall bed + sizzle + charcoal crackle. Unlock after a user gesture.
 *  iOS silent-switch: when wrapped in Capacitor, call configureIosAudioSession()
 *  after unlock so AVAudioSession category is Playback (ignores mute switch).
 */

let ctx: AudioContext | null = null;
let sizzle: OscillatorNode | null = null;
let gain: GainNode | null = null;
let bed: GainNode | null = null;
let murmur: OscillatorNode | null = null;
let murmur2: OscillatorNode | null = null;
let crackleGain: GainNode | null = null;
let crackleSource: AudioBufferSourceNode | null = null;
let master: GainNode | null = null;
let muted = false;

type CapAudio = {
  configure?: (opts: { category?: string; mode?: string }) => Promise<void>;
  setCategory?: (category: string) => Promise<void>;
};

function capAudioPlugin(): CapAudio | null {
  const w = window as unknown as {
    Capacitor?: { Plugins?: { AudioSession?: CapAudio; NativeAudio?: CapAudio } };
  };
  return w.Capacitor?.Plugins?.AudioSession ?? w.Capacitor?.Plugins?.NativeAudio ?? null;
}

export async function configureIosAudioSession() {
  const p = capAudioPlugin();
  if (!p) return;
  try {
    if (p.configure) await p.configure({ category: "playback", mode: "default" });
    else if (p.setCategory) await p.setCategory("playback");
  } catch {
    /* native plugin optional */
  }
}

function out(): AudioNode {
  return master ?? ctx!.destination;
}

function makeCrackleBuffer(ac: AudioContext): AudioBuffer {
  const dur = 1.6;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + white * 0.12;
    b1 = 0.985 * b1 + white * 0.08;
    b2 = 0.96 * b2 + white * 0.05;
    let v = b0 + b1 * 0.6 + b2 * 0.35;
    if (Math.random() < 0.0045) {
      v += (Math.random() * 2 - 1) * (0.55 + Math.random() * 0.9);
    }
    const env = Math.min(1, i / (ac.sampleRate * 0.02), (n - i) / (ac.sampleRate * 0.02));
    data[i] = v * env * 0.55;
  }
  return buf;
}

export async function unlockAudio() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  try {
    ctx = new AC({ latencyHint: "interactive" });
  } catch {
    ctx = new AC();
  }

  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);

  bed = ctx.createGain();
  bed.gain.value = 0.028;
  bed.connect(out());

  murmur = ctx.createOscillator();
  murmur.type = "triangle";
  murmur.frequency.value = 52;
  const mg = ctx.createGain();
  mg.gain.value = 0.22;
  murmur.connect(mg).connect(bed);
  murmur.start();

  murmur2 = ctx.createOscillator();
  murmur2.type = "sine";
  murmur2.frequency.value = 78;
  const mg2 = ctx.createGain();
  mg2.gain.value = 0.09;
  murmur2.connect(mg2).connect(bed);
  murmur2.start();

  const tick = ctx.createOscillator();
  tick.type = "square";
  tick.frequency.value = 210;
  const tg = ctx.createGain();
  tg.gain.value = 0.012;
  const tfilt = ctx.createBiquadFilter();
  tfilt.type = "bandpass";
  tfilt.frequency.value = 400;
  tfilt.Q.value = 0.6;
  tick.connect(tfilt).connect(tg).connect(bed);
  tick.start();

  gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(out());
  sizzle = ctx.createOscillator();
  sizzle.type = "sawtooth";
  sizzle.frequency.value = 90;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 800;
  sizzle.connect(filter).connect(gain);
  sizzle.start();

  crackleGain = ctx.createGain();
  crackleGain.gain.value = 0;
  const cfilt = ctx.createBiquadFilter();
  cfilt.type = "bandpass";
  cfilt.frequency.value = 920;
  cfilt.Q.value = 0.7;
  const cfilt2 = ctx.createBiquadFilter();
  cfilt2.type = "highpass";
  cfilt2.frequency.value = 280;
  crackleGain.connect(cfilt).connect(cfilt2).connect(out());

  const cbuf = makeCrackleBuffer(ctx);
  crackleSource = ctx.createBufferSource();
  crackleSource.buffer = cbuf;
  crackleSource.loop = true;
  crackleSource.loopStart = 0.04;
  crackleSource.loopEnd = cbuf.duration - 0.04;
  crackleSource.connect(crackleGain);
  crackleSource.start();

  void configureIosAudioSession();
}

export function isMuted() {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  if (master && ctx) {
    master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.05);
  }
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function setSizzle(amount: number) {
  if (!gain || !ctx) return;
  const a = Math.max(0, Math.min(1, amount));
  gain.gain.setTargetAtTime(a * 0.048, ctx.currentTime, 0.08);
  if (crackleGain) {
    const c = a * 0.038 + (a > 0.15 ? 0.012 : 0);
    crackleGain.gain.setTargetAtTime(c, ctx.currentTime, 0.12);
  }
}

export function tapBlip() {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = 420;
  g.gain.value = 0.05;
  o.connect(g).connect(out());
  o.start();
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  o.stop(ctx.currentTime + 0.13);
}

export function flareBoom() {
  if (!ctx) return;
  const t = ctx.currentTime;

  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = 58;
  g.gain.value = 0.11;
  o.connect(g).connect(out());
  o.start(t);
  o.frequency.exponentialRampToValueAtTime(26, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
  o.stop(t + 0.36);

  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.type = "triangle";
  o2.frequency.value = 110;
  g2.gain.value = 0.045;
  o2.connect(g2).connect(out());
  o2.start(t);
  o2.frequency.exponentialRampToValueAtTime(55, t + 0.18);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o2.stop(t + 0.22);

  const bufferSize = Math.floor(2 * ctx.sampleRate * 0.08);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const ng = ctx.createGain();
  ng.gain.value = 0.07;
  const nf = ctx.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.value = 1800;
  nf.Q.value = 1.2;
  noise.connect(nf).connect(ng).connect(out());
  noise.start(t);
}

/** Metallic tine ping when 吉叉 lands in the bone (#52). */
export function skewerPing() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = 1480;
  g.gain.value = 0.09;
  o.connect(g).connect(out());
  o.start(t);
  o.frequency.exponentialRampToValueAtTime(620, t + 0.16);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.stop(t + 0.2);
  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.type = "sine";
  o2.frequency.value = 3100;
  g2.gain.value = 0.04;
  o2.connect(g2).connect(out());
  o2.start(t);
  o2.frequency.exponentialRampToValueAtTime(900, t + 0.09);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o2.stop(t + 0.11);
}

/** Tiny oil-pop tick when fat hits the coals (#57). */
export function oilPop() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const n = Math.floor(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 1800;
  const g = ctx.createGain();
  g.gain.value = 0.07;
  src.connect(f).connect(g).connect(out());
  src.start(t);
}

/** Louder plate-up steam hiss when wings land on newspaper (#46). */
export function steamPuff() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const n = Math.floor(ctx.sampleRate * 0.7);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const env = Math.exp(-i / (ctx.sampleRate * 0.22));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2800;
  bp.Q.value = 0.55;
  const g = ctx.createGain();
  g.gain.value = 0.28;
  src.connect(hp).connect(bp).connect(g).connect(out());
  src.start(t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.62);

  const src2 = ctx.createBufferSource();
  src2.buffer = buf;
  const bp2 = ctx.createBiquadFilter();
  bp2.type = "bandpass";
  bp2.frequency.value = 900;
  bp2.Q.value = 0.7;
  const g2 = ctx.createGain();
  g2.gain.value = 0.14;
  src2.connect(bp2).connect(g2).connect(out());
  src2.start(t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.48);

  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.type = "sine";
  o.frequency.value = 160;
  og.gain.value = 0.055;
  o.connect(og).connect(out());
  o.start(t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.35);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  o.stop(t + 0.4);
}

/** Soft night-market footstep when the fog NPC walks past (#51). */
export function footstep(pan = 0) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-0.85, Math.min(0.85, pan));
  panner.connect(out());
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = 72 + Math.random() * 18;
  g.gain.value = 0.045;
  o.connect(g).connect(panner);
  o.start(t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.09);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  o.stop(t + 0.12);
  const n = Math.floor(ctx.sampleRate * 0.07);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 480 + Math.random() * 200;
  f.Q.value = 0.9;
  const ng = ctx.createGain();
  ng.gain.value = 0.055;
  src.connect(f).connect(ng).connect(panner);
  src.start(t);
}

export function setAudioSuspended(hidden: boolean) {
  if (!ctx) return;
  if (hidden) void ctx.suspend();
  else void ctx.resume();
}
