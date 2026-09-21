/**
 * Google reviews for the store.
 *
 * Reads live from the Google Places API (New) in the browser. Two values
 * configure it, both optional at build time:
 *
 *   VITE_GOOGLE_MAPS_API_KEY   a browser key, restricted by HTTP referrer
 *   VITE_GOOGLE_PLACE_ID       skips the lookup; found automatically if absent
 *
 * Without a key the section still renders — rating summary unavailable,
 * with a link out to the Google listing. It never invents reviews or a
 * rating: everything shown here came back from Google, or is not shown.
 *
 * Responses are cached in localStorage for twelve hours so browsing the
 * site does not bill a request per page view. Google allows caching place
 * ids indefinitely; other fields are refreshed on that cycle.
 */
import { el, escapeHtml } from '../lib/dom.js';
import { t, getLang } from '../lib/i18n.js';
import { branches } from '../lib/data.js';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
const PLACE_ID = import.meta.env.VITE_GOOGLE_PLACE_ID ?? '';

const CACHE_KEY = 'wafiq:reviews';
const CACHE_MS = 12 * 60 * 60 * 1000;
const MAX_SHOWN = 6;

/** The listing we are asking Google about, built from the branch record. */
const PLACE_QUERY = `${branches[0]?.name ?? 'Wafiq Super Stores'} ${branches[0]?.address ?? ''}`.trim();
export const FALLBACK_MAPS_URL =
  branches[0]?.maps ?? 'https://www.google.com/maps/search/?api=1&query=Wafiq+Super+Stores';

/* ------------------------------------------------------------------ *
   Fetching
 * ------------------------------------------------------------------ */

const readCache = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (!raw || Date.now() - raw.at > CACHE_MS) return null;
    return raw.data;
  } catch {
    return null;
  }
};

/** Whatever the last successful fetch found, for surfaces that want the
 *  real rating without triggering their own fetch (the hero rating card).
 *  `null` until something has loaded — never a placeholder number. */
export const getCachedReviewSummary = () => {
  const data = readCache();
  return data?.rating ? { rating: data.rating, count: data.count, url: data.url } : null;
};

const writeCache = (data) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* private mode — it will just fetch again next time */
  }
};

async function findPlaceId() {
  if (PLACE_ID) return PLACE_ID;

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify({ textQuery: PLACE_QUERY, maxResultCount: 1 }),
  });

  if (!response.ok) throw new Error(`place search failed (${response.status})`);
  const body = await response.json();
  const id = body.places?.[0]?.id;
  if (!id) throw new Error('no matching place');
  return id;
}

