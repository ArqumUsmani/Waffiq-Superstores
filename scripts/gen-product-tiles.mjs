/**
 * Rasterises the generated product tile — the same deterministic
 * gradient + glyph + initials design product-tile.js used to draw as an
 * inline SVG at runtime — into a real PNG file per SKU, then points
 * every product without a real photo at its file.
 *
 * One-time (well, re-run-on-demand) build step: after this, no SVG is
 * generated in the browser at all — every product tile is a plain
 * <img>, same as a real photo would be. `image` already set on a
 * product (a genuine photo dropped in later) is left untouched.
 *
 * Needs a Chrome instance reachable over the DevTools protocol — this
 * only ever runs from the command line, never in the shipped site.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PRODUCTS_PATH = resolve(ROOT, 'src/data/products.json');
const CATEGORIES_PATH = resolve(ROOT, 'src/data/categories.json');
const OUT_DIR = resolve(ROOT, 'public/products');
const CDP_PORT = process.env.CDP_PORT ?? 9333;
const SIZE = 400;

/* ------------------------------------------------------------------ *
   The tile design itself — ported as-is from product-tile.js, which
   this script makes redundant. Kept in sync by being the only copy:
   product-tile.js's runtime version is deleted in the same change.
 * ------------------------------------------------------------------ */

const GLYPHS = {
  fruit: [
    ['c', 48, 58, 26],
    ['p', 'M50 30 Q60 20 70 26 Q64 36 52 34 Z', 'shade'],
    ['e', 38, 46, 6, 9, 'hole'],
  ],
  vegetable: [
    ['p', 'M50 30 Q74 34 72 62 Q70 82 50 82 Q30 82 28 62 Q26 34 50 30 Z'],
    ['p', 'M46 30 Q50 18 54 30 Z', 'shade'],
    ['e', 40, 52, 5, 8, 'hole'],
  ],
  leaf: [
    ['p', 'M50 24 Q78 34 70 62 Q60 80 50 80 Q40 80 30 62 Q22 34 50 24 Z'],
    ['e', 50, 52, 2.2, 26, 'shade'],
    ['e', 40, 42, 5, 8, 'hole'],
  ],
  nut: [
    ['p', 'M50 22 Q68 30 66 56 Q64 78 50 82 Q36 78 34 56 Q32 30 50 22 Z'],
    ['e', 50, 52, 2, 24, 'shade'],
    ['e', 42, 40, 4, 7, 'hole'],
  ],
  cookie: [['c', 50, 50, 30], ['c', 40, 41, 4.5, 'shade'], ['c', 60, 45, 4, 'shade'], ['c', 52, 60, 4.5, 'shade'], ['c', 38, 58, 3.5, 'shade']],
  candy: [['r', 34, 40, 32, 20, 8], ['p', 'M34 44 L24 38 L24 62 L34 56 Z'], ['p', 'M66 44 L76 38 L76 62 L66 56 Z']],
  chocolate: [['r', 28, 30, 44, 40, 5], ['r', 33, 35, 15, 13, 2, 'hole'], ['r', 52, 35, 15, 13, 2, 'hole'], ['r', 33, 52, 15, 13, 2, 'hole'], ['r', 52, 52, 15, 13, 2, 'hole']],
  bar: [['r', 22, 40, 56, 22, 9], ['p', 'M32 46 L44 46 L38 56 L26 56 Z', 'hole']],
  cup: [['r', 30, 34, 36, 32, 9], ['c', 71, 45, 9], ['c', 71, 45, 4.5, 'hole'], ['e', 50, 74, 26, 7]],
  cereal: [['p', 'M22 46 L78 46 Q72 74 50 74 Q28 74 22 46 Z'], ['c', 38, 40, 6], ['c', 52, 36, 6], ['c', 64, 41, 5]],
  jar: [['r', 32, 36, 36, 40, 8], ['r', 29, 26, 42, 12, 4]],
  carton: [['r', 34, 42, 32, 36, 3], ['p', 'M34 42 L50 24 L66 42 Z'], ['r', 46, 20, 8, 7, 2]],
  tin: [['r', 33, 34, 34, 40, 4], ['e', 50, 34, 17, 6]],
  bottle: [['r', 36, 40, 28, 38, 12], ['r', 44, 26, 12, 16, 3], ['r', 42, 20, 16, 7, 3]],
  spice: [['p', 'M24 50 L76 50 Q70 76 50 76 Q30 76 24 50 Z'], ['p', 'M30 50 L50 26 L70 50 Z']],
  noodles: [['p', 'M24 48 L76 48 Q70 76 50 76 Q30 76 24 48 Z'], ['e', 40, 40, 9, 5], ['e', 58, 36, 9, 5], ['e', 50, 44, 9, 5]],
  whisk: [['r', 46, 58, 8, 22, 4], ['p', 'M50 22 Q30 38 34 58 L66 58 Q70 38 50 22 Z'], ['p', 'M50 26 Q44 42 46 58 L54 58 Q56 42 50 26 Z', 'hole']],
  can: [['r', 34, 30, 32 , 44, 4], ['e', 50, 30, 16, 6], ['r', 34, 44, 32, 14, 1, 'hole']],
  oil: [['r', 38, 38, 24, 40, 9], ['r', 45, 24, 10, 14, 3], ['p', 'M72 44 Q80 56 72 60 Q64 56 72 44 Z']],
  tissue: [['r', 26, 44, 48, 30, 5], ['p', 'M42 44 L50 26 L58 44 Z']],
  flame: [['p', 'M50 20 Q66 38 62 54 Q60 74 50 78 Q40 74 38 54 Q34 38 50 20 Z'], ['p', 'M50 42 Q57 52 54 62 Q52 70 50 71 Q48 70 46 62 Q43 52 50 42 Z', 'hole']],
  box: [['r', 28, 40, 44 , 34, 6], ['r', 24, 30, 52, 12, 5]],
  dish: [['e', 50, 56, 30, 16], ['c', 68, 34, 7], ['c', 78, 44, 4.5], ['c', 60, 27, 4]],
  spray: [['r', 38, 42, 26, 34, 9], ['r', 44, 30, 14, 12, 3], ['p', 'M34 30 L34 20 L58 20 L58 26 L44 26 L44 30 Z'], ['c', 74, 22, 4], ['c', 82, 32, 3]],
  detergent: [['r', 28, 32, 44, 42, 5], ['r', 34, 42, 32, 5, 2, 'hole'], ['r', 34, 52, 24, 5, 2, 'hole']],
  baby: [['r', 36, 42, 28, 36, 13], ['r', 34, 32, 32, 9, 3], ['p', 'M44 32 Q44 18 50 18 Q56 18 56 32 Z']],
  razor: [['r', 46, 44, 8, 32, 4], ['r', 32, 26, 36, 18, 5], ['r', 36, 38, 28, 4, 2, 'hole']],
  pad: [['r', 26, 38, 48, 26, 13], ['r', 34, 48, 32, 4, 2, 'hole']],
  'bottle-pump': [['r', 36, 42, 28, 36, 12], ['r', 45, 30, 10, 12, 3], ['r', 45, 20, 6, 12, 3], ['r', 50, 18, 16, 6, 3]],
  tooth: [['p', 'M32 30 Q50 22 68 30 Q72 52 62 74 Q56 80 53 66 Q50 56 47 66 Q44 80 38 74 Q28 52 32 30 Z'], ['r', 40, 38, 20, 5, 2, 'hole']],
};

