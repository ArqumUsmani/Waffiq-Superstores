import { useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { SiteHeader } from './SiteHeader';
import { Drawer } from './Drawer';
import { SiteFooter } from './SiteFooter';
import { BackToTop } from './BackToTop';
import { Background } from './Background';
import { LaunchProvider } from './LaunchProvider';
import { ScrollTrigger } from '../lib/gsap-setup';
import { getLenis, initSmoothScroll } from '../lib/smooth-scroll';
import { initSfxUnlock } from '../lib/sfx';
import { syncDocumentLang, t } from '../lib/i18n';
import { navFlags } from '../lib/nav-flags';
import { useLang } from '../state/app-state';

/** Nastaliq is a heavy face — only fetch it when Urdu is actually in use. */
let urduFontLoaded = false;
async function ensureUrduFont(lang: string) {
  if (urduFontLoaded || lang !== 'ur') return;
  urduFontLoaded = true;
  await import('@fontsource/noto-nastaliq-urdu/arabic-600.css');
}

export function Layout() {
  const lang = useLang();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  /* Boot: one Lenis for the app's life, one sfx unlock listener. Both are
     idempotent, so StrictMode's double-mount is harmless. */
  useEffect(() => {
    syncDocumentLang();
    history.scrollRestoration = 'manual';
    initSmoothScroll();
    initSfxUnlock();
  }, []);

  useEffect(() => {
    void ensureUrduFont(lang);
  }, [lang]);

  /* Reset scroll before the new route's rigs measure anything. Layout
     effect, so it lands before paint. */
  useLayoutEffect(() => {
    if (navFlags.skipScrollReset) {
      navFlags.skipScrollReset = false;
      return;
    }
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }, [location.key]);

  /* One refresh per route change, at the root, deferred two frames so the
     new page has painted. Per-component refresh() calls are deliberately
     not ported — N components meant N full recalcs per transition. */
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => ScrollTrigger.refresh()),
    );
    return () => cancelAnimationFrame(id);
  }, [location.key]);

  const openSearch = () => setSearchOpen(true);

  return (
    <>
      <Background />

      <a className="skip-link" href="#main">
        {t('nav.skip')}
      </a>

      <SiteHeader
        onSearchOpen={openSearch}
        onMenuOpen={() => setMenuOpen(true)}
        menuOpen={menuOpen}
      />

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} onSearchOpen={openSearch} />

      <main id="main">
        <LaunchProvider>
          <Outlet />
        </LaunchProvider>
      </main>

      <SiteFooter onSearchOpen={openSearch} />
      <BackToTop />

      {/* Phase 6 replaces this with the real palette. */}
      {searchOpen ? <SearchStub onClose={() => setSearchOpen(false)} /> : null}
    </>
  );
}

function SearchStub({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return null;
}
