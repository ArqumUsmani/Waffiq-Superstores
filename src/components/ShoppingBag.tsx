/**
 * The shopping bag.
 *
 * Adding an item: the bag pops up from the bottom of the screen, the item's
 * picture arcs into its mouth with a rustle, and the bag glides off to dock
 * in the bottom-left corner. Each add replays that, and the bag comes back
 * bigger every time, up to a maximum.
 *
 * Scrolling down to the footer: the footer has a Wafiq bag of its own. As it
 * comes into view the docked bag flies over and takes its place — the
 * footer's bag fades out — and follows it while the footer is on screen.
 *
 * Clicking the bag brings it to the middle of the screen with a pair of
 * scissors on its left and a dashed line across its bottom. Clicking the
 * scissors (or pressing them from the keyboard) sends them along the line;
 * the bottom tears away and everything inside drops out, scatters across
 * the screen and fades.
 *
 * One bag element does all of it. Its position is always described by the
 * bottom-centre point of its box, and the box is a fixed BASE square scaled
 * to the size wanted — so moving and growing are a single tween on x, y and
 * scale, and the bottom edge (where the cut runs) never drifts.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { rafThrottle } from '../lib/dom';
import { lockScroll } from '../lib/smooth-scroll';
import { bagPlace, bagSnip, bagSpill } from '../lib/sfx';
import {
  bagCount,
  currentBagCount,
  emptyBag,
  onBagAdd,
  useBag,
  type BagAddEvent,
  type BagItem,
} from '../state/bag';

const BAG_SRC = '/assets/footer-bag.webp';

/**
 * The bag element's unscaled box, in px. Everything else scales from it.
 * Larger than any size the bag is shown at (the footer's 349px is the most),
 * so it is only ever scaled down. Scaling a smaller box up stretches the
 * bitmap the browser drew it at, and the bag goes soft.
 */
const BASE = 360;

/**
 * Where the bag actually is inside its square image (720px, measured from
 * the alpha channel of footer-bag.webp, rendered from shopping-bag.svg): the
 * rest is transparent padding. The tote's body spans 31%-87% of the height;
 * above it are the handles, below it the narrowing bottom panel.
 */
const ART = { left: 122 / 720, right: 584 / 720, top: 24 / 720, bottom: 697 / 720 };
/** How far down the box the bag's opening is — where items go in (the top of the body). */
const MOUTH = 0.34;
/** Where the scissors cut across, as a fraction of the box height — the front face, just above its bottom edge. */
const CUT = 0.84;

/* The bag grows with every item until GROW_CAP, then holds at its largest.
   Beyond that the docked bag would start covering the page it sits beside. */
const GROW_CAP = 10;
const DOCK_MIN = 76;
const DOCK_MAX = 176;
const dockSize = (count: number) =>
  DOCK_MIN + ((DOCK_MAX - DOCK_MIN) * Math.min(count, GROW_CAP)) / GROW_CAP;
const popSize = (count: number) => Math.min(dockSize(count) * 1.7, window.innerHeight * 0.45, 300);
const openSize = () => Math.min(340, window.innerWidth * 0.62, window.innerHeight * 0.55);

/* In the footer the bag stands in for the footer's own bag. It grows with
   what is in it, like the docked bag — the footer bag's own size with one
   item, up to FOOTER_MAX times it at GROW_CAP. Kept modest: the tote fills
   most of its frame, so a large multiple dwarfs the footer. */
const FOOTER_MAX = 1.3;
const footerScale = (count: number) => 1 + ((FOOTER_MAX - 1) * Math.min(count, GROW_CAP)) / GROW_CAP;

/* More than this many falling sprites buries the screen and drops frames. */
const MAX_SPILL = 28;
/**
 * The torn edge where the bag splits: a zigzag along the cut line, as
 * clip-path polygons. The top part keeps everything above it, the bottom
 * part everything below, so assembled they meet with no gap — and when the
 * bottom falls away the bag is left with a ragged edge, not a ruler-straight
 * one. Teeth are uneven on purpose; a regular zigzag reads as pinking shears.
 */
