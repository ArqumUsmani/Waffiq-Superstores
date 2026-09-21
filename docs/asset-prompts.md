# Cutout artwork — generation brief

The site ships with generated artwork so it works today with no image
sourcing. This document covers the ~40 real cutouts that replace the
generated stand-ins on the surfaces people actually look at.

Nothing here is required for the site to run. Drop files in and they
appear; leave the folders empty and the generated fallbacks stay.

---

## House style (apply to every prompt)

Append this to each prompt so the set reads as one family:

> Product photograph, studio lit, soft top-left key light with a gentle
> fill, subtle contact shadow directly beneath, shot slightly above eye
> level at a three-quarter angle, sharp focus throughout, true-to-life
> colour, no props, no text overlays, no hands, no packaging mockup
> frames, isolated on a pure white background, centred with generous
> margin on all sides.

Then cut the background out and export with real transparency.

**Why the white background then cut it:** generators handle "on white"
far more reliably than "transparent PNG", and background removal from
clean white is near-lossless.

### Export settings

| Property | Value |
|---|---|
| Format | WebP, lossy quality 82, alpha preserved |
| Size | 800 × 800 px, object filling ~78% of the frame |
| Background | Fully transparent (alpha 0), no white fringe |
| Naming | Exactly as listed below, lowercase, hyphenated |

Check the alpha edge at 400% before exporting — a white halo is very
visible against the deep-green hero.

---

## Set 1 — Hero cluster (9 files)

These float around the WAFIQ wordmark on the home page and are the first
thing anyone sees. They read at roughly 100–160 px, so silhouette matters
more than label detail.

**Folder:** `src/assets/cutouts/`
**Naming:** `<category-slug>.webp`

| File | Prompt subject |
|---|---|
| `snacks-confectionery.webp` | A stack of three round butter biscuits beside one wrapped toffee |
| `tea-coffee-breakfast.webp` | A carton of loose black tea leaves next to a filled ceramic chai cup |
| `milk-beverages.webp` | A one-litre tetra carton of full cream milk beside a chilled glass bottle |
| `cooking-baking.webp` | A small steel bowl of red chilli powder with a sachet of recipe masala leaning against it |
| `condiments-canned.webp` | A glass jar of mixed pickle in oil beside an unlabelled tin can |
| `home-kitchen.webp` | A clear airtight food container with a roll of kitchen foil standing beside it |
| `cleaning-fresheners.webp` | A trigger spray bottle of surface cleaner at a three-quarter angle |
| `baby-hygiene.webp` | A baby feeding bottle with a soft pastel cap and a folded nappy behind it |
| `personal-care.webp` | A pump-top shampoo bottle beside a bar of soap |

> The hero deliberately uses no people. If you later want a person in
> the scene, that is a design change, not an asset swap — say so and it
> can be rebuilt around a figure.

## Set 2 — Aisle feature renders (9 files)

Larger, more detailed versions for the aisle headers and category cards.
These sit on a pastel plate at ~170 px, so a little more shelf context is
welcome — two or three items rather than one.

**Folder:** `src/assets/cutouts/`
**Naming:** `aisle-<category-slug>.webp`

Use the same subjects as Set 1, but arranged as a small group of three
related products from that aisle, slightly overlapping, front item in
sharpest focus.

## Set 3 — Popular rail (22 files)

The SKUs tagged `popular` in `src/js/data/products.json` appear on the
home page rail and lead every aisle. Real packshots here lift the whole
site more than anything else on this list.

**Folder:** `public/products/`
**Naming:** `<sku>.webp` — the exact `sku` value from `products.json`

To list the ones that matter first:

```bash
node -e "const p=require('./src/js/data/products.json'); \
  console.log(p.filter(x=>x.tags.includes('popular')).map(x=>x.sku).join('\n'))"
```

**Important:** these are real branded products. Do not generate imitation
packaging with brand names on it — either photograph the actual product on
the shelf, or use the supplier's official packshot with permission. A
generated fake of a Tapal or Dettol pack is a trademark problem, not a
design shortcut.

---

## Wiring them up

**Sets 1 and 2** need no code change. `hero-cluster.js` and the category
components glob `src/assets/cutouts/` at build time and prefer a real file
over the generated icon whenever one exists.

