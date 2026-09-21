/**
 * The "picked item becomes the page" transition: clone a source element out
 * of its card, arc it to the centre of the screen while it grows, flood the
 * viewport with the category's pastel from that point, then navigate.
 *
 * Every tween below is unchanged from the vanilla build — same keyframes,
 * same easings, same offsets. Two things are new, and neither touches an
 * existing tween:
 *
 *  1. `onCover` fires at the moment the flood fully hides the page, so the
 *     router can commit behind it. The old code navigated on complete
 *     because a document navigation ended the page anyway.
 *  2. A fade-out after the grow, since in an SPA the overlay now has to
 *     get out of the way rather than being destroyed by a page load.
 */
import { gsap } from './gsap-setup';

const FLOOD_START = 0.05;
const FLOOD_DURATION = 0.75;
const GROW_END = 0.8;
const FADE_DURATION = 0.35;

let launchLayer: HTMLDivElement | null = null;

function getLaunchLayer(): HTMLDivElement {
  if (!launchLayer) {
    launchLayer = document.createElement('div');
    launchLayer.className = 'scene-launch';
    launchLayer.setAttribute('aria-hidden', 'true');
  }
  if (!launchLayer.isConnected) document.body.append(launchLayer);
  return launchLayer;
}

/**
 * When does the flood actually cover the screen?
 *
 * The flood is `clip-path: circle(calc(var(--flood-scale) * 150%) at x y)`,
 * and a percentage radius resolves against `hypot(w, h) / sqrt(2)`. Full
 * coverage means the radius reaches the furthest viewport corner from the
 * launch point, so a card near the centre is covered at ~0.41s but one in
 * a corner not until ~0.67s. Solving for the required scale and inverting
 * power2.inOut gives the real moment rather than a hardcoded average.
 */
function coverMoment(startX: number, startY: number): number {
  const { innerWidth: w, innerHeight: h } = window;
  const diagonal = Math.hypot(w, h);
  const furthestCorner = Math.max(
    Math.hypot(startX, startY),
    Math.hypot(w - startX, startY),
    Math.hypot(startX, h - startY),
    Math.hypot(w - startX, h - startY),
  );

  const needed = (furthestCorner * Math.SQRT2) / (1.5 * diagonal);
  if (needed >= 1) return FLOOD_START + FLOOD_DURATION;

  // Invert power2.inOut.
  const progress =
    needed < 0.5 ? Math.sqrt(needed / 2) : 1 - Math.sqrt((1 - needed) / 2);

  return gsap.utils.clamp(0.42, 0.68, FLOOD_START + progress * FLOOD_DURATION);
}

export interface LaunchOptions {
  /** The element to clone and fly. */
  sourceEl: HTMLElement;
  /** Flood colour; falls back to the source's inherited `--pastel`. */
  pastel?: string;
  /**
   * The source's current visual rotation in degrees, if any — cloneNode
   * copies the element alone, not an ancestor's transform, so a rotated
   * source has to say so explicitly or the clone snaps upright for a frame.
   */
  rotate?: number;
  /** Runs while the flood fully covers the screen — commit the route here. */
  onCover: () => void;
  /** Runs once the overlay has faded back out. */
  onDone?: () => void;
}

export interface LaunchHandle {
  /** Aborts mid-flight and restores the page (back button, stray nav). */
  kill: () => void;
}

export function launch({
  sourceEl,
  pastel,
  rotate = 0,
  onCover,
  onDone,
}: LaunchOptions): LaunchHandle {
  const rect = sourceEl.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  const layer = getLaunchLayer();
  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.className = 'scene-launch__item';
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
  });
  layer.append(clone);
  sourceEl.style.visibility = 'hidden';

  gsap.set(clone, { rotate, transformOrigin: '50% 50%' });

  const resolvedPastel =
    pastel ||
    getComputedStyle(sourceEl).getPropertyValue('--pastel').trim() ||
    '#e4f2d3';

  const flood = document.createElement('div');
  flood.className = 'scene-launch__flood';
  flood.style.setProperty('--flood-color', resolvedPastel);
  flood.style.setProperty('--flood-x', `${startX}px`);
  flood.style.setProperty('--flood-y', `${startY}px`);
  layer.append(flood);
  layer.classList.add('is-active');

  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    layer.classList.remove('is-active');
    gsap.set(layer, { clearProps: 'all' });
    clone.remove();
    flood.remove();
    sourceEl.style.visibility = '';
  };

  // Grown via real width/height, not a transform scale. A ~45x jump (a 20px
  // card icon to a 900px hero) is far past what a compositor keeps sharp:
  // transform-scale animations are backed by a bitmap rasterised once at the
  // start size, so stretching it that far blurs badly regardless of the
  // source being vector art or a high-res photo. Animating layout
  // width/height instead makes the browser re-render the image at each size
  // — real cost, but trivial for one clone over well under a second.
  const midSize = rect.width * 1.2;
  const endSize = Math.min(window.innerWidth, window.innerHeight) * 0.62;
  const midCentreX = startX + (startX < window.innerWidth / 2 ? 40 : -40);
  const midCentreY = startY - window.innerHeight * 0.16;
  const endCentreX = window.innerWidth / 2;
  const endCentreY = window.innerHeight / 2;

  const timeline = gsap.timeline({
    onComplete: () => {
      cleanup();
      onDone?.();
    },
  });

  timeline
    .to(
      clone,
      {
        keyframes: [
          {
            left: midCentreX - midSize / 2,
            top: midCentreY - midSize / 2,
            width: midSize,
            height: midSize,
            rotate: rotate * 0.3,
            duration: 0.38,
            ease: 'power2.out',
          },
          {
            left: endCentreX - endSize / 2,
            top: endCentreY - endSize / 2,
            width: endSize,
            height: endSize,
            rotate: 0,
            duration: 0.42,
            ease: 'power3.out',
          },
        ],
      },
      0,
    )
    .to(flood, { '--flood-scale': 1, duration: FLOOD_DURATION, ease: 'power2.inOut' }, FLOOD_START)
    .call(onCover, undefined, coverMoment(startX, startY))
    .to(layer, { autoAlpha: 0, duration: FADE_DURATION, ease: 'power2.inOut' }, GROW_END);

  return {
    kill: () => {
      timeline.kill();
      cleanup();
    },
  };
}
