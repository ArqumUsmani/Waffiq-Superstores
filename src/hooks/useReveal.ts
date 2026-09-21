/**
 * Scroll reveals, scoped to a container.
 *
 * Two deliberate changes from the vanilla build:
 *
 * 1. The `data-revealed` attribute guard is gone. It existed because
 *    `refreshScene()` re-scanned the whole document after every render, so
 *    nodes had to remember they were done. Here each container owns its own
 *    effect and each element instance passes through exactly once, so the
 *    flag is unnecessary — and actively harmful: `ctx.revert()` restores the
 *    recorded `opacity: 0`, and a still-flagged node would never get a new
 *    trigger to animate it back. That combination is a permanently blank
 *    grid after a language switch.
 *
 * 2. No global scope. `refreshScene()` is not ported.
 */
import { gsap, ScrollTrigger } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { dirFactor } from '../lib/dom';
import { totals } from '../lib/data';
import { useRig } from './useRig';

/** `[data-count-key="aisles"]` reads live from data.ts so tiles never go stale. */
const STAT_KEYS: Record<string, keyof typeof totals> = {
  aisles: 'categories',
  shelves: 'subcategories',
  products: 'products',
  brands: 'brands',
};

export function useReveal<T extends HTMLElement = HTMLDivElement>(deps: unknown[] = []) {
  return useRig<T>((root) => {
    /* ---- [data-reveal]: rise + fade, batched ---- */
    const targets = [...root.querySelectorAll<HTMLElement>('[data-reveal]')];
    if (targets.length) {
      if (motion.reduced) {
        gsap.set(targets, { opacity: 1, y: 0, clearProps: 'transform' });
      } else {
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
    }

    /* ---- [data-shelf-rule]: the lime rule drawing under a row ---- */
    const rules = [...root.querySelectorAll<HTMLElement>('[data-shelf-rule]')];
    if (rules.length) {
      if (motion.reduced) {
        gsap.set(rules, { scaleX: 1 });
      } else {
        for (const rule of rules) {
          gsap.set(rule, {
            scaleX: 0,
            transformOrigin: dirFactor() > 0 ? 'left center' : 'right center',
          });
          gsap.to(rule, {
            scaleX: 1,
            duration: 1.1,
            ease: 'power2.inOut',
            scrollTrigger: { trigger: rule, start: 'top 92%', once: true },
          });
        }
      }
    }

    /* ---- [data-count] / [data-count-key]: numbers counting up ---- */
    for (const node of root.querySelectorAll<HTMLElement>('[data-count-key]')) {
      const field = STAT_KEYS[node.dataset.countKey ?? ''];
      if (field) node.dataset.count = String(totals[field]);
    }

    for (const node of root.querySelectorAll<HTMLElement>('[data-count]')) {
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
  }, deps);
}
