/**
 * Turns the scraped Naheed listing into the site's product catalogue.
 *
 * Run: node scripts/import-naheed.mjs [perSubcategory=8] [--dry]
 * --dry prints the picks and writes nothing.
 * Reads:  scripts/data/naheed-catalogue.json  (from scrape-naheed.mjs)
 * Writes: src/data/products.json
 *         public/products/<sku>.jpg            (product photos)
 *         scripts/data/naheed-selection.json   (sku -> source page, for reference)
 *
 * Selection, per subcategory:
 *  - Everyday brands first. A brand already in BRAND_UR is one the store
 *    stocks or a shopper would ask for by name, so it ranks above unknown
 *    imports. Very expensive outliers (over three times the subcategory's
 *    median price) rank last — a neighbourhood supermarket does not lead
 *    with a Rs 28,000 salon shampoo.
 *  - One entry per product line: sizes and pack counts of the same item
 *    collapse to the first one seen.
 *  - At most two products per brand, so a shelf is not eight Nestlé SKUs.
 *
 * Prices are deliberately not carried over: they are Naheed's, not Wafiq's.
 *
 * Images are the listing's 480px renders, saved as-is. Downloads already on
 * disk are skipped, so a re-run only fetches what changed.
 */
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_UR, SUB_META, hash, slugify } from './lib/catalogue-meta.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRAPED = resolve(ROOT, 'scripts/data/naheed-catalogue.json');
const SELECTION = resolve(ROOT, 'scripts/data/naheed-selection.json');
const PRODUCTS = resolve(ROOT, 'src/data/products.json');
const IMAGES = resolve(ROOT, 'public/products');
const DRY = process.argv.includes('--dry');
const PER_SUB = Math.max(1, Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 8));
const MAX_PER_BRAND = 2;
const POPULAR_PER_SUB = 2;
const PAUSE_MS = 350;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36';

/** Subcategories of loose produce: "brand" is an origin, as on a market bin. */
const PRODUCE = new Set(['fresh-fruits', 'fresh-vegetables', 'herbs-leafy-greens', 'dried-fruits-nuts']);

/**
 * Brand names as they appear at the start of Naheed's titles, mapped to the
 * spelling used in BRAND_UR. Longest match wins, so "Peek Freans" beats
 * "Peek". Anything not listed falls back to the title's first word.
 */
const BRAND_ALIASES = {
  nestle: 'Nestlé',
  'nestlé': 'Nestlé',
  nescafe: 'Nescafé',
  'nescafé': 'Nescafé',
  olpers: "Olper's",
  "olper's": "Olper's",
  'coca cola': 'Coca-Cola',
  'coca-cola': 'Coca-Cola',
  kelloggs: "Kellogg's",
  "kellogg's": "Kellogg's",
  johnsons: "Johnson's",
  "johnson's": "Johnson's",
  youngs: "Young's",
  "young's": "Young's",
  mitchells: "Mitchell's",
  "mitchell's": "Mitchell's",
  'head and shoulders': 'Head & Shoulders',
  'oral b': 'Oral-B',
  'close-up': 'Close Up',
  'scotch brite': 'Scotch-Brite',
  nutrilov: 'Nutri Lov',
};

/**
 * Not for this shelf: luxury smoking accessories, skin-whitening products
 * and adult items that the keyword splits let into baby and intimate care.
 */
const EXCLUDE = /\b(cigarette|whitening|adult|zippo)\b/i;

/**
 * Listings whose photo is a marketing graphic rather than a pack shot — an
 * "Official Store" marketplace badge or a promo tile with large text. Found
 * by eye on a contact sheet of every imported photo; titles cannot reveal
 * it. Every Sensodyne listing on Naheed is one of these.
 */
const PROMO_PHOTO = [
  /\bsensodyne\b/i,
  /\blipton green tea\b.*\bzesty lemon/i,
  /\bolper'?s strawberry flavou?red milk\b/i,
  /\bolper'?s full cream milk powder\b/i,
  /\bsurf excel expert white\b/i,
  /\bsummer'?s eve 7-in-1\b/i,
];

/** Items a source listing carries that belong on a different shelf. */
const SUB_EXCLUDE = { 'baby-care': /\bdiaper/i };

/** Naheed's own produce label. It is their brand, not a Wafiq one. */
const HOUSE_LABEL = /\bfresh basket\b\s*/gi;

/**
 * Loose produce, where the house label is only in the listing's title — the
 * photo is just the fruit or vegetable, so the name is cleaned and the item
 * kept. Everywhere else the label is printed on the pack in the photo, so
 * house-label items are left out entirely.
 */
