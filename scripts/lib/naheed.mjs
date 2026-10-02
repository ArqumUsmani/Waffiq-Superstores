/**
 * Reading naheed.pk category listings — shared by scrape-naheed.mjs and
 * aisle-images.mjs.
 *
 * Only friendly category URLs and their `?p=` pagination are fetched, both
 * allowed by the site's robots.txt; never site search or the
 * sort/limit/filter parameters. One request at a time, with a pause.
 */
export const BASE = 'https://www.naheed.pk/';
export const PAUSE_MS = 1500;
export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36';

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const decode = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** "Lipton Yellow Label Tea, 430g Pouch" -> name + size, when it splits that way. */
function splitSize(full) {
  const at = full.lastIndexOf(', ');
  if (at > 0 && /\d/.test(full.slice(at + 2))) {
    return { name: full.slice(0, at), size: full.slice(at + 2) };
  }
  const tail = full.match(/\s(\d+(?:\.\d+)?\s?(?:g|gm|gms|kg|ml|l|ltr|litre|pcs|pc|pack|sheets|rolls|bags|tablets|caps)\b.*)$/i);
  return tail ? { name: full.slice(0, tail.index).trim(), size: tail[1] } : { name: full, size: '' };
}

/** Listings are cached per page so sources sharing a listing fetch it once. */
const pageCache = new Map();

export async function fetchListing(path, page) {
  const key = `${path}?p=${page}`;
  if (pageCache.has(key)) return pageCache.get(key);

  const url = page > 1 ? `${BASE}${path}?p=${page}` : `${BASE}${path}`;
  let html = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await sleep(PAUSE_MS);
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
      if (response.ok) {
        html = await response.text();
        break;
      }
      console.warn(`  ${response.status} ${url} (attempt ${attempt})`);
    } catch (error) {
      console.warn(`  ${error.message} ${url} (attempt ${attempt})`);
    }
  }

  const items = [];
  const blocks = html.split(/<li[^>]*class="[^"]*product-item[^"]*"/).slice(1);
  for (const block of blocks) {
    const link = block.match(/class="product-item-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const image =
      block.match(/<img[^>]*class="product-image-photo[^"]*"[^>]*src="([^"]+)"/) ??
      block.match(/src="(https:\/\/media\.naheed\.pk\/catalog\/product\/[^"]+)"/);
    const price = block.match(/data-price-amount="([\d.]+)"/);
    const full = decode(link[2]);
    items.push({
      title: full,
      ...splitSize(full),
      url: decode(link[1]).split('?')[0],
      image: image ? image[1] : null,
      pricePkr: price ? Number(price[1]) : null,
    });
  }

  pageCache.set(key, items);
  return items;
}
