/**
 * Generates stand-in artwork for interactive scenes (currently just the
 * Fruits & Vegetables crate) so basket-scene.js can be built, wired up
 * and reviewed before the real photography arrives.
 *
 * Reads each category's scene.json and, for every item it names plus the
 * container itself, writes a simple flat-colour SVG if no real file
 * (.png/.webp) already exists at that path — same "real art wins, never
 * clobbered" rule as gen-lottie.mjs.
 *
 * Output: src/assets/scenes/<slug>/<container>.svg
 *         src/assets/scenes/<slug>/items/<item-id>.svg
 */
import { writeFile, mkdir, readFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCENES_DIR = resolve(root, 'src/assets/scenes');

const hasRealArt = async (svgPath) => {
  const dir = dirname(svgPath);
  const base = svgPath.slice(dir.length + 1).replace(/\.svg$/, '');
  try {
    const files = await readdir(dir);
    return files.some((f) => f.startsWith(`${base}.`) && !f.endsWith('.svg'));
  } catch {
    return false;
  }
};

/** Simple, recognisable produce silhouettes — placeholders, not final art. */
const ITEM_ART = {
  banana: (fill) => `
    <path d="M120 340 Q60 300 70 210 Q76 150 130 110 Q145 100 155 108
             Q160 118 150 128 Q108 158 100 210 Q94 280 145 315
             Q160 325 150 338 Q140 348 120 340 Z" fill="${fill}"/>
    <path d="M130 112 Q140 96 155 100" stroke="#7a5a1e" stroke-width="8" stroke-linecap="round" fill="none"/>`,
  mango: (fill) => `
    <path d="M200 90 Q290 110 300 210 Q305 300 210 330 Q120 305 110 220
             Q104 130 200 90 Z" fill="${fill}"/>
    <path d="M195 92 Q210 70 235 80" stroke="#3d6b2c" stroke-width="10" stroke-linecap="round" fill="none"/>`,
  apple: (fill) => `
    <circle cx="200" cy="220" r="105" fill="${fill}"/>
    <circle cx="140" cy="180" r="60" fill="${fill}"/>
    <path d="M200 118 Q205 95 225 88" stroke="#5a3a1e" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M222 92 Q245 78 260 96 Q245 104 222 98 Z" fill="#4a8f3c"/>`,
  lemon: (fill) => `
    <ellipse cx="200" cy="210" rx="120" ry="95" fill="${fill}"/>
    <path d="M90 210 Q70 208 68 200" stroke="${fill}" stroke-width="14" stroke-linecap="round"/>
    <path d="M310 210 Q330 208 332 200" stroke="${fill}" stroke-width="14" stroke-linecap="round"/>`,
  capsicum: (fill) => `
    <path d="M200 130 Q270 140 275 220 Q278 300 200 320 Q122 300 125 220
             Q130 140 200 130 Z" fill="${fill}"/>
    <path d="M190 132 Q195 98 175 82 M205 132 Q212 100 232 88"
          stroke="#3d6b2c" stroke-width="10" stroke-linecap="round" fill="none"/>`,
  tomato: (fill) => `
    <circle cx="200" cy="225" r="110" fill="${fill}"/>
    <path d="M155 118 L175 140 M200 108 L200 135 M245 118 L225 140"
          stroke="#3d6b2c" stroke-width="10" stroke-linecap="round"/>
    <circle cx="200" cy="128" r="16" fill="#3d6b2c"/>`,
  carrot: (fill) => `
    <path d="M170 90 Q230 92 240 150 L215 330 Q205 350 195 330 L160 150
             Q158 100 170 90 Z" fill="${fill}"/>
    <path d="M180 92 L165 60 M200 88 L200 54 M220 92 L235 60"
          stroke="#3d8f3c" stroke-width="9" stroke-linecap="round"/>`,
  onion: (fill) => `
    <path d="M200 320 Q120 300 122 220 Q124 140 200 110 Q276 140 278 220
             Q280 300 200 320 Z" fill="${fill}"/>
    <path d="M198 112 Q192 90 200 70" stroke="#a8863a" stroke-width="8" stroke-linecap="round" fill="none"/>`,
};

const ITEM_FILL = {
  banana: '#f3c94d', mango: '#ef9d3c', apple: '#d94f4f', lemon: '#f0d647',
  capsicum: '#4fae52', tomato: '#e2523f', carrot: '#ef8232', onion: '#e0b8d8',
};

/** A simple open wooden crate, wide enough to read at card and panel sizes. */
function crateSvg() {
  const wood = '#c8873f';
  const woodDark = '#a8672a';
  const woodDeep = '#8a5220';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" width="600" height="420">
    <defs>
      <linearGradient id="crateBack" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${wood}"/><stop offset="1" stop-color="${woodDark}"/>
      </linearGradient>
      <linearGradient id="crateFront" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${woodDark}"/><stop offset="1" stop-color="${woodDeep}"/>
      </linearGradient>
    </defs>
    <path d="M40 90 L560 90 L520 340 L80 340 Z" fill="url(#crateBack)"/>
    <path d="M60 240 L540 240 L520 340 L80 340 Z" fill="url(#crateFront)"/>
    ${[130, 220, 310, 400, 470].map((x) => `<line x1="${x}" y1="240" x2="${x - 8}" y2="340" stroke="${woodDeep}" stroke-width="4" opacity="0.5"/>`).join('')}
    <rect x="40" y="80" width="520" height="18" rx="6" fill="${woodDark}"/>
  </svg>`;
}

function itemSvg(id) {
  const build = ITEM_ART[id];
  const fill = ITEM_FILL[id] ?? '#8bbf5a';
  const inner = build ? build(fill) : `<circle cx="200" cy="210" r="100" fill="${fill}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <radialGradient id="shine-${id}" cx="35%" cy="30%" r="65%">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
        <stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g>${inner}</g>
    <circle cx="200" cy="210" r="140" fill="url(#shine-${id})"/>
  </svg>`;
}

async function writeIfMissing(path, svg) {
  if (await hasRealArt(path)) {
    console.log(`  ${path.replace(`${root}/`, '')} — skipped, real render present`);
    return;
  }
  await writeFile(path, svg, 'utf8');
  console.log(`  ${path.replace(`${root}/`, '')}`);
}

const entries = await readdir(SCENES_DIR, { withFileTypes: true }).catch(() => []);

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const sceneDir = resolve(SCENES_DIR, entry.name);
  const manifest = JSON.parse(await readFile(resolve(sceneDir, 'scene.json'), 'utf8'));

  await writeIfMissing(resolve(sceneDir, `${manifest.container}.svg`), crateSvg());

  await mkdir(resolve(sceneDir, 'items'), { recursive: true });
  for (const item of manifest.items) {
    await writeIfMissing(resolve(sceneDir, 'items', `${item.id}.svg`), itemSvg(item.id));
  }
}

console.log('\nScene placeholders ready. Drop real .png/.webp files in the same folders to replace them.');
