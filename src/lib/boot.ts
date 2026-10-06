/**
 * Takes the splash screen down once the site is fit to be seen.
 *
 * The splash itself is plain HTML and CSS in index.html, so it is on screen
 * before any of this code has loaded. This module only decides when it can
 * go: after the things whose absence makes the page look broken — the web
 * fonts, and on the home page the hero picture — and never sooner than
 * MIN_MS, so every aisle is seen once even when the site loads at once. It never
 * holds the site back longer than MAX_MS; a slow image is better shown late
 * than hidden behind a spinner.
 */

/** One full pass through all four aisles (4 x 1.3s in index.html). */
const MIN_MS = 5200;
/** After this the site is shown regardless. */
const MAX_MS = 8000;
/** Matches the splash's opacity transition in index.html. */
const EXIT_MS = 550;

const sleep = (ms: number) => new Promise<void>((done) => window.setTimeout(done, ms));

function imageReady(src: string): Promise<void> {
  const img = new Image();
  img.src = src;
  /* A failed image must not keep the splash up: the page copes without it. */
  return img.decode().catch(() => undefined);
}

function siteReady(): Promise<unknown> {
  const waits: Promise<unknown>[] = [document.fonts.ready];
  if (window.location.pathname === '/') {
    waits.push(imageReady('/assets/scene-day.webp'));
    if (document.documentElement.dataset.theme === 'dark') {
      waits.push(imageReady('/assets/scene-night.webp'));
    }
  }
  return Promise.all(waits);
}

export async function dismissSplash(): Promise<void> {
  const splash = document.getElementById('splash');
  if (!splash) return;

  /* performance.now() counts from navigation start, which is when the
     splash appeared — so MIN_MS is measured from what the visitor saw. */
  const shown = performance.now();
  await Promise.race([siteReady(), sleep(Math.max(0, MAX_MS - shown))]);
  /* The admin panel is a tool, opened many times a day: no show for it. */
  const minimum = window.location.pathname.startsWith('/admin') ? 0 : MIN_MS;
  await sleep(Math.max(0, minimum - performance.now()));

  splash.classList.remove('is-stuck');
  splash.classList.add('is-leaving');
  await sleep(EXIT_MS);
  splash.remove();
}
