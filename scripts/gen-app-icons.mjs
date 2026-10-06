/**
 * App icons for the installable site (home-screen icon, splash, iOS).
 *
 * Run: node scripts/gen-app-icons.mjs
 * Needs headless Chrome on CDP_PORT, like scripts/gen-images.mjs — the
 * browser rasterises the monogram, since there is no image tool on this
 * machine. Writes public/icons/*.png.
 *
 * The monogram is green and lime, so it sits on the brand cream. The
 * "maskable" icon keeps the mark inside the middle 60%: Android crops the
 * rest to whatever shape the launcher uses.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9333);
const BACKGROUND = '#eef6e2';

const ICONS = [
  { file: 'icon-192.png', size: 192, mark: 0.72 },
  { file: 'icon-512.png', size: 512, mark: 0.72 },
  { file: 'icon-maskable-512.png', size: 512, mark: 0.56 },
  { file: 'apple-touch-icon.png', size: 180, mark: 0.7 },
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

const svg = await readFile(resolve(ROOT, 'src/assets/logo/monogram.svg'), 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
const ws = new WebSocket(webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const { targetId } = await rpc(ws, 'Target.createTarget', { url: 'about:blank' });
const { sessionId } = await rpc(ws, 'Target.attachToTarget', { targetId, flatten: true });
await rpc(ws, 'Runtime.enable', {}, sessionId);

await mkdir(resolve(ROOT, 'public/icons'), { recursive: true });
for (const icon of ICONS) {
  const expression = `
    (async () => {
      const img = new Image();
      img.src = ${JSON.stringify(dataUrl)};
      await img.decode();
      const size = ${icon.size};
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = ${JSON.stringify(BACKGROUND)};
      ctx.fillRect(0, 0, size, size);
      const w = size * ${icon.mark};
      const h = w * (img.naturalHeight / img.naturalWidth);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768));
      return btoa(s);
    })()
  `;
  const result = await rpc(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'icon failed');
  const bytes = Buffer.from(result.result.value, 'base64');
  await writeFile(resolve(ROOT, 'public/icons', icon.file), bytes);
  console.log(`${icon.file.padEnd(24)} ${icon.size}px  ${(bytes.length / 1024).toFixed(1)} kB`);
}

await rpc(ws, 'Target.closeTarget', { targetId });
ws.close();
