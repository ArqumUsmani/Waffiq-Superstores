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
  { from: 'src/assets/Shopping Bag.png', to: 'public/assets/footer-bag.webp', width: 720 },
];

const run = promisify(execFile);

/** Reads a source, shrinking it first with macOS `sips` if it is enormous. */
async function readSource(path, tmp) {
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
      .writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' })
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
  if (!wanted.length) throw new Error(`no source matches "${only}"`);
  for (const [i, spec] of wanted.entries()) {
    files.push({ name: `src-${i}.png`, bytes: await readSource(resolve(ROOT, spec.from), tmp), spec });
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
        const outH = Math.round(srcH * (outW / srcW));
        const canvas = new OffscreenCanvas(outW, outH);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, outW, outH);

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

  await rpc(ws, 'Target.closeTarget', { targetId });
  ws.close();
  server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
