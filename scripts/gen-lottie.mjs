/**
 * Generates the nine category icons as skeuomorphic isometric artwork —
 * a Lottie v5 animation plus a matching static SVG poster each.
 *
 * Geometry is built in 3D world units and projected to 2:1 dimetric
 * ("isometric") screen space by `proj()`. Both renderers consume the same
 * flat list of already-projected 2D shapes, so the poster is exactly the
 * animation's resting frame and cannot drift from it.
 *
 * Motion: frame 0 is the resting pose and nothing moves on its own. The
 * whole 0..HOVER_END range is one hover gesture — objects lift, tilt and
 * settle — and frame HOVER_END returns to the rest pose, so replaying is
 * seamless.
 *
 * Output: src/assets/categories/<slug>.json and <slug>.svg
 *
 * A category with a real render at <slug>.png is skipped entirely — the
 * PNG wins, and regenerating will not clobber or shadow it. A category
 * that declares `"scene"` in categories.json (an interactive scene, e.g.
 * the fruits-and-vegetables crate) is skipped too — it is built and
 * animated by basket-scene.js, not by this generator.
 */
import { writeFile, mkdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'src/assets/categories');

const SIZE = 240;
const CENTRE = SIZE / 2;
const FPS = 60;
const HOVER_END = 48; // one hover gesture, rest -> lift -> settle -> rest

/* ------------------------------------------------------------------ *
   Colour
 * ------------------------------------------------------------------ */

const rgb = (hex) => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
};

const hex = (parts) =>
  `#${parts
    .map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0'))
    .join('')}`;

/** amount > 0 lightens toward white, < 0 darkens toward black. */
const shade = (color, amount) =>
  hex(rgb(color).map((c) => (amount < 0 ? c * (1 + amount) : c + (1 - c) * amount)));

/** Pulls a colour toward another, for tinting shadows with the object hue. */
const mix = (a, b, t) => {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return hex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
};

/* ------------------------------------------------------------------ *
   Isometric projection

   World: x runs right-and-down, y runs left-and-down, z is up.
   Visible faces of a box are therefore +x (right), +y (left) and +z (top).
 * ------------------------------------------------------------------ */

/** World units are scaled here rather than at every call site. */
const S = 1.75;
const proj = (x, y, z = 0) => [(x - y) * S, ((x + y) * 0.5 - z) * S];

/** A circle of radius r on the ground plane projects to this ellipse. */
const ISO_RX = Math.SQRT2;
const ISO_RY = Math.SQRT2 / 2;

/** Single-cubic approximation of a half ellipse. */
const ARC_K = 4 / 3;

const poly = (points, fill) => ({
  t: 'p',
  v: points,
  i: points.map(() => [0, 0]),
  o: points.map(() => [0, 0]),
  fill,
});

const ellipse = (centre, rx, ry, fill) => ({ t: 'e', c: centre, r: [rx * 2, ry * 2], fill });

const solid = (color, opacity = 100) => ({ type: 'solid', color, opacity });

const linear = (from, to, s, e, opacity = 100) => ({ type: 'linear', from, to, s, e, opacity });

/* ------------------------------------------------------------------ *
   Primitives
 * ------------------------------------------------------------------ */

/**
 * An isometric box.
 * Faces are shaded top / right / left from lightest to darkest, with a
 * specular sliver along the top-right edge — the cue that reads as a
 * solid object under a single light.
 */
function isoBox({ x = 0, y = 0, z = 0, w, d, h, color, gloss = true }) {
  const a = w / 2;
  const b = d / 2;
  const top = z + h;

  const P = (dx, dy, dz) => proj(x + dx, y + dy, dz);

  const topFace = [P(-a, -b, top), P(a, -b, top), P(a, b, top), P(-a, b, top)];
  const rightFace = [P(a, -b, z), P(a, b, z), P(a, b, top), P(a, -b, top)];
  const leftFace = [P(-a, b, z), P(a, b, z), P(a, b, top), P(-a, b, top)];

  const shapes = [
    poly(leftFace, linear(shade(color, -0.3), shade(color, -0.46), leftFace[3], leftFace[0])),
    poly(rightFace, linear(shade(color, -0.04), shade(color, -0.24), rightFace[3], rightFace[0])),
    poly(topFace, linear(shade(color, 0.28), shade(color, 0.06), topFace[0], topFace[2])),
  ];

  if (gloss) {
    const inset = Math.min(a, b) * 0.26;
    shapes.push(
      poly(
        [
          P(a - inset, -b + inset, top),
          P(a - inset, b - inset, top),
          P(a - inset * 2.1, b - inset, top),
          P(a - inset * 2.1, -b + inset, top),
        ],
        solid('#ffffff', 15),
      ),
    );
  }

  return shapes;
}