const LOOSE = new Set(['fresh-fruits', 'fresh-vegetables', 'herbs-leafy-greens']);
const HOUSE_PACK = /\b(fresh basket|naheed)\b/i;

/**
 * Everyday produce, in rough order of how often it is on a shopping list.
 * Within loose produce this decides which kinds get the eight places.
 */
const STAPLES = [
  /\bbanana/i, /\bapple/i, /\bmango/i, /\b(orange|malta|kinnow)/i, /\bgrape/i, /\bpomegranate/i,
  /\bguava/i, /\bmelon/i, /\btomato/i, /\bonion/i, /\bpotato/i, /\bgarlic/i, /\bginger/i,
  /\bgreen chil+i/i, /\bcarrot/i, /\bcucumber/i, /\bpeas\b/i, /\bcapsicum/i, /\blemon/i,
  /\bcauliflower/i, /\bcabbage/i, /\bcoriander|dhania/i, /\bmint|podina/i, /\bspinach|palak/i,
  /\bfenugreek|methi|meethi/i, /\bdates?\b|khajoor/i, /\balmond/i, /\bcashew/i, /\bwalnut/i,
  /\bpistachio/i, /\braisin|kishmish/i, /\bapricot/i, /\bpeanut/i, /\bfig/i,
];

/** Urdu for loose produce and dry fruit, matched against the English name. */
const PRODUCE_UR = [
  [/\bsweet potato/i, 'شکر قندی'], [/\bspring onion/i, 'ہری پیاز'], [/\bbitter gourd|karela/i, 'کریلا'],
  [/\blady ?finger|okra|bhindi/i, 'بھنڈی'], [/\bcapsicum|bell pepper/i, 'شملہ مرچ'], [/\bgreen chil+i/i, 'ہری مرچ'],
  [/\bchil+i/i, 'مرچ'], [/\bcauliflower/i, 'پھول گوبھی'], [/\bcabbage/i, 'بند گوبھی'], [/\bbroccoli/i, 'بروکلی'],
  [/\bpotato/i, 'آلو'], [/\btomato/i, 'ٹماٹر'], [/\bonion/i, 'پیاز'], [/\bgarlic/i, 'لہسن'], [/\bginger/i, 'ادرک'],
  [/\bcarrot/i, 'گاجر'], [/\bcucumber/i, 'کھیرا'], [/\bpeas\b/i, 'مٹر'], [/\b(brinjal|eggplant|aubergine)/i, 'بینگن'],
  [/\bpumpkin|kaddu/i, 'کدو'], [/\bradish|mooli/i, 'مولی'], [/\bturnip/i, 'شلجم'], [/\bbeetroot/i, 'چقندر'],
  [/\bmushroom/i, 'کھمبی'], [/\bzucchini/i, 'زکینی'], [/\bmosambi|sweet lemon/i, 'موسمی'], [/\blemon/i, 'لیموں'], [/\bspinach|palak/i, 'پالک'],
  [/\bmint|podina/i, 'پودینہ'], [/\bcoriander|dhania/i, 'دھنیا'], [/\bfenugreek|methi|meethi/i, 'میتھی'],
  [/\blettuce|salad/i, 'سلاد پتہ'], [/\bcelery/i, 'اجمود'], [/\bthyme/i, 'صعتر'], [/\bbasil/i, 'نیاز بو'],
  [/\bparsley/i, 'پارسلے'], [/\bcurry leaves/i, 'کڑی پتہ'],
  [/\bwatermelon/i, 'تربوز'], [/\bmelon/i, 'خربوزہ'], [/\bapple/i, 'سیب'], [/\bbanana/i, 'کیلا'],
  [/\bmango/i, 'آم'], [/\b(orange|malta)/i, 'مالٹا'], [/\bkinnow/i, 'کینو'], [/\bgrape/i, 'انگور'],
  [/\bpomegranate/i, 'انار'], [/\bguava/i, 'امرود'], [/\bpapaya/i, 'پپیتا'], [/\bstrawberr/i, 'سٹرابیری'],
  [/\bpeach/i, 'آڑو'], [/\bplum/i, 'آلو بخارا'], [/\bpear\b/i, 'ناشپاتی'], [/\bkiwi/i, 'کیوی'],
  [/\bpineapple/i, 'انناس'], [/\bavocado/i, 'ایووکاڈو'], [/\bcherr/i, 'چیری'], [/\bdragon/i, 'ڈریگن فروٹ'],
  [/\bdates?\b|khajoor|ajwa|medjool/i, 'کھجور'], [/\balmond/i, 'بادام'], [/\bcashew/i, 'کاجو'],
  [/\bwalnut/i, 'اخروٹ'], [/\bpistachio/i, 'پستہ'], [/\braisin|kishmish/i, 'کشمش'], [/\bapricot/i, 'خوبانی'],
  [/\bfig/i, 'انجیر'], [/\bpeanut/i, 'مونگ پھلی'], [/\bpine ?nut|chilgoza/i, 'چلغوزہ'], [/\bseeds?\b/i, 'بیج'],
  [/\bprune/i, 'آلو بخارا'], [/\bcranberr/i, 'کرین بیری'], [/\bhazelnut/i, 'فندق'], [/\bmixed nuts|trail mix/i, 'مکس میوہ'],
];

