/**
 * Interaction sounds.
 *
 * The UI sounds (pickup, drop, peep) are synthesised — short, generic, and
 * not worth a network request. The scene sounds (horn, rooster, and the two
 * ambience beds in ambience.ts) are recordings, prepared for the web by
 * scripts/gen-sfx.mjs.
 *
 * Browsers refuse to start an AudioContext before a user gesture, and a
 * hover is not a gesture. So this module stays silent until the visitor's
 * first `pointerdown`, `keydown` or `touchend` anywhere on the page (wired
 * up once from the root layout), after which every subsequent
 * pickup()/drop() plays immediately — nothing queues and plays late.
 *
 * `window.__sfxLog` records every call in dev builds only, so the CDP audit
 * harness can assert on sound behaviour it cannot literally hear.
 */
import { motion } from './motion-guard';

declare global {
  interface Window {
    __sfxLog?: { kind: SoundKind; at: number }[];
    webkitAudioContext?: typeof AudioContext;
  }
}

type SoundKind = 'pickup' | 'drop' | 'peep' | 'horn' | 'rooster';

interface Voice {
  source: AudioScheduledSourceNode;
  env: GainNode;
}

/* Written by scripts/gen-sfx.mjs from the recordings in src/assets/sfx. */
const SAMPLE_FILES = {
  horn: '/assets/sfx/horn.mp3',
  rooster: '/assets/sfx/rooster.mp3',
  day: '/assets/sfx/day.mp3',
  night: '/assets/sfx/night.mp3',
} as const;

export type SampleName = keyof typeof SAMPLE_FILES;

/**
 * How late a sample may arrive and still play. A horn that lands a beat
 * after the click reads as lag; one that lands two seconds later reads as a
 * bug, so past this it is dropped instead.
 */
const LATE_MS = 400;

const STORAGE_KEY = 'wafiq:sound';
const MIN_GAP_MS = 120;
/* The hover peep needs a longer gate than the rest: a pointer crossing the
   headlight fires many enters, and at 120ms they machine-gun. */
const PEEP_GAP_MS = 420;
/* The crow is nearly a second long — overlapping two is a farmyard, not a
   morning. */
const ROOSTER_GAP_MS = 2500;

let ctx: AudioContext | null = null;
let unlocked = false;
let masterGain: GainNode | null = null;
const lastPlayedAt: Record<SoundKind, number> = {
  pickup: -Infinity,
  drop: -Infinity,
  peep: -Infinity,
  horn: -Infinity,
  rooster: -Infinity,
};

/** Notified when the audio graph becomes usable, or when mute flips. */
type AudioListener = () => void;
const audioListeners = new Set<AudioListener>();
const notifyAudio = () => audioListeners.forEach((cb) => cb());

/**
 * Subscribe to "the audio situation changed" — first gesture unlock, or a
 * mute toggle. The ambience layer uses this to start and stop itself.
 */
export function onAudioChange(callback: AudioListener): () => void {
  audioListeners.add(callback);
  return () => {
    audioListeners.delete(callback);
  };
}

/**
 * The shared graph, for layers that manage their own nodes (ambience).
 * `null` until the visitor's first gesture has unlocked playback.
 */
export function audioGraph(): { context: AudioContext; master: GainNode } | null {
  if (!unlocked || muted || motion.reduced) return null;
  const context = ensureContext();
  if (!context || !masterGain) return null;
  return { context, master: masterGain };
}

const readMuted = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
};

let muted = readMuted();

function log(kind: SoundKind): void {
  if (!import.meta.env.DEV) return;
  window.__sfxLog ??= [];
  window.__sfxLog.push({ kind, at: performance.now() });
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.35;
  masterGain.connect(ctx.destination);
  return ctx;
}

/* ------------------------------------------------------------------ *
   Recorded samples
 * ------------------------------------------------------------------ */

/** Decoded and ready to play this instant. */
const samples = new Map<SampleName, AudioBuffer>();
/** In flight, so concurrent callers share one fetch and one decode. */
const pending = new Map<SampleName, Promise<AudioBuffer | null>>();
/** Bytes fetched before the context existed, awaiting a gesture to decode. */
const rawBytes = new Map<SampleName, Promise<ArrayBuffer | null>>();

function fetchSample(name: SampleName): Promise<ArrayBuffer | null> {
  const existing = rawBytes.get(name);
  if (existing) return existing;

  const request = fetch(SAMPLE_FILES[name])
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .catch(() => null);

  rawBytes.set(name, request);
  return request;
}

