/**
 * Cuts a white sky out of a render, using a matching render's alpha as the
 * guide. Runs inside the headless Chrome page that scripts/gen-images.mjs
 * drives — it is injected as source, so it must stay a single
 * self-contained function with no imports.
 *
 * Built for the hero's night frame, whose background was removed to white
 * rather than to transparency. The day frame shares its camera for
 * everything except the scooter, so its transparent sky is a near-exact
 * mask, and the passes below handle the places where the two differ:
 *
 *  1. Seed with the day render's transparent pixels.
 *  2. Grow through connected near-white pixels — sky showing through gaps
 *     the day render had filled.
 *     2b. Grow through pale haze where the day render shows foliage — the
 *     night trees have a soft edge the day trees do not.
 *  3. Dilate 2px so the anti-aliased rim is included.
 *  4. Solve alpha per pixel. Rims beside solid scene are a blend of that
 *     scene and white, so alpha is solved against the nearest solid colour
 *     and the pixel takes that colour; otherwise a pale line traces every
 *     silhouette. Warm lit pixels (lamp glow) are kept whole. Wires hanging
 *     in open sky are matted against their own dark core.
 *  5. Refill small holes rimmed with warm glow — bulb cores, which are as
 *     white as the sky and get cut with it.
 *
 * Mutates `night` in place and returns counts for the log.
 */
