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
 * rating: everything shown came back from Google, or is not shown.
 *
 * Responses are cached in localStorage for twelve hours so browsing the
 * site does not bill a request per page view.
 */
import { branches } from './data';
import { getLang } from './i18n';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
const PLACE_ID = import.meta.env.VITE_GOOGLE_PLACE_ID ?? '';

const CACHE_KEY = 'wafiq:reviews';
const CACHE_MS = 12 * 60 * 60 * 1000;

export const MAX_SHOWN = 6;

/** The listing we are asking Google about, built from the branch record. */
const PLACE_QUERY = `${branches[0]?.name ?? 'Wafiq Super Stores'} ${
  branches[0]?.address ?? ''
}`.trim();

export const FALLBACK_MAPS_URL =
  branches[0]?.maps ?? 'https://www.google.com/maps/search/?api=1&query=Wafiq+Super+Stores';

export interface Review {
  id: string;
  author: string;
  authorUrl: string;
  photo: string;
  rating: number;
  when: string;
  text: string;
}

export interface PlaceData {
  rating: number | null;
  count: number;
  url: string;
  reviews: Review[];
}

export const isConfigured = (): boolean => Boolean(API_KEY);

const readCache = (): PlaceData | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (!raw || Date.now() - raw.at > CACHE_MS) return null;
    return raw.data as PlaceData;
  } catch {
    return null;
  }
};

const writeCache = (data: PlaceData) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* private mode — it will just fetch again next time */
  }
};

/**
 * Whatever the last successful fetch found, for surfaces that want the real
 * rating without triggering their own request. `null` until something has
 * loaded — never a placeholder number.
 */
export const getCachedReviewSummary = (): PlaceData | null => {
  const data = readCache();
  return data?.rating ? data : null;
};

async function findPlaceId(): Promise<string> {
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
  return id as string;
}

export async function fetchPlace(): Promise<PlaceData> {
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
  const data: PlaceData = {
    rating: body.rating ?? null,
    count: body.userRatingCount ?? 0,
    url: body.googleMapsUri ?? FALLBACK_MAPS_URL,
    reviews: (body.reviews ?? []).map(
      (review: Record<string, any>): Review => ({
        id: review.name,
        author: review.authorAttribution?.displayName ?? '',
        authorUrl: review.authorAttribution?.uri ?? '',
        photo: review.authorAttribution?.photoUri ?? '',
        rating: review.rating ?? 0,
        when: review.relativePublishTimeDescription ?? '',
        text: review.text?.text ?? review.originalText?.text ?? '',
      }),
    ),
  };

  writeCache(data);
  return data;
}
