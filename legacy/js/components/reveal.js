/**
 * Scroll reveals: anything with [data-reveal] rises and fades in once,
 * batched so a grid of forty cards costs one trigger rather than forty.
 *
 * Under reduced motion the elements are simply shown — no observer, no
 * transforms, no delay before content is readable.
 */
import { gsap, ScrollTrigger } from '../lib/gsap-setup.js';
import { motion } from '../lib/motion-guard.js';
import { $$, dirFactor } from '../lib/dom.js';
import { totals } from '../lib/data.js';

export function initReveals(scope = document) {
  const targets = $$('[data-reveal]', scope).filter((node) => !node.dataset.revealed);
  if (!targets.length) return;

  for (const node of targets) node.dataset.revealed = 'true';

  if (motion.reduced) {
    gsap.set(targets, { opacity: 1, y: 0, clearProps: 'transform' });
    return;
  }

  gsap.set(targets, { opacity: 0, y: 28 });

  ScrollTrigger.batch(targets, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: { each: 0.055, from: 'start' },
        overwrite: true,
      }),
  });
}

/**
 * The lime rule that draws under a product row as it arrives —
 * the "shelf filling" idea from the design.
 */
export function initShelfRules(scope = document) {
  const rules = $$('[data-shelf-rule]', scope);
  if (!rules.length) return;

  if (motion.reduced) {
    gsap.set(rules, { scaleX: 1 });
    return;
  }

  for (const rule of rules) {
    gsap.set(rule, { scaleX: 0, transformOrigin: dirFactor() > 0 ? 'left center' : 'right center' });
    gsap.to(rule, {
      scaleX: 1,
      duration: 1.1,
      ease: 'power2.inOut',
      scrollTrigger: { trigger: rule, start: 'top 92%', once: true },
    });
  }
}

/** [data-count-key="aisles"] etc. reads live from lib/data.js's `totals`,
 * so stat tiles never go stale when a category is added or removed. */
const STAT_KEYS = {
  aisles: 'categories',
  shelves: 'subcategories',
  products: 'products',
  brands: 'brands',
};

function resolveCountKeys(scope) {
  for (const node of $$('[data-count-key]', scope)) {
    const field = STAT_KEYS[node.dataset.countKey];
    if (field) node.dataset.count = String(totals[field]);
  }
}

/**
 * Counts a number up when it scrolls into view.
 * Reads the target from [data-count] (or [data-count-key], resolved
 * above), so the markup stays the source of truth.
 */
export function initCounters(scope = document) {
  resolveCountKeys(scope);

  const counters = $$('[data-count]', scope);
  if (!counters.length) return;

  for (const node of counters) {
    const target = Number(node.dataset.count);
    if (!Number.isFinite(target)) continue;

    if (motion.reduced) {
      node.textContent = String(target);
      continue;
    }

    const state = { value: 0 };
    node.textContent = '0';

    gsap.to(state, {
      value: target,
      duration: 1.4,
      ease: 'power2.out',
      scrollTrigger: { trigger: node, start: 'top 90%', once: true },
      onUpdate: () => {
        node.textContent = String(Math.round(state.value));
      },
    });
  }
}