function keySky(night, day, MAX_BULB = 100) {
  const W = night.width, H = night.height, N = W * H;
  const nd = night.data, dd = day.data;
  const original = new Uint8ClampedArray(nd);
  const minc = (k) => Math.min(nd[k], nd[k + 1], nd[k + 2]);
  const whiteish = (k) => { const lo = minc(k), hi = Math.max(nd[k], nd[k + 1], nd[k + 2]); return lo > 222 && hi - lo < 28; };
  // 1. seed: where the day render is transparent
  const inSky = new Uint8Array(N);
  const queue = new Int32Array(N); let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (dd[i * 4 + 3] < 128) { inSky[i] = 1; queue[qt++] = i; }
  const seeded = qt;
  // 2. flood outward through connected near-white night pixels (sky showing through gaps)
  while (qh < qt) {
    const i = queue[qh++]; const x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (inSky[j]) continue;
      if (whiteish(j * 4)) { inSky[j] = 1; queue[qt++] = j; }
    }
  }
  /* 2b. The night render's tree edges are a soft haze over its white sky,
     paler than white but not white enough for the pass above — and the day
     render's tree is bigger, so the day sky never reaches them. Grow again
     through pale neutral pixels, but only where the day render shows
     foliage: the cream facade is pale too, and is not green by day. */
  const pale = (k) => { const lo = minc(k), hi = Math.max(nd[k], nd[k + 1], nd[k + 2]); return lo > 172 && hi - lo < 36; };
  const foliage = (k) => dd[k + 3] > 128 && dd[k + 1] > dd[k] + 6 && dd[k + 1] > dd[k + 2] + 6;
  qh = 0; const q2start = qt;
  while (qh < qt) {
    const i = queue[qh++]; const x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (inSky[j]) continue;
      const jk = j * 4;
      if (whiteish(jk) || (pale(jk) && foliage(jk))) { inSky[j] = 1; queue[qt++] = j; }
    }
  }
  const haze = qt - q2start;
  const grown = q2start - seeded;
  // 3. dilate 2px so the anti-aliased rim is keyed too
  const zone = inSky.slice();
  for (let pass = 0; pass < 2; pass++) {
    const src = zone.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (src[i]) continue;
      if (src[i - 1] || src[i + 1] || src[i - W] || src[i + W]) zone[i] = 1;
    }
  }
  // 4. inside the zone, alpha from how much white is mixed in. Rim pixels
  //    next to solid scene are a blend of that scene and the white sky, so
  //    their alpha is solved against the nearest solid colour and they take
  //    that colour outright — otherwise a pale line traces every silhouette.
  //    Pixels with no solid scene nearby (bulbs, wires hanging in the sky)
  //    fall back to a plain whiteness ramp.
  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  let cut = 0, soft = 0, matted = 0;
  const R = 6;
  for (let i = 0; i < N; i++) {
    if (!zone[i]) continue;
    const k = i * 4; const x = i % W, y = (i / W) | 0;
    /* Lamp glow is warm; sky and wire fringes are neutral. A warm, lit pixel
       is light, never sky, wherever it sits. */
    if (original[k] - original[k + 2] > 35 && lum(original[k], original[k + 1], original[k + 2]) > 120) {
      nd[k + 3] = 255; continue;
    }
    let fk = -1, fd = -1;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (zone[j]) continue;
      const jk = j * 4; const d = 255 - Math.min(original[jk], original[jk + 1], original[jk + 2]);
      if (d > fd) { fd = d; fk = jk; }
    }
    const Lc = lum(nd[k], nd[k + 1], nd[k + 2]);
    if (fk >= 0 && fd > 40) {
      const Lf = lum(original[fk], original[fk + 1], original[fk + 2]);
      const a = Math.min(1, Math.max(0, (255 - Lc) / Math.max(1, 255 - Lf)));
      if (a <= 0.02) { nd[k + 3] = 0; cut++; continue; }
      nd[k] = original[fk]; nd[k + 1] = original[fk + 1]; nd[k + 2] = original[fk + 2];
      nd[k + 3] = Math.round(a * 255); matted++;
      continue;
    }
    /* Thin things in open sky (wires): matte against the darkest pixel close
       by, which is the wire's own core. */
    let dk = -1, dL = 256;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const jk = (ny * W + nx) * 4; const L = lum(original[jk], original[jk + 1], original[jk + 2]);
      if (L < dL) { dL = L; dk = jk; }
    }
    if (dk >= 0 && dL < 170) {
      const a = Math.min(1, Math.max(0, (255 - Lc) / Math.max(1, 255 - dL)));
      if (a <= 0.02) { nd[k + 3] = 0; cut++; continue; }
      nd[k] = original[dk]; nd[k + 1] = original[dk + 1]; nd[k + 2] = original[dk + 2];
      nd[k + 3] = Math.round(a * 255); matted++;
      continue;
    }
    const lo = minc(k);
    const a = Math.min(1, Math.max(0, (250 - lo) / 38));
    if (a <= 0.004) { nd[k + 3] = 0; cut++; continue; }
    if (a < 1) {
      for (let c = 0; c < 3; c++) nd[k + c] = Math.max(0, Math.min(255, Math.round((nd[k + c] - (1 - a) * 255) / a)));
      soft++;
    }
    nd[k + 3] = Math.round(a * 255);
  }
  // 5. refill highlights. A lit bulb's core is as white as the sky and gets
  //    cut with it, leaving a hollow ring. Small enclosed holes rimmed by warm
  //    glow are light sources, not sky, so they are restored; gaps between
  //    fronds and patches of haze stay open.
  const label = new Int32Array(N); let comp = 0, restored = 0, holes = 0;
  const stack = new Int32Array(N);
  for (let s0 = 0; s0 < N; s0++) {
    if (label[s0] || nd[s0 * 4 + 3] >= 128) continue;
    comp++; let sp = 0, size = 0, edge = false; stack[sp++] = s0; label[s0] = comp;
    const members = [];
    let rimL = 0, rimN = 0, rimWarm = 0;
    while (sp) {
      const i = stack[--sp]; members.push(i); size++;
      const x = i % W, y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= N) continue;
        if (nd[j * 4 + 3] >= 128) { const k = j * 4; rimL += 0.299 * original[k] + 0.587 * original[k + 1] + 0.114 * original[k + 2]; rimWarm += original[k] - original[k + 2]; rimN++; continue; }
        if (!label[j]) { label[j] = comp; stack[sp++] = j; }
      }
    }
    if (edge || size > 900) continue;
    holes++;
    /* A bulb's rim is its own orange glow; haze and sky gaps are neutral or
       bluish. Brightness alone cannot tell them apart. */
    const bulb = rimN && rimL / rimN > 130 && rimWarm / rimN > 25;
    if (bulb && size <= MAX_BULB) {
      for (const i of members) { const k = i * 4; nd[k] = original[k]; nd[k + 1] = original[k + 1]; nd[k + 2] = original[k + 2]; nd[k + 3] = 255; }
      restored++;
    }
  }
  return { seeded, grownThroughGaps: grown, hazeAbsorbed: haze, transparent: cut, softEdge: soft, rimMatted: matted, enclosedHoles: holes, bulbsRestored: restored };
}
