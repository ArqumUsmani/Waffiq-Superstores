/**
 * Product artwork.
 *
 * Every SKU has a real PNG: either a genuine product photo dropped in
 * at `image`, or — for the ones without one yet — the generated tile
 * (a gradient tinted from the aisle's accent colour, the shelf's glyph,
 * and the product's initials) rasterised once by
 * `scripts/gen-product-tiles.mjs` into public/products/<sku>.png. The
 * same SKU always gets the same tile, so grids are stable across builds
 * and read as intentional rather than as missing images.
 *
 * Nothing is generated in the browser — this module just picks the
 * <img>. Re-run `npm run gen:tiles` after adding a product with no
 * `image` set, or after changing the tile design in the generator
 * script itself.
 */
export function productArtwork(product, { alt = '', eager = false } = {}) {
  return `<img class="tile" src="${product.image}" alt="${alt}"
    loading="${eager ? 'eager' : 'lazy'}" decoding="async" width="400" height="400">`;
}