/**
 * Urdu for what a branded product is, where a shelf holds more than one kind
 * of thing. Without this every product takes its subcategory's one noun, and
 * a bar of soap on the "Shampoos & Soaps" shelf is labelled a shampoo. First
 * match wins, so specific phrases come before general ones.
 */
const PRODUCT_UR = [
  [/\bconditioner/i, 'کنڈیشنر'], [/\bbody ?wash|shower gel/i, 'باڈی واش'], [/\bshampoo/i, 'شیمپو'],
  [/\bhand ?wash/i, 'ہینڈ واش'], [/\bbaby oil|\boil\b/i, 'تیل'], [/\bsoap/i, 'صابن'],
  [/\btooth ?brush/i, 'ٹوتھ برش'], [/\bmouth ?wash/i, 'ماؤتھ واش'], [/\btooth ?paste/i, 'ٹوتھ پیسٹ'],
  [/\bsweetener|stevia|canderel/i, 'سویٹنر'], [/\bwhitener/i, 'ٹی وائٹنر'], [/\bgreen tea/i, 'سبز چائے'],
  [/\bfoil/i, 'فوائل'], [/\bbutter paper|baking paper/i, 'بٹر پیپر'], [/\bcling|wrap\b|warp\b/i, 'کلنگ فلم'],
  [/\bfreezer bags?|zip|slider/i, 'فریزر بیگ'], [/\bgarbage|trash|bin bag/i, 'کچرا بیگ'],
  [/\bcontainer|storage box|jar\b/i, 'کنٹینر'], [/\btoilet (tissue|roll)|tissue roll/i, 'ٹوائلٹ رول'],
  [/\bkitchen (towel|roll)/i, 'کچن رول'], [/\btissue/i, 'ٹشو'],
  [/\bsponge|scrub/i, 'اسفنج'], [/\bdishwasher/i, 'ڈش واشر گولیاں'],
  [/\bfabric softener|conditioner/i, 'فیبرک سافٹنر'], [/\bbleach/i, 'بلیچ'], [/\bfloor|surface|glass|multi.?purpose/i, 'کلینر'],
  [/\bdetergent|washing powder|laundry/i, 'ڈٹرجنٹ'],
  [/\bcoil/i, 'کوائل'], [/\bmosquito repellent|repellent lotion|cream/i, 'مچھر بھگاؤ'],
  [/\bwipes?\b/i, 'وائپس'], [/\bcotton (bud|swab)|swab/i, 'روئی کی تیلیاں'], [/\bpowder\b/i, 'پاؤڈر'],
  [/\blotion/i, 'لوشن'], [/\bwax/i, 'ویکس'], [/\brazor/i, 'ریزر'], [/\bpantiliner|liner/i, 'پینٹی لائنر'],
  [/\bsyrup/i, 'شربت'], [/\bsquash/i, 'اسکواش'], [/\bcustard/i, 'کسٹرڈ'], [/\bjelly/i, 'جیلی'],
  [/\bcake mix|brownie mix/i, 'کیک مکس'], [/\bbaking powder|yeast|baking soda/i, 'بیکنگ پاؤڈر'],
  [/\bmayo/i, 'مایونیز'], [/\bketchup/i, 'کیچپ'], [/\bsoy sauce/i, 'سویا ساس'], [/\bvinegar/i, 'سرکہ'],
  [/\bhoney/i, 'شہد'], [/\bjam\b/i, 'جام'], [/\bpeanut butter/i, 'پینٹ بٹر'], [/\bspread/i, 'اسپریڈ'],
  [/\boats|porridge/i, 'دلیہ'], [/\bpasta|macaroni|spaghetti/i, 'پاستا'], [/\bvermicelli/i, 'سویاں'],
  [/\bcorn\b/i, 'مکئی'], [/\bbeans/i, 'لوبیا'], [/\btuna/i, 'ٹونا'], [/\bmushroom/i, 'کھمبی'],
  [/\bolive oil/i, 'زیتون کا تیل'], [/\bolives?\b/i, 'زیتون'], [/\blighter/i, 'لائٹر'], [/\bmatch/i, 'ماچس'],
  [/\bwafer/i, 'ویفر'], [/\bcake\b/i, 'کیک'], [/\blollipop/i, 'لالی پاپ'], [/\bgum\b/i, 'چیونگم'],
  [/\bcoffee|capsule|pods?\b/i, 'کافی'], [/\bjuice|nectar/i, 'جوس'], [/\bwater\b/i, 'پانی'],
];

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

