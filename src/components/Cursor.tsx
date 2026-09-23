/**
 * Magnetic cursor.
 *
 * A lime dot that trails the pointer, snaps to interactive elements, and
 * expands into a labelled disc over product and category cards.
 *
 * Desktop pointers only, and never under reduced motion — on touch the
 * native cursor is the right answer and this never mounts. Portaled to
 * <body> so no transformed ancestor can trap its fixed positioning.
 */
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { t } from '../lib/i18n';
import { useMotionKey } from '../state/app-state';

const MAGNETIC = 'a, button, .site-nav__link, [data-magnetic]';
const LABELLED = '.product-card, .category-card, [data-cursor-label]';

export function Cursor() {
  const motionKey = useMotionKey();
  const dotRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const enabled = motion.hasHover && !motion.reduced;

  useGSAP(
    () => {
      const dot = dotRef.current;
      const label = labelRef.current;
      if (!dot || !label || !enabled) return;

      document.body.classList.add('has-cursor');
      const quickX = gsap.quickTo(dot, 'x', { duration: 0.35, ease: 'power3' });
      const quickY = gsap.quickTo(dot, 'y', { duration: 0.35, ease: 'power3' });

      let hidden = true;
      const onMove = (event: PointerEvent) => {
        if (hidden) {
          hidden = false;
          dot.classList.add('is-visible');
        }
        quickX(event.clientX);
        quickY(event.clientY);
      };

      const onOver = (event: PointerEvent) => {
        const target = event.target as Element | null;
        const labelled = target?.closest<HTMLElement>(LABELLED);
        if (labelled) {
          label.textContent = labelled.dataset.cursorLabel || t('product.view');
          dot.classList.add('is-labelled');
          dot.classList.remove('is-magnetic');
          return;
        }
        dot.classList.toggle('is-magnetic', Boolean(target?.closest(MAGNETIC)));
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
      document.documentElement.addEventListener('pointerleave', onLeave);

      return () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerover', onOver);
        window.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        document.body.classList.remove('has-cursor');
      };
    },
    { dependencies: [motionKey, enabled], revertOnUpdate: true },
  );

  if (!enabled) return null;

  return createPortal(
    <div className="cursor" aria-hidden="true" ref={dotRef}>
      <div className="cursor__ring" />
      <span className="cursor__label" ref={labelRef} />
    </div>,
    document.body,
  );
}