async function fetchPlace() {
  const cached = readCache();
  if (cached) return cached;

  const id = await findPlaceId();
  const fields = 'id,displayName,rating,userRatingCount,googleMapsUri,reviews';
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=${getLang()}`,
    { headers: { 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': fields } },
  );

  if (!response.ok) throw new Error(`place details failed (${response.status})`);

  const body = await response.json();
  const data = {
    rating: body.rating ?? null,
    count: body.userRatingCount ?? 0,
    url: body.googleMapsUri ?? FALLBACK_MAPS_URL,
    reviews: (body.reviews ?? []).map((review) => ({
      id: review.name,
      author: review.authorAttribution?.displayName ?? '',
      authorUrl: review.authorAttribution?.uri ?? '',
      photo: review.authorAttribution?.photoUri ?? '',
      rating: review.rating ?? 0,
      when: review.relativePublishTimeDescription ?? '',
      text: review.text?.text ?? review.originalText?.text ?? '',
    })),
  };

  writeCache(data);
  return data;
}

/* ------------------------------------------------------------------ *
   Rendering
 * ------------------------------------------------------------------ */

/** Five stars with the filled row clipped to the score. */
const stars = (rating, label = '') => `
  <span class="stars" style="--pct:${Math.max(0, Math.min(5, rating)) * 20}%"
        role="img" aria-label="${escapeHtml(label || `${rating} out of 5`)}">
    <span class="stars__base" aria-hidden="true">★★★★★</span>
    <span class="stars__fill" aria-hidden="true">★★★★★</span>
  </span>`;

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

function summaryMarkup(data) {
  return `
    <div class="reviews__score">
      <strong>${data.rating ? data.rating.toFixed(1) : '—'}</strong>
      ${stars(data.rating ?? 0)}
      <span class="reviews__count">
        ${data.count} ${escapeHtml(t('reviews.count'))}
      </span>
      <a class="reviews__source" href="${escapeHtml(data.url)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(t('reviews.onGoogle'))}
      </a>
    </div>`;
}

function reviewCard(review, index) {
  // Review text is written by the public — always escaped, never markup.
  const body = escapeHtml(review.text).replace(/\n{2,}/g, '<br><br>').replace(/\n/g, ' ');

  return `
    <article class="review" data-reveal data-reveal-index="${index}">
      <header class="review__head">
        ${
          review.photo
            ? `<img class="review__avatar" src="${escapeHtml(review.photo)}" alt=""
                 width="40" height="40" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
            : `<span class="review__avatar review__avatar--initials">${escapeHtml(initials(review.author))}</span>`
        }
        <span class="review__who">
          <a class="review__author" href="${escapeHtml(review.authorUrl || '#')}"
             target="_blank" rel="noopener noreferrer">${escapeHtml(review.author)}</a>
          <span class="review__when">${escapeHtml(review.when)}</span>
        </span>
      </header>
      ${stars(review.rating, `${review.rating} out of 5`)}
      <p class="review__text">${body}</p>
    </article>`;
}

function renderLoaded(host, data) {
  const shown = data.reviews.slice(0, MAX_SHOWN);

  // Other surfaces (the hero's rating card) want the same real number
  // without duplicating the fetch — this is the one place it lands.
  if (data.rating) {
    document.dispatchEvent(
      new CustomEvent('wafiq:reviews', { detail: { rating: data.rating, count: data.count, url: data.url } }),
    );
  }

  host.innerHTML = `
    ${summaryMarkup(data)}
    ${
      shown.length
        ? `<div class="reviews__grid">${shown.map(reviewCard).join('')}</div>`
        : `<p class="reviews__empty">${escapeHtml(t('reviews.none'))}</p>`
    }
    <p class="reviews__attribution">
      ${escapeHtml(t('reviews.attribution'))}
      <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(t('reviews.viewAll'))}
      </a>
    </p>`;
}

function renderUnconfigured(host) {
  host.innerHTML = `
    <div class="reviews__placeholder">
      <p>${escapeHtml(t('reviews.unconfigured'))}</p>
      <a class="btn btn--ghost btn--sm" href="${escapeHtml(FALLBACK_MAPS_URL)}"
         target="_blank" rel="noopener noreferrer">
        ${escapeHtml(t('reviews.onGoogle'))}
      </a>
    </div>`;

  if (import.meta.env.DEV) {
    console.info(
      '[reviews] Set VITE_GOOGLE_MAPS_API_KEY in .env.local to pull live Google reviews.',
    );
  }
}

function renderError(host) {
  host.innerHTML = `
    <div class="reviews__placeholder">
      <p>${escapeHtml(t('reviews.error'))}</p>
      <a class="btn btn--ghost btn--sm" href="${escapeHtml(FALLBACK_MAPS_URL)}"
         target="_blank" rel="noopener noreferrer">
        ${escapeHtml(t('reviews.onGoogle'))}
      </a>
    </div>`;
}

/**
 * Mounts the reviews block into `host`.
 * Safe to call with a missing host, and safe to call again to re-render.
 */
export async function mountReviews(host, { force = false } = {}) {
  if (!host) return;
  if (host.dataset.mounted === 'true' && !force) return;
  host.dataset.mounted = 'true';

  if (!API_KEY) {
    renderUnconfigured(host);
    return;
  }

  host.innerHTML = `<p class="reviews__loading">${escapeHtml(t('common.loading'))}…</p>`;

  try {
    renderLoaded(host, await fetchPlace());
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[reviews]', error);
    renderError(host);
  }
}