/**
 * Fetches and decodes a sample, once. Resolves `null` if the file is
 * missing or the context is not available yet — callers treat that as
 * "stay silent", never as an error worth surfacing.
 */
export function loadSample(name: SampleName): Promise<AudioBuffer | null> {
  const ready = samples.get(name);
  if (ready) return Promise.resolve(ready);

  const inFlight = pending.get(name);
  if (inFlight) return inFlight;

  const context = ensureContext();
  if (!context) return Promise.resolve(null);

  const task = fetchSample(name)
    .then((bytes) => (bytes ? context.decodeAudioData(bytes.slice(0)) : null))
    .then((buffer) => {
      if (buffer) samples.set(name, buffer);
      return buffer;
    })
    .catch(() => null)
    .finally(() => {
      pending.delete(name);
    });

  pending.set(name, task);
  return task;
}

/** Plays a decoded sample once through the master bus. */
function playSample(context: AudioContext, buffer: AudioBuffer, gain: number): void {
  const source = context.createBufferSource();
  source.buffer = buffer;

  const env = context.createGain();
  env.gain.value = gain;

  source.connect(env).connect(masterGain!);
  source.start();
}

/**
 * The sample counterpart to `attempt`: same mute, gate and logging rules,
 * but the buffer may not have arrived yet. If it has, this is synchronous
 * and the sound lands on the gesture; if not, it plays on arrival provided
 * that is still soon enough to read as a response.
 */
function attemptSample(kind: SoundKind, name: SampleName, gain: number): void {
  if (!unlocked || !canPlay(kind)) return;
  const context = ensureContext();
  if (!context) return;

  const ready = samples.get(name);
  if (ready) {
    log(kind);
    playSample(context, ready, gain);
    return;
  }

  const asked = performance.now();
  void loadSample(name).then((buffer) => {
    /* Re-checked on arrival: the visitor may have muted, or simply moved
       on, in the time the fetch took. */
    if (!buffer || muted || motion.reduced) return;
    if (performance.now() - asked > LATE_MS) return;
    log(kind);
    playSample(context, buffer, gain);
  });
}

/**
 * Warms the two one-shots (~29 KB together) so the first horn is not late.
 * Only the bytes — decoding needs a context, which needs a gesture. The
 * ambience beds are an order of magnitude larger and are left until the
 * visitor has actually interacted.
 */
function warmSamples(): void {
  const warm = () => {
    void fetchSample('horn');
    void fetchSample('rooster');
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(warm, { timeout: 3000 });
  } else {
    window.setTimeout(warm, 1200);
  }
}

/**
 * Registers the one-time unlock listener. Call once at boot.
 * Safe to call multiple times — only the first gesture matters.
 */
export function initSfxUnlock(): void {
  if (unlocked) return;
  warmSamples();

  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    const context = ensureContext();
    void context?.resume?.();
    /* Decode what was warmed, so the first horn plays from memory. */
    void loadSample('horn');
    void loadSample('rooster');
    notifyAudio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchend', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchend', unlock, { once: true, passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void ctx?.suspend?.();
    else if (unlocked) void ctx?.resume?.();
  });
}

interface NoiseSpec {
  duration: number;
  filterType: BiquadFilterType;
  filterFreq: number;
  gain: number;
  delay?: number;
}

