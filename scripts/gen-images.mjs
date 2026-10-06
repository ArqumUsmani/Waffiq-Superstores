/**
 * Optimises the large raster art for the web.
 *
 * The sources are design exports far heavier than anything the page renders:
 * the hero scenes are 2752x1536 at ~5 MB each, the footer bag 12000x12000 at
 * 20 MB. This downscales each and writes WebP (alpha preserved) into
 * public/assets/, where the components load them by path.
 *
 * There is no sharp or ImageMagick on this machine, so the resize and encode
 * run through a headless Chrome canvas over CDP — the same approach already
 * used for storefront.webp. Needs Chrome listening on CDP_PORT:
 *
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless=new --disable-gpu --remote-debugging-port=9333 \
 *     --user-data-dir=/tmp/wafiq-chrome about:blank &
 *
 *   node scripts/gen-hero-scene.mjs
 */
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9333);

const QUALITY = 0.86;

/**
 * Past this many pixels a side, the source is shrunk with `sips` before it
 * reaches Chrome. A 12000px square decodes to a ~576 MB bitmap, which is
 * more than a headless tab should be asked to hold for a 720px output.
 */
const PRESHRINK_ABOVE = 4000;

/* `width` is the output width — roughly twice the largest CSS size the
   component renders it at, for high-density screens. `skyFrom` names a
   matching render whose transparent sky guides cutting a white sky out of
   this one (see key-sky.browser.js). */
const SOURCES = [
  { from: 'src/assets/hero/scene/day.png', to: 'public/assets/scene-day.webp', width: 1800 },
  {
    from: 'src/assets/hero/scene/night.png',
    to: 'public/assets/scene-night.webp',
    width: 1800,
    skyFrom: 'src/assets/hero/scene/day.png',
  },
  /* The bag is shared by the footer and the shopping bag. It is drawn into
     a square, centred: the shopping bag positions it as a square box. The
     SVG is a raster wrapped in SVG (no vector paths), so it is rendered down
     to WebP rather than shipped as-is at ~900 KB. 1024px: the bag shows at
     up to ~350 CSS px, so 2x screens need ~700px, and the source's own
     detail tops out around here. */
  { from: 'src/assets/shopping-bag.svg', to: 'public/assets/footer-bag.webp', width: 1024, square: true, sharpen: 0.9 },
];

/**
 * Sprites: several images side by side in one file, each fitted into a
 * square cell. The splash screen in index.html uses one — it has to show
 * before the bundle loads, so it cannot use the bundled (hashed) renders,
 * and one small file is one request and one small bitmap to hold.
 */
const SPRITES = [
  {
    to: 'public/assets/splash.webp',
    /* Shown at ~265 CSS px, so 2x screens need ~530. */
    cell: 540,
    from: ['fruits-vegetables', 'snacks-confectionery', 'milk-beverages', 'personal-care'].map(
      (slug) => `src/assets/categories/originals/${slug}.png`,
    ),
  },
];

const run = promisify(execFile);

/** Reads a source, shrinking it first with macOS `sips` if it is enormous. */
async function readSource(path, tmp) {
  /* sips cannot read SVG; it is drawn by the browser at whatever size. */
  if (path.endsWith('.svg')) return readFile(path);
  const { stdout } = await run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path]);
  const side = Math.max(...[...stdout.matchAll(/pixel(?:Width|Height):\s*(\d+)/g)].map((m) => Number(m[1])));
  if (side <= PRESHRINK_ABOVE) return readFile(path);

  const shrunk = resolve(tmp, 'preshrink.png');
  await run('sips', ['-Z', String(PRESHRINK_ABOVE), path, '--out', shrunk]);
  return readFile(shrunk);
}

async function rpc(ws, method, params = {}, sessionId) {
  const id = Math.floor(Math.random() * 1e9);
  const done = new Promise((res, rej) => {
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', handler);
      if (msg.error) rej(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
    };
    ws.addEventListener('message', handler);
  });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return done;
}

