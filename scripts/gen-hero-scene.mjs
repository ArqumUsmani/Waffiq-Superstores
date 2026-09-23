/**
 * Optimises the two hero scene renders.
 *
 * The Figma exports are 2752x1536 PNGs at ~5 MB each with a transparent sky.
 * This downscales them and writes WebP (alpha preserved) into public/assets/,
 * where the hero loads them by path.
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
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9333);

/** Output width. The hero never renders wider than ~1500 CSS px. */
const OUT_WIDTH = 1800;
const QUALITY = 0.86;

const SOURCES = [
  { from: 'src/assets/hero/scene/day.png', to: 'public/assets/scene-day.webp' },
  { from: 'src/assets/hero/scene/night.png', to: 'public/assets/scene-night.webp' },
];

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
  const files = await Promise.all(
    SOURCES.map(async (spec, i) => ({
      name: `src-${i}.png`,
      bytes: await readFile(resolve(ROOT, spec.from)),
      spec,
    })),
  );

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

  for (const file of files) {
    const expression = `
      (async () => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = 'http://127.0.0.1:${port}/${file.name}';
        await img.decode();

        const outW = ${OUT_WIDTH};
        const outH = Math.round(img.naturalHeight * (outW / img.naturalWidth));
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
        return JSON.stringify({ b64: dataUrl.slice(dataUrl.indexOf(',') + 1), outW, outH });
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

    const { b64, outW, outH } = JSON.parse(result.result.value);
    const bytes = Buffer.from(b64, 'base64');
    await writeFile(resolve(ROOT, file.spec.to), bytes);
    console.log(
      `${file.spec.to}  ${outW}x${outH}  ${(bytes.length / 1024).toFixed(0)} KB` +
        `  (from ${(file.bytes.length / 1024 / 1024).toFixed(1)} MB)`,
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
