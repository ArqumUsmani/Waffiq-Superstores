# Wafiq Superstores

A product **listing** site — nine aisles, thirty-six shelves, and the full
catalogue in between. There is no cart, no checkout, no payment and no
"buy now" anywhere: people browse what the store carries, then visit a
branch.

Built as a static multi-page site. Vite + Tailwind v4 + SCSS + vanilla ES
modules, deployable to any static host.

## Running it

```bash
npm install
npm run dev        # http://localhost:5178
npm run build      # -> dist/
npm run preview    # serve the build
```

Three generators, all idempotent and safe to re-run — none will ever
overwrite a real asset that already exists at the same path:

```bash
npm run gen:data     # scripts/gen-products.mjs            -> src/js/data/products.json
npm run gen:lottie   # scripts/gen-lottie.mjs               -> src/assets/categories/*.{json,svg}
npm run gen:scene    # scripts/gen-scene-placeholders.mjs   -> src/assets/scenes/*/**.svg
```

For live Google reviews, copy `.env.example` to `.env.local` and add a
Places API key. Everything else works without it.

## Brand

Values taken from the live `wafiq.pk` stylesheet and the supplied logo
SVGs, not chosen here. They live in `src/styles/tailwind.css`.

| Token | Value |
|---|---|
| `--color-green` | `#136F37` |
| `--color-green-deep` | `#0E6337` (logo) |
| `--color-lime` | `#B2DD4A` |
| `--color-lime-bright` | `#BAE957` (logo) |
| `--color-ink` | `#232323` |
| Typeface | Poppins 300–700, Noto Nastaliq Urdu for Urdu |
| Radii | 50px pills, 20px cards, 32px frames |

The brand is spelled **Wafiq** (one `f`) throughout, per the logo and the
live site.

**Note on the logo filenames:** the supplied `Logo for Dark BG.svg` is
actually the *light*-background lockup — green mark, lime swoosh, black
wordmark. `Group 4.svg` is the dark-background one (lime mark, white
wordmark). They are copied into `src/assets/logo/` renamed for what they
do: `logo-on-light.svg`, `logo-on-dark.svg`, `monogram.svg`. The
originals in `assets/logo/` are untouched.

## Structure

```
index.html  categories.html  category.html  product.html
search.html  branches.html  about.html  contact.html  404.html

src/
├─ styles/    tailwind.css (tokens) · main.scss · rtl.scss
├─ i18n/      en.json · ur.json
├─ assets/    logo/ · categories/ · brands/ · cutouts/ · scenes/
└─ js/
   ├─ lib/         data · i18n · theme · motion-guard · gsap-setup · smooth-scroll · dom · sfx
   ├─ components/  shell · hero-cluster · aisle-rail · category-card · product-card
   │               product-tile · category-icon · basket-scene · brand-mark · reviews
   │               search-palette · cursor · marquee · reveal
   ├─ pages/       one module per page, code-split
   └─ data/        categories.json · products.json · branches.json
```

Dynamic pages read query params (`category.html?cat=…&shelf=…`,
`product.html?sku=…`), so the whole site stays static — no server, no
router, no rewrites needed.

## Swapping in real content

| What | Where | Notes |
|---|---|---|
| Product catalogue | `src/js/data/products.json` | Replace wholesale, same schema. Or edit `CATALOGUE` in `scripts/gen-products.mjs` and re-run `npm run gen:data`. |
| Product photos | `public/products/<sku>.webp` + set `image` | See [docs/asset-prompts.md](docs/asset-prompts.md). |
| Hero / aisle cutouts | `src/assets/cutouts/` | Picked up automatically; no code change. |
| **Category artwork** | `src/assets/categories/<slug>.png` | A real 3D render wins over the generated icon, and `gen:lottie` then skips that category. This is the recommended path. |
| Category icons (generated) | `src/assets/categories/<slug>.json` + `.svg` | Or drop in a purchased Lottie set. |
| Interactive scene art (Fruits & Vegetables) | `src/assets/scenes/<slug>/…` | Crate + 8 produce PNGs; see [docs/asset-prompts.md](docs/asset-prompts.md). `npm run gen:scene` regenerates only the placeholders that are still missing. |
| Brand logos | `src/assets/brands/<slug>.png` | Replaces the generated isometric pack in the marquee. Slug is the lowercased, hyphenated brand name. |
| Branches | `src/js/data/branches.json` | Real address and hours; `phone` is `null` until confirmed. |
| Google reviews | `.env.local` | `VITE_GOOGLE_MAPS_API_KEY`, optional `VITE_GOOGLE_PLACE_ID`. |
| UI copy | `src/i18n/en.json`, `ur.json` | Markup uses `data-i18n` keys. |
| Contact form | `data-endpoint` on the form in `contact.html` | Without one it falls back to `mailto:`. |

