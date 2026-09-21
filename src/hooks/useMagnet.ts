import { useRef, type RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';

/**
 * Pulls a button slightly toward the pointer while it is over it.
 * Applied to primary CTAs only — everywhere would be noise.
 *
 * Not built on useRig: the target is the element itself rather than a
 * container to query within, and it has no language dependency.
 */
export function useMagnet<T extends HTMLElement>(strength = 0.28): RefObject<T | null> {
  const ref = useRef<T>(null);

  useGSAP(
    () => {
      const node = ref.current;
      if (!node || !motion.hasHover || motion.reduced) return;

      const x = gsap.quickTo(node, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.5)' });
      const y = gsap.quickTo(node, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.5)' });

      const onMove = (event: PointerEvent) => {
        const rect = node.getBoundingClientRect();
        x((event.clientX - (rect.left + rect.width / 2)) * strength);
        y((event.clientY - (rect.top + rect.height / 2)) * strength);
      };
      const onLeave = () => {
        x(0);
        y(0);
      };

      node.addEventListener('pointermove', onMove);
      node.addEventListener('pointerleave', onLeave);
      return () => {
        node.removeEventListener('pointermove', onMove);
        node.removeEventListener('pointerleave', onLeave);
      };
    },
    { dependencies: [strength], revertOnUpdate: true },
  );

  return ref;
}
