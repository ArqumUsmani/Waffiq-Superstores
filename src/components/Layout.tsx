import { useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { SiteHeader } from './SiteHeader';
import { Drawer } from './Drawer';
import { SiteFooter } from './SiteFooter';
import { BackToTop } from './BackToTop';
import { Background } from './Background';
import { LaunchProvider } from './LaunchProvider';
import { SearchPalette } from './SearchPalette';
import { Cursor } from './Cursor';
import { ScrollTrigger } from '../lib/gsap-setup';
import { getLenis, initSmoothScroll, scrollTo } from '../lib/smooth-scroll';
import { initSfxUnlock } from '../lib/sfx';
import { initAmbience } from '../lib/ambience';
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
    /* Silent until the first gesture unlocks the graph; initAmbience
       subscribes and starts itself at that point. */
    return initAmbience();
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
     not ported — N components meant N full recalcs per transition.

     A hash target (/#branches from another route) is scrolled to *after*
     the refresh, never alongside it: refresh() restores the scroll position
     it recorded, and the pinned aisle rail's spacer only reaches its real
     height during refresh — any offset measured earlier is short by
     thousands of pixels. */
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        /* Lenis caches the scroll limit and clamps to it. Its resize
           observer has not seen the new document yet, so without this a
           jump to a section on a taller page stops at the *previous*
           page's bottom edge. */
        getLenis()?.resize();
        const id = location.hash.slice(1);
        const target = id ? document.getElementById(id) : null;
        if (target) scrollTo(target, { immediate: true });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash]);

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

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
      {/* Last, so it paints above every other body-level layer. */}
      <Cursor />
    </>
  );
}