/**
 * An isometric cylinder: a body whose lower edge bows out into the
 * ground ellipse, capped by the full top ellipse.
 */
function isoCylinder({ x = 0, y = 0, z = 0, r, h, color, gloss = true }) {
  const rx = r * ISO_RX * S;
  const ry = r * ISO_RY * S;
  const [cx, cyBase] = proj(x, y, z);
  const cyTop = cyBase - h * S;

  const body = {
    t: 'p',
    v: [
      [cx - rx, cyTop],
      [cx - rx, cyBase],
      [cx + rx, cyBase],
      [cx + rx, cyTop],
    ],
    i: [
      [0, 0],
      [0, 0],
      [0, ry * ARC_K],
      [0, 0],
    ],
    o: [
      [0, 0],
      [0, ry * ARC_K],
      [0, 0],
      [0, 0],
    ],
    fill: linear(
      shade(color, -0.42),
      shade(color, -0.02),
      [cx - rx, cyTop],
      [cx + rx * 0.55, cyTop],
    ),
  };

  const shapes = [
    body,
    ellipse([cx, cyTop], rx, ry, linear(shade(color, 0.3), shade(color, 0.04), [cx - rx, cyTop - ry], [cx + rx, cyTop + ry])),
  ];

  if (gloss) {
    shapes.splice(1, 0, {
      t: 'p',
      v: [
        [cx - rx * 0.62, cyTop + ry * 0.5],
        [cx - rx * 0.62, cyBase],
        [cx - rx * 0.3, cyBase],
        [cx - rx * 0.3, cyTop + ry * 0.72],
      ],
      i: [[0, 0], [0, 0], [0, ry * 0.4], [0, 0]],
      o: [[0, 0], [0, ry * 0.4], [0, 0], [0, 0]],
      fill: solid('#ffffff', 13),
    });
  }

  return shapes;
}

/** A cone — spice mounds, bottle teats. */
function isoCone({ x = 0, y = 0, z = 0, r, h, color }) {
  const rx = r * ISO_RX * S;
  const ry = r * ISO_RY * S;
  const [cx, cyBase] = proj(x, y, z);
  const apex = [cx, cyBase - h * S];

  return [
    {
      t: 'p',
      v: [[cx - rx, cyBase], apex, [cx + rx, cyBase]],
      i: [[0, 0], [0, 0], [0, ry * ARC_K]],
      o: [[0, 0], [0, 0], [0, 0]],
      fill: linear(shade(color, 0.22), shade(color, -0.3), [cx - rx, cyBase - h], [cx + rx, cyBase]),
    },
  ];
}

/** Soft contact shadow — three stacked ellipses stand in for a blur. */
function contactShadow({ x = 0, y = 0, z = 0, r, color, strength = 1 }) {
  const [cx, cy] = proj(x, y, z);
  return [1, 0].map((i) =>
    ellipse(
      [cx, cy],
      r * ISO_RX * S * (1 + i * 0.2),
      r * ISO_RY * S * (1 + i * 0.2),
      solid(color, [15, 8][i] * strength),
    ),
  );
}

/** The pedestal every icon stands on, plus the shadow it casts. */
function plinth(pastel, accent) {
  return [
    ellipse(proj(0, 0, 0), 36 * ISO_RX * S, 36 * ISO_RY * S, solid(shade(accent, -0.72), 9)),
    ...isoCylinder({ r: 34, h: 3, z: -3, color: shade(pastel, 0.3), gloss: false }),
  ];
}

