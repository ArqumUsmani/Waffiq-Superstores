/**
 * The hero's ambient soundscape — two recorded beds, day and night,
 * prepared by scripts/gen-sfx.mjs. Switching the theme crossfades between
 * them rather than cutting.
 *
 * Both are seamless loops: the encoder wraps each one's tail back over its
 * head, so `loop = true` has no click at the seam.
 *
 * Everything hangs off the shared graph in sfx.ts, so the existing rules
 * apply for free: nothing sounds before the visitor's first gesture, the
 * header mute button silences it, reduced motion silences it, and the
 * context suspends when the tab is hidden.
 *
 * It is deliberately quiet. A background loop on a website is intrusive at
 * anything but a whisper, so the bed sits well under the one-shots.
 */
import { audioGraph, loadSample, onAudioChange } from './sfx';

export type Scene = 'day' | 'night';

declare global {
  interface Window {
    /**
     * Dev-only view of the bed, for the CDP harness — the same reason
     * `window.__sfxLog` exists. There is no way to assert on sound we
     * cannot hear, so the graph reports its own state instead.
     */
    __ambience?: () => {
      running: boolean;
      present: boolean;
      scene: Scene;
      contextState: string | null;
      bed: number | null;
      day: number | null;
      night: number | null;
      playing: number;
    };
  }
}

/**
 * Ceiling for the whole bed, before the 0.35 master. The recordings are
 * normalised to -20 LUFS by the encoder, so this is the one number that
 * sets how present the soundscape is.
 */
const BED_GAIN = 0.85;
const FADE = 1.4;
/* Ducking as the hero leaves should be quicker than the initial arrival —
   long enough not to cut, short enough that it is gone by the time the
   next section fills the screen. */
const PRESENCE_FADE = 0.7;

interface Layer {
  /** Everything in this layer routes through here, for crossfading. */
  gain: GainNode;
  /** The looping source, once its buffer has arrived. */
  source: AudioBufferSourceNode | null;
}

let context: AudioContext | null = null;
let bed: GainNode | null = null;
let layers: Record<Scene, Layer> | null = null;
let scene: Scene = 'day';
let running = false;
/** Whether the hero is on screen. The bed is a hero sound, not a site one. */
let present = true;
/**
 * Bumped on every teardown. A buffer that arrives after its run has ended
 * checks this and drops itself rather than starting into a dead graph.
 */
let generation = 0;

if (import.meta.env.DEV) {
  window.__ambience = () => ({
    running,
    present,
    scene,
    contextState: context?.state ?? null,
    bed: bed?.gain.value ?? null,
    day: layers?.day.gain.gain.value ?? null,
    night: layers?.night.gain.gain.value ?? null,
    playing: layers ? Object.values(layers).filter((l) => l.source).length : 0,
  });
}

/**
 * One bed: a gain node now, its looping source attached when the recording
 * arrives. Starting at a random offset means two visits in a row do not
 * open on the same bird.
 */
function buildLayer(ctx: AudioContext, out: GainNode, name: Scene): Layer {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(out);

  const layer: Layer = { gain, source: null };
  const mine = generation;

  void loadSample(name).then((buffer) => {
    /* The visitor may have muted or navigated while this was in flight. */
    if (!buffer || !running || generation !== mine) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start(0, Math.random() * buffer.duration);
    layer.source = source;
  });

  return layer;
}


/* ------------------------------------------------------------------ *
   Control
 * ------------------------------------------------------------------ */

function applyScene(immediate = false) {
  if (!context || !layers) return;
  const now = context.currentTime;
  const fade = immediate ? 0.01 : FADE;

  for (const key of ['day', 'night'] as Scene[]) {
    const target = key === scene ? 1 : 0;
    const param = layers[key].gain.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + fade);
  }
}

/** Ramps the whole bed to its present/absent target. */
function applyPresence(immediate = false) {
  if (!context || !bed) return;
  const now = context.currentTime;
  const param = bed.gain;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(
    present ? BED_GAIN : 0,
    now + (immediate ? 0.01 : PRESENCE_FADE),
  );
}

/**
 * Fades the bed down when the hero scrolls away or the route changes, and
 * back up on return. The sources keep running underneath — they are a few
 * cheap nodes, and restarting them would re-trigger the arrival fade every
 * time someone scrolled back up.
 */
export function setAmbiencePresence(next: boolean): void {
  if (present === next) return;
  present = next;
  applyPresence();
}

function teardown() {
  running = false;
  /* Invalidates any buffer still in flight, so it does not start into the
     graph we are about to dismantle. */
  generation += 1;

  if (layers) {
    for (const key of ['day', 'night'] as Scene[]) {
      const layer = layers[key];
      try {
        layer.source?.stop();
      } catch {
        /* already stopped */
      }
      layer.source?.disconnect();
      layer.gain.disconnect();
    }
  }
  bed?.disconnect();
  layers = null;
  bed = null;
  context = null;
}

/** Idempotent. Does nothing while locked, muted or under reduced motion. */
export function startAmbience(): void {
  if (running) return;
  const graph = audioGraph();
  if (!graph) return;

  context = graph.context;
  bed = context.createGain();
  bed.gain.value = 0;
  bed.connect(graph.master);

  running = true;
  layers = {
    day: buildLayer(context, bed, 'day'),
    night: buildLayer(context, bed, 'night'),
  };

  applyScene(true);

  /* Fade the whole bed up, so it arrives rather than snapping on. */
  const now = context.currentTime;
  bed.gain.setValueAtTime(0, now);
  if (present) bed.gain.linearRampToValueAtTime(BED_GAIN, now + FADE * 1.4);
}

export function stopAmbience(): void {
  if (!running) return;
  teardown();
}

/** Crossfades to the other bed. Safe to call before the ambience starts. */
export function setAmbienceScene(next: Scene): void {
  if (scene === next) return;
  scene = next;
  applyScene();
}

/**
 * Starts or stops in step with the shared graph — first gesture, mute
 * toggle. Call once at boot; returns an unsubscribe.
 */
export function initAmbience(): () => void {
  const sync = () => {
    if (audioGraph()) startAmbience();
    else stopAmbience();
  };
  const off = onAudioChange(sync);
  sync();
  return () => {
    off();
    stopAmbience();
  };
}
