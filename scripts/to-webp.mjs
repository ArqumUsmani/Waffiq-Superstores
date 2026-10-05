/**
 * Converts the site's raster images to WebP, in place.
 *
 * Run: node scripts/to-webp.mjs      (npm run images:webp)
 * Needs headless Chrome on CDP_PORT — see scripts/gen-images.mjs. There is
 * no cwebp, sharp or ImageMagick on this machine, so the browser's own
 * encoder does the work.
 *
 * Three folders:
 *
 *  - src/assets/categories/*.png — the 3D aisle renders. 2000px sources shown
 *    at 132-200px (and briefly at ~560px in the launch transition), so they
 *    are also resized to 800px. The PNGs move to categories/originals/, out
 *    of the bundler's glob, and are the source for any re-run.
 *  - public/products/*.jpg and public/aisle/*.jpg — photos fetched by the
 *    import scripts. Converted at their own size; the JPG is deleted and the
 *    matching `image` path in the data file is switched to .webp.
 *
 * Safe to re-run: anything already converted is skipped.
 */
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9333);

const JOBS = [
  {
    label: 'category renders',
    dir: 'src/assets/categories',
    ext: '.png',
    maxWidth: 800,
    quality: 0.86,
    /* Kept, as the source for re-runs — just outside the glob. */
    archiveTo: 'src/assets/categories/originals',
  },
  { label: 'product photos', dir: 'public/products', ext: '.jpg', quality: 0.82, data: 'src/data/products.json' },
  { label: 'aisle photos', dir: 'public/aisle', ext: '.jpg', quality: 0.82, data: 'src/data/aisles.json' },
];

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg' };

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

/** Serves whichever file is being converted; CORS so the canvas is not tainted. */
let current = null;
const server = createServer((req, res) => {
  if (!current) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': current.mime, 'Access-Control-Allow-Origin': '*' }).end(current.bytes);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;

const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
const ws = new WebSocket(webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const { targetId } = await rpc(ws, 'Target.createTarget', { url: 'about:blank' });
const { sessionId } = await rpc(ws, 'Target.attachToTarget', { targetId, flatten: true });
await rpc(ws, 'Runtime.enable', {}, sessionId);

async function encode(bytes, mime, { maxWidth, quality }, nonce) {
  current = { bytes, mime };
  const expression = `
    (async () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = 'http://127.0.0.1:${port}/${nonce}';
      await img.decode();
      const scale = ${maxWidth ?? 0} && img.naturalWidth > ${maxWidth ?? 0} ? ${maxWidth ?? 0} / img.naturalWidth : 1;
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality: ${quality} });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768));
      return JSON.stringify({ b64: btoa(s), w, h });
    })()
  `;
  const result = await rpc(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'encode failed');
  const { b64, w, h } = JSON.parse(result.result.value);
  return { bytes: Buffer.from(b64, 'base64'), w, h };
}

let nonce = 0;
for (const job of JOBS) {
  const dir = resolve(ROOT, job.dir);
  const files = (await readdir(dir)).filter((f) => extname(f).toLowerCase() === job.ext);
  let before = 0;
  let after = 0;

  for (const file of files) {
    const source = resolve(dir, file);
    const target = resolve(dir, file.slice(0, -job.ext.length) + '.webp');
    /* A fuller-resolution copy may already be archived; convert from that
       rather than the working copy, and never overwrite it. */
    const archived = job.archiveTo ? resolve(ROOT, job.archiveTo, file) : null;
    const hasArchive = archived ? await readFile(archived).then(() => true, () => false) : false;
    const bytes = await readFile(hasArchive ? archived : source);
    nonce += 1;
    const out = await encode(bytes, MIME[job.ext], job, nonce);
    await writeFile(target, out.bytes);
    before += bytes.length;
    after += out.bytes.length;

    if (hasArchive) {
      await unlink(source);
    } else if (archived) {
      await mkdir(dirname(archived), { recursive: true });
      await rename(source, archived);
    } else {
      await unlink(source);
    }
  }

  /* Point the data file at the new extension, for files that now exist. */
  let repointed = 0;
  if (job.data) {
    const path = resolve(ROOT, job.data);
    const text = await readFile(path, 'utf8');
    const prefix = `/${job.dir.replace(/^public\//, '')}/`;
    const pattern = new RegExp(`("${prefix}[^"]+)\\${job.ext}"`, 'g');
    const existing = new Set(await readdir(dir));
    const next = text.replace(pattern, (whole, stem) => {
      const name = `${stem.slice(prefix.length + 1)}.webp`;
      if (!existing.has(name)) return whole;
      repointed += 1;
      return `${stem}.webp"`;
    });
    if (next !== text) await writeFile(path, next);
  }

  const mb = (n) => (n / 1048576).toFixed(2);
  console.log(
    files.length
      ? `${job.label.padEnd(18)} ${String(files.length).padStart(3)} files  ${mb(before)} MB → ${mb(after)} MB` +
          (job.data ? `  (${repointed} paths updated)` : '')
      : `${job.label.padEnd(18)} nothing to convert`,
  );
}

await rpc(ws, 'Target.closeTarget', { targetId });
ws.close();
server.close();
