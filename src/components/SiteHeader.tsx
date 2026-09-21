import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import monogram from '../assets/logo/monogram.svg?raw';
import { Icon } from './Icon';
import { NAV } from './nav-model';
import { rafThrottle } from '../lib/dom';
import { t, toggleLang } from '../lib/i18n';
import { toggleTheme } from '../lib/theme';
import { isMuted, toggleMuted } from '../lib/sfx';
import { useLang, useTheme } from '../state/app-state';
import { useSectionNav } from '../hooks/useSectionNav';

const isMac = () => /mac/i.test(navigator.platform ?? navigator.userAgent);

interface Props {
  onSearchOpen: () => void;
  onMenuOpen: () => void;
  menuOpen: boolean;
}

export function SiteHeader({ onSearchOpen, onMenuOpen, menuOpen }: Props) {
  const lang = useLang();
  const theme = useTheme();
  const { active, go } = useSectionNav();
  const [muted, setMuted] = useState(isMuted);

  const headerRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);

  /* Scroll state is written straight to the DOM — this fires on every
     scroll frame, and routing it through setState would re-render the
     whole header 60 times a second for a class toggle and a transform. */
  useEffect(() => {
    const onScroll = rafThrottle(() => {
      const y = window.scrollY;
      headerRef.current?.classList.toggle('is-stuck', y > 80);

      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      }
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dark = theme === 'dark';

  return (
    <header className="site-header" id="site-header" ref={headerRef}>
      <div className="site-header__inner shell">
        <Link className="brand" to="/" aria-label={t('brand.name')}>
          <span className="brand__badge" dangerouslySetInnerHTML={{ __html: monogram }} />
          <span className="brand__text">
            <span className="brand__name">{t('brand.short')}</span>
            <span className="brand__sub">Superstores</span>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.id}
              className={`site-nav__link${item.id === active ? ' is-current' : ''}`}
              href={`#${item.id}`}
              aria-current={item.id === active ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                go(item.id);
              }}
            >
              {t(item.key)}
            </a>
          ))}
        </nav>

        <div className="site-header__actions">
          <button
            className="search-trigger"
            type="button"
            onClick={onSearchOpen}
            aria-label={t('nav.search')}
          >
            <Icon name="search" />
            <span className="search-trigger__label">{t('search.open')}</span>
            <kbd className="search-trigger__kbd">{isMac() ? '⌘' : 'Ctrl'} K</kbd>
          </button>

          <button
            className={`icon-btn${muted ? ' is-muted' : ''}`}
            type="button"
            onClick={() => {
              toggleMuted();
              setMuted(isMuted());
            }}
            /* aria-pressed tracks "is sound on", the opposite of the muted
               flag — matching how the theme toggle reads "is dark". */
            aria-pressed={!muted}
            aria-label={t(muted ? 'sound.toOn' : 'sound.toOff')}
          >
            <span className="icon-btn__swap icon-btn__swap--sound">
              <Icon name="soundOn" className="ico--sound-on" />
              <Icon name="soundOff" className="ico--sound-off" />
            </span>
          </button>

          <button
            className="icon-btn"
            type="button"
            onClick={toggleTheme}
            aria-pressed={dark}
            aria-label={t(dark ? 'theme.toLight' : 'theme.toDark')}
          >
            <span className="icon-btn__swap">
              <Icon name="sun" className="ico--sun" />
              <Icon name="moon" className="ico--moon" />
            </span>
          </button>

          <button
            className="lang-toggle"
            type="button"
            onClick={toggleLang}
            aria-label={t('lang.label')}
          >
            {/* Shows the language you would switch *to*. */}
            <span className="lang-toggle__value">{lang === 'ur' ? 'English' : 'اردو'}</span>
          </button>

          <button
            className="icon-btn icon-btn--menu"
            type="button"
            onClick={onMenuOpen}
            aria-label={t('nav.menu')}
            aria-expanded={menuOpen}
          >
            <Icon name="menu" />
          </button>
        </div>
      </div>
      <div className="scroll-progress" aria-hidden="true">
        <span ref={progressRef} />
      </div>
    </header>
  );
}