/* ------------------------------------------------------------------ *
   Icon compositions

   Each layer animates as one unit, so objects that should lift together
   belong in the same layer.
 * ------------------------------------------------------------------ */

const ICONS = {
  'snacks-confectionery': (a, p) => [
    { name: 'plinth', lift: 0, shapes: plinth(p, a) },
    {
      name: 'pack',
      lift: 8,
      tilt: -2.5,
      shapes: [
        ...contactShadow({ x: -15, y: 11, r: 12, color: shade(a, -0.6), strength: 0.7 }),
        ...isoBox({ x: -15, y: 11, w: 26, d: 17, h: 42, color: shade(a, -0.14) }),
        ...isoBox({ x: -15, y: 11, z: 13, w: 26.6, d: 17.6, h: 11, color: shade(p, 0.34) }),
      ],
    },
    {
      name: 'biscuits',
      lift: 14,
      tilt: 3,
      shapes: [
        ...contactShadow({ x: 13, y: -3, r: 16, color: shade(a, -0.6), strength: 0.8 }),
        ...isoCylinder({ x: 13, y: -3, r: 16, h: 5, color: shade(a, 0.04) }),
        ...isoCylinder({ x: 13, y: -3, z: 5, r: 16, h: 5, color: shade(a, 0.2) }),
        ...isoCylinder({ x: 13, y: -3, z: 10, r: 16, h: 5, color: shade(a, 0.36) }),
        ellipse(proj(8, -8, 15), 3 * S, 3 * S, solid('#4a2c14', 74)),
        ellipse(proj(18, 2, 15), 2.6 * S, 2.6 * S, solid('#4a2c14', 66)),
        ellipse(proj(16, -8, 15), 2.2 * S, 2.2 * S, solid('#4a2c14', 58)),
      ],
    },
  ],

  'tea-coffee-breakfast': (a, p) => [
    { name: 'plinth', lift: 0, shapes: plinth(p, a) },
    {
      name: 'carton',
      lift: 8,
      tilt: -2.5,
      shapes: [
        ...contactShadow({ x: -15, y: 11, r: 11, color: shade(a, -0.6), strength: 0.7 }),
        ...isoBox({ x: -15, y: 11, w: 22, d: 16, h: 36, color: shade(a, -0.06) }),
        ...isoBox({ x: -15, y: 11, z: 11, w: 22.6, d: 16.6, h: 12, color: shade(p, 0.4) }),
      ],
    },
    {
      name: 'cup',
      lift: 14,
      tilt: 3,
      shapes: [
        ...contactShadow({ x: 13, y: -3, r: 24, color: shade(a, -0.6), strength: 0.8 }),
        ...isoCylinder({ x: 13, y: -3, r: 21, h: 3, color: shade(p, 0.5), gloss: false }),
        ...isoCylinder({ x: 13, y: -3, z: 3, r: 12, h: 25, color: '#ffffff' }),
        ellipse(proj(13, -3, 28), 12 * ISO_RX * S * 0.86, 12 * ISO_RY * S * 0.86, solid('#5c3a24', 100)),
        ellipse(proj(9, -7, 28), 12 * ISO_RX * S * 0.3, 12 * ISO_RY * S * 0.3, solid('#ffffff', 22)),
      ],
    },
  ],

  'milk-beverages': (a, p) => [
    { name: 'plinth', lift: 0, shapes: plinth(p, a) },
    {
      name: 'bottle',
      lift: 8,
      tilt: -3,
      shapes: [
        ...contactShadow({ x: -15, y: 11, r: 12, color: shade(a, -0.6), strength: 0.7 }),
        ...isoBox({ x: -15, y: 11, w: 22, d: 16, h: 30, color: '#ffffff' }),
        ...isoBox({ x: -15, y: 11, z: 8, w: 22.6, d: 16.6, h: 11, color: shade(a, 0.08) }),
      ],
    },
    {
      name: 'carton',
      lift: 14,
      tilt: 2.5,
      shapes: [
        ...contactShadow({ x: 13, y: -3, r: 15, color: shade(a, -0.6), strength: 0.8 }),
        ...isoCylinder({ x: 13, y: -3, r: 12, h: 40, color: a }),
        ...isoCylinder({ x: 13, y: -3, z: 11, r: 12.4, h: 15, color: '#ffffff', gloss: false }),
        ...isoCylinder({ x: 13, y: -3, z: 40, r: 6, h: 7, color: shade(a, -0.2) }),
        ...isoCylinder({ x: 13, y: -3, z: 47, r: 8, h: 5, color: shade(a, -0.38) }),
      ],
    },
  ],

  'cooking-baking': (a, p) => [
    { name: 'plinth', lift: 0, shapes: plinth(p, a) },
    {
      name: 'jar',
      lift: 8,
      tilt: -3,
      shapes: [
        ...contactShadow({ x: -15, y: 11, r: 10, color: shade(a, -0.6), strength: 0.7 }),
        ...isoCylinder({ x: -15, y: 11, r: 11, h: 25, color: shade(a, 0.08) }),
        ...isoCylinder({ x: -15, y: 11, z: 25, r: 12, h: 6, color: shade(a, -0.34) }),
      ],
    },
    {
      name: 'bowl',
      lift: 14,
      tilt: 2.5,
      shapes: [
        ...contactShadow({ x: 13, y: -3, r: 24, color: shade(a, -0.6), strength: 0.8 }),
        ...isoCylinder({ x: 13, y: -3, r: 21, h: 8, color: '#ffffff' }),
        ...isoCone({ x: 13, y: -3, z: 8, r: 19, h: 20, color: a }),
      ],
    },
  ],

  'condiments-canned': (a, p) => [
    { name: 'plinth', lift: 0, shapes: plinth(p, a) },
    {
      name: 'tin',
      lift: 8,
      tilt: -3,
      shapes: [
        ...contactShadow({ x: -15, y: 11, r: 11, color: shade(a, -0.6), strength: 0.7 }),
        ...isoCylinder({ x: -15, y: 11, r: 12, h: 21, color: '#c3ccd3' }),
        ...isoCylinder({ x: -15, y: 11, z: 21, r: 12.6, h: 2.5, color: '#e7ecef' }),
      ],
    },
    {
      name: 'jar',
      lift: 14,
      tilt: 2.5,
      shapes: [
        ...contactShadow({ x: 13, y: -3, r: 18, color: shade(a, -0.6), strength: 0.8 }),
        ...isoCylinder({ x: 13, y: -3, r: 15, h: 36, color: shade(p, 0.44) }),
        ...isoCylinder({ x: 13, y: -3, z: 9, r: 15.4, h: 15, color: '#ffffff', gloss: false }),
        ...isoCylinder({ x: 13, y: -3, z: 36, r: 16, h: 8, color: shade(a, -0.3) }),
      ],
    },
  ],

  'home-kitchen': (a, p) => [
    { name: 'plinth', lift: 0, shapes: plinth(p, a) },
    {
      name: 'roll',
      lift: 8,
      tilt: -3,
      shapes: [
        ...contactShadow({ x: -15, y: 11, r: 8, color: shade(a, -0.6), strength: 0.7 }),
        ...isoCylinder({ x: -15, y: 11, r: 9, h: 34, color: '#ffffff' }),
        ellipse(proj(-15, 11, 34), 9 * ISO_RX * S * 0.32, 9 * ISO_RY * S * 0.32, solid(shade(a, -0.18), 100)),
      ],
    },
    {
      name: 'container',
      lift: 14,
      tilt: 2.5,
      shapes: [
        ...contactShadow({ x: 13, y: -3, r: 22, color: shade(a, -0.6), strength: 0.8 }),
        ...isoBox({ x: 13, y: -3, w: 42, d: 31, h: 21, color: shade(p, 0.55) }),
        ...isoBox({ x: 13, y: -3, z: 21, w: 46, d: 35, h: 6.5, color: shade(a, -0.02) }),
        ...isoBox({ x: 13, y: -3, z: 27.5, w: 13, d: 11, h: 3.5, color: shade(a, -0.3) }),
      ],
    },
  ],

  'cleaning-fresheners': (a, p) => [
    { name: 'plinth', lift: 0, shapes: plinth(p, a) },
    {
      name: 'carton',
      lift: 8,
      tilt: -2.5,
      shapes: [
        ...contactShadow({ x: -15, y: 11, r: 10, color: shade(a, -0.6), strength: 0.7 }),
        ...isoBox({ x: -15, y: 11, w: 21, d: 15, h: 28, color: shade(a, 0.18) }),
      ],
    },
    {
      name: 'spray',
      lift: 14,
      tilt: 3,
      shapes: [
        ...contactShadow({ x: 13, y: -3, r: 14, color: shade(a, -0.6), strength: 0.8 }),
        ...isoCylinder({ x: 13, y: -3, r: 12, h: 34, color: a }),
        ...isoCylinder({ x: 13, y: -3, z: 9, r: 12.4, h: 14, color: '#ffffff', gloss: false }),
        ...isoCylinder({ x: 13, y: -3, z: 34, r: 6, h: 7, color: shade(a, -0.3) }),
        ...isoBox({ x: 8, y: -8, z: 41, w: 19, d: 8, h: 6, color: shade(a, -0.44) }),
      ],
    },
  ],

  'baby-hygiene': (a, p) => [
    { name: 'plinth', lift: 0, shapes: plinth(p, a) },
    {
      name: 'wipes',
      lift: 8,
      tilt: -2.5,
      shapes: [
        ...contactShadow({ x: -15, y: 11, r: 11, color: shade(a, -0.6), strength: 0.7 }),
        ...isoBox({ x: -15, y: 11, w: 25, d: 17, h: 14, color: shade(a, 0.22) }),
        ...isoBox({ x: -15, y: 11, z: 14, w: 11, d: 8, h: 2.5, color: '#ffffff' }),
      ],
    },
    {
      name: 'bottle',
      lift: 14,
      tilt: 3,
      shapes: [
        ...contactShadow({ x: 13, y: -3, r: 14, color: shade(a, -0.6), strength: 0.8 }),
        ...isoCylinder({ x: 13, y: -3, r: 12, h: 34, color: shade(p, 0.55) }),
        ...isoCylinder({ x: 13, y: -3, z: 34, r: 12.6, h: 6, color: shade(a, 0.05) }),
        ...isoCone({ x: 13, y: -3, z: 40, r: 8, h: 15, color: shade(a, 0.3) }),
      ],
    },
  ],

  'personal-care': (a, p) => [
    { name: 'plinth', lift: 0, shapes: plinth(p, a) },
    {
      name: 'soap',
      lift: 8,
      tilt: -3,
      shapes: [
        ...contactShadow({ x: -15, y: 11, r: 11, color: shade(a, -0.6), strength: 0.7 }),
        ...isoBox({ x: -15, y: 11, w: 25, d: 18, h: 11, color: shade(a, 0.42) }),
      ],
    },
    {
      name: 'pump',
      lift: 14,
      tilt: 3,
      shapes: [
        ...contactShadow({ x: 13, y: -3, r: 15, color: shade(a, -0.6), strength: 0.8 }),
        ...isoCylinder({ x: 13, y: -3, r: 13, h: 36, color: a }),
        ...isoCylinder({ x: 13, y: -3, z: 10, r: 13.4, h: 15, color: '#ffffff', gloss: false }),
        ...isoCylinder({ x: 13, y: -3, z: 36, r: 5, h: 8, color: shade(a, -0.3) }),
        ...isoCylinder({ x: 13, y: -3, z: 44, r: 3.5, h: 8, color: shade(a, -0.42) }),
        ...isoBox({ x: 19, y: 3, z: 48, w: 16, d: 6.5, h: 4.5, color: shade(a, -0.42) }),
      ],
    },
  ],
};

