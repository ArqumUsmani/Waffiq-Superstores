import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { launch, type LaunchHandle } from '../lib/launch';
import { motion } from '../lib/motion-guard';
import { getLenis, lockScroll } from '../lib/smooth-scroll';
import { navFlags } from '../lib/nav-flags';

export interface Arrival {
  slug: string;
  /** The art that flew, so the aisle header can enter from the same image. */
  srcUrl?: string;
  pastel?: string;
}

interface LaunchTo {
  slug: string;
  sourceEl: HTMLElement;
  pastel?: string;
  rotate?: number;
}

interface LaunchApi {
  launchTo: (options: LaunchTo) => void;
  /** One-shot: returns the pending arrival and clears it. */
  takeArrival: () => Arrival | null;
}

const LaunchContext = createContext<LaunchApi | null>(null);

export const useLaunch = (): LaunchApi => {
  const api = useContext(LaunchContext);
  if (!api) throw new Error('useLaunch must be used inside <LaunchProvider>');
  return api;
};

export function LaunchProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const busy = useRef(false);
  const handle = useRef<LaunchHandle | null>(null);
  const arrival = useRef<Arrival | null>(null);
  /** The location key we ourselves navigated to, so foreign navs are detectable. */
  const ownKey = useRef<string | null>(null);

  /* If the route changes mid-flight and it was not our own commit — a back
     button, a nav link, a search result — abandon the transition rather
     than leaving a flood frozen over the new page. */
  useEffect(() => {
    if (!busy.current) return;
    if (ownKey.current === location.key) return;
    handle.current?.kill();
    handle.current = null;
    busy.current = false;
    arrival.current = null;
    lockScroll(false);
    getLenis()?.start();
  }, [location.key]);

  const launchTo = ({ slug, sourceEl, pastel, rotate = 0 }: LaunchTo) => {
    const href = `/aisle/${slug}`;

    if (motion.reduced) {
      navigate(href);
      return;
    }
    if (busy.current) return;
    busy.current = true;

    const img = sourceEl instanceof HTMLImageElement ? sourceEl : null;
    arrival.current = { slug, srcUrl: img?.currentSrc || img?.src, pastel };

    lockScroll(true);

    handle.current = launch({
      sourceEl,
      pastel,
      rotate,
      onCover: () => {
        /* Order matters: stop Lenis, reset scroll, then commit. Scrolling
           after the commit would be visible the moment the flood lifts. */
        /* Reset through Lenis, not window.scrollTo: Lenis keeps its own
           scroll position, and a raw native reset leaves it holding the old
           value, which it re-applies on the next resize or start(). */
        const lenis = getLenis();
        if (lenis) {
          lenis.scrollTo(0, { immediate: true, force: true });
          lenis.stop();
        } else {
          window.scrollTo(0, 0);
        }
        navFlags.skipScrollReset = true;
        navigate(href);
        queueMicrotask(() => {
          ownKey.current = window.history.state?.key ?? null;
        });
      },
      onDone: () => {
        busy.current = false;
        handle.current = null;
        lockScroll(false);
        getLenis()?.start();
      },
    });
  };

  const takeArrival = () => {
    const pending = arrival.current;
    arrival.current = null;
    return pending;
  };

  return (
    <LaunchContext.Provider value={{ launchTo, takeArrival }}>{children}</LaunchContext.Provider>
  );
}
