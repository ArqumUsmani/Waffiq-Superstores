/**
 * Isometric brand packs for the marquee band.
 *
 * Each brand is drawn as a 3D carton in the same 2:1 dimetric projection
 * as the category icons, with the brand name set on its front face so the
 * lettering sits on the surface rather than floating over it.
 *
 * These are *generated marks, not brand logos*. Real logos are
 * trademarked artwork we cannot invent — supply them as transparent PNGs
 * at src/assets/brands/<slug>.png and they replace the generated pack
 * with no code change.
 */
import { escapeHtml } from '../lib/dom.js';

const LOGOS = import.meta.glob('../../assets/brands/*.{png,webp,svg}', {
  query: '?url',
  import: 'default',
  eager: true,
});

const S = 1;
const proj = (x, y, z = 0) => [(x - y) * S, ((x + y) * 0.5 - z) * S];

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Stable hash so a brand's pack never changes shape between builds. */
function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hsl(h, s, l) {
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
}

const pt = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;

export function brandMark(name, { height = 96 } = {}) {
  const slug = slugify(name);
  const logo = LOGOS[`../../assets/brands/${slug}.png`]
    ?? LOGOS[`../../assets/brands/${slug}.webp`]
    ?? LOGOS[`../../assets/brands/${slug}.svg`];

  if (logo) {
    // Not lazy: this only ever renders into the marquee ribbon, where
    // every copy (the run is duplicated for a seamless loop) is always
    // at most one viewport away. A lazy image the browser judges "off
    // enough" to defer indefinitely never fires its load event, which
    // hangs marquee.js's decode-then-measure step forever — narrower
    // viewports made that judgement more often, not more rarely.
    return `<img class="brand-mark brand-mark--logo" src="${logo}" alt="${escapeHtml(name)}"
      height="${height}" decoding="async">`;
  }

  // A curated hue set rather than the full wheel — free hues put magenta
  // next to teal and the band stops looking like one shelf.
  const PALETTE = [96, 145, 168, 28, 12, 200, 45, 262];
  const seed = hash(slug);
  const hue = PALETTE[seed % PALETTE.length];
  const sat = 30 + (seed % 13);

  // Wider names get a wider pack, so the lettering never has to squeeze
  // down to an unreadable condensed.
  const a = Math.min(36, 17 + name.length * 1.5); // half width
  const b = 13; // half depth
  const h = 42 + (seed % 10); // height

  const P = (x, y, z) => proj(x, y, z);

  const topFace = [P(-a, -b, h), P(a, -b, h), P(a, b, h), P(-a, b, h)];
  const rightFace = [P(a, -b, 0), P(a, b, 0), P(a, b, h), P(a, -b, h)];
  const frontFace = [P(-a, b, 0), P(a, b, 0), P(a, b, h), P(-a, b, h)];

  const base = { h: hue, s: sat };
  const faceTop = hsl(base.h, base.s, 82);
  const faceTop2 = hsl(base.h, base.s, 72);
  const faceRight = hsl(base.h, base.s, 52);
  const faceRight2 = hsl(base.h, base.s, 44);
  const faceFront = hsl(base.h, base.s, 67);
  const faceFront2 = hsl(base.h, base.s, 57);
  const ink = hsl(base.h, Math.min(62, base.s + 18), 20);

  // Front face local axes: u runs along x, v runs down from the top edge.
  const faceMatrix = `matrix(${S} ${0.5 * S} 0 ${S} ${(-b * S).toFixed(3)} ${(0.5 * b * S).toFixed(3)})`;

  const width = (a + b) * 2 * S + 16;
  const tall = (a + b) * S + h * S + 22;
  const gradId = `bm${slug.replace(/-/g, '')}`;

  return `<svg class="brand-mark" viewBox="${-width / 2} ${-(h * S + (a + b) * 0.5 * S + 14)} ${width} ${tall}"
    height="${height}" role="img" aria-label="${escapeHtml(name)}">
    <defs>
      <linearGradient id="${gradId}t" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="${faceTop}"/><stop offset="1" stop-color="${faceTop2}"/>
      </linearGradient>
      <linearGradient id="${gradId}r" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${faceRight}"/><stop offset="1" stop-color="${faceRight2}"/>
      </linearGradient>
      <linearGradient id="${gradId}f" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${faceFront}"/><stop offset="1" stop-color="${faceFront2}"/>
      </linearGradient>
    </defs>

    <ellipse cx="0" cy="${(b * 0.5).toFixed(2)}" rx="${((a + b) * 0.92).toFixed(2)}" ry="${((a + b) * 0.3).toFixed(2)}"
      fill="${ink}" opacity="0.16"/>

    <polygon points="${frontFace.map(pt).join(' ')}" fill="url(#${gradId}f)"/>
    <polygon points="${rightFace.map(pt).join(' ')}" fill="url(#${gradId}r)"/>
    <polygon points="${topFace.map(pt).join(' ')}" fill="url(#${gradId}t)"/>

    <g transform="${faceMatrix}">
      <text x="0" y="${(-h * 0.42).toFixed(2)}" text-anchor="middle"
        textLength="${(a * 1.68).toFixed(2)}" lengthAdjust="spacingAndGlyphs"
        font-size="${(h * 0.34).toFixed(2)}" font-weight="700" fill="${ink}"
        opacity="0.95">${escapeHtml(name)}</text>
    </g>
  </svg>`;
}
