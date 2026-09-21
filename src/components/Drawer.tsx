import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import monogram from '../assets/logo/monogram.svg?raw';
import { Icon } from './Icon';
import { NAV } from './nav-model';
import { t } from '../lib/i18n';
import { lockScroll } from '../lib/smooth-scroll';
import { useLang } from '../state/app-state';
import { useSectionNav } from '../hooks/useSectionNav';

interface Props {
  open: boolean;
  onClose: () => void;
  onSearchOpen: () => void;
}

/**
 * Mobile nav sheet. Portaled to <body> because it sits at z-120 and must
 * not inherit a transformed ancestor — `position: fixed` inside one
 * resolves against that ancestor instead of the viewport.
 */
export function Drawer({ open, onClose, onSearchOpen }: Props) {
  useLang();
  const { go } = useSectionNav();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    document.body.classList.toggle('has-drawer', open);
    lockScroll(open);

    if (open) {
      lastFocused.current = document.activeElement as HTMLElement | null;
      const id = requestAnimationFrame(() => {
        panelRef.current?.querySelector<HTMLAnchorElement>('.drawer__link')?.focus();
      });
      return () => {
        cancelAnimationFrame(id);
        document.body.classList.remove('has-drawer');
        lockScroll(false);
      };
    }

    lastFocused.current?.focus?.();
    return undefined;
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="drawer"
      id="drawer"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="drawer__scrim" onClick={onClose} />
      <div
        className="drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.menu')}
        ref={panelRef}
      >
        <div className="drawer__head">
          <span className="brand__badge" dangerouslySetInnerHTML={{ __html: monogram }} />
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('nav.close')}>
            <Icon name="close" />
          </button>
        </div>

        <nav className="drawer__nav" aria-label="Mobile">
          {NAV.map((item, i) => (
            <a
              key={item.id}
              className="drawer__link"
              style={{ '--i': i } as React.CSSProperties}
              href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault();
                onClose();
                go(item.id);
              }}
            >
              {t(item.key)}
            </a>
          ))}
        </nav>

        <button
          className="btn btn--ghost drawer__search"
          type="button"
          onClick={() => {
            onClose();
            onSearchOpen();
          }}
        >
          <Icon name="search" />
          <span>{t('search.open')}</span>
        </button>

        <p className="drawer__note">{t('footer.note')}</p>
      </div>
    </div>,
    document.body,
  );
}