/* ------------------------------------------------------------------ *
   Lottie renderer
 * ------------------------------------------------------------------ */

const lottieFill = (fill) => {
  if (fill.type === 'solid') {
    return {
      ty: 'fl',
      c: { a: 0, k: [...rgb(fill.color), 1] },
      o: { a: 0, k: fill.opacity },
      r: 1,
      bm: 0,
      nm: 'fill',
    };
  }
  return {
    ty: 'gf',
    o: { a: 0, k: fill.opacity },
    r: 1,
    bm: 0,
    g: { p: 2, k: { a: 0, k: [0, ...rgb(fill.from), 1, ...rgb(fill.to)] } },
    s: { a: 0, k: fill.s },
    e: { a: 0, k: fill.e },
    t: 1,
    nm: 'grad',
  };
};

const groupTransform = () => ({
  ty: 'tr',
  p: { a: 0, k: [0, 0] },
  a: { a: 0, k: [0, 0] },
  s: { a: 0, k: [100, 100] },
  r: { a: 0, k: 0 },
  o: { a: 0, k: 100 },
  nm: 'tr',
});

function lottieShape(shape) {
  const geo =
    shape.t === 'e'
      ? { ty: 'el', d: 1, s: { a: 0, k: shape.r }, p: { a: 0, k: shape.c }, nm: 'el' }
      : {
          ty: 'sh',
          d: 1,
          ks: { a: 0, k: { c: true, v: shape.v, i: shape.i, o: shape.o } },
          nm: 'sh',
        };

  return { ty: 'gr', nm: 'g', bm: 0, hd: false, it: [geo, lottieFill(shape.fill), groupTransform()] };
}