/** A short band of filtered noise — the "rustle"/"thud" texture layer. */
function noiseBurst(context: AudioContext, spec: NoiseSpec): Voice {
  const { duration, filterType, filterFreq, gain, delay = 0 } = spec;
  const frames = Math.max(1, Math.round(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;

  const env = context.createGain();
  const t0 = context.currentTime + delay;
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  source.connect(filter).connect(env).connect(masterGain!);
  source.start(t0);
  source.stop(t0 + duration + 0.02);
  return { source, env };
}

interface ToneSpec {
  type: OscillatorType;
  from: number;
  to: number;
  duration: number;
  gain: number;
  delay?: number;
  detuneCents?: number;
}

/** A pitch-swept tone — the melodic core of both sounds. */
function tone(context: AudioContext, spec: ToneSpec): Voice {
  const { type, from, to, duration, gain, delay = 0, detuneCents = 0 } = spec;
  const osc = context.createOscillator();
  osc.type = type;
  const detune = 2 ** (detuneCents / 1200);

  const t0 = context.currentTime + delay;
  osc.frequency.setValueAtTime(from * detune, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to * detune), t0 + duration);

  const env = context.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(env).connect(masterGain!);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
  return { source: osc, env };
}

/**
 * Silences a scheduled-but-not-yet-played node cleanly: ramps its gain to
 * zero over a couple of milliseconds (avoiding a click) and stops the
 * source right after, rather than letting it play out.
 */
function cancel({ source, env }: Voice, context: AudioContext): void {
  const t0 = context.currentTime;
  env.gain.cancelScheduledValues(t0);
  env.gain.setValueAtTime(env.gain.value, t0);
  env.gain.linearRampToValueAtTime(0, t0 + 0.008);
  try {
    source.stop(t0 + 0.01);
  } catch {
    /* already stopped or never started — nothing to cancel */
  }
}

/** ±40 cents of random detune so repeated plays are not robotic. */
const jitter = (): number => (Math.random() - 0.5) * 80;

function canPlay(kind: SoundKind): boolean {
  if (muted || motion.reduced) return false;
  const now = performance.now();
  const gap = kind === 'peep' ? PEEP_GAP_MS : kind === 'rooster' ? ROOSTER_GAP_MS : MIN_GAP_MS;
  if (now - lastPlayedAt[kind] < gap) return false;
  lastPlayedAt[kind] = now;
  return true;
}

// The drop sound's second "bounce" thud is scheduled ~70ms into the future;
// if a pickup interrupts before it plays (a quick flick off and back onto
// the card), it is silenced rather than overlapping the pickup.
let pendingBounce: Voice[] | null = null;

function cancelPendingBounce(context: AudioContext): void {
  if (!pendingBounce) return;
  for (const node of pendingBounce) cancel(node, context);
  pendingBounce = null;
}

/**
 * A sound only ever logs (and plays) once it actually happens — never on a
 * hover before the first gesture, never while muted, never while
 * rate-limited — so `window.__sfxLog` is a true record of what a visitor
 * would have heard, not of every call site that asked.
 */
function attempt(kind: SoundKind, synth: (context: AudioContext, detune: number) => void): void {
  if (!unlocked || !canPlay(kind)) return;
  const context = ensureContext();
  if (!context) return;
  log(kind);
  synth(context, jitter());
}

/** A soft rising pop — something light being lifted off a surface. */
export function pickup(): void {
  attempt('pickup', (context, detune) => {
    cancelPendingBounce(context);
    tone(context, {
      type: 'triangle',
      from: 420,
      to: 880,
      duration: 0.09,
      gain: 0.5,
      detuneCents: detune,
    });
    noiseBurst(context, {
      duration: 0.06,
      filterType: 'bandpass',
      filterFreq: 2500,
      gain: 0.12,
    });
  });
}

/** A muted wooden thud, with a quieter echo for a small landing bounce. */
export function drop(): void {
  attempt('drop', (context, detune) => {
    tone(context, {
      type: 'sine',
      from: 180,
      to: 70,
      duration: 0.12,
      gain: 0.55,
      detuneCents: detune,
    });
    noiseBurst(context, { duration: 0.08, filterType: 'lowpass', filterFreq: 900, gain: 0.16 });

    const bounceDelayMs = 70;
    pendingBounce = [
      tone(context, {
        type: 'sine',
        from: 140,
        to: 60,
        duration: 0.09,
        gain: 0.22,
        delay: bounceDelayMs / 1000,
        detuneCents: detune,
      }),
      noiseBurst(context, {
        duration: 0.05,
        filterType: 'lowpass',
        filterFreq: 800,
        gain: 0.08,
        delay: bounceDelayMs / 1000,
      }),
    ];
    // Once the bounce has actually started playing there is nothing left
    // worth cancelling, so the pending reference expires on its own.
    setTimeout(() => {
      pendingBounce = null;
    }, bounceDelayMs);
  });
}

/**
 * A short high blip for hovering the headlight — a "this is a control"
 * cue rather than a notification, so it stays quiet and brief.
 */
export function peep(): void {
  attempt('peep', (context, detune) => {
    tone(context, {
      type: 'sine',
      from: 1720,
      to: 2380,
      duration: 0.055,
      gain: 0.16,
      detuneCents: detune,
    });
    noiseBurst(context, {
      duration: 0.02,
      filterType: 'highpass',
      filterFreq: 3200,
      gain: 0.05,
    });
  });
}

/**
 * The scooter's horn, on clicking the headlight. Levels are set so it sits
 * clearly above the ambience bed rather than competing with it.
 */
export function horn(): void {
  attemptSample('horn', 'horn', 0.9);
}

/** A cockerel, on the switch from night back to day. */
export function rooster(): void {
  attemptSample('rooster', 'rooster', 0.9);
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = Boolean(next);
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
  } catch {
    /* private mode — the choice just will not persist */
  }
  notifyAudio();
}

export const toggleMuted = (): void => setMuted(!muted);
