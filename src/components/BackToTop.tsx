import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { rafThrottle } from '../lib/dom';
import { scrollTo } from '../lib/smooth-scroll';
import { t } from '../lib/i18n';
import { useLang } from '../state/app-state';

export function BackToTop() {
  useLang();
  const ref = useRef<HTMLButtonElement>(null);

  /* Visibility is a class toggle written on the scroll frame, not state —
     same reasoning as the header's .is-stuck. */
  useEffect(() => {
    const onScroll = rafThrottle(() => {
      ref.current?.classList.toggle('is-visible', window.scrollY > window.innerHeight);
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      className="back-to-top"
      type="button"
      ref={ref}
      aria-label={t('common.backToTop')}
      onClick={() => scrollTo(0, { offset: 0 })}
    >
      <Icon name="up" />
    </button>
  );
}
