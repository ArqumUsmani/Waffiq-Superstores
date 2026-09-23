/**
 * Prepares the raw recordings in src/assets/sfx/ for the web.
 *
 * Run: node scripts/gen-sfx.mjs
 * Output: public/assets/sfx/*.mp3
 *
 * The sources are studio-weight files — 256 kbps, ~5 MB, recorded very
 * quiet (the beds peak at -20 dB) and with ~90 ms of leading silence on the
 * one-shots. Shipping them as-is would mean a laggy horn and 8.7 MB of
 * audio, so this does four things:
 *
 *  - Trims the leading silence off the one-shots, so the horn lands on the
 *    click rather than a frame later.
 *  - Cuts a LOOP_SECONDS window out of each ambience bed and crossfades its
 *    tail back over its head, so `source.loop = true` has no seam. Without
 *    this the loop point is an audible click on a continuous recording.
 *  - Normalises the beds to a known loudness, so day and night sit at the
 *    same level and the gain constants in ambience.ts mean something.
 *  - Re-encodes at a bitrate suited to playback level. The beds run at
 *    roughly 0.05 amplitude behind a hero; 256 kbps of that is inaudible
 *    fidelity for megabytes of transfer.
 */
import { execFile } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'src/assets/sfx');
const OUT = resolve(root, 'public/assets/sfx');

/** Window taken from each bed. Long enough that a visit never hears it twice. */
const LOOP_SECONDS = 75;
/** Crossfade wrapping the tail onto the head. Also the amount the loop loses. */
const CROSSFADE = 4;
/** Skipped at the head of a bed, in case the recording fades in. */
const LEAD_IN = 5;
/** Beds are normalised here; ambience.ts scales down from a known level. */
const BED_LUFS = -20;

async function duration(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  return Number.parseFloat(stdout.trim());
}

/**
 * A bed: one seamless, normalised loop.
 *
 * The seam is built by mixing the window's last CROSSFADE seconds (fading
 * out) under its first CROSSFADE seconds (fading in), then playing the
 * remaining middle. The result ends where it begins, so looping is
 * continuous. `qsin` rather than the default linear fade — crossfading two
 * uncorrelated stretches of noise linearly dips in the middle.
 */
async function bed(name, outName) {
  const input = resolve(SRC, name);
  const total = await duration(input);
  const start = LEAD_IN;
  const end = Math.min(total, start + LOOP_SECONDS);
  const seamAt = end - CROSSFADE;

  const filter = [
    `[0:a]atrim=${start}:${start + CROSSFADE},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${CROSSFADE}:curve=qsin[head]`,
    `[0:a]atrim=${start + CROSSFADE}:${seamAt},asetpts=PTS-STARTPTS[body]`,
    `[0:a]atrim=${seamAt}:${end},asetpts=PTS-STARTPTS,afade=t=out:st=0:d=${CROSSFADE}:curve=qsin[tail]`,
    `[head][tail]amix=inputs=2:normalize=0[seam]`,
    `[seam][body]concat=n=2:v=0:a=1[joined]`,
    `[joined]loudnorm=I=${BED_LUFS}:TP=-1.5:LRA=11[out]`,
  ].join(';');

  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-filter_complex', filter,
    '-map', '[out]',
    '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '64k',
    resolve(OUT, outName),
  ]);
  return outName;
}

/** A one-shot: silence trimmed off the front, short fade off the tail. */
async function shot(name, outName, { start, end }) {
  const fade = 0.05;
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', resolve(SRC, name),
    '-af', `atrim=${start}:${end},asetpts=PTS-STARTPTS,afade=t=out:st=${end - start - fade}:d=${fade}`,
    '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k',
    resolve(OUT, outName),
  ]);
  return outName;
}

await mkdir(OUT, { recursive: true });

const written = [
  await bed('DaytimeSound.mp3', 'day.mp3'),
  await bed('NightSound.mp3', 'night.mp3'),
  /* Silence runs to 0.095 s; the horn itself is done by 0.345 s and what
     follows is inaudible tail. */
  await shot('ScooterSoundHorn.mp3', 'horn.mp3', { start: 0.09, end: 0.55 }),
  /* Silence to 0.085 s, crow ends at 1.886 s. */
  await shot('RoasterSound.mp3', 'rooster.mp3', { start: 0.08, end: 1.95 }),
];

for (const name of written) {
  const { size } = await stat(resolve(OUT, name));
  const seconds = await duration(resolve(OUT, name));
  console.log(`${name.padEnd(12)} ${(size / 1024).toFixed(0).padStart(5)} KB  ${seconds.toFixed(2)}s`);
}
