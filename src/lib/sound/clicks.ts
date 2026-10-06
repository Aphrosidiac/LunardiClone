// Ported from reference module 153213 (chunk 1ukx7_lvtix23). Every UI sound is synthesised in
// the browser: the two mouse clicks are rendered once into an AudioBuffer from seeded, band-passed
// noise plus a short sine "body"; the beep is a plain oscillator. No audio files are loaded.

type ClickLayer = {
  gain: number;
  delay: number;
  attack: number;
  decay: number;
  lowpass: number;
  highpass: number;
};

type ClickPartial = { frequency: number; gain: number; decay: number };

export type ClickSpec = {
  seed: number;
  duration: number;
  layers: ClickLayer[];
  body: { delay: number; attack: number; partials: ClickPartial[] };
};

type Tone = { type: OscillatorType; from: number; to: number; duration: number; gain: number };

export const CLICKS = {
  'click-down': {
    seed: 6,
    duration: 0.024,
    layers: [
      { gain: 0.434, delay: 486e-6, attack: 0.00244, decay: 0.00159, lowpass: 10394, highpass: 3591 },
      { gain: 0.366, delay: 0.00364, attack: 427e-6, decay: 0.00398, lowpass: 5494, highpass: 701 },
    ],
    body: {
      delay: 0.00488,
      attack: 788e-7,
      partials: [
        { frequency: 463, gain: 0.0674, decay: 0.0035 },
        { frequency: 569, gain: 0.0634, decay: 0.00556 },
      ],
    },
  },
  'click-up': {
    seed: 10,
    duration: 0.025,
    layers: [
      { gain: 0.45, delay: 993e-6, attack: 437e-6, decay: 0.00178, lowpass: 10713, highpass: 2118 },
      { gain: 0.4, delay: 0.00197, attack: 974e-6, decay: 0.00449, lowpass: 4685, highpass: 1300 },
    ],
    body: {
      delay: 0.00196,
      attack: 753e-6,
      partials: [
        { frequency: 469, gain: 0.0567, decay: 0.00431 },
        { frequency: 583, gain: 0.0389, decay: 0.00673 },
      ],
    },
  },
} satisfies Record<string, ClickSpec>;

const TONES = {
  beep: [{ type: 'square', from: 1000, to: 1000, duration: 0.2, gain: 0.03 }],
} satisfies Record<string, Tone[]>;

export type SoundName = keyof typeof CLICKS | keyof typeof TONES;

let context: AudioContext | null = null;

/** Linear attack to 1, then exponential decay with time constant `decay`. */
function envelope(t: number, attack: number, decay: number) {
  return t < 0 ? 0 : t < attack ? t / attack : Math.exp(-(t - attack) / decay);
}

/** mulberry32 */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    let t = (state = (state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function addNoiseLayer(out: Float32Array, layer: ClickLayer, seed: number, sampleRate: number) {
  const rand = random(seed);
  const lp = 1 - Math.exp((-2 * Math.PI * layer.lowpass) / sampleRate);
  const hp = 1 - Math.exp((-2 * Math.PI * layer.highpass) / sampleRate);
  let lp1 = 0;
  let lp2 = 0;
  let hp1 = 0;
  let hp2 = 0;
  for (let i = 0; i < out.length; i++) {
    lp1 += lp * (2 * rand() - 1 - lp1);
    lp2 += lp * (lp1 - lp2);
    hp1 += hp * (lp2 - hp1);
    const band = lp2 - hp1;
    hp2 += hp * (band - hp2);
    const t = i / sampleRate - layer.delay;
    out[i] = (out[i] ?? 0) + layer.gain * envelope(t, layer.attack, layer.decay) * (band - hp2);
  }
}

export function renderClick(spec: ClickSpec, sampleRate: number) {
  const length = Math.round(spec.duration * sampleRate);
  const out = new Float32Array(length);
  spec.layers.forEach((layer, index) => addNoiseLayer(out, layer, spec.seed + index, sampleRate));

  const { body } = spec;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate - body.delay;
    if (t < 0) continue;
    let sample = 0;
    for (const partial of body.partials) {
      sample += partial.gain * envelope(t, body.attack, partial.decay) * Math.sin(2 * Math.PI * partial.frequency * t);
    }
    out[i] = (out[i] ?? 0) + sample;
  }

  // 2ms linear fade-out so the buffer never ends on a discontinuity.
  const fade = Math.round(0.002 * sampleRate);
  for (let i = 0; i < fade; i++) {
    const index = length - fade + i;
    out[index] = (out[index] ?? 0) * (1 - i / (fade - 1));
  }
  return out;
}

const buffers = new Map<string, AudioBuffer>();

function getContext() {
  if (!context) {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context = new Ctor();
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

function playClick(ctx: AudioContext, name: keyof typeof CLICKS) {
  let buffer = buffers.get(name);
  if (!buffer) {
    const data = renderClick(CLICKS[name], ctx.sampleRate);
    buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buffer.copyToChannel(data, 0);
    buffers.set(name, buffer);
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = 0.5;
  source.connect(gain).connect(ctx.destination);
  source.start();
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
}

function playTone(ctx: AudioContext, tone: Tone) {
  const start = ctx.currentTime;
  const end = start + tone.duration;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = tone.type;
  osc.frequency.setValueAtTime(tone.from, start);
  osc.frequency.exponentialRampToValueAtTime(tone.to, end);
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(tone.gain, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(1e-4, end);
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
  osc.onended = () => {
    osc.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

export function play(name: SoundName) {
  try {
    const ctx = getContext();
    if (name in CLICKS) {
      playClick(ctx, name as keyof typeof CLICKS);
      return;
    }
    for (const tone of TONES[name as keyof typeof TONES]) playTone(ctx, tone);
  } catch {}
}