const TEAR = (() => {
  const teeth = [0, 1.4, -0.6, 1.1, -1, 0.8, -0.4, 1.5, -0.9, 0.5, -1.2, 1, -0.3, 1.3, -0.8, 0.6, -1.1, 0.9, -0.5, 1.2, 0];
  const pts = teeth.map((d, i) => `${((i / (teeth.length - 1)) * 100).toFixed(2)}% ${(CUT * 100 + d).toFixed(2)}%`);
  return {
    top: `polygon(0 0, 100% 0, ${[...pts].reverse().join(', ')})`,
    bottom: `polygon(${pts.join(', ')}, 100% 100%, 0 100%)`,
  };
})();

interface Spot {
  /** Bottom-centre of the box. */
  cx: number;
  by: number;
  size: number;
}

/** gsap vars that put the box's bottom-centre at a point, at a size. */
const at = ({ cx, by, size }: Spot) => ({ x: cx - BASE / 2, y: by - BASE, scale: size / BASE });

/** The art's bottom sits above the box's bottom; this lifts a spot by that. */
const artDrop = (size: number) => (1 - ART.bottom) * size;

const dockSpot = (count: number): Spot => {
  const size = dockSize(count);
  return {
    /* The bag's own left edge, not its box's, sits 16px from the side. */
    cx: 16 + (0.5 - ART.left) * size,
    by: window.innerHeight - 16 + artDrop(size),
    size,
  };
};
const popSpot = (count: number): Spot => {
  const size = popSize(count);
  return { cx: window.innerWidth / 2, by: window.innerHeight - 28 + artDrop(size), size };
};
const openSpot = (): Spot => {
  const size = openSize();
  return { cx: window.innerWidth / 2, by: window.innerHeight / 2 + size / 2, size };
};
/** Just out of sight below the screen, under a given x. */
const belowSpot = (cx: number, size: number): Spot => ({ cx, by: window.innerHeight + size + 24, size });

/**
 * The footer's own bag, if it is on the page — same image, so same box. Its
 * size comes from layout, not from its on-screen rectangle: the footer bag
 * floats with a slight rotation, which inflates the bounding box.
 */
const footerSpot = (): Spot | null => {
  const art = document.querySelector<HTMLElement>('.site-footer__bag');
  if (!art) return null;
  const rect = art.getBoundingClientRect();
  const size = art.offsetWidth;
  /* Anchored at the footer bag's bottom, so the bigger bag sits on the
     panel edge in the same place and grows upward into the space the
     footer already leaves above itself. */
  return {
    cx: rect.left + rect.width / 2,
    by: rect.top + rect.height / 2 + size / 2,
    size: size * footerScale(currentBagCount()),
  };
};

/** The cut line across the open bag, in screen coordinates. */
const cutLine = () => {
  const spot = openSpot();
  return {
    y: spot.by - (1 - CUT) * spot.size,
    left: spot.cx - (0.5 - ART.left) * spot.size,
    right: spot.cx + (ART.right - 0.5) * spot.size,
    spot,
  };
};

type Phase = 'hidden' | 'docked' | 'footer' | 'rising' | 'out' | 'returning' | 'open' | 'spilling';

/** A loose picture of an item, for flying in or spilling out. */
function makeSprite(item: BagItem, size: number): HTMLElement {
  const sprite = document.createElement(item.image ? 'img' : 'span');
  sprite.className = 'bag-sprite';
  if (item.image) {
    (sprite as HTMLImageElement).src = item.image;
    (sprite as HTMLImageElement).alt = '';
  } else {
    sprite.textContent = item.emoji;
    sprite.style.fontSize = `${size * 0.7}px`;
  }
  sprite.style.width = `${size}px`;
  sprite.style.height = `${size}px`;
  sprite.setAttribute('aria-hidden', 'true');
  document.body.append(sprite);
  return sprite;
}

