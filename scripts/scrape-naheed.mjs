/**
 * Collects real product listings from naheed.pk for the ten Wafiq aisles.
 *
 * Run: node scripts/scrape-naheed.mjs [pagesPerSource=1]
 * Output: scripts/data/naheed-catalogue.json — raw, for review. Nothing here
 * touches src/data/products.json; applying the results is a separate step.
 *
 * Staying inside the site's robots.txt: it reads only friendly category
 * listing URLs (allowed) and their `?p=` pagination. It never uses site
 * search (/catalogsearch/ is disallowed) or the sort/limit/filter
 * parameters. Requests go one at a time with a pause between them.
 *
 * Each source category maps onto one of our subcategories. Where Naheed
 * lumps two of ours together (tea and coffee, pickles and Chinese sauces),
 * `include` keeps only the matching names and the rest fall through to the
 * next source that claims them.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchListing } from './lib/naheed.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'scripts/data/naheed-catalogue.json');
const PAGES = Math.max(1, Number(process.argv[2] ?? 1));

const G = 'groceries-pets/';
const HB = 'health-beauty/';
const LH = 'groceries-pets/laundry-household/';

/* Order matters within a subcategory pair: a keyword-filtered source should
   come before the catch-all that shares its listing. */
const SOURCES = [
  // fruits-vegetables
  { cat: 'fruits-vegetables', sub: 'fresh-fruits', path: `${G}fresh-products/fruits` },
  {
    cat: 'fruits-vegetables',
    sub: 'herbs-leafy-greens',
    path: `${G}fresh-products/vegetables`,
    include: /\b(mint|podina|coriander|dhania|spinach|palak|methi|fenugreek|lettuce|salad|parsley|celery|basil|leaves|saag|spring onion|curry)\b/i,
  },
  { cat: 'fruits-vegetables', sub: 'fresh-vegetables', path: `${G}fresh-products/vegetables` },
  { cat: 'fruits-vegetables', sub: 'dried-fruits-nuts', path: `${G}chocolates-snacks/dry-fruit-dates` },
  { cat: 'fruits-vegetables', sub: 'dried-fruits-nuts', path: `${G}baking-cooking/nuts-seeds` },

  // snacks-confectionery
  { cat: 'snacks-confectionery', sub: 'cookies-biscuits', path: `${G}chocolates-snacks/biscuits` },
  { cat: 'snacks-confectionery', sub: 'candies-jellies', path: `${G}candies-bubble-gum/candies-and-jellies` },
  { cat: 'snacks-confectionery', sub: 'chocolates', path: `${G}chocolates-snacks/chocolates` },
  {
    cat: 'snacks-confectionery',
    sub: 'protein-bars',
    path: `${G}chocolates-snacks/snacks`,
    include: /\b(protein|granola|energy|nutri|bar|bars)\b/i,
  },

  // tea-coffee-breakfast
  {
    cat: 'tea-coffee-breakfast',
    sub: 'coffee',
    path: `${G}beverages/tea-coffee`,
    include: /\b(coffee|nescaf|espresso|cappuccino|latte|mocha|americano|capsules?|pods?)\b/i,
  },
  { cat: 'tea-coffee-breakfast', sub: 'tea-sweeteners', path: `${G}beverages/tea-coffee` },
  { cat: 'tea-coffee-breakfast', sub: 'tea-sweeteners', path: `${G}beverages/whiteners-sweetener` },
  { cat: 'tea-coffee-breakfast', sub: 'cereals-porridge', path: `${G}breakfast/cereals` },
  { cat: 'tea-coffee-breakfast', sub: 'cereals-porridge', path: `${G}breakfast/oatmeals-porridge` },
  { cat: 'tea-coffee-breakfast', sub: 'spreads-honey-jams', path: `${G}breakfast/honey` },
  { cat: 'tea-coffee-breakfast', sub: 'spreads-honey-jams', path: `${G}breakfast/jams-spreads` },

  // milk-beverages
  {
    cat: 'milk-beverages',
    sub: 'condensed-milk',
    path: `${G}dairy/milk-dairy-drinks`,
    include: /\bcondensed\b/i,
  },
  {
    cat: 'milk-beverages',
    sub: 'powdered-milk',
    path: `${G}dairy/milk-dairy-drinks`,
    include: /\b(powder|powdered)\b/i,
  },
  { cat: 'milk-beverages', sub: 'packed-milk', path: `${G}dairy/milk-dairy-drinks` },
  { cat: 'milk-beverages', sub: 'soft-drinks', path: `${G}beverages/soft-drinks-soda` },

  // cooking-baking
  { cat: 'cooking-baking', sub: 'powdered-masalas', path: `${G}food-staples/spices-recipes` },
  { cat: 'cooking-baking', sub: 'sauces-syrups', path: `${G}deserts/syrups` },
  { cat: 'cooking-baking', sub: 'sauces-syrups', path: `${G}beverages/squash-syrup-flavors` },
  { cat: 'cooking-baking', sub: 'noodles-pasta', path: `${G}food-staples/noodles-pasta` },
  { cat: 'cooking-baking', sub: 'baking-desserts', path: `${G}baking-cooking/home-baking` },
  { cat: 'cooking-baking', sub: 'baking-desserts', path: `${G}deserts/jelly-custard` },

  // condiments-canned
  {
    cat: 'condiments-canned',
    sub: 'pickles-ketchups',
    path: `${G}food-staples/sauces-pickles`,
    include: /\b(pickle|achar|ketchup|tomato sauce|mayo|mayonnaise|mustard|chutney)/i,
  },
  { cat: 'condiments-canned', sub: 'spreads-chinese-sauces', path: `${G}food-staples/sauces-pickles` },
  {
    cat: 'condiments-canned',
    sub: 'mushrooms-olives-oils',
    path: `${G}food-staples/canned-jarred-food`,
    include: /\b(mushroom|olive|olives)\b/i,
  },
  { cat: 'condiments-canned', sub: 'canned-fruit-veg', path: `${G}food-staples/canned-jarred-food` },
  { cat: 'condiments-canned', sub: 'mushrooms-olives-oils', path: `${G}baking-cooking/olive-oil` },

  // home-kitchen
  {
    cat: 'home-kitchen',
    sub: 'tissues-foils',
    path: `${LH}food-storage`,
    include: /\b(foil|butter paper|baking paper|parchment)\b/i,
  },
  { cat: 'home-kitchen', sub: 'tissues-foils', path: `${LH}tissue-toilet-rolls` },
  { cat: 'home-kitchen', sub: 'storage-wraps', path: `${LH}food-storage` },
  { cat: 'home-kitchen', sub: 'storage-wraps', path: `${LH}trash-bags` },
  { cat: 'home-kitchen', sub: 'lighters-matches', path: 'home-lifestyle/household-supplies/lighters-matches' },
  {
    cat: 'home-kitchen',
    sub: 'dish-washing',
    path: `${LH}household-cleaners`,
    include: /\b(dish|dishwash|dishwashing|lemon max|vim|joy|scrub|sponge)/i,
  },

  // cleaning-fresheners
  {
    cat: 'cleaning-fresheners',
    sub: 'toilet-cleaning',
    path: `${LH}household-cleaners`,
    include: /\b(toilet|harpic|bathroom|tile|domex|bleach)/i,
  },
  { cat: 'cleaning-fresheners', sub: 'washing-cleaning', path: `${LH}laundry` },
  { cat: 'cleaning-fresheners', sub: 'washing-cleaning', path: `${LH}household-cleaners` },
  { cat: 'cleaning-fresheners', sub: 'insect-killers', path: `${LH}repellents-insecticides` },
  { cat: 'cleaning-fresheners', sub: 'air-fresheners', path: `${LH}air-fresheners` },

  // baby-hygiene
  { cat: 'baby-hygiene', sub: 'diapers', path: 'kids-babies/diapering-napping/diapers' },
  { cat: 'baby-hygiene', sub: 'baby-care', path: 'kids-babies/diapering-napping/baby-wipes' },
  { cat: 'baby-hygiene', sub: 'baby-care', path: 'kids-babies/baby-care/bathing' },
  { cat: 'baby-hygiene', sub: 'hair-removal', path: `${HB}personal-care/hair-removal` },
  { cat: 'baby-hygiene', sub: 'sanitary-pads', path: `${HB}feminine-care/sanitary-napkins` },

  // personal-care
  { cat: 'personal-care', sub: 'shampoos-soaps', path: `${HB}hair-care/shampoo-conditioners` },
  { cat: 'personal-care', sub: 'shampoos-soaps', path: `${HB}bath-body/body-wash-body-soap` },
  { cat: 'personal-care', sub: 'oral-care', path: `${HB}personal-care/oral-hygiene/toothpaste` },
  { cat: 'personal-care', sub: 'oral-care', path: `${HB}personal-care/oral-hygiene/toothbrushes-accessories` },
  { cat: 'personal-care', sub: 'handwash-baby-oils', path: `${HB}bath-body/hand-wash` },
  { cat: 'personal-care', sub: 'handwash-baby-oils', path: 'kids-babies/baby-care/baby-oils' },
  { cat: 'personal-care', sub: 'intimate-care', path: `${HB}feminine-care/feminine-washes` },
];

async function main() {
  const claimed = new Set();
  const products = [];
  const report = [];

  for (const source of SOURCES) {
    let taken = 0;
    let seen = 0;
    for (let page = 1; page <= PAGES; page += 1) {
      const items = await fetchListing(source.path, page);
      seen += items.length;
      for (const item of items) {
        if (claimed.has(item.url)) continue;
        if (source.include && !source.include.test(item.title)) continue;
        claimed.add(item.url);
        products.push({ category: source.cat, subcategory: source.sub, source: source.path, ...item });
        taken += 1;
      }
      if (items.length < 20) break;
    }
    report.push(`${`${source.cat}/${source.sub}`.padEnd(46)} ${String(taken).padStart(3)} of ${seen}  ← ${source.path}`);
    console.log(report.at(-1));
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    `${JSON.stringify({ source: 'naheed.pk', scrapedAt: new Date().toISOString(), pagesPerSource: PAGES, count: products.length, products }, null, 2)}\n`,
  );
  console.log(`\n${products.length} products → ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