const FALLBACK_GLYPH = 'box';

function hexToHsl(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return [0, 0, lightness * 100];

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  return [(hue * 60 + 360) % 360, saturation * 100, lightness * 100];
}

function initialsFor(product) {
  const words = product.name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function renderGlyph(name, holeFill, detailFill) {
  const parts = GLYPHS[name] ?? GLYPHS[FALLBACK_GLYPH];
  return parts
    .map((part) => {
      const marker = part.at(-1);
      const paint =
        marker === 'hole' ? ` fill="${holeFill}"`
        : marker === 'shade' ? ` fill="${detailFill}"`
        : '';
      if (part[0] === 'c') return `<circle cx="${part[1]}" cy="${part[2]}" r="${part[3]}"${paint}/>`;
      if (part[0] === 'e') {
        return `<ellipse cx="${part[1]}" cy="${part[2]}" rx="${part[3]}" ry="${part[4]}"${paint}/>`;
      }
      if (part[0] === 'r') {
        return `<rect x="${part[1]}" y="${part[2]}" width="${part[3]}" height="${part[4]}" rx="${part[5] ?? 0}"${paint}/>`;
      }
      return `<path d="${part[1]}"${paint}/>`;
    })
    .join('');
}

function productTileSvg(product, category) {
  const accent = category?.accent ?? '#136f37';
  const [hue, saturation] = hexToHsl(accent);

  const seed = product.tile?.hue ?? 0;
  const drift = (seed % 40) - 20;
  const h = ((hue + drift + 360) % 360).toFixed(1);
  const s = Math.min(74, Math.max(28, saturation * 0.66 + (seed % 11) - 5)).toFixed(1);
  const lift = (seed % 7) - 3;

  const light = `hsl(${h} ${s}% ${95 + lift * 0.4}%)`;
  const mid = `hsl(${h} ${s}% ${86 + lift * 0.5}%)`;
  const face = `hsl(${h} ${s}% ${69 + lift}%)`;
  const shade = `hsl(${h} ${s}% ${54 + lift}%)`;
  const ink = `hsl(${h} ${s}% 38%)`;
  const id = `t${product.sku.replace(/[^a-z0-9]/gi, '')}`;
  const glyph = product.tile?.glyph;

  return `<svg class="tile" viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0.7" y2="1">
        <stop offset="0" stop-color="${light}"/>
        <stop offset="1" stop-color="${mid}"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#${id})"/>
    <ellipse cx="50" cy="79" rx="27" ry="5" fill="${ink}" opacity="0.13"/>
    <g transform="translate(50 46) scale(0.68) translate(-50 -50)">
      <g fill="${shade}" opacity="0.5" transform="translate(3 4)">${renderGlyph(glyph, shade, shade)}</g>
      <g fill="${face}">${renderGlyph(glyph, light, shade)}</g>
    </g>
    <text x="50" y="92" fill="${ink}" text-anchor="middle"
      font-family="Poppins, Arial, sans-serif" font-size="7" font-weight="600"
      letter-spacing="1.3" opacity="0.55">${initialsFor(product)}</text>
  </svg>`;
}

/* ------------------------------------------------------------------ *
   CDP plumbing — minimal, dependency-free.
 * ------------------------------------------------------------------ */

let nextId = 1;
const rpc = (ws, method, params = {}, sessionId) =>
  new Promise((resolve_, reject) => {
    const id = nextId++;
    const onMsg = (e) => {
      const m = JSON.parse(e.data);
      if (m.id !== id) return;
      ws.removeEventListener('message', onMsg);
      m.error ? reject(new Error(method + ': ' + JSON.stringify(m.error))) : resolve_(m.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

async function main() {
  const products = JSON.parse(await readFile(PRODUCTS_PATH, 'utf8'));
  const categories = JSON.parse(await readFile(CATEGORIES_PATH, 'utf8'));
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  await mkdir(OUT_DIR, { recursive: true });

  const version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res) => ws.addEventListener('open', res, { once: true }));

  const { targetId } = await rpc(ws, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await rpc(ws, 'Target.attachToTarget', { targetId, flatten: true });
  await rpc(ws, 'Page.enable', {}, sessionId);
  await rpc(ws, 'Runtime.enable', {}, sessionId);
  // deviceScaleFactor 1, deliberately: this is a soft gradient and a
  // few flat shapes, not fine detail — retina density roughly doubled
  // every file's weight (a gradient's smooth pixel-to-pixel drift is
  // exactly what PNG's compression is worst at) for no visible gain at
  // the sizes these actually render on a card.
  await rpc(ws, 'Emulation.setDeviceMetricsOverride',
    { width: SIZE, height: SIZE, deviceScaleFactor: 1, mobile: false }, sessionId);
  // The '#' in `background:transparent` — anything, really, in an
  // unencoded data: URL — gets read as a URL fragment and silently
  // truncates the document right there, well before <body> even
  // exists. encodeURIComponent is what makes this actually a page.
  const stageHtml = `<!doctype html><html><head><style>` +
    `html,body{margin:0;background:transparent}` +
    `#stage{width:${SIZE}px;height:${SIZE}px}` +
    `</style></head><body><div id="stage"></div></body></html>`;
  await rpc(ws, 'Page.navigate', {
    url: `data:text/html,${encodeURIComponent(stageHtml)}`,
  }, sessionId);
  await new Promise((res) => {
    const onMsg = (e) => {
      const m = JSON.parse(e.data);
      if (m.method === 'Page.loadEventFired' && m.sessionId === sessionId) {
        ws.removeEventListener('message', onMsg);
        res();
      }
    };
    ws.addEventListener('message', onMsg);
  });

  let written = 0;
  let skipped = 0;
  let updated = false;

  for (const product of products) {
    if (product.image) {
      skipped += 1;
      continue;
    }

    const svg = productTileSvg(product, categoryBySlug.get(product.category));
    // JSON-encode so the SVG's own quotes/newlines survive the trip
    // through Runtime.evaluate's expression string untouched.
    await rpc(ws, 'Runtime.evaluate', {
      expression: `document.getElementById('stage').innerHTML = ${JSON.stringify(svg)}`,
    }, sessionId);
    // The DOM mutation above completes synchronously, but headless
    // Chrome still needs a paint to actually composite it — without
    // this the screenshot below can win the race and capture a blank
    // frame.
    await new Promise((r) => setTimeout(r, 60));

    const { data } = await rpc(ws, 'Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: SIZE, height: SIZE, scale: 1 },
    }, sessionId);

    const outPath = resolve(OUT_DIR, `${product.sku}.png`);
    await writeFile(outPath, Buffer.from(data, 'base64'));
    product.image = `/products/${product.sku}.png`;
    updated = true;
    written += 1;
  }

  await rpc(ws, 'Target.closeTarget', { targetId });
  ws.close();

  if (updated) {
    await writeFile(PRODUCTS_PATH, JSON.stringify(products, null, 2) + '\n');
  }

  console.log(`Rendered ${written} product tile(s) to public/products/, skipped ${skipped} with a real image already.`);
}

main();
