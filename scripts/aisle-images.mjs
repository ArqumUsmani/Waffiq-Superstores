/**
 * Real photos for the featured items at the top of each aisle page.
 *
 * Run: node scripts/aisle-images.mjs
 * Writes: public/aisle/<aisle>-<item>.jpg and the `image` field of each
 *         item in src/data/aisles.json. Names, units and prices are left as
 *         they are.
 *
 * Each item names the naheed.pk category listing to look in and what the
 * product title must match. Among matches, a brand already in BRAND_UR —
 * an everyday one a shopper asks for by name — is preferred, then listing
 * order. Photos already on disk are kept, so a re-run only fetches what
 * changed; delete a file to force a new pick.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_UR, slugify } from './lib/catalogue-meta.mjs';
import { UA, fetchListing, sleep } from './lib/naheed.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AISLES = resolve(ROOT, 'src/data/aisles.json');
const OUT_DIR = resolve(ROOT, 'public/aisle');
const PAGES = 3;

const G = 'groceries-pets/';
const LH = `${G}laundry-household/`;
const HB = 'health-beauty/';

/* aisle slug -> item name -> where to look and what to take. `not` rules out
   near-misses the match would otherwise accept. */
const PICKS = {
  'fruits-vegetables': {
    Bananas: { path: `${G}fresh-products/fruits`, match: /\bbanana/i, loose: true },
    'Red Apples': { path: `${G}fresh-products/fruits`, match: [/\bred apple/i, /\bapple/i], not: /green|golden/i, loose: true },
    Tomatoes: { path: `${G}fresh-products/vegetables`, match: /\btomato/i, not: /cherry|sun.?dried/i, loose: true },
    Spinach: { path: `${G}fresh-products/vegetables`, match: /\bspinach|palak/i, loose: true },
  },
  'snacks-confectionery': {
    'Potato Chips': { path: `${G}chocolates-snacks/chips-crisps`, match: [/\blay'?s\b.*\b(classic|salted|french cheese|masala)\b/i, /\blay'?s\b.*\b(chips|crisps)\b/i, /\bpotato\b.*\b(chips|crisps)\b/i, /\b(chips|crisps)\b/i], not: /tortilla|nacho|kimchi/i },
    'Milk Chocolate': { path: `${G}chocolates-snacks/chocolates`, match: /\bdairy milk\b/i },
    'Cream Biscuits': { path: `${G}chocolates-snacks/biscuits`, match: [/\b(sandwich|cream) biscuits?\b/i, /\bcream\b/i], not: /no added sugar|sugar free/i },
    'Mixed Nuts': { path: [`${G}chocolates-snacks/dry-fruit-dates`, `${G}baking-cooking/nuts-seeds`], match: [/\bmix(ed)?\b.*\b(nuts?|dry fruits?)\b/i, /\b(nuts?|dry fruits?)\b.*\bmix/i] },
  },
  'tea-coffee-breakfast': {
    'Black Tea': { path: `${G}beverages/tea-coffee`, match: /\b(danedar|black tea|yellow label)\b/i, not: /bags?\b/i },
    'Ground Coffee': { path: `${G}beverages/tea-coffee`, match: /\bground\b|\bcoffee\b/i, not: /capsule|pods?\b|drink|creamer/i },
    'Corn Flakes': { path: `${G}breakfast/cereals`, match: /\bcorn ?flakes\b/i },
    'Pure Honey': { path: `${G}breakfast/honey`, match: /\bhoney\b/i },
  },
  'milk-beverages': {
    'Fresh Milk': { path: `${G}dairy/milk-dairy-drinks`, match: [/\bfull cream milk\b/i, /\bmilk\b/i], not: /flavou?r|choc|strawberry|mango|banana|powder|condensed|laban|lassi|date/i },
    'Orange Juice': { path: `${G}beverages/juices`, match: [/\b100%.*\borange\b/i, /\borange juice\b/i, /\borange\b/i], not: /coco|nata|jelly/i },
    Cola: { path: `${G}beverages/soft-drinks-soda`, match: [/\b(coca.?cola|pepsi)\b/i, /\bcola\b/i], not: /zero|diet|light/i },
    'Mineral Water': { path: `${G}beverages/drinking-water`, match: /\bwater\b/i, not: /sparkling|soda/i },
  },
  'cooking-baking': {
    'Wheat Flour': { path: `${G}baking-cooking/flours-meals`, match: [/\bchakki atta\b/i, /\b(atta|wheat flour)\b/i], not: /gluten|multigrain|brown|keto/i },
    /* Plain white sugar in bags on Naheed is only their own brand, which is
       never used; the one other white sugar is a box of sachets. */
    'White Sugar': { path: `${G}food-staples/sugar-salt`, match: [/\bwhite sugar\b/i, /\bsugar\b/i], not: /brown|icing|cube|free|jaggery|gur\b|shakkar|coconut|stevia/i },
    'Cooking Oil': { path: `${G}baking-cooking/cooking-oil`, match: /\b(cooking oil|canola|sunflower|vegetable oil|oil)\b/i, not: /olive/i },
    'Basmati Rice': { path: `${G}baking-cooking/rice`, match: /\bbasmati\b/i },
  },
  'condiments-canned': {
    'Tomato Ketchup': { path: `${G}food-staples/sauces-pickles`, match: /\bketchup\b/i },
    Mayonnaise: { path: `${G}food-staples/sauces-pickles`, match: /\bmayo(nnaise)?\b/i, not: /garlic|chipotle|spicy/i },
    'Baked Beans': { path: `${G}food-staples/canned-jarred-food`, match: /\bbaked beans\b/i },
    'Canned Tuna': { path: `${G}food-staples/canned-jarred-food`, match: /\btuna\b/i },
  },
  'home-kitchen': {
    'Aluminium Foil': { path: `${LH}food-storage`, match: /\bfoil\b/i },
    'Garbage Bags': { path: `${LH}trash-bags`, match: /\b(garbage|trash|bin|waste)\b/i },
    'Facial Tissues': { path: `${LH}tissue-toilet-rolls`, match: /\bfacial\b/i },
    'Food Storage Box': { path: `${LH}food-storage`, match: [/\bglass container\b/i, /\b(container|storage box|lunch box)\b/i] },
  },
  'cleaning-fresheners': {
    /* The Expert White listings carry an "Official Store" banner in the photo. */
    'Washing Powder': { path: `${LH}laundry`, match: [/^surf excel washing powder/i, /\bwashing powder\b/i], not: /expert white/i },
    'Dishwash Liquid': { path: `${LH}household-cleaners`, match: /\bdish ?wash(ing)?\b.*\b(liquid|gel)\b|\b(liquid|gel)\b.*\bdish/i },
    'Surface Cleaner': { path: `${LH}household-cleaners`, match: /\b(surface|multi.?purpose|floor|all.?purpose)\b/i },
    'Air Freshener': { path: `${LH}air-fresheners`, match: /\b(air freshener|aerosol|spray)\b/i, not: /refill|matic|automatic/i },
  },
  'baby-hygiene': {
    'Baby Diapers': { path: 'kids-babies/diapering-napping/diapers', match: /\bdiapers?\b/i, not: /pants?\b/i },
    'Baby Wipes': { path: 'kids-babies/diapering-napping/baby-wipes', match: [/\bbaby wipes\b/i, /\bwipes\b/i] },
    'Baby Cereal': { path: 'kids-babies/baby-foods', match: [/\bcerelac\b/i, /\b(cereal|porridge)\b/i] },
    'Baby Lotion': { path: 'kids-babies/baby-care/baby-lotions-creams', match: /\bbaby\b.*\blotion\b|\blotion\b.*\bbaby\b/i },
  },
  'personal-care': {
    'Bath Soap': { path: `${HB}bath-body/body-wash-body-soap`, match: /\bsoap\b/i, not: /liquid|wash/i },
    Shampoo: { path: `${HB}hair-care/shampoo-conditioners`, match: /\bshampoo\b/i, not: /conditioner|dry shampoo/i },
    /* Sensodyne's listings are promotional graphics, not pack shots. */
    Toothpaste: { path: `${HB}personal-care/oral-hygiene/toothpaste`, match: [/\bcolgate\b/i, /\btooth ?paste\b/i], not: /sensodyne/i },
    Deodorant: { path: `${HB}perfumes/men-deodorants`, match: /\b(deodorant|body spray|deo)\b/i },
  },
};

