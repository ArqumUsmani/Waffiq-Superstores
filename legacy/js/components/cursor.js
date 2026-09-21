/**
 * Magnetic cursor.
 *
 * A lime dot that trails the pointer, snaps to interactive elements, and
 * expands into a labelled disc over product and category cards.
 *
 * Desktop pointers only, and never under reduced motion — on touch the
 * native cursor is the right answer and this never mounts.
 */
import { el } from '../lib/dom.js';
import { gsap } from '../lib/gsap-setup.js';
import { motion } from '../lib/motion-guard.js';
import { t } from '../lib/i18n.js';

const MAGNETIC = 'a, button, .site-nav__link, [data-magnetic]';
const LABELLED = '.product-card, .category-card, [data-cursor-label]';

export function initCursor() {
  if (!motion.hasHover || motion.reduced) return null;

  const dot = el('div', { class: 'cursor', 'aria-hidden': 'true' });
  const ring = el('div', { class: 'cursor__ring' });
  const label = el('span', { class: 'cursor__label' });
  dot.append(ring, label);
  document.body.append(dot);
  document.body.classList.add('has-cursor');

  const quickX = gsap.quickTo(dot, 'x', { duration: 0.35, ease: 'power3' });
  const quickY = gsap.quickTo(dot, 'y', { duration: 0.35, ease: 'power3' });

  let hidden = true;

  const onMove = (event) => {
    if (hidden) {
      hidden = false;
      dot.classList.add('is-visible');
    }
    quickX(event.clientX);
    quickY(event.clientY);
  };

  const onOver = (event) => {
    const labelled = event.target.closest(LABELLED);
    if (labelled) {
      label.textContent = labelled.dataset.cursorLabel || t('product.view');
      dot.classList.add('is-labelled');
      dot.classList.remove('is-magnetic');
      return;
    }

    const magnetic = event.target.closest(MAGNETIC);
    dot.classList.toggle('is-magnetic', Boolean(magnetic));
    dot.classList.remove('is-labelled');
  };

  const onLeave = () => {
    hidden = true;
    dot.classList.remove('is-visible');
  };

  const onDown = () => dot.classList.add('is-down');
  const onUp = () => dot.classList.remove('is-down');

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerover', onOver, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  return {
    destroy() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerleave', onLeave);
      dot.remove();
      document.body.classList.remove('has-cursor');
    },
  };
}

/**
 * Pulls a button slightly toward the pointer while it is over it.
 * Applied to primary CTAs only — everywhere would be noise.
 */
export function attachMagnet(node, strength = 0.28) {
  if (!motion.hasHover || motion.reduced) return;

  const x = gsap.quickTo(node, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.5)' });
  const y = gsap.quickTo(node, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.5)' });

  node.addEventListener('pointermove', (event) => {
    const rect = node.getBoundingClientRect();
    x((event.clientX - (rect.left + rect.width / 2)) * strength);
    y((event.clientY - (rect.top + rect.height / 2)) * strength);
  });

  node.addEventListener('pointerleave', () => {
    x(0);
    y(0);
  });
}
