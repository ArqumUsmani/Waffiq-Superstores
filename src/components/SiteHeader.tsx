import { useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import logoOnLight from '../assets/logo/logo-on-light.svg?url';
import logoOnDark from '../assets/logo/logo-on-dark.svg?url';
import { Icon } from './Icon';
import { NAV } from './nav-model';
import { rafThrottle } from '../lib/dom';
import { t, toggleLang } from '../lib/i18n';
import { toggleTheme } from '../lib/theme';
import { toggleMuted } from '../lib/sfx';
import { useLang, useTheme } from '../state/app-state';
import { useSectionNav } from '../hooks/useSectionNav';
import { useMuted } from '../hooks/useMuted';

const isMac = () => /mac/i.test(navigator.platform ?? navigator.userAgent);

/**
 * How far down the hero you have to be before the bar comes back. The same
 * figure the stuck background uses, so it arrives already styled rather
 * than fading its backdrop in a moment later.
 */
const REVEAL_AT = 80;

interface Props {
  onSearchOpen: () => void;
  onMenuOpen: () => void;
  menuOpen: boolean;
}

export function SiteHeader({ onSearchOpen, onMenuOpen, menuOpen }: Props) {
  const lang = useLang();
  const theme = useTheme();
  const { active, go } = useSectionNav();
  const muted = useMuted();

  const headerRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);

  /* The hero owns the top of the home page on its own; everywhere else the
     bar is present from the start. */
  const { pathname } = useLocation();
  const overHero = pathname === '/';

  /* Scroll state is written straight to the DOM — this fires on every
     scroll frame, and routing it through setState would re-render the
     whole header 60 times a second for a class toggle and a transform. */
  const sync = useRef<() => void>(() => {});
  sync.current = () => {
    const y = window.scrollY;
    const header = headerRef.current;
    if (header) {
      header.classList.toggle('is-stuck', y > REVEAL_AT);
      header.classList.toggle('is-hidden', overHero && y <= REVEAL_AT);
    }

    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progressRef.current) {
      progressRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    }
  };

  /* Re-applied after every render as well as on scroll. The classes live
     outside React, so any re-render — a theme flip, a section becoming
     current — would otherwise wipe them off the element. */
  useLayoutEffect(() => {
    sync.current();
  });

  useEffect(() => {
    const onScroll = rafThrottle(() => sync.current());
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dark = theme === 'dark';

  return (
    <header className="site-header" id="site-header" ref={headerRef}>
      <div className="site-header__inner shell">
        <Link className="brand" to="/" aria-label={t('brand.name')}>
          {/* Named for the background they sit on: the "on-dark" file is the
              white lettering, so it is the one dark mode wants. The link
              already carries the name, so the image itself is decorative. */}
          <img
            className="brand__logo"
            src={dark ? logoOnDark : logoOnLight}
            alt=""
            width={220}
            height={63}
          />
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
            onClick={toggleMuted}
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
