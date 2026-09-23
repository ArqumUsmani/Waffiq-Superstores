# Wafiq Superstores

Marketing and catalogue site for Wafiq Super Store, Gulberg Arena Mall,
Gulberg Greens, Islamabad — ten aisles, forty shelves and a 202-product
catalogue. Aisle pages carry a short priced shortlist with a local "in
cart" counter; there is no checkout, payment or delivery. People browse,
then visit the branch.

React 19 + TypeScript + Vite 7 + Tailwind v4, react-router (data mode),
GSAP + ScrollTrigger for motion, Lenis for smooth scroll. Deployable to any
static host that rewrites unknown paths to `index.html`.

## Running it

```bash
npm install
npm run dev        # http://localhost:5178
npm run typecheck
npm run build      # typecheck, then -> dist/
npm run preview    # serve the build
```

Generators — all idempotent, none overwrites a real asset already on disk:

```bash
npm run gen:data     # scripts/gen-products.mjs          -> src/data/products.json
npm run gen:tiles    # scripts/gen-product-tiles.mjs     -> public/products/<sku>.png
npm run gen:lottie   # scripts/gen-lottie.mjs            -> src/assets/categories/*.{json,svg}
```

For live Google reviews, copy `.env.example` to `.env.local` and add a
Places API key. Everything else works without it.

## Routes

| Path | Page |
|---|---|
| `/` | Hero, pinned aisle rail, aisle grid, reviews, branch (`#home #categories #reviews #branches #contact`) |
| `/aisle/:slug` | Aisle header, priced shortlist + cart stepper, full shelf from the catalogue, other aisles |
| `/product/:sku` | Product detail and related products |
| `*` | Not found |

The ⌘K / Ctrl K / `/` search palette covers every product, aisle and shelf.

## Structure

```
src/
├─ main.tsx · App.tsx · routes.tsx
├─ pages/        Home · AislePage · ProductPage · NotFound
├─ components/   Layout · SiteHeader · Drawer · SiteFooter · BackToTop · Cursor
│                Background · HeroGrocery · Hero · hero-parts · AisleRail
│                CategoriesSection · CategoryCard · CategoryIcon · ProductCard
│                ReviewsSection · BranchSection · SearchPalette · LaunchProvider
├─ hooks/        useRig · useReveal · useMagnet · useSectionNav
├─ state/        app-state (useLang / useTheme / useMotionKey)
├─ lib/          data · i18n · theme · motion-guard · gsap-setup · smooth-scroll
│                launch · sfx · reviews · dom · nav-flags · types
├─ data/         categories.json · products.json · branches.json · aisles.json
├─ assets/       registry.ts (every import.meta.glob) · logo/ · categories/ · brands/
├─ i18n/         en.json · ur.json
└─ styles/       tailwind.css (tokens) · main.css · rtl.css (loaded last)
```

## Brand

Greens and lime are the real ones from `wafiq.pk` and the logo SVGs; the
build brief's `--color-ground-*` names are aliases onto them. Light-theme
neutrals carry a green cast (paper / ink). Display type is Bricolage
Grotesque, body is Inter, Urdu is Noto Nastaliq — all self-hosted.

## Swapping in real content

| What | Where |
|---|---|
| Product catalogue | `src/data/products.json` (same schema), or `CATALOGUE` in `scripts/gen-products.mjs` |
| Product photos | Any path, set on the product's `image` field |
| Aisle shortlist + prices | `src/data/aisles.json` — kept apart from the price-free catalogue |
| Category artwork | `src/assets/categories/<slug>.png` wins over the generated Lottie |
| Brand logos | `src/assets/brands/<slug>.png` |
| Branch | `src/data/branches.json` |
| UI copy | `src/i18n/en.json`, `ur.json` — components call `t('key')` |

## How the motion is wired

- **One rig pattern.** Every GSAP scene runs inside `useRig` (built on
  `@gsap/react`'s `useGSAP`) with `revertOnUpdate`, and rebuilds on
  language or motion-condition change. Import gsap only from
  `lib/gsap-setup.ts` — its defaults (`power3.out`, `0.8s`) are relied on.
- **Launch transition** (`lib/launch.ts`, `LaunchProvider`) — clicking an
  aisle clones its art to a body-level layer, arcs and grows it while the
  pastel floods out, commits the route at the exact frame the flood is
  opaque, then fades. Grows real `width/height`, not `scale`.
- **Aisle rail** — pinned horizontal scrub on desktop, native snap
  carousel below 1024px or under reduced motion. The active panel is
  written imperatively, never React state.
- **Route changes** — one `ScrollTrigger.refresh()` at the root, then
  `lenis.resize()`, then any `#hash` scroll — in that order, or hash jumps
  land short of pinned sections.
- **Reduced motion** — a global CSS killswitch plus `motion.reduced`
  checks: no Lenis, no pin, no cursor, launch navigates directly.

## Known gaps

1. Six of ten aisles use the generated isometric Lottie icons; supply
   `src/assets/categories/<slug>.png` renders to replace them.
2. Aisle prices in `aisles.json` are placeholders, not real prices.
3. The 202 SKUs are realistic but invented.
4. Branch phone number is not yet confirmed.
5. Urdu strings want a native-speaker review.
6. Reviews need a Places API key before they show live data.