/** Serves the source PNGs so the page can fetch them without a giant data URL. */
function serve(files) {
  const server = createServer(async (req, res) => {
    const entry = files.find((f) => req.url === `/${f.name}`);
    if (!entry) {
      res.writeHead(404).end();
      return;
    }
    /* CORS, or drawing the image taints the canvas and convertToBlob throws. */
    res
      .writeHead(200, {
        'Content-Type': entry.name.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
        'Access-Control-Allow-Origin': '*',
      })
      .end(entry.bytes);
  });
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port }));
  });
}

async function main() {
  const tmp = await mkdtemp(resolve(tmpdir(), 'gen-images-'));
  const files = [];
  /* Sequential: the preshrink step reuses one temp file. */
  const only = process.argv[2];
  const wanted = only ? SOURCES.filter((spec) => spec.to.includes(only)) : SOURCES;
  const sprites = only ? SPRITES.filter((spec) => spec.to.includes(only)) : SPRITES;
  if (!wanted.length && !sprites.length) throw new Error(`no source matches "${only}"`);
  /* Sprite cells ride along as extra files for the server; `guide` keeps
     the single-image loop below from encoding them on their own. */
  for (const [s, sprite] of sprites.entries()) {
    sprite.names = [];
    for (const [c, from] of sprite.from.entries()) {
      const name = `sprite-${s}-${c}.png`;
      sprite.names.push(name);
      files.push({ name, bytes: await readSource(resolve(ROOT, from), tmp), guide: true });
    }
  }
  for (const [i, spec] of wanted.entries()) {
    const ext = spec.from.endsWith('.svg') ? 'svg' : 'png';
    files.push({ name: `src-${i}.${ext}`, bytes: await readSource(resolve(ROOT, spec.from), tmp), spec });
    if (spec.skyFrom) {
      files.push({ name: `sky-${i}.png`, bytes: await readSource(resolve(ROOT, spec.skyFrom), tmp), guide: true });
    }
  }
  const keySkySource = await readFile(resolve(ROOT, 'scripts/key-sky.browser.js'), 'utf8');
  await rm(tmp, { recursive: true, force: true });

  const { server, port } = await serve(files);

  const { webSocketDebuggerUrl } = await (
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
  ).json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  const { targetId } = await rpc(ws, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await rpc(ws, 'Target.attachToTarget', { targetId, flatten: true });
  await rpc(ws, 'Page.enable', {}, sessionId);
  await rpc(ws, 'Runtime.enable', {}, sessionId);

  await mkdir(resolve(ROOT, 'public/assets'), { recursive: true });

  for (const [index, file] of files.entries()) {
    if (file.guide) continue;
    const guide = file.spec.skyFrom ? files[index + 1].name : null;
    const expression = `
      (async () => {
        ${keySkySource}

        const load = async (name) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = 'http://127.0.0.1:${port}/' + name;
          await img.decode();
          return img;
        };
        const pixels = (img) => {
          const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
          const x = c.getContext('2d');
          x.drawImage(img, 0, 0);
          return x.getImageData(0, 0, c.width, c.height);
        };

        let img = await load('${file.name}');
        let keyed = null;
        const guideName = ${JSON.stringify(guide)};
        if (guideName) {
          /* Key at full resolution, before the downscale blurs the edges. */
          const data = pixels(img);
          keyed = keySky(data, pixels(await load(guideName)));
          const full = new OffscreenCanvas(data.width, data.height);
          full.getContext('2d').putImageData(data, 0, 0);
          img = full;
        }
        const srcW = img.naturalWidth ?? img.width;
        const srcH = img.naturalHeight ?? img.height;

        const outW = ${file.spec.width};
        const square = ${Boolean(file.spec.square)};
        const outH = square ? outW : Math.round(srcH * (outW / srcW));
        const canvas = new OffscreenCanvas(outW, outH);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        if (square) {
          /* Contain, centred, on transparency. */
          const k = Math.min(outW / srcW, outH / srcH);
          const w = srcW * k;
          const h = srcH * k;
          ctx.drawImage(img, (outW - w) / 2, (outH - h) / 2, w, h);
        } else {
          ctx.drawImage(img, 0, 0, outW, outH);
        }

        /* Unsharp mask: add back the difference between each pixel and a
           3x3 blur of its neighbours, scaled by \`sharpen\`. Colour only —
           alpha is left alone, and fully transparent neighbours are skipped
           so the outline does not pick up a dark halo. */
        const amount = ${file.spec.sharpen ?? 0};
        if (amount > 0) {
          const id = ctx.getImageData(0, 0, outW, outH);
          const src = new Uint8ClampedArray(id.data);
          const d = id.data;
          for (let y = 1; y < outH - 1; y += 1) {
            for (let x = 1; x < outW - 1; x += 1) {
              const k = (y * outW + x) * 4;
              if (src[k + 3] < 8) continue;
              for (let c = 0; c < 3; c += 1) {
                let sum = 0;
                let n = 0;
                for (let dy = -1; dy <= 1; dy += 1) {
                  for (let dx = -1; dx <= 1; dx += 1) {
                    const j = ((y + dy) * outW + (x + dx)) * 4;
                    if (src[j + 3] < 8) continue;
                    sum += src[j + c];
                    n += 1;
                  }
                }
                d[k + c] = src[k + c] + amount * (src[k + c] - sum / n);
              }
            }
          }
          ctx.putImageData(id, 0, 0);
        }

        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: ${QUALITY} });
        const dataUrl = await new Promise((done) => {
          const reader = new FileReader();
          reader.onload = () => done(reader.result);
          reader.readAsDataURL(blob);
        });
        return JSON.stringify({ b64: dataUrl.slice(dataUrl.indexOf(',') + 1), outW, outH, keyed });
      })()
    `;

    const result = await rpc(
      ws,
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails;
      throw new Error(
        `${detail.text ?? 'canvas encode failed'} — ${detail.exception?.description ?? ''}`,
      );
    }

    const { b64, outW, outH, keyed } = JSON.parse(result.result.value);
    const bytes = Buffer.from(b64, 'base64');
    await writeFile(resolve(ROOT, file.spec.to), bytes);
    console.log(
      `${file.spec.to}  ${outW}x${outH}  ${(bytes.length / 1024).toFixed(0)} KB` +
        `  (from ${(file.bytes.length / 1024 / 1024).toFixed(1)} MB)` +
        (keyed ? `\n  sky keyed: ${JSON.stringify(keyed)}` : ''),
    );
  }

  for (const sprite of sprites) {
    const expression = `
      (async () => {
        const cell = ${sprite.cell};
        const names = ${JSON.stringify(sprite.names)};
        const canvas = new OffscreenCanvas(cell * names.length, cell);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        for (const [i, name] of names.entries()) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = 'http://127.0.0.1:${port}/' + name;
          await img.decode();
          /* Contain, centred in its cell. */
          const k = Math.min(cell / img.naturalWidth, cell / img.naturalHeight);
          const w = img.naturalWidth * k;
          const h = img.naturalHeight * k;
          ctx.drawImage(img, i * cell + (cell - w) / 2, (cell - h) / 2, w, h);
        }
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: ${QUALITY} });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768));
        return btoa(s);
      })()
    `;
    const result = await rpc(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'sprite failed');
    const bytes = Buffer.from(result.result.value, 'base64');
    await writeFile(resolve(ROOT, sprite.to), bytes);
    console.log(`${sprite.to}  ${sprite.cell * sprite.names.length}x${sprite.cell}  ${(bytes.length / 1024).toFixed(0)} KB  (${sprite.names.length} cells)`);
  }

  await rpc(ws, 'Target.closeTarget', { targetId });
  ws.close();
  server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