const brandKeys = [
  ...Object.keys(BRAND_UR).map((b) => [norm(b), b]),
  ...Object.entries(BRAND_ALIASES).map(([alias, b]) => [norm(alias), b]),
].sort((a, b) => b[0].length - a[0].length);

function detectBrand(name, sub) {
  if (PRODUCE.has(sub)) return /\bimported\b/i.test(name) ? 'Imported' : 'Local';
  const n = norm(name);
  for (const [key, brand] of brandKeys) {
    if (n === key || n.startsWith(`${key} `)) return brand;
  }
  return name.split(' ')[0];
}

/** A product line, with sizes, counts and pack wording stripped. */
const lineKey = (name) =>
  norm(name)
    .replace(/\b\d+(\.\d+)?\s?(g|gm|gms|kg|ml|l|ltr|litre|litres|liter|liters|pcs|pc|pack|packs|sheets|rolls|bags|tablets|x)\b/g, '')
    .replace(/\b(pack of|value pack|family pack|jar|pouch|bottle|box|tin|can|refill|large|small|medium)\b/g, '')
    /* The same item in another colour is the same product line. */
    .replace(/\b(red|blue|green|black|white|pink|purple|yellow|grey|gray|orange|turquish|turquoise|transparent|clear)\b/g, '')
    .replace(/[^a-z]+/g, ' ')
    .trim();

const median = (values) => {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

/**
 * Which kind of produce a name is, as an index into PRODUCE_UR, or -1. The
 * kind named earliest in the title wins: "Almonds (Badam), Lemon" is
 * almonds with a lemon coating, not lemons.
 */
function produceKind(name) {
  let best = -1;
  let at = Infinity;
  PRODUCE_UR.forEach(([pattern], index) => {
    const hit = pattern.exec(name);
    if (hit && hit.index < at) {
      at = hit.index;
      best = index;
    }
  });
  return best;
}

function select(items, sub) {
  const produce = PRODUCE.has(sub);
  const mid = median(items.map((i) => i.pricePkr));
  const ranked = items
    .filter((item) => !EXCLUDE.test(item.name) && !SUB_EXCLUDE[sub]?.test(item.name))
    .filter((item) => LOOSE.has(sub) || !HOUSE_PACK.test(item.title))
    .filter((item) => !PROMO_PHOTO.some((pattern) => pattern.test(item.title)))
    .map((item, order) => {
      const name = item.name.replace(HOUSE_LABEL, '').trim();
      const brand = detectBrand(name, sub);
      let score = 0;
      if (produce) {
        /* Recognised produce scores as an everyday item; staples rank by
           how high they sit on the list. Novelties fall to the bottom. */
        if (produceKind(name) >= 0) score += 10;
        const staple = STAPLES.findIndex((pattern) => pattern.test(name));
        if (staple >= 0) score += (STAPLES.length - staple) / STAPLES.length;
      } else if (BRAND_UR[brand]) {
        score += 10;
      }
      if (mid && item.pricePkr > mid * 3) score -= 12;
      if (name.length > 70) score -= 3;
      return { ...item, name, brand, score, order };
    })
    .sort((a, b) => b.score - a.score || a.order - b.order);

  const picked = [];
  const lines = new Set();
  const perBrand = new Map();
  for (const item of ranked) {
    if (picked.length >= PER_SUB) break;
    /* Loose produce: one of each kind, not three apple varieties. */
    const kind = produce ? produceKind(item.name) : -1;
    const key = kind >= 0 ? `kind:${kind}` : lineKey(item.name);
    if (lines.has(key)) continue;
    if (!produce && (perBrand.get(item.brand) ?? 0) >= MAX_PER_BRAND) continue;
    lines.add(key);
    perBrand.set(item.brand, (perBrand.get(item.brand) ?? 0) + 1);
    picked.push(item);
  }
  return picked;
}

async function download(url, file) {
  try {
    await stat(file);
    return 'kept';
  } catch {
    /* not on disk yet */
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await sleep(PAUSE_MS);
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA } });
      if (response.ok) {
        await writeFile(file, Buffer.from(await response.arrayBuffer()));
        return 'fetched';
      }
    } catch {
      /* retried below */
    }
  }
  return 'failed';
}

