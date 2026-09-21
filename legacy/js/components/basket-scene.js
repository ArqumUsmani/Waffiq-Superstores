/**
 * Interactive crate scene — the first of the site's "living" category
 * icons. Data-driven from scene.json, so the same engine can later run a
 * different container (a bag, a shelf) just by pointing at another
 * manifest; only Fruits & Vegetables ("basket") exists today.
 *
 * Behaviour:
 *   enter()  — produce lifts out of the crate, one item at a time on a
 *              random height and a random stagger, then holds still.
 *   leave()  — everything falls back in, staggered, with a small
 *              landing bounce.
 *   activate(href) — a random item flies out of the crate and grows to
 *              fill the view, then the page navigates.
 *
 * Nothing moves on its own: idle is idle. A pickup/drop sound plays on
 * enter/leave (see lib/sfx.js) except when triggered "silently" (keyboard
 * focus) or under prefers-reduced-motion, where enter/leave/the fly-out
 * are skipped entirely and activate() navigates immediately.
 *
 * Real photography drops in at src/assets/scenes/<slug>/ — a container
 * or item file wins over its generated .svg stand-in the moment it
 * exists; scripts/gen-scene-placeholders.mjs never overwrites either.
 */
import { el } from '../lib/dom.js';
import { gsap } from '../lib/gsap-setup.js';
import { motion } from '../lib/motion-guard.js';
import { pickup, drop } from '../lib/sfx.js';
import { launchAndNavigate } from '../lib/launch.js';

const SCENES_DIR = '../../assets/scenes';

const MANIFESTS = import.meta.glob('../../assets/scenes/*/scene.json', {
  eager: true,
  import: 'default',
});

// Real art (.png/.webp) and the generated .svg stand-in share one glob so
// whichever exists resolves the same way — the file system decides, not
// a runtime fetch/fallback dance.
const CONTAINER_FILES = import.meta.glob('../../assets/scenes/*/*.{png,webp,svg}', {
  eager: true,
  import: 'default',
  query: '?url',
});
const ITEM_FILES = import.meta.glob('../../assets/scenes/*/items/*.{png,webp,svg}', {
  eager: true,
  import: 'default',
  query: '?url',
});

const EXT_PRIORITY = ['png', 'webp', 'svg'];

function resolveArt(map, dir, base) {
  for (const ext of EXT_PRIORITY) {
    const hit = map[`${dir}/${base}.${ext}`];
    if (hit) return hit;
  }
  return null;
}

export const getSceneManifest = (slug) => MANIFESTS[`${SCENES_DIR}/${slug}/scene.json`] ?? null;

export const resolveContainerArt = (slug, name) =>
  resolveArt(CONTAINER_FILES, `${SCENES_DIR}/${slug}`, name);

export const resolveItemArt = (slug, itemId) =>
  resolveArt(ITEM_FILES, `${SCENES_DIR}/${slug}/items`, itemId);