**Set 3** needs one field per product in `src/js/data/products.json`:

```json
{
  "sku": "tea-sweeteners-tapal-danedar-black-tea",
  "image": "/products/tea-sweeteners-tapal-danedar-black-tea.webp"
}
```

Every SKU already has an `image` — `scripts/gen-product-tiles.mjs`
rasterised a generated placeholder (a gradient tinted from the aisle's
colour, the shelf's glyph, the product's initials) to a real PNG at
`public/products/<sku>.png` for every product that didn't have a real
photo. Nothing is generated in the browser any more; that script is the
only place the design lives. Pointing `image` at a real photo instead —
same field, any path — swaps it in everywhere that product appears:
card, rail, search palette, detail page, no other edit.

Re-run `npm run gen:tiles` after adding a new product with no image, or
after editing the tile design in that script; it skips any SKU that
already has one. `npm run gen:data` (regenerating from the catalogue)
never wipes an `image` that's already set, real photo or generated
tile alike.

To fill in real photos in bulk once the files exist:

```bash
node -e "
const fs=require('fs');
const path='src/js/data/products.json';
const items=JSON.parse(fs.readFileSync(path,'utf8'));
for (const p of items) {
  if (fs.existsSync('public/products/'+p.sku+'.webp')) p.image='/products/'+p.sku+'.webp';
}
fs.writeFileSync(path, JSON.stringify(items,null,2)+'\n');
"
```

## Category artwork — the highest-value swap

The nine category icons live in `src/assets/categories/`, and the site
takes the best available source for each:

1. `<category-slug>.png` — a real 3D render. Used as-is, no player
   loaded, and `npm run gen:lottie` skips that category so regenerating
   can never shadow it. **This is the recommended path.**
2. `<category-slug>.json` + `.svg` — the generated isometric icon and
   its resting frame. Also accepts a purchased Lottie set.

`tea-coffee-breakfast.png` is already wired up this way and shows the
quality difference against the generated eight.

Prompt for the remaining eight, to match the one already in place:

> Isometric 3D render of a small product group for a supermarket aisle,
> skeuomorphic style with realistic materials — glass, matte card, glossy
> plastic, brushed metal. Arranged on a light wooden board, soft studio
> lighting from the upper left, gentle contact shadows, warm neutral
> palette, clean and uncluttered, no background, transparent PNG, square
> composition with generous margin.

Then name the subject per aisle:

| File | Subject |
|---|---|
| `snacks-confectionery.png` | biscuit packet, stacked butter biscuits, wrapped toffees, a chocolate bar |
| `milk-beverages.png` | tetra milk carton, glass milk bottle, a soft-drink bottle |
| `cooking-baking.png` | bowl of red chilli powder, masala sachets, a small spice jar, a wooden spoon |
| `condiments-canned.png` | glass pickle jar, a tin can, a ketchup bottle |
| `home-kitchen.png` | clear airtight container, kitchen foil roll, a sponge, a tissue box |
| `cleaning-fresheners.png` | trigger spray bottle, detergent carton, an air freshener can |
| `baby-hygiene.png` | baby feeding bottle, a wipes pack, folded nappies |
| `personal-care.png` | pump shampoo bottle, a soap bar, a toothpaste tube and brush |

## Brand logos for the marquee

The ribbon under the hero currently shows **generated isometric packs**
with each brand name on the front face — deliberately not imitations of
real logos.

To use the real ones, drop transparent PNGs at
`src/assets/brands/<slug>.png`, where the slug is the brand name
lowercased and hyphenated (`Surf Excel` → `surf-excel.png`,
`Peek Freans` → `peek-freans.png`). Each is picked up automatically.

These must be the official logos, used with permission — do not generate
lookalikes.

## Interactive scenes — the Fruits & Vegetables crate

Fruits & Vegetables is the first category with a **living icon** instead
of a static render: hover lifts the produce out of a wooden crate, one
item at a time to a random height, and a click sends a random item
flying out to become the category page's hero. The mechanism lives in
`src/js/components/basket-scene.js`; the content lives in
`src/assets/scenes/fruits-vegetables/`.

Two kinds of file, both optional individually:

| File | Role |
|---|---|
| `crate.png` | The container, back layer. The **same file** is reused a second time, clipped to `scene.json`'s `frontClip` polygon, as the front lip produce rises past. |
| `items/<id>.png` (× 17: `apple`, `banana`, `broccoli`, `capsicum`, `carrot`, `cauliflower`, `chilli`, `corn`, `cucumber`, `eggplant`, `garlic`, `grapes`, `onion`, `orange`, `potato`, `strawberry`, `tomato`) | One item each. `scene.json` may name the same id more than once — a crate holds several tomatoes — and each entry gets its own size and rotation, so repeats read as separate pieces rather than copies. |

Until real photography lands, `scripts/gen-scene-placeholders.mjs` fills
both with flat-colour SVG stand-ins — good enough to build and review the
motion against, not final art. `npm run gen:data`'s sibling command:

```bash
node scripts/gen-scene-placeholders.mjs
```

never overwrites a real file — same "real art wins" rule as the category
icons. Drop a PNG at either path and it takes over immediately, no code
change.

**Spec for real produce photography:**

> Isometric 3D render of a single [item], skeuomorphic style with
> realistic material and texture, soft studio lighting from the upper
> left matching a wooden crate viewed from the same three-quarter angle,
> isolated, **no surface, no ground shadow** (the page draws its own
> shadow so it can shrink as the item rises), transparent background,
> centred with generous margin, roughly square crop.

The **no ground shadow** instruction matters more here than on the
other category renders — a baked-in shadow would rise and float with the
item instead of staying on the crate floor.

**The crate itself** should be shot or rendered as an *empty* crate (no
produce piled in it — the produce is composited by the page), at the
same isometric angle, ideally with the front-bottom wall clearly
distinct from the back wall so `frontClip` in scene.json can be
re-tuned to the exact seam once the real photo arrives.

To measure a new crate, overlay a percentage grid on the image and read
off the four corners of its opening; the front rim is the two edges from
the leftmost corner down to the nearest corner and back up to the
rightmost. The current crate's opening sits at stage-space `(20,46)`, `(60,27)`,
`(85.5,40.5)`, `(45,58.5)`, which is where its `frontClip` comes from
after converting to image space. Produce also has to heap well above the
rim: filling the opening alone leaves the wooden body dominating the
icon and the crate still reads as empty. A handful of pieces marked
`"front": true` sit above the lip, resting on the near rail — without
them the lip cuts the whole front row along one clean diagonal, which
reads as a mask rather than as a crate.

### Building another scene later

`scene.json`'s shape is generic on purpose — a shopping bag of snacks or
a shelf of bottles could reuse the same engine:

```json
{
  "container": "crate",
  "frontClip": "polygon(0% 37.6%, 44.3% 59.7%, 100% 34.9%, 100% 100%, 0% 100%)",
  "lipClearancePct": 0.05,
  "lift": { "min": 0.05, "max": 0.26 },
  "items": [{ "id": "tomato", "x": 49.8, "y": 49.2, "size": 16, "rotate": 7 }]
}
```

`x`/`y`/`size` are percentages of the icon's square stage, so the same
manifest scales from a 132px category card to a 200px aisle panel
untouched.

**Two things to know before hand-placing items.** `y` is the *bottom of
the item's square box*, not the bottom of the produce inside it — every
render carries roughly 15–20% transparent margin, so a piece sits that
much higher than its `y` suggests and the value has to be pushed down to
compensate. And array order is paint order, back to front: sort by `y`
so nearer pieces cover further ones, then hand-fix the exceptions (a
piece perched on top of the heap belongs in front of whatever it rests
on, whatever its `y` says).

`frontClip` is in the *container image's* own coordinates — it clips the
`<img>`, not the stage — while item `x`/`y` are in stage coordinates. The
two differ by `.basket-scene__container`'s inset, currently
`stage% = 6 + image% × 0.88`. Placing produce so its base falls a couple
of percent *below* the front rim line is what makes the lip cut into it
and the piece read as sitting inside the crate rather than in front of
it. To wire up a second scene: add a new folder under
`src/assets/scenes/`, give the category a matching `"scene"` value in
`categories.json`, and add that value to the `SCENES` map at the top of
`src/js/components/category-icon.js`.