const EASE_OUT = { i: { x: [0.16, 0.16, 0.16], y: [1, 1, 1] }, o: { x: [0.3, 0.3, 0.3], y: [0, 0, 0] } };
const EASE_1D = { i: { x: [0.16], y: [1] }, o: { x: [0.3], y: [0] } };

/**
 * One hover gesture. Frame 0 and frame HOVER_END are the same resting
 * pose, so the icon is static until something plays it.
 */
function hoverPosition(lift) {
  const rest = [CENTRE, CENTRE, 0];
  const up = [CENTRE, CENTRE - lift, 0];
  const dip = [CENTRE, CENTRE + lift * 0.16, 0];
  return {
    a: 1,
    k: [
      { t: 0, s: rest, ...EASE_OUT },
      { t: 14, s: up, ...EASE_OUT },
      { t: 30, s: dip, ...EASE_OUT },
      { t: HOVER_END, s: rest },
    ],
  };
}

function hoverRotation(tilt) {
  return {
    a: 1,
    k: [
      { t: 0, s: [0], ...EASE_1D },
      { t: 14, s: [tilt], ...EASE_1D },
      { t: 30, s: [-tilt * 0.35], ...EASE_1D },
      { t: HOVER_END, s: [0] },
    ],
  };
}

function hoverScale(lift) {
  const grow = 100 + lift * 0.35;
  return {
    a: 1,
    k: [
      { t: 0, s: [100, 100, 100], ...EASE_OUT },
      { t: 14, s: [grow, grow, 100], ...EASE_OUT },
      { t: 30, s: [100 - lift * 0.12, 100 - lift * 0.12, 100], ...EASE_OUT },
      { t: HOVER_END, s: [100, 100, 100] },
    ],
  };
}

