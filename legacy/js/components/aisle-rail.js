/**
 * "Walk the aisle" — the home page's category scene.
 *
 * On desktop the section pins and vertical scroll is converted into
 * horizontal travel past nine aisle stops; the centred aisle scales up
 * and tints the backdrop. Icons stay still unless hovered.
 *
 * Below 1024px, or under reduced motion, the very same markup becomes a
 * native scroll-snap carousel — no pinning, no scroll hijack, nothing to
 * get stuck inside.
 */
import { $, $$, el, escapeHtml, dirFactor } from '../lib/dom.js';
import { gsap, ScrollTrigger } from '../lib/gsap-setup.js';
import { motion, onMotionChange } from '../lib/motion-guard.js';
import { categories, countInCategory } from '../lib/data.js';
import { createCategoryIcon } from './category-icon.js';
import { t, pick } from '../lib/i18n.js';

const TOUCH_LIFT_HOLD_MS = 350;

/** Adds a `<link rel="prefetch">` for `href` at most once per page. */
function prefetch(href) {
  if (document.head.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
  document.head.append(el('link', { rel: 'prefetch', href }));
}

function panel(category, index) {
  const href = `/category.html?cat=${encodeURIComponent(category.slug)}`;

  const node = el('article', {
    class: 'aisle',
    dataset: { aislePanel: category.slug, index: String(index) },
    style: { '--pastel': category.pastel, '--accent': category.accent },
  });

  const icon = createCategoryIcon({ slug: category.slug, size: 200 });

  const shelves = category.subcategories
    .map((sub) => `<li>${escapeHtml(pick(sub, 'en'))}</li>`)
    .join('');

  const body = el('div', { class: 'aisle__body' });
  body.innerHTML = `
    <p class="aisle__index">${String(index + 1).padStart(2, '0')}</p>
    <h3 class="aisle__name">${escapeHtml(pick(category, 'en'))}</h3>
    <p class="aisle__blurb">${escapeHtml(pick(category, 'blurbEn'))}</p>
    <ul class="aisle__shelves">${shelves}</ul>
    <a class="btn btn--solid aisle__cta" href="${href}">
      ${escapeHtml(t('aisle.open'))}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6"/>
      </svg>
    </a>
    <p class="aisle__count">
      <strong>${countInCategory(category.slug)}</strong> ${escapeHtml(t('aisle.products'))}
      <span aria-hidden="true">·</span>
      <strong>${category.subcategories.length}</strong> ${escapeHtml(t('aisle.shelves'))}
    </p>
  `;

  const stage = el('div', { class: 'aisle__stage' }, icon.el);
  node.append(stage, body);

  if (icon.activate) attachLaunchPanel(node, body.querySelector('.aisle__cta'), icon, href);

  return { node, icon, category };
}

/**
 * Same activate() routing as category-card.js, scoped to this panel: the
 * panel itself owns hover (it is not a link), while the "Open aisle"
 * anchor inside it owns focus, blur and the click that actually
 * navigates. `icon.enter?.()` throughout: a scene gets its hover
 * choreography, a plain render just skips straight to activate().
 */
function attachLaunchPanel(node, cta, icon, href) {
  let lastPointerType = 'mouse';

  node.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    prefetch(href);
    icon.enter?.();
  });
  node.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    icon.leave?.();
  });

  if (!cta) return;

  cta.addEventListener('pointerdown', (event) => {
    lastPointerType = event.pointerType;
  });
  cta.addEventListener('focus', () => {
    prefetch(href);
    icon.enter?.({ silent: true });
  });
  cta.addEventListener('blur', () => icon.leave?.({ silent: true }));

  cta.addEventListener('click', (event) => {
    event.preventDefault();

    if (lastPointerType === 'touch' && !motion.reduced && icon.enter) {
      icon.enter();
      window.setTimeout(() => icon.activate(href), TOUCH_LIFT_HOLD_MS);
      return;
    }

    icon.activate(href);
  });
}

export function initAisleRail(root = $('[data-aisle-rail]')) {
  if (!root) return () => {};

  const track = $('[data-aisle-track]', root);
  const dots = $('[data-aisle-dots]', root);
  const built = categories.map((category, i) => panel(category, i));

  // Re-entrant: a language switch rebuilds the rail from scratch.
  track.replaceChildren(...built.map((item) => item.node));

  // Icons are still, and only move when a pointer asks them to. A scene
  // panel already wired its own hover in attachLaunchPanel above — this
  // generic listener is for everything else, including a plain render
  // that has activate() (the click transition) but no enter() to hover.
  for (const item of built) {
    if (item.icon.enter) continue;
    item.node.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') item.icon.pop();
    });
  }

  if (dots) {
    dots.innerHTML = categories
      .map(
        (category, i) =>
          `<button type="button" class="aisle-dot" data-go="${i}"
             style="--accent:${category.accent}"
             aria-label="${escapeHtml(category.en)}"></button>`,
      )
      .join('');
  }

  const dotNodes = $$('.aisle-dot', root);
  let active = -1;

  const setActive = (index) => {
    if (index === active) return;
    active = index;

    built.forEach((item, i) => {
      item.node.classList.toggle('is-active', i === index);
    });

    dotNodes.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
      dot.setAttribute('aria-current', String(i === index));
    });

    const category = categories[index];
    if (category) {
      root.style.setProperty('--rail-pastel', category.pastel);
      root.style.setProperty('--rail-accent', category.accent);
    }
  };

  setActive(0);

  let context = null;
  let observer = null;

  /** Desktop: pin the section and scrub the track sideways. */
  const buildPinned = () => {
    context = gsap.context(() => {
      const distance = () => track.scrollWidth - root.clientWidth + 80;

      const tween = gsap.to(track, {
        x: () => -distance() * dirFactor(),
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            setActive(Math.round(self.progress * (built.length - 1)));
          },
        },
      });

      root.dataset.mode = 'pinned';
      return () => tween.kill();
    }, root);
  };

  /** Touch and reduced motion: plain snap carousel, active state from scroll position. */
  const buildCarousel = () => {
    root.dataset.mode = 'carousel';

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio > 0.6) {
            setActive(Number(entry.target.dataset.index));
          }
        }
      },
      { root: track, threshold: [0.6] },
    );

    for (const item of built) observer.observe(item.node);
  };

  const teardown = () => {
    context?.revert();
    context = null;
    observer?.disconnect();
    observer = null;
    gsap.set(track, { clearProps: 'transform' });
  };

  const build = () => {
    teardown();
    if (motion.allowScenes) buildPinned();
    else buildCarousel();
  };

  build();

  const stopWatching = onMotionChange(() => {
    build();
    ScrollTrigger.refresh();
  });

  // Dots jump the carousel; in pinned mode they scroll the page to that stop.
  dots?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-go]');
    if (!button) return;
    const index = Number(button.dataset.go);

    if (root.dataset.mode === 'carousel') {
      built[index].node.scrollIntoView({
        behavior: motion.reduced ? 'auto' : 'smooth',
        inline: 'center',
        block: 'nearest',
      });
      return;
    }

    const trigger = ScrollTrigger.getAll().find((st) => st.pin === root);
    if (!trigger) return;
    const ratio = index / (built.length - 1);
    window.scrollTo({
      top: trigger.start + (trigger.end - trigger.start) * ratio,
      behavior: motion.reduced ? 'auto' : 'smooth',
    });
  });

  return () => {
    stopWatching();
    teardown();
    for (const item of built) item.icon.destroy();
  };
}
