/**
 * Generic, unbranded stock photos for the featured items at the top of each
 * aisle page, from Pexels (free for commercial use, no attribution required).
 *
 * Needs PEXELS_API_KEY in .env.local (ignored by git). It is read only by
 * this script; with no VITE_ prefix, Vite never ships it to the browser.
 *
 *   node scripts/aisle-stock.mjs --candidates
 *       Searches each item, saves small previews to scripts/data/aisle-stock/
 *       for choosing by eye, and lists them in candidates.json.
 *
 *   node scripts/aisle-stock.mjs
 *       Downloads the chosen photo for each item — scripts/data/
 *       aisle-photo-picks.json maps "aisle|Item" to a Pexels photo id — into
 *       public/aisle/, points src/data/aisles.json at it, and records the
 *       photographer in scripts/data/aisle-photo-credits.json.
 *
 * Choosing stays manual on purpose: search results include branded packs,
 * and only a look at the photo catches them.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from './lib/catalogue-meta.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AISLES = resolve(ROOT, 'src/data/aisles.json');
const DATA = resolve(ROOT, 'scripts/data');
const PREVIEWS = resolve(DATA, 'aisle-stock');
const PICKS = resolve(DATA, 'aisle-photo-picks.json');
const CREDITS = resolve(DATA, 'aisle-photo-credits.json');
const OUT_DIR = resolve(ROOT, 'public/aisle');
const PER_ITEM = 12;
const PAUSE_MS = 400;

/** What to search for. Generic nouns, so results lean to unbranded shots. */
const QUERIES = {
  Bananas: 'bananas', 'Red Apples': 'red apples', Tomatoes: 'tomatoes', Spinach: 'fresh spinach',
  'Potato Chips': 'potato chips', 'Milk Chocolate': 'milk chocolate pieces', 'Cream Biscuits': 'cream biscuits',
  'Mixed Nuts': 'mixed nuts', 'Black Tea': 'black tea leaves', 'Ground Coffee': 'ground coffee',
  'Corn Flakes': 'corn flakes', 'Pure Honey': 'honey jar', 'Fresh Milk': 'glass of milk',
  'Orange Juice': 'orange juice', Cola: 'cola glass', 'Mineral Water': 'water bottle',
  'Wheat Flour': 'wheat flour', 'White Sugar': 'white sugar', 'Cooking Oil': 'cooking oil',
  'Basmati Rice': 'basmati rice', 'Tomato Ketchup': 'ketchup', Mayonnaise: 'mayonnaise',
  'Baked Beans': 'baked beans', 'Canned Tuna': 'tuna can', 'Aluminium Foil': 'aluminum foil',
  'Garbage Bags': 'garbage bags', 'Facial Tissues': 'tissue box', 'Food Storage Box': 'food storage containers',
  'Washing Powder': 'laundry detergent powder', 'Dishwash Liquid': 'dish soap', 'Surface Cleaner': 'cleaning spray bottle',
  'Air Freshener': 'air freshener', 'Baby Diapers': 'baby diapers', 'Baby Wipes': 'baby wipes',
  'Baby Cereal': 'baby cereal bowl', 'Baby Lotion': 'baby lotion', 'Bath Soap': 'soap bar',
  Shampoo: 'shampoo bottle', Toothpaste: 'toothpaste', Deodorant: 'deodorant',
};

async function apiKey() {
  if (process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY;
  try {
    const env = await readFile(resolve(ROOT, '.env.local'), 'utf8');
    const line = env.split('\n').find((l) => l.startsWith('PEXELS_API_KEY='));
    if (line) return line.slice('PEXELS_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
  } catch {
    /* no .env.local */
  }
  throw new Error('PEXELS_API_KEY is not set — add it to .env.local (see the header of this file).');
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function pexels(key, path) {
  const response = await fetch(`https://api.pexels.com/v1/${path}`, { headers: { Authorization: key } });
  if (!response.ok) throw new Error(`Pexels ${response.status} for ${path}`);
  return response.json();
}

async function download(url, file) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download ${response.status}: ${url}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
}

async function candidates(key, aisles) {
  await mkdir(PREVIEWS, { recursive: true });
  const found = {};
  for (const aisle of aisles) {
    for (const item of aisle.items) {
      const query = QUERIES[item.name] ?? item.name;
      await sleep(PAUSE_MS);
      const { photos } = await pexels(key, `search?query=${encodeURIComponent(query)}&per_page=${PER_ITEM}&orientation=landscape`);
      const id = `${aisle.slug}|${item.name}`;
      found[id] = photos.map((p) => ({ id: p.id, alt: p.alt, photographer: p.photographer, url: p.url }));
      for (const [index, photo] of photos.entries()) {
        await download(photo.src.tiny, resolve(PREVIEWS, `${aisle.slug}__${slugify(item.name)}__${index}.jpg`));
      }
      console.log(`${id.padEnd(46)} ${photos.length}`);
    }
  }
  await writeFile(resolve(PREVIEWS, 'candidates.json'), `${JSON.stringify(found, null, 1)}\n`);
}

async function apply(key, aisles) {
  const picks = JSON.parse(await readFile(PICKS, 'utf8'));
  const credits = {};
  await mkdir(OUT_DIR, { recursive: true });
  for (const aisle of aisles) {
    for (const item of aisle.items) {
      const id = `${aisle.slug}|${item.name}`;
      const photoId = picks[id];
      if (!photoId) {
        console.log(`${id.padEnd(46)} no pick — unchanged`);
        continue;
      }
      await sleep(PAUSE_MS);
      const photo = await pexels(key, `photos/${photoId}`);
      const file = `${aisle.slug}-${slugify(item.name)}.jpg`;
      /* 940px wide: twice the tile's largest rendered width, and the
         landscape crop matches its shape. */
      await download(photo.src.large, resolve(OUT_DIR, file));
      item.image = `/aisle/${file}`;
      credits[id] = { pexelsId: photo.id, photographer: photo.photographer, url: photo.url };
      console.log(`${id.padEnd(46)} ${photo.photographer}`);
    }
  }
  await writeFile(AISLES, `${JSON.stringify(aisles, null, 2)}\n`);
  await writeFile(CREDITS, `${JSON.stringify(credits, null, 2)}\n`);
}

const key = await apiKey();
const aisles = JSON.parse(await readFile(AISLES, 'utf8'));
if (process.argv.includes('--candidates')) await candidates(key, aisles);
else await apply(key, aisles);