function lottieLayer(index, layer) {
  return {
    ddd: 0,
    ind: index,
    ty: 4,
    nm: layer.name,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: hoverRotation(layer.tilt ?? 0),
      p: hoverPosition(layer.lift ?? 0),
      a: { a: 0, k: [0, 0, 0] },
      s: hoverScale(layer.lift ?? 0),
    },
    ao: 0,
    // Lottie paints shapes[0] on top, the opposite of SVG document order.
    shapes: [...layer.shapes].reverse().map(lottieShape),
    ip: 0,
    op: HOVER_END + 1,
    st: 0,
    bm: 0,
  };
}

/* ------------------------------------------------------------------ *
   SVG renderer — the resting frame
 * ------------------------------------------------------------------ */

function svgFor(slug, layers) {
  const defs = [];
  let gradId = 0;

  const paint = (fill) => {
    if (fill.type === 'solid') {
      return `fill="${fill.color}"${fill.opacity < 100 ? ` opacity="${fill.opacity / 100}"` : ''}`;
    }
    const id = `${slug.replace(/[^a-z]/g, '')}g${gradId++}`;
    defs.push(
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
        `x1="${fill.s[0].toFixed(2)}" y1="${fill.s[1].toFixed(2)}" ` +
        `x2="${fill.e[0].toFixed(2)}" y2="${fill.e[1].toFixed(2)}">` +
        `<stop offset="0" stop-color="${fill.from}"/>` +
        `<stop offset="1" stop-color="${fill.to}"/></linearGradient>`,
    );
    return `fill="url(#${id})"${fill.opacity < 100 ? ` opacity="${fill.opacity / 100}"` : ''}`;
  };

  const draw = (shape) => {
    if (shape.t === 'e') {
      return `<ellipse cx="${shape.c[0].toFixed(2)}" cy="${shape.c[1].toFixed(2)}" ` +
        `rx="${(shape.r[0] / 2).toFixed(2)}" ry="${(shape.r[1] / 2).toFixed(2)}" ${paint(shape.fill)}/>`;
    }

    // Same vertex/tangent data the Lottie path uses, emitted as cubics.
    const { v, i, o } = shape;
    const at = (k) => v[(k + v.length) % v.length];
    const inT = (k) => i[(k + v.length) % v.length];
    const outT = (k) => o[(k + v.length) % v.length];

    let d = `M${at(0)[0].toFixed(2)} ${at(0)[1].toFixed(2)}`;
    for (let k = 0; k < v.length; k += 1) {
      const from = at(k);
      const to = at(k + 1);
      const c1 = [from[0] + outT(k)[0], from[1] + outT(k)[1]];
      const c2 = [to[0] + inT(k + 1)[0], to[1] + inT(k + 1)[1]];
      d += `C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${to[0].toFixed(2)} ${to[1].toFixed(2)}`;
    }
    return `<path d="${d}Z" ${paint(shape.fill)}/>`;
  };

  const body = layers
    .map(
      (layer) =>
        `<g transform="translate(${CENTRE} ${CENTRE})">${layer.shapes.map(draw).join('')}</g>`,
    )
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" ` +
    `width="${SIZE}" height="${SIZE}" role="img" aria-hidden="true">` +
    `<defs>${defs.join('')}</defs>${body}</svg>\n`
  );
}