async function main() {
  const { products: scraped, scrapedAt } = JSON.parse(await readFile(SCRAPED, 'utf8'));
  const categories = JSON.parse(await readFile(resolve(ROOT, 'src/data/categories.json'), 'utf8'));
  await mkdir(IMAGES, { recursive: true });

  const products = [];
  const selection = [];
  const seenSku = new Set();
  const missingBrands = new Map();
  const tally = { fetched: 0, kept: 0, failed: 0 };

  for (const cat of categories) {
    for (const { slug: sub } of cat.subcategories) {
      const [urNoun, glyph, blurb] = SUB_META[sub];
      const pool = scraped.filter((p) => p.subcategory === sub);
      const picked = select(pool, sub);

      for (const [rank, item] of picked.entries()) {
        let sku = `${sub}-${slugify(item.name)}`.slice(0, 90).replace(/-$/, '');
        if (seenSku.has(sku)) sku = `${sku}-${rank}`;
        seenSku.add(sku);

        let nameUr;
        if (PRODUCE.has(sub)) {
          const kind = produceKind(item.name);
          nameUr = kind >= 0 ? PRODUCE_UR[kind][1] : urNoun;
        } else {
          const brandUr = BRAND_UR[item.brand];
          if (!brandUr) missingBrands.set(item.brand, (missingBrands.get(item.brand) ?? 0) + 1);
          const kind = PRODUCT_UR.find(([pattern]) => pattern.test(item.name));
          nameUr = `${brandUr ?? item.brand} ${kind ? kind[1] : urNoun}`;
        }

        const result = DRY ? 'kept' : item.image ? await download(item.image, resolve(IMAGES, `${sku}.jpg`)) : 'failed';
        tally[result] += 1;

        products.push({
          sku,
          name: item.name,
          nameUr,
          brand: item.brand,
          category: cat.slug,
          subcategory: sub,
          size: item.size,
          desc: blurb,
          tags: rank < POPULAR_PER_SUB && item.score >= 10 ? ['popular'] : [],
          tile: { hue: hash(sku) % 360, glyph },
          image: result === 'failed' ? null : `/products/${sku}.jpg`,
        });
        selection.push({ sku, title: item.title, source: item.url });
      }

      console.log(`${`${cat.slug}/${sub}`.padEnd(46)} ${picked.length} of ${pool.length}`);
      if (DRY) for (const item of picked) console.log(`    ${item.score >= 10 ? '•' : '·'} ${item.brand.padEnd(18)} ${item.name}${item.size ? ` (${item.size})` : ''}`);
    }
  }

  if (DRY) {
    console.log(`\n${products.length} products (dry run — nothing written)`);
    if (missingBrands.size) console.log(`no Urdu for: ${[...missingBrands.keys()].sort().join(', ')}`);
    return;
  }

  /* Old tiles and photos nothing points at any more. */
  const wanted = new Set(products.filter((p) => p.image).map((p) => p.image.split('/').pop()));
  let removed = 0;
  for (const file of await readdir(IMAGES)) {
    if (!wanted.has(file)) {
      await unlink(resolve(IMAGES, file));
      removed += 1;
    }
  }

  await writeFile(PRODUCTS, `${JSON.stringify(products, null, 2)}\n`);
  await writeFile(
    SELECTION,
    `${JSON.stringify({ source: 'naheed.pk', scrapedAt, products: selection }, null, 2)}\n`,
  );

  console.log(`\n${products.length} products → src/data/products.json`);
  console.log(`images: ${tally.fetched} fetched, ${tally.kept} already on disk, ${tally.failed} failed; ${removed} unused removed`);
  if (missingBrands.size) {
    console.log(`\nno Urdu for ${missingBrands.size} brand(s) — add them to BRAND_UR in scripts/lib/catalogue-meta.mjs:`);
    console.log(`  ${[...missingBrands.keys()].sort().join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
