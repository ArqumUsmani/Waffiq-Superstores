/**
 * Every bundled asset lookup, in one place.
 *
 * `import.meta.glob` resolves its pattern relative to the *importing file*,
 * so the same four globs spread across four components meant four paths
 * that would silently become `{}` if a file ever moved — and an empty glob
 * throws nothing, it just renders every category icon as an empty box.
 * One module, one set of paths, and a dev-time assertion that they matched.
 */

const categoryRenders = import.meta.glob('./categories/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const categoryLotties = import.meta.glob('./categories/*.json', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const categoryPosters = import.meta.glob('./categories/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const brandLogos = import.meta.glob('./brands/*.{png,webp,svg}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Real cutout artwork, if it has ever been dropped in. Optional by design. */
const cutouts = import.meta.glob('./cutouts/*.{webp,png}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** A 3D render for this aisle, if one exists. Four of ten have one. */
export const categoryRender = (slug: string): string | undefined =>
  categoryRenders[`./categories/${slug}.png`];

/** The generated Lottie for this aisle — only where no render exists. */
export const categoryLottie = (slug: string): string | undefined =>
  categoryLotties[`./categories/${slug}.json`];

/** The Lottie's rest frame as inline SVG markup, used as the poster. */
export const categoryPoster = (slug: string): string | undefined =>
  categoryPosters[`./categories/${slug}.svg`];

/** A real brand logo, if one has been supplied for this slug. */
export const brandLogo = (slug: string): string | undefined =>
  brandLogos[`./brands/${slug}.png`] ??
  brandLogos[`./brands/${slug}.webp`] ??
  brandLogos[`./brands/${slug}.svg`];

/** A hero cutout, preferred over the category render when present. */
export const cutout = (slug: string): string | undefined =>
  cutouts[`./cutouts/${slug}.webp`] ?? cutouts[`./cutouts/${slug}.png`];

if (import.meta.env.DEV) {
  const counts = {
    categoryRenders: Object.keys(categoryRenders).length,
    categoryLotties: Object.keys(categoryLotties).length,
    categoryPosters: Object.keys(categoryPosters).length,
    brandLogos: Object.keys(brandLogos).length,
  };
  // Not an exact-count assertion — art gets added. This catches the failure
  // that matters: a moved folder turning a glob into {} with no error.
  for (const [name, count] of Object.entries(counts)) {
    if (count === 0) {
      console.error(
        `[assets] glob "${name}" matched nothing — did src/assets move? ` +
          `Every icon that depends on it will render empty.`,
      );
    }
  }
}