export function createBasketScene({ slug, label = '', size = 120 }) {
  const manifest = getSceneManifest(slug);

  const root = el('div', {
    class: 'basket-scene',
    style: { width: `${size}px`, height: `${size}px` },
    dataset: { icon: slug },
    ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }),
  });

  if (!manifest) {
    // Missing manifest is a build problem, not a visitor-facing one —
    // render an empty, harmless box rather than throwing during paint.
    return { el: root, pop() {}, destroy() {} };
  }

  const containerUrl = resolveContainerArt(slug, manifest.container);
  const shadow = el('span', { class: 'basket-scene__shadow', 'aria-hidden': 'true' });
  const back = el('img', {
    class: 'basket-scene__container basket-scene__container--back',
    src: containerUrl, alt: '', loading: 'lazy', decoding: 'async',
  });
  const itemLayer = el('div', { class: 'basket-scene__items' });
  const lip = el('img', {
    class: 'basket-scene__container basket-scene__container--lip',
    src: containerUrl, alt: '', loading: 'lazy', decoding: 'async',
    style: { clipPath: manifest.frontClip ?? 'none' },
  });

  // Crate and produce ride together in one group that floats above the
  // ground shadow and turns a few degrees on hover; the shadow stays
  // outside it, on the floor. The turn itself is a CSS transition keyed
  // off `.is-lifted` rather than a tween, so it composes with — instead
  // of fighting — GSAP's per-item transforms further down the tree.
  const tilt = el('div', { class: 'basket-scene__tilt' }, back, itemLayer, lip);

  root.append(shadow, tilt);

  const liftMin = manifest.lift?.min ?? 0.16;
  const liftMax = manifest.lift?.max ?? 0.36;
  const lipClearance = manifest.lipClearancePct ?? 0.05;

  const items = manifest.items.map((spec, index) => {
    // Two layers, deliberately: `wrapper` owns static placement (position
    // percentages, the anchor translate, the item's fixed rest tilt) via
    // plain CSS and is never touched by GSAP. `lift` is GSAP's exclusive
    // target for y/rotate/scale — if the two shared one element, GSAP's
    // transform writes would overwrite the CSS anchor transform outright
    // rather than compose with it.
    // `front: true` in the manifest parks a piece permanently above the
    // crate's front lip instead of behind it — produce spilling over the
    // near rail, which is what stops the lip's clip line reading as an
    // unnaturally clean diagonal cut across every item in the front row.
    const wrapper = el('span', {
      class: 'basket-item',
      style: {
        '--x': `${spec.x}%`,
        '--y': `${spec.y}%`,
        '--size': `${spec.size}%`,
        '--rest-rotate': `${spec.rotate}deg`,
        zIndex: String((spec.front ? 60 : 20) + index),
      },
    });
    const itemShadow = el('span', { class: 'basket-item__shadow' });
    const lift = el('span', { class: 'basket-item__lift' });
    const art = el('img', {
      class: 'basket-item__art',
      src: resolveItemArt(slug, spec.id),
      alt: '', loading: 'lazy', decoding: 'async',
    });
    lift.append(art);
    wrapper.append(itemShadow, lift);
    itemLayer.append(wrapper);

    return { spec, wrapper, lift, art, shadow: itemShadow, lifted: false };
  });

  let lifted = false;
  let launching = false;

  const stageHeight = () => root.getBoundingClientRect().height || size;

  // A full crate is a lot of items; a fixed per-item delay would make the
  // last one start most of a second after the first. Spread the same
  // total window over however many the manifest declares.
  const stagger = Math.min(55, 620 / Math.max(items.length, 1));

  /** Flips an item between the rest z-band and the in-front-of-the-lip band. */
  function watchLipCrossing(item) {
    // A `front` piece already sits above the lip and never crosses it.
    if (item.spec.front) return undefined;
    const threshold = -stageHeight() * lipClearance;
    return () => {
      const y = gsap.getProperty(item.lift, 'y');
      const inFront = y < threshold;
      if (inFront === item.lifted) return;
      item.lifted = inFront;
      item.wrapper.classList.toggle('is-in-front', inFront);
    };
  }

  function settleCrate() {
    gsap.fromTo(
      back,
      { scaleY: 0.985, transformOrigin: '50% 100%' },
      { scaleY: 1, duration: 0.32, ease: 'power2.out', overwrite: 'auto' },
    );
  }

  /** Produce rises out of the crate, staggered and to random heights, then holds. */
  function enter({ silent = false } = {}) {
    if (motion.reduced || launching) return;
    lifted = true;
    root.classList.add('is-lifted');
    settleCrate();
    if (!silent) pickup();

    // Only the top of the pile floats off on any one hover. Lifting a
    // packed crate all at once just looks like an empty crate with a
    // cloud above it, and lifting a uniformly random set tears holes in
    // the middle of the heap. Scoring by how high a piece already sits
    // (its box top) keeps the lower layers seated and the crate stocked;
    // the jitter is wide enough that no two hovers choose the same set.
    const order = items
      .map((item) => ({ item, score: item.spec.y - item.spec.size + Math.random() * 26 }))
      .sort((a, b) => a.score - b.score)
      .map((entry) => entry.item);
    const floaters = Math.max(1, Math.round(order.length * (0.4 + Math.random() * 0.18)));

    order.forEach((item, i) => {
      const h = stageHeight();
      const floats = i < floaters;
      // Each item's own rest position caps how far it may rise: an item
      // reaches from its base up by its own size, so the ones already
      // heaped above the crate's back rim get a short lift while the
      // front row still has room to pop. The constant is deliberate
      // slack — the card does not clip and produce drifting a little
      // past its top is the point — and the jitter stops every clamped
      // item from stopping on the same invisible ceiling.
      const headroom = Math.max(
        0.08,
        (item.spec.y - item.spec.size + 2 + Math.random() * 5) / 100,
      );
      // Biased toward the low end, so even among the floaters most rise
      // modestly and only a few really climb.
      const reach = liftMin + Math.random() ** 1.5 * (liftMax - liftMin);
      const rise = -(floats ? Math.min(reach, headroom) : 0.004 + Math.random() * 0.014) * h;
      // A delta on top of the wrapper's own fixed rest tilt, not a
      // replacement for it — `lift` carries no base rotation of its own.
      const wobble = (Math.random() < 0.5 ? -1 : 1) * Math.random() * (floats ? 8 : 3);
      const delay = (i * stagger + Math.random() * 90) / 1000;
      const duration = 0.55 + Math.random() * 0.2;

      gsap.to(item.lift, {
        y: rise,
        rotate: wobble,
        scale: floats ? 1.04 : 1.01,
        duration,
        delay,
        ease: 'back.out(1.6)',
        overwrite: 'auto',
        onUpdate: watchLipCrossing(item),
      });

      gsap.to(item.shadow, {
        scale: floats ? 0.55 : 0.9,
        opacity: floats ? 0.12 : 0.28,
        duration,
        delay,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    });
  }

  /** Everything falls back into the crate with a small landing bounce. */
  function leave({ silent = false } = {}) {
    if (motion.reduced || launching || !lifted) return;
    lifted = false;
    root.classList.remove('is-lifted');
    if (!silent) drop();

    for (const item of items) {
      const delay = Math.random() * 0.12;

      gsap.to(item.lift, {
        y: 0,
        rotate: 0,
        scale: 1,
        duration: 0.3,
        delay,
        ease: 'power3.in',
        overwrite: 'auto',
        onUpdate: watchLipCrossing(item),
        onComplete: () => {
          item.lifted = false;
          item.wrapper.classList.remove('is-in-front');
          gsap.fromTo(
            item.lift,
            { scaleX: 1.05, scaleY: 0.92 },
            { scaleX: 1, scaleY: 1, duration: 0.18, ease: 'power2.out' },
          );
        },
      });

      gsap.to(item.shadow, {
        scale: 1,
        opacity: 0.35,
        duration: 0.3,
        delay,
        ease: 'power3.in',
        overwrite: 'auto',
      });
    }
  }

  /** A random item flies out of the crate and grows to fill the view. */
  function activate(href) {
    if (launching) return;
    if (!href) return;

    if (motion.reduced) {
      window.location.href = href;
      return;
    }

    launching = true;
    const chosen = items[Math.floor(Math.random() * items.length)];

    // Everyone else drops back fast; the scene fades into the background
    // as the chosen item takes over.
    for (const item of items) {
      if (item === chosen) continue;
      gsap.to(item.lift, { y: 0, scale: 1, duration: 0.25, ease: 'power3.in', overwrite: 'auto' });
      gsap.to(item.shadow, { opacity: 0, duration: 0.25, overwrite: 'auto' });
    }
    gsap.to([back, lip], { opacity: 0.4, scale: 0.94, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });

    chosen.shadow.style.opacity = '0';

    // `cloneNode` copies the <img> alone, not the ancestor transforms that
    // were actually tilting it (the wrapper's fixed rest tilt plus
    // whatever wobble `lift` settled on) — launchAndNavigate's rect read
    // already captures that rotation's effect on size/position, but not
    // the rotation itself, so the clone would start upright unless told
    // otherwise.
    const restRotation = chosen.spec.rotate + (gsap.getProperty(chosen.lift, 'rotate') || 0);

    // Both callers (category-card.js, aisle-rail.js) already set --pastel
    // on an ancestor of this icon, so launchAndNavigate inherits it
    // rather than needing it threaded through as a prop.
    launchAndNavigate({
      sourceEl: chosen.art,
      href,
      rotate: restRotation,
      beforeNavigate: () => {
        try {
          sessionStorage.setItem('wafiq:scene-hero', chosen.spec.id);
        } catch {
          /* private mode — the category page just shows the plain scene */
        }
      },
    });
  }

  return {
    el: root,
    /** Keyboard-focus equivalent — a brief silent lift, no sound, no hold. */
    pop() {
      if (motion.reduced) return;
      enter({ silent: true });
    },
    enter,
    leave,
    activate,
    play() {
      enter();
    },
    pause() {
      leave({ silent: true });
    },
    destroy() {
      gsap.killTweensOf(items.map((i) => i.wrapper));
      gsap.killTweensOf(items.map((i) => i.shadow));
      gsap.killTweensOf(back);
    },
  };
}