/* ------------------------------------------------------------------ *
   Emit
 * ------------------------------------------------------------------ */

const categories = JSON.parse(
  await readFile(resolve(root, 'src/data/categories.json'), 'utf8'),
);

await mkdir(OUT, { recursive: true });

const hasPng = async (slug) => {
  try {
    await access(resolve(OUT, `${slug}.png`));
    return true;
  } catch {
    return false;
  }
};

let written = 0;

for (const cat of categories) {
  if (cat.scene) {
    console.log(`  ${cat.slug} — skipped, interactive scene (${cat.scene})`);
    continue;
  }

  if (await hasPng(cat.slug)) {
    console.log(`  ${cat.slug} — skipped, real render present`);
    continue;
  }

  const build = ICONS[cat.slug];
  if (!build) throw new Error(`No icon description for category: ${cat.slug}`);

  const layers = build(cat.accent, cat.pastel);

  const animation = {
    v: '5.7.4',
    fr: FPS,
    ip: 0,
    op: HOVER_END + 1,
    w: SIZE,
    h: SIZE,
    nm: cat.slug,
    ddd: 0,
    assets: [],
    // Later layers sit in front, so reverse for Lottie's top-first order.
    layers: [...layers].reverse().map((layer, i) => lottieLayer(i + 1, layer)),
    markers: [{ tm: 0, cm: 'hover', dr: HOVER_END }],
  };

  await writeFile(resolve(OUT, `${cat.slug}.json`), JSON.stringify(animation), 'utf8');
  await writeFile(resolve(OUT, `${cat.slug}.svg`), svgFor(cat.slug, layers), 'utf8');
  written += 1;
  console.log(`  ${cat.slug}`);
}

console.log(`\nWrote ${written} isometric icon pairs to src/assets/categories/`);
