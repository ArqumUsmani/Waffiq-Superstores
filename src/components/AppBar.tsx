/**
 * The phone app's pieces: a tab bar along the bottom of the screen, and the
 * offer to put Wafiq on the home screen.
 *
 * Both belong to the online store, so neither renders while it is switched
 * off. The tab bar is phone-only (CSS), and steps aside while the hero
 * fills the screen — the same rule the header follows.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Icon, type IconName } from './Icon';
import { t } from '../lib/i18n';
import { promptInstall, useInstall } from '../lib/install';
import { useLang } from '../state/app-state';
import { useAuth } from '../state/auth';
import { bagCount, useBag } from '../state/bag';
import { useShop } from '../state/shop';
import { useSectionNav } from '../hooks/useSectionNav';

export function AppTabBar({ onSearchOpen }: { onSearchOpen: () => void }) {
  useLang();
  const shop = useShop();
  const { user } = useAuth();
  const count = bagCount(useBag());
  const { pathname } = useLocation();
  const { go } = useSectionNav();

  /* Lets the rest of the page (the docked bag, back-to-top, the footer's
     bottom padding) make room. */
  useEffect(() => {
    const root = document.documentElement;
    if (shop.enabled) root.dataset.tabbar = '';
    else delete root.dataset.tabbar;
    return () => {
      delete root.dataset.tabbar;
    };
  }, [shop.enabled]);

  if (!shop.enabled) return null;

  const accountPath = user ? '/account' : '/login';
  const tab = (to: string, icon: IconName, label: string, current: boolean, badge?: number) => (
    <Link className={`tabbar__tab${current ? ' is-current' : ''}`} to={to} aria-current={current ? 'page' : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
      {badge ? <b className="tabbar__badge">{badge > 99 ? '99+' : badge}</b> : null}
    </Link>
  );

  return (
    <nav className="tabbar" aria-label={t('nav.menu')}>
      {tab('/', 'home', t('shop.app.home'), pathname === '/')}
      <a
        className={`tabbar__tab${pathname.startsWith('/aisle') || pathname.startsWith('/product') ? ' is-current' : ''}`}
        href="/#categories"
        onClick={(event) => {
          event.preventDefault();
          go('categories');
        }}
      >
        <Icon name="grid" />
        <span>{t('shop.app.aisles')}</span>
      </a>
      <button className="tabbar__tab" type="button" onClick={onSearchOpen}>
        <Icon name="search" />
        <span>{t('shop.app.search')}</span>
      </button>
      {tab('/cart', 'bag', t('shop.app.bag'), pathname === '/cart' || pathname === '/checkout', count)}
      {tab(accountPath, 'user', t('shop.app.account'), ['/account', '/login', '/lists'].includes(pathname) || pathname.startsWith('/order'))}
    </nav>
  );
}

const DISMISSED = 'wafiq:install-dismissed';

/** A card offering to install the app. Renders nothing where that is not possible, or already done. */
export function InstallCard() {
  useLang();
  const install = useInstall();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed || install.installed || (!install.ready && !install.ios)) return null;

  return (
    <aside className="notice install-card">
      <img src="/icons/icon-192.png" alt="" width={48} height={48} />
      <div>
        <strong>{t('shop.app.install')}</strong>
        <p>{install.ios ? t('shop.app.installIos') : t('shop.app.installBody')}</p>
      </div>
      <div className="install-card__actions">
        {install.ready ? (
          <button className="btn btn--solid btn--sm" type="button" onClick={() => void promptInstall()}>
            {t('shop.app.installCta')}
          </button>
        ) : null}
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISSED, '1');
            } catch {
              /* it will just be offered again next visit */
            }
          }}
        >
          {t('shop.app.later')}
        </button>
      </div>
    </aside>
  );
}
