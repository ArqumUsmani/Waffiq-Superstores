/**
 * Synthesised interaction sounds — no audio files, no licensing.
 *
 * Browsers refuse to start an AudioContext before a user gesture, and a
 * hover is not a gesture. So this module stays silent until the visitor's
 * first `pointerdown`, `keydown` or `touchend` anywhere on the page
 * (wired up once from main.js's boot), after which every subsequent
 * pickup()/drop() plays immediately — nothing queues and plays late.
 *
 * `window.__sfxLog` records every call in dev builds only, so the CDP
 * audit harness can assert on sound behaviour it cannot literally hear.
 */
import { motion } from './motion-guard.js';

const STORAGE_KEY = 'wafiq:sound';
const MIN_GAP_MS = 120;

let ctx = null;
let unlocked = false;
let masterGain = null;
let lastPlayedAt = { pickup: -Infinity, drop: -Infinity };

const readMuted = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
};

let muted = readMuted();

function log(kind) {
  if (!import.meta.env.DEV) return;
  window.__sfxLog ??= [];
  window.__sfxLog.push({ kind, at: performance.now() });
}

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.35;
  masterGain.connect(ctx.destination);
  return ctx;
}

/**
 * Registers the one-time unlock listener. Call once from main.js boot.
 * Safe to call multiple times — only the first gesture matters.
 */
export function initSfxUnlock() {
  if (unlocked) return;

  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    const context = ensureContext();
    context?.resume?.();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchend', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchend', unlock, { once: true, passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ctx?.suspend?.();
    else if (unlocked) ctx?.resume?.();
  });
}

/** A short band of filtered noise — the "rustle"/"thud" texture layer. */
function noiseBurst(context, { duration, filterType, filterFreq, gain, delay = 0 }) {
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

  source.connect(filter).connect(env).connect(masterGain);
  source.start(t0);
  source.stop(t0 + duration + 0.02);
  return { source, env };
}

/** A pitch-swept tone — the melodic core of both sounds. */
function tone(context, { type, from, to, duration, gain, delay = 0, detuneCents = 0 }) {
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

  osc.connect(env).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
  return { source: osc, env };
}

/**
 * Silences a scheduled-but-not-yet-played node cleanly: ramps its gain to
 * zero over a couple of milliseconds (avoiding a click) and stops the
 * source right after, rather than letting it play out.
 */
function cancel({ source, env }, context) {
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
const jitter = () => (Math.random() - 0.5) * 80;

function canPlay(kind) {
  if (muted || motion.reduced) return false;
  const now = performance.now();
  if (now - lastPlayedAt[kind] < MIN_GAP_MS) return false;
  lastPlayedAt[kind] = now;
  return true;
}

// The drop sound's second "bounce" thud is scheduled ~70ms into the
// future; if a pickup interrupts before it plays (a quick flick off and
// back onto the card), it is silenced rather than overlapping the pickup.
let pendingBounce = null;

function cancelPendingBounce(context) {
  if (!pendingBounce) return;
  for (const node of pendingBounce) cancel(node, context);
  pendingBounce = null;
}

/**
 * A sound only ever logs (and plays) once it actually happens — never on
 * a hover before the first gesture, never while muted, never while
 * rate-limited — so `window.__sfxLog` is a true record of what a
 * visitor would have heard, not of every call site that asked.
 */
function attempt(kind, synth) {
  if (!unlocked || !canPlay(kind)) return;
  const context = ensureContext();
  if (!context) return;
  log(kind);
  synth(context, jitter());
}

/** A soft rising pop — something light being lifted off a surface. */
export function pickup() {
  attempt('pickup', (context, detune) => {
    cancelPendingBounce(context);
    tone(context, { type: 'triangle', from: 420, to: 880, duration: 0.09, gain: 0.5, detuneCents: detune });
    noiseBurst(context, { duration: 0.06, filterType: 'bandpass', filterFreq: 2500, gain: 0.12 });
  });
}

/** A muted wooden thud, with a quieter echo for a small landing bounce. */
export function drop() {
  attempt('drop', (context, detune) => {
    tone(context, { type: 'sine', from: 180, to: 70, duration: 0.12, gain: 0.55, detuneCents: detune });
    noiseBurst(context, { duration: 0.08, filterType: 'lowpass', filterFreq: 900, gain: 0.16 });

    const bounceDelayMs = 70;
    pendingBounce = [
      tone(context, {
        type: 'sine', from: 140, to: 60, duration: 0.09, gain: 0.22,
        delay: bounceDelayMs / 1000, detuneCents: detune,
      }),
      noiseBurst(context, {
        duration: 0.05, filterType: 'lowpass', filterFreq: 800, gain: 0.08,
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

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = Boolean(next);
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
  } catch {
    /* private mode — the choice just will not persist */
  }
}

export const toggleMuted = () => setMuted(!muted);