export function ShoppingBag() {
  const items = useBag();
  const count = bagCount(items);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const rootRef = useRef<HTMLDivElement>(null);
  const bagRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLSpanElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const countLabelRef = useRef<HTMLParagraphElement>(null);
  const scissorsRef = useRef<HTMLButtonElement>(null);
  const bladeTopRef = useRef<SVGGElement>(null);
  const bladeBottomRef = useRef<SVGGElement>(null);
  const slitRef = useRef<HTMLSpanElement>(null);

  const phase = useRef<Phase>('hidden');
  const rising = useRef<Promise<void> | null>(null);
  const inFlight = useRef(0);
  const returnTimer = useRef<number>(0);
  const footerInView = useRef(false);
  const follow = useRef<((spot: Spot) => void) | null>(null);

  /* How far the cut has got, 0-1, and whether one is under way. */
  const progress = useRef(0);
  const cutting = useRef(false);

  const [open, setOpen] = useState(false);
  const [spilling, setSpilling] = useState(false);
  const [announce, setAnnounce] = useState('');

  const { contextSafe } = useGSAP({ scope: rootRef });

  /* ---------------- resting places: the corner and the footer ---------------- */

  const setInFooter = (inFooter: boolean) => {
    const root = document.documentElement;
    if (inFooter) root.dataset.bagInFooter = '';
    else delete root.dataset.bagInFooter;
  };

  /** Puts the bag where it rests: the footer if that is in view, else the corner. */
  const settle = contextSafe((instant = true) => {
    const bag = bagRef.current;
    if (!bag) return;
    const n = currentBagCount();
    if (n === 0) {
      gsap.set(bag, { autoAlpha: 0, ...at(belowSpot(80, dockSize(0))) });
      phase.current = 'hidden';
      setInFooter(false);
      return;
    }

    const footer = footerInView.current ? footerSpot() : null;
    if (footer) {
      phase.current = 'footer';
      setInFooter(true);
      gsap.set(bag, { autoAlpha: 1 });
      follow.current?.(footer);
      return;
    }

    phase.current = 'docked';
    setInFooter(false);
    const spot = dockSpot(n);
    if (instant) gsap.set(bag, { autoAlpha: 1, ...at(spot) });
    else gsap.to(bag, { autoAlpha: 1, ...at(spot), duration: 0.65, ease: 'power3.inOut' });
  });

  useEffect(() => {
    const bag = bagRef.current;
    if (!bag) return undefined;
    gsap.set(bag, { transformOrigin: '50% 100%' });

    /* In the footer the bag rides along with the page, so its target moves
       every scroll frame. quickTo eases toward wherever it now is — which is
       also what carries it over from the corner in the first place. */
    const toX = gsap.quickTo(bag, 'x', { duration: 0.5, ease: 'power3.out' });
    const toY = gsap.quickTo(bag, 'y', { duration: 0.5, ease: 'power3.out' });
    /* scaleX and scaleY separately: quickTo drives one real property, and
       `scale` is a shorthand it silently does nothing with. */
    const toScaleX = gsap.quickTo(bag, 'scaleX', { duration: 0.5, ease: 'power3.out' });
    const toScaleY = gsap.quickTo(bag, 'scaleY', { duration: 0.5, ease: 'power3.out' });
    follow.current = (spot) => {
      const vars = at(spot);
      toX(vars.x);
      toY(vars.y);
      toScaleX(vars.scale);
      toScaleY(vars.scale);
    };

    settle(true);

    const onScroll = rafThrottle(() => {
      if (phase.current !== 'footer') return;
      const spot = footerSpot();
      if (spot) follow.current?.(spot);
    });
    const onResize = () => {
      if (phase.current === 'docked' || phase.current === 'hidden' || phase.current === 'footer') settle(true);
      else if (phase.current === 'open') gsap.set(bag, at(openSpot()));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(returnTimer.current);
      setInFooter(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Watch the footer. Once it starts to come into view the bag goes and
     takes the footer bag's place, riding along with it — even as that spot
     scrolls up out of sight — until the footer leaves the screen again. The
     footer is part of the layout, so it is on every route; it is looked up
     again after each navigation. */
  const { pathname } = useLocation();
  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    const frame = requestAnimationFrame(() => {
      const footer = document.querySelector('.site-footer');
      if (!footer) return;
      observer = new IntersectionObserver(
        ([entry]) => {
          footerInView.current = Boolean(entry?.isIntersecting);
          /* Only between the two resting places — never mid-flight or open. */
          if (phase.current === 'docked' && footerInView.current) settle();
          else if (phase.current === 'footer' && !footerInView.current) settle(false);
        },
        /* A little of the footer first, so the bag does not lurch over at
           the first sliver of it. */
        { rootMargin: '0px 0px -15% 0px' },
      );
      observer.observe(footer);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      footerInView.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* On a phone the hero fills the screen and its marquee runs along the
     bottom; the bag tucks away below the edge while most of the hero is on
     screen, and comes back once the visitor scrolls on (CSS, keyed off this
     attribute). Watched from here, so the hero needs no knowledge of it. */
  useEffect(() => {
    const root = document.documentElement;
    let observer: IntersectionObserver | null = null;
    const frame = requestAnimationFrame(() => {
      const hero = document.querySelector('.hero-scene');
      if (!hero) return;
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry && entry.isIntersecting && entry.intersectionRatio >= 0.6) root.dataset.bagAvoid = 'hero';
          else delete root.dataset.bagAvoid;
        },
        { threshold: [0, 0.6] },
      );
      observer.observe(hero);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      delete root.dataset.bagAvoid;
    };
  }, [pathname]);

  /* ---------------- adding ---------------- */

  /** Brings the bag up from the bottom of the screen, ready to catch. */
  const ensureOut = contextSafe((): Promise<void> => {
    const bag = bagRef.current;
    if (!bag) return Promise.resolve();
    window.clearTimeout(returnTimer.current);
    if (phase.current === 'out') return Promise.resolve();
    if (phase.current === 'rising' && rising.current) return rising.current;

    gsap.killTweensOf(bag);
    const n = currentBagCount();
    const pop = popSpot(n);
    const from = phase.current;
    phase.current = 'rising';
    setInFooter(false);

    rising.current = new Promise<void>((done) => {
      const tl = gsap.timeline({
        onComplete: () => {
          phase.current = 'out';
          done();
        },
      });
      /* Out of its resting place first, so the bag rises from the bottom
         rather than sliding across. */
      if (from === 'docked' || from === 'returning') {
        const dock = dockSpot(Math.max(n - 1, 1));
        tl.to(bag, { ...at(belowSpot(dock.cx, dock.size)), duration: 0.2, ease: 'power2.in' });
      } else if (from === 'footer') {
        tl.to(bag, { autoAlpha: 0, duration: 0.15 });
      }
      tl.set(bag, { autoAlpha: 1, rotation: 0, ...at(belowSpot(pop.cx, pop.size)) });
      tl.to(bag, { ...at(pop), duration: 0.45, ease: 'back.out(1.6)' });
    });
    return rising.current;
  });

  /** After the last item lands, the bag glides back to where it rests. */
  const scheduleReturn = contextSafe(() => {
    window.clearTimeout(returnTimer.current);
    returnTimer.current = window.setTimeout(() => {
      if (inFlight.current > 0 || phase.current !== 'out') return;
      const bag = bagRef.current;
      if (!bag) return;
      if (footerInView.current) {
        settle();
        return;
      }
      phase.current = 'returning';
      const spot = dockSpot(currentBagCount());
      gsap.to(bag, {
        ...at(spot),
        duration: 0.7,
        ease: 'power3.inOut',
        onComplete: () => {
          phase.current = 'docked';
          /* A small settle as it sticks. */
          gsap.fromTo(bag, { rotation: 4 }, { rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
        },
      });
    }, 550);
  });

  /* Every add: fly the item's picture into the bag. */
  useEffect(
    () =>
      onBagAdd(
        contextSafe(async ({ item, from }: BagAddEvent) => {
          setAnnounce(`${item.name} added to your bag.`);
          const bag = bagRef.current;
          if (!bag) return;

          if (motion.reduced || !from) {
            bagPlace();
            settle(true);
            return;
          }

          inFlight.current += 1;
          await ensureOut();

          const pop = popSpot(currentBagCount());
          /* The bag may have grown since it rose; ease it to the new size. */
          gsap.to(bag, { ...at(pop), duration: 0.3, ease: 'power2.out' });

          const startSize = Math.min(from.width, from.height, 140);
          const sprite = makeSprite(item, startSize);
          const startX = from.left + from.width / 2 - startSize / 2;
          const startY = from.top + from.height / 2 - startSize / 2;
          const endSize = pop.size * 0.3;
          const mouthX = pop.cx - startSize / 2;
          const mouthY = pop.by - (1 - MOUTH) * pop.size - startSize / 2;
          /* Arc over: up above whichever end is higher, then down in. */
          const peakY = Math.min(startY, mouthY) - Math.max(80, window.innerHeight * 0.12);

          gsap.set(sprite, { x: startX, y: startY, transformOrigin: '50% 50%' });
          const tl = gsap.timeline({
            onComplete: () => {
              sprite.remove();
              inFlight.current -= 1;
              scheduleReturn();
            },
          });
          tl.to(sprite, { x: mouthX, duration: 0.7, ease: 'power1.inOut' }, 0)
            .to(sprite, { y: peakY, duration: 0.33, ease: 'power2.out' }, 0)
            .to(sprite, { y: mouthY, duration: 0.37, ease: 'power2.in' }, 0.33)
            .to(sprite, { scale: endSize / startSize, rotation: gsap.utils.random(-25, 25), duration: 0.7, ease: 'power1.in' }, 0)
            /* In: down past the rim and out of sight. */
            .add(() => bagPlace(), 0.68)
            .to(sprite, { y: mouthY + pop.size * 0.18, scale: (endSize * 0.55) / startSize, autoAlpha: 0, duration: 0.18, ease: 'power2.in' }, 0.7)
            .fromTo(bag, { scaleY: (pop.size / BASE) * 0.9, scaleX: (pop.size / BASE) * 1.05 }, { scaleY: pop.size / BASE, scaleX: pop.size / BASE, duration: 0.45, ease: 'elastic.out(1, 0.45)' }, 0.76);
        }),
      ),
    [contextSafe, ensureOut, settle, scheduleReturn],
  );

  /* ---------------- open and close ---------------- */

  /** Scissors at rest: on the bag's left, level with its middle. */
  const scissorsHome = () => {
    const scissors = scissorsRef.current;
    const { spot, left } = cutLine();
    return {
      x: left - (scissors?.offsetWidth ?? 120) - 28,
      y: spot.by - spot.size * 0.55,
    };
  };

  const resetCut = () => {
    progress.current = 0;
    cutting.current = false;
    if (slitRef.current) gsap.set(slitRef.current, { width: 0, autoAlpha: 0 });
  };

  const openBag = contextSafe(() => {
    const bag = bagRef.current;
    if (!bag || (phase.current !== 'docked' && phase.current !== 'footer')) return;
    phase.current = 'open';
    setInFooter(false);
    resetCut();
    setOpen(true);
    lockScroll(true);
    gsap.killTweensOf(bag);
    gsap.to(bag, { ...at(openSpot()), rotation: 0, duration: motion.reduced ? 0 : 0.6, ease: 'power3.out' });
  });

  const closeBag = contextSafe(() => {
    if (phase.current !== 'open') return;
    lockScroll(false);
    setOpen(false);
    resetCut();
    settle(motion.reduced);
    bagRef.current?.focus();
  });

  /* The scene's pieces settle in once it has rendered. */
  useEffect(() => {
    if (!open) return undefined;
    const scissors = scissorsRef.current;
    const scene = sceneRef.current;
    const { spot } = cutLine();
    /* Where the bag's own bottom is, so the hint sits right under it. */
    scene?.style.setProperty('--bag-bottom', `${spot.by - artDrop(spot.size)}px`);
    if (!scissors) return undefined;

    gsap.set(scissors, { ...scissorsHome(), rotation: 0 });
    scissors.focus();
    if (motion.reduced) return undefined;

    /* Opacity, not autoAlpha: autoAlpha hides it with visibility, and a
       hidden element cannot keep the focus it was just given. */
    gsap.from(scissors, { opacity: 0, x: '-=60', duration: 0.5, delay: 0.25, ease: 'back.out(1.7)' });
    /* An idle snip now and then, so it reads as something to pick up. */
    const idle = gsap.timeline({ repeat: -1, repeatDelay: 1.4, delay: 1 });
    idle
      .to(bladeTopRef.current, { rotation: -16, svgOrigin: '60 30', duration: 0.14 })
      .to(bladeBottomRef.current, { rotation: 16, svgOrigin: '60 30', duration: 0.14 }, '<')
      .to([bladeTopRef.current, bladeBottomRef.current], { rotation: 0, svgOrigin: '60 30', duration: 0.12 });
    return () => {
      idle.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !spilling) closeBag();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, spilling, closeBag]);

  /* ---------------- cutting ---------------- */

  /** One close of the blades, with its snip. */
  const snip = contextSafe(() => {
    /* The sound goes with the call, not on a timeline callback: a delayed
       callback could fire after the cut had finished and the bag spilled. */
    bagSnip();
    gsap.killTweensOf([bladeTopRef.current, bladeBottomRef.current]);
    gsap
      .timeline()
      .to(bladeTopRef.current, { rotation: -20, svgOrigin: '60 30', duration: 0.06, ease: 'power2.out' })
      .to(bladeBottomRef.current, { rotation: 20, svgOrigin: '60 30', duration: 0.06, ease: 'power2.out' }, '<')
      .to([bladeTopRef.current, bladeBottomRef.current], { rotation: 0, svgOrigin: '60 30', duration: 0.07, ease: 'power3.in' });
  });

  /** Left edge of the scissors that puts their blade tips at a screen x. */
  const scissorsXForTip = (tipX: number) => tipX - (scissorsRef.current?.offsetWidth ?? 120) * 0.92;

  /** The slit grows to however far the blades have reached. Never shrinks. */
  const showProgress = (reached: number) => {
    const { left, right, y } = cutLine();
    progress.current = Math.max(progress.current, Math.min(1, Math.max(0, reached)));
    gsap.set(slitRef.current, {
      x: left,
      y: y - 2,
      width: progress.current * (right - left),
      autoAlpha: 1,
    });
  };

  /** The bottom gives way: everything drops out and scatters. */
  const spill = contextSafe(() => {
    const bag = bagRef.current;
    const scissors = scissorsRef.current;
    if (!bag || phase.current !== 'open') return;
    phase.current = 'spilling';
    setSpilling(true);

    const { spot, y: cutY } = cutLine();
    const finish = () => {
      emptyBag();
      setSpilling(false);
      setOpen(false);
      lockScroll(false);
      phase.current = 'hidden';
      setAnnounce('Your bag is empty.');
      /* Only what GSAP moved — 'all' would also wipe the torn-edge clip-path. */
      if (bottomRef.current) gsap.set(bottomRef.current, { clearProps: 'transform,opacity,visibility' });
      if (markRef.current) gsap.set(markRef.current, { clearProps: 'opacity,visibility' });
    };

    if (motion.reduced) {
      gsap.set(bag, { autoAlpha: 0 });
      finish();
      return;
    }

    const tl = gsap.timeline({ onComplete: finish });
    tl.add(() => bagSpill(), 0)
      .to(scissors, { autoAlpha: 0, x: '+=60', duration: 0.3 }, 0)
      .to([slitRef.current, markRef.current], { autoAlpha: 0, duration: 0.2 }, 0)
      .to(bottomRef.current, { y: 90, rotation: 18, autoAlpha: 0, duration: 0.7, ease: 'power2.in' }, 0)
      .to(bag, { rotation: -3, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0);

    const units: BagItem[] = [];
    for (const item of itemsRef.current) for (let q = 0; q < item.qty; q += 1) units.push(item);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    units.slice(0, MAX_SPILL).forEach((item, index) => {
      const size = gsap.utils.random(52, 84);
      const sprite = makeSprite(item, size);
      const fromX = spot.cx + gsap.utils.random(-0.18, 0.18) * spot.size - size / 2;
      const fromY = cutY - size * 0.6;
      const toX = gsap.utils.random(vw * 0.05, vw * 0.95 - size);
      const toY = gsap.utils.random(vh * 0.6, vh * 0.92 - size);
      const start = index * 0.035;
      gsap.set(sprite, { x: fromX, y: fromY, rotation: gsap.utils.random(-30, 30), autoAlpha: 0 });
      tl.set(sprite, { autoAlpha: 1 }, start)
        .to(sprite, { x: toX, duration: gsap.utils.random(1.1, 1.5), ease: 'power2.out' }, start)
        .to(sprite, { y: fromY - gsap.utils.random(30, 110), duration: 0.22, ease: 'power2.out' }, start)
        .to(sprite, { y: toY, duration: gsap.utils.random(0.9, 1.2), ease: 'bounce.out' }, start + 0.22)
        .to(sprite, { rotation: `+=${gsap.utils.random(-420, 420)}`, duration: 1.3, ease: 'power2.out' }, start)
        .to(sprite, { autoAlpha: 0, scale: 0.7, duration: 0.45, onComplete: () => sprite.remove() }, 2.1 + start);
    });

    /* The empty bag folds away, and the room goes back to normal. */
    tl.to(bag, { autoAlpha: 0, scale: (spot.size / BASE) * 0.85, duration: 0.5, ease: 'power2.in' }, 1.1).to(
      [backdropRef.current, countLabelRef.current],
      { autoAlpha: 0, duration: 0.6 },
      1.9,
    );
  });

  /** Clicking the scissors (or pressing them from the keyboard) makes the whole cut. */
  const autoCut = contextSafe(() => {
    const scissors = scissorsRef.current;
    if (!scissors || phase.current !== 'open' || cutting.current) return;
    cutting.current = true;
    if (motion.reduced) {
      spill();
      return;
    }
    gsap.killTweensOf(scissors);
    const { left, right, y } = cutLine();
    const h = scissors.offsetHeight;
    const steps = 3;
    const tl = gsap.timeline({ onComplete: spill });
    tl.to(scissors, { x: scissorsXForTip(left) - 10, y: y - h / 2, rotation: 0, duration: 0.45, ease: 'power3.inOut' });
    for (let i = 1; i <= steps; i += 1) {
      const tip = left + ((right - left) * i) / steps + (i === steps ? 8 : 0);
      tl.add(() => snip()).to(
        scissors,
        {
          x: scissorsXForTip(tip),
          duration: 0.24,
          ease: 'power2.out',
          onUpdate: () => {
            const x = Number(gsap.getProperty(scissors, 'x'));
            showProgress((x + scissors.offsetWidth * 0.92 - left) / (right - left));
          },
        },
        '+=0.06',
      );
    }
  });

  return (
    <div className="shopping-bag" ref={rootRef}>
      {open ? (
        /* The wrapper is deliberately unpositioned. A fixed, z-indexed
           wrapper would be a stacking context of its own, trapping the
           scissors and the slit inside it — beneath the open bag no matter
           their z-index. Unwrapped, each piece is its own fixed layer and
           the blades can pass in front of the bag. */
        <div
          className="bag-scene"
          ref={sceneRef}
          role="dialog"
          aria-modal="true"
          aria-label="Your shopping bag"
        >
          <div
            className="bag-scene__backdrop"
            ref={backdropRef}
            aria-hidden="true"
            onClick={() => {
              if (!spilling) closeBag();
            }}
          />
          <p className="bag-scene__count" ref={countLabelRef}>
            {count} {count === 1 ? 'item' : 'items'} in your bag
          </p>
          {spilling ? null : <p className="bag-scene__hint">Click the scissors to drop items</p>}
          <span className="bag-scene__slit" ref={slitRef} aria-hidden="true" />
          <button
            className="bag-scene__scissors"
            ref={scissorsRef}
            type="button"
            onClick={autoCut}
            disabled={spilling}
            aria-label="Cut the bag open and empty it"
          >
            <svg viewBox="0 0 120 60" aria-hidden="true">
              <g ref={bladeTopRef}>
                <path className="blade" d="M60 30 L114 26 Q118 27.5 114 29.5 L60 33 Z" />
                <path className="arm" d="M37 21 L60 30" />
                <circle className="ring" cx="25" cy="16" r="11" />
              </g>
              <g ref={bladeBottomRef}>
                <path className="blade" d="M60 30 L114 34 Q118 32.5 114 30.5 L60 27 Z" />
                <path className="arm" d="M37 39 L60 30" />
                <circle className="ring" cx="25" cy="44" r="11" />
              </g>
              <circle className="pivot" cx="60" cy="30" r="3.2" />
            </svg>
          </button>
          <button className="bag-scene__close" type="button" onClick={closeBag} disabled={spilling}>
            Keep my bag
          </button>
        </div>
      ) : null}

      <button
        className={`bag-dock${open ? ' is-open' : ''}`}
        ref={bagRef}
        type="button"
        onClick={openBag}
        tabIndex={count > 0 && !open ? 0 : -1}
        aria-label={`Shopping bag, ${count} ${count === 1 ? 'item' : 'items'}. Open the bag.`}
      >
        {/* Two copies of the bag, split along the cut line, so the bottom
            can fall away on its own when the cut is done. */}
        <span className="bag-dock__part" style={{ clipPath: TEAR.top }} aria-hidden="true">
          <img src={BAG_SRC} alt="" width={1024} height={1024} />
        </span>
        <span className="bag-dock__part" ref={bottomRef} style={{ clipPath: TEAR.bottom }} aria-hidden="true">
          <img src={BAG_SRC} alt="" width={1024} height={1024} />
        </span>
        {/* "Cut here" — only shown with the bag open. */}
        <span className="bag-dock__mark" ref={markRef} aria-hidden="true" />
        {count > 0 ? <span className="bag-dock__count">{count}</span> : null}
      </button>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
