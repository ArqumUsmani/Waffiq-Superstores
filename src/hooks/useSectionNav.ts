import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { scrollTo } from '../lib/smooth-scroll';
import { NAV } from '../components/nav-model';

/**
 * Drives the primary nav: which section is currently in view, and what a
 * click should do.
 *
 * On home a click smooth-scrolls. From an aisle page it routes home first,
 * then scrolls once the section has actually mounted.
 */
export function useSectionNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [active, setActive] = useState('home');

  useEffect(() => {
    if (!isHome) {
      setActive('');
      return;
    }

    const sections = NAV.map((item) => document.getElementById(item.id)).filter(
      (node): node is HTMLElement => node !== null,
    );
    if (!sections.length) return;

    // Whichever tracked section is nearest the top of the viewport wins.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [isHome, location.key]);

  const go = useCallback(
    (id: string) => {
      const target = document.getElementById(id);
      if (isHome && target) {
        scrollTo(target);
        return;
      }
      // Coming from an aisle page: land home, then scroll once it is there.
      navigate('/');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const landed = document.getElementById(id);
          if (landed) scrollTo(landed);
        });
      });
    },
    [isHome, navigate],
  );

  return { active, go, isHome };
}
