/**
 * Category artwork.
 *
 * Four sources, in order of preference:
 *   0. An interactive scene (categories.json sets `"scene"`) — delegates
 *      entirely to basket-scene.js, which returns its own enter/leave/
 *      activate API alongside the usual pop()/destroy().
 *   1. <slug>.png  — a real 3D render. Used as-is; no player, no Lottie.
 *      Also gets activate(): the same fly-out-and-grow click transition
 *      as a scene, just flying the render itself rather than one chosen
 *      item — see lib/launch.js. category-card.js calls it whenever it
 *      is present, scene or plain render alike.
 *   2. <slug>.json — the generated isometric animation, with <slug>.svg
 *                    as its resting frame.
 *   3. nothing     — an empty, harmless box.
 *
 * Nothing ever animates on its own. Frame 0 of every generated icon is
 * the rest pose, and the whole timeline is one hover gesture played by
 * `pop()`. A PNG icon's hover lift is plain CSS instead (:hover /
 * :focus-within on the card, easing back out the moment the pointer
 * leaves) — its `pop()` is a no-op kept only so callers don't need to
 * feature-detect which kind of icon they got. Scenes are the same rule
 * taken further: enter()/leave() are explicit calls a caller makes on
 * pointer/focus events, never a loop.
 *
 * Adding a real render is a drop-in: put <slug>.png in
 * src/assets/categories/ and it takes over. `npm run gen:lottie` skips
 * any category that has one, or that declares a scene.
 */
import { el, uniquifySvgIds } from '../lib/dom.js';
import { motion, onMotionChange } from '../lib/motion-guard.js';
import { getCategory } from '../lib/data.js';
import { createBasketScene } from './basket-scene.js';
import { launchAndNavigate } from '../lib/launch.js';

const SCENES = { basket: createBasketScene };

const ART_DIR = '../../assets/categories';

const RENDERS = import.meta.glob('../../assets/categories/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
});

const ANIMATIONS = import.meta.glob('../../assets/categories/*.json', {
  query: '?url',
  import: 'default',
  eager: true,
});

const POSTERS = import.meta.glob('../../assets/categories/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The generated files carry one marker: frame 0..48 is a hover gesture. */
const HOVER = [0, 48];

/** True when this category ships a real render rather than a generated icon. */
export const categoryRender = (slug) => RENDERS[`${ART_DIR}/${slug}.png`] ?? null;

let playerPromise = null;
const loadPlayer = () => {
  playerPromise ??= import('lottie-web/build/player/lottie_light.js').then(
    (mod) => mod.default ?? mod,
  );
  return playerPromise;
};

const idle = (fn) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 400);

export function createCategoryIcon({ slug, label = '', size = 120 }) {
  /* ---- 0. Interactive scene --------------------------------------- */

  const sceneKind = getCategory(slug)?.scene;
  const buildScene = sceneKind && SCENES[sceneKind];
  if (buildScene) return buildScene({ slug, label, size });

  const root = el('div', {
    class: 'category-icon',
    style: { width: `${size}px`, height: `${size}px` },
    dataset: { icon: slug },
    ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }),
  });

  /* ---- 1. Real render ------------------------------------------- */

  const render = categoryRender(slug);
  if (render) {
    const img = el('img', {
      class: 'category-icon__render',
      src: render,
      alt: '',
      loading: 'lazy',
      decoding: 'async',
      width: size,
      height: size,
    });
    root.append(img);
    root.dataset.kind = 'render';

    let launching = false;

    return {
      el: root,
      // The hover lift is plain CSS now (.category-icon__render's
      // :hover/:focus-within rule in main.scss) — it eases in and back
      // out on the same transition, so there is nothing for a one-shot
      // JS gesture to trigger here any more.
      pop() {},
      play() {},
      pause() {},
      /** Same fly-out-and-grow click as the interactive scenes — the
       *  card's own render, rather than one item chosen from a crate. */
      activate(href) {
        if (launching || !href) return;
        if (motion.reduced) {
          window.location.href = href;
          return;
        }
        launching = true;
        launchAndNavigate({ sourceEl: img, href });
      },
      destroy() {},
    };
  }

  /* ---- 2. Generated icon ---------------------------------------- */

  const poster = POSTERS[`${ART_DIR}/${slug}.svg`] ?? '';
  const url = ANIMATIONS[`${ART_DIR}/${slug}.json`];

  root.dataset.kind = 'generated';
  const posterLayer = el('div', { class: 'category-icon__poster', html: uniquifySvgIds(poster) });
  const stage = el('div', { class: 'category-icon__stage' });
  root.append(posterLayer, stage);

  let animation = null;
  let destroyed = false;
  let mounting = null;

  const mount = () => {
    if (animation || destroyed || !url || motion.reduced) return Promise.resolve();
    mounting ??= loadPlayer()
      .then((lottie) => {
        if (destroyed || animation) return;
        animation = lottie.loadAnimation({
          container: stage,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          path: url,
          rendererSettings: { progressiveLoad: true, hideOnTransparent: true },
        });
        animation.addEventListener('DOMLoaded', () => {
          if (destroyed) return;
          // Hold the rest pose. Nothing moves until pop() asks it to.
          animation.goToAndStop(0, true);
          root.classList.add('is-ready');
        });
      })
      .catch(() => {
        // The poster is already correct, so a failed player is not an error.
        root.classList.add('is-poster-only');
      });
    return mounting;
  };

  // Warm the player once the icon is on screen and the device can hover,
  // so the first hover is instant without costing touch visitors anything.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.disconnect();
        if (motion.hasHover && !motion.reduced) idle(mount);
      }
    },
    { rootMargin: '300px' },
  );
  observer.observe(root);

  const stopWatchingMotion = onMotionChange(() => {
    if (!motion.reduced || !animation) return;
    animation.destroy();
    animation = null;
    root.classList.remove('is-ready');
  });

  return {
    el: root,
    /** The one gesture these icons have: lift, tilt, settle back to rest. */
    pop() {
      if (motion.reduced) return;
      if (!animation) {
        mount()?.then(() => animation?.playSegments(HOVER, true));
        return;
      }
      animation.playSegments(HOVER, true);
    },
    play() {
      this.pop();
    },
    pause() {
      animation?.pause();
    },
    destroy() {
      destroyed = true;
      observer.disconnect();
      animation?.destroy();
      animation = null;
      stopWatchingMotion();
    },
  };
}
