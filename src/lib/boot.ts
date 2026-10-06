/**
 * Takes the splash screen down once the site is fit to be seen.
 *
 * The splash itself is plain HTML and CSS in index.html, so it is on screen
 * before any of this code has loaded. This module only decides when it can
 * go: after the things whose absence makes the page look broken — the web
 * fonts, and on the home page the hero picture — and never sooner than
 * MIN_MS, so the card completes a flip instead of flashing past. It never
 * holds the site back longer than MAX_MS; a slow image is better shown late
 * than hidden behind a spinner.
 */

/** Long enough for one full flip of the card (a loop is 2s). */
const MIN_MS = 2000;
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
  await sleep(Math.max(0, MIN_MS - performance.now()));

  splash.classList.remove('is-stuck');
  splash.classList.add('is-leaving');
  await sleep(EXIT_MS);
  splash.remove();
}