## Design notes

- **Hero** — giant lime wordmark with grocery objects passing in front of
  the letterforms, pointer parallax by depth, and a dashed connector to
  the branch card.
- **Walk the aisle** — pins on desktop and converts vertical scroll into
  horizontal travel past nine stops; below 1024px, and under reduced
  motion, the same markup is a plain snap carousel with no pinning.
- **Product tiles** — generated deterministically from each SKU (aisle
  hue + shelf glyph + initials), so the grid is stable across builds and
  never shows a broken image.
- **Search** — `⌘K` / `Ctrl K` / `/`, fully client-side over the bundled
  catalogue, with the matched span highlighted.
- **Category artwork** — three sources in order: a real `<slug>.png`
  render, the generated isometric Lottie, or nothing. Swapping one in is
  a file drop; `npm run gen:lottie` refuses to shadow a real render.
- **Interactive scene (Fruits & Vegetables)** — `basket-scene.js`.
  Hovering the crate lifts every item to its own random height on a
  random stagger, then holds — nothing loops. A pickup/drop sound plays
  (synthesised, `lib/sfx.js`; silent until the visitor's first gesture,
  since browsers block audio before one). Clicking sends a random item
  flying out of a body-level overlay to fill the screen, floods the page
  to the aisle's pastel, and lands on the category page with that same
  item as the header hero, read once from `sessionStorage` — a fresh
  entrance on the new page rather than a dependency on the browser's
  cross-document View Transition, which a static multi-page site can't
  lean on reliably for JS-rendered content. The item's growth animates
  real `width`/`height`, not a transform `scale` — a ~45× size jump
  blurs badly under a compositor-cached transform, regardless of source
  resolution.
- **Motion** — nothing loops on its own. Category icons sit at their rest
  pose and play a single lift-and-settle gesture only on hover or focus;
  the hero objects hold still after their entry and respond to pointer
  and scroll. The one continuous element is the brand marquee, which is
  a ribbon by design. `lib/motion-guard.js` is the single gate: under
  `prefers-reduced-motion` there is no smooth scroll, no pinning, no
  cursor, no basket lift/fly-out (a click navigates immediately), and
  every icon holds its static frame.
- **Reviews** — pulled live from the Google Places API (New), cached for
  twelve hours in `localStorage`. Without a key the section renders a
  link to the Google listing. It never invents a rating or a review.
- **Urdu** — full RTL flip. Layout uses logical properties, so the
  mirroring is nearly free; `rtl.scss` holds only the physical exceptions
  (arrow glyphs, gradient directions, transform origins).

## Known gaps

1. Eight of the nine non-scene category icons are the generated
   isometric set. Tea, Coffee & Breakfast has a real render and shows
   the difference — supply the other eight as
   `src/assets/categories/<slug>.png`.
2. The Fruits & Vegetables crate and its 8 produce items are all
   generated placeholders — see [docs/asset-prompts.md](docs/asset-prompts.md)
   for the real-photography spec.
3. The marquee shows generated isometric packs, not real brand logos.
   Real logos are trademarked artwork and have to be supplied.
4. The 202 SKUs are realistic but invented — real brands, made-up shelf.
5. The branch phone number is not yet confirmed.
6. Urdu strings are a best effort and want a native-speaker review.
7. Contact phone / WhatsApp / email are placeholders.
8. Reviews need a Places API key before they show live data.