/**
 * Never Naheed's own brands, and nothing for adults on the baby shelf. Their
 * "Fresh Basket" label is printed on its packs, so it is ruled out too —
 * except for loose produce (`loose: true`), where the photo is just the
 * fruit; even there another listing is preferred when one exists.
 */
const NEVER = /\bnaheed\b|\badult\b/i;
const HOUSE_LABEL = /\bfresh basket\b/i;

const norm = (s) => s.toLowerCase().replace(/[’']/g, "'");
const brandKeys = Object.keys(BRAND_UR).map(norm);
const everyday = (title) => brandKeys.some((key) => norm(title).startsWith(`${key} `));

/**
 * `match` may be a list, tried in order across every page before falling
 * back to the next — so "Coca-Cola or Pepsi" is preferred over any cola.
 */
async function findPhoto({ path, match, not, loose = false }) {
  const items = [];
  /* `path` may list several listings, searched together. */
  for (const listingPath of [path].flat()) {
    for (let page = 1; page <= PAGES; page += 1) {
      const listing = await fetchListing(listingPath, page);
      items.push(...listing);
      if (listing.length < 20) break;
    }
  }
  const usable = items.filter(
    (item) =>
      item.image &&
      !NEVER.test(item.title) &&
      (loose || !HOUSE_LABEL.test(item.title)) &&
      !(not && not.test(item.title)),
  );
  for (const pattern of [match].flat()) {
    const hits = usable.filter((item) => pattern.test(item.title));
    if (!hits.length) continue;
    const ranked = [...hits].sort(
      (a, b) =>
        Number(HOUSE_LABEL.test(a.title)) - Number(HOUSE_LABEL.test(b.title)) ||
        Number(everyday(b.title)) - Number(everyday(a.title)),
    );
    return ranked[0];
  }
  return null;
}

async function main() {
  const aisles = JSON.parse(await readFile(AISLES, 'utf8'));
  await mkdir(OUT_DIR, { recursive: true });
  const misses = [];

  for (const aisle of aisles) {
    for (const item of aisle.items) {
      const spec = PICKS[aisle.slug]?.[item.name];
      if (!spec) {
        misses.push(`${aisle.slug} / ${item.name} (no rule)`);
        continue;
      }

      const stem = `${aisle.slug}-${slugify(item.name)}`;
      /* Already converted by scripts/to-webp.mjs: keep it. New photos land
         as .jpg and are converted by the next `npm run images:webp`. */
      const converted = await stat(resolve(OUT_DIR, `${stem}.webp`)).then(() => true, () => false);
      const file = `${stem}.${converted ? 'webp' : 'jpg'}`;
      const target = resolve(OUT_DIR, file);
      let source = 'kept';
      try {
        await stat(target);
      } catch {
        const hit = await findPhoto(spec);
        if (!hit) {
          misses.push(`${aisle.slug} / ${item.name} (nothing matched on ${[spec.path].flat().join(', ')})`);
          continue;
        }
        await sleep(400);
        const response = await fetch(hit.image, { headers: { 'User-Agent': UA } });
        if (!response.ok) {
          misses.push(`${aisle.slug} / ${item.name} (image ${response.status})`);
          continue;
        }
        await writeFile(target, Buffer.from(await response.arrayBuffer()));
        source = hit.title;
      }

      item.image = `/aisle/${file}`;
      console.log(`${`${aisle.slug} / ${item.name}`.padEnd(46)} ${source}`);
    }
  }

  await writeFile(AISLES, `${JSON.stringify(aisles, null, 2)}\n`);
  if (misses.length) {
    console.log(`\n${misses.length} item(s) without a photo — they keep their emoji:`);
    for (const miss of misses) console.log(`  ${miss}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
