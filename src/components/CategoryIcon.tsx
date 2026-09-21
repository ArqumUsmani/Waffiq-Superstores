/**
 * Category artwork, in tiers picked by which files exist:
 *
 *   1. a real 3D render  — four aisles, a plain <img>; the hover lift is
 *      pure CSS (.category-icon__render), so pop() is a genuine no-op
 *   2. a generated Lottie — the other six, poster SVG until the player has
 *      mounted, then one "lift, tilt, settle" gesture on hover
 *   3. nothing            — a gradient + emoji tile, as a last resort
 *
 * The caller gets `pop()` and `artEl()` through a ref, mirroring the
 * vanilla build's returned object.
 */
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type Ref,
} from 'react';
import type { AnimationItem } from 'lottie-web';
import { uniquifySvgIds } from '../lib/dom';
import { motion } from '../lib/motion-guard';
import { onMotionChange } from '../lib/motion-guard';
import { categoryLottie, categoryPoster, categoryRender } from '../assets/registry';
import type { Category } from '../lib/types';

/** The generated files carry one marker: frame 0..48 is a hover gesture. */
const HOVER: [number, number] = [0, 48];

let playerPromise: Promise<typeof import('lottie-web').default> | null = null;
const loadPlayer = () => {
  playerPromise ??= import('lottie-web/build/player/lottie_light.js').then(
    (mod) => (mod.default ?? mod) as typeof import('lottie-web').default,
  );
  return playerPromise;
};

const idle = (fn: () => void) =>
  'requestIdleCallback' in window
    ? requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 400);

export interface CategoryIconHandle {
  /** The one gesture these icons have: lift, tilt, settle back to rest. */
  pop: () => void;
  /** The element the launch transition should clone and fly. */
  artEl: () => HTMLElement | null;
}

interface Props {
  category: Category;
  size?: number;
  label?: string;
  ref?: Ref<CategoryIconHandle>;
}

export function CategoryIcon({ category, size = 132, label = '', ref }: Props) {
  const slug = category.slug;
  const render = categoryRender(slug);
  const lottieUrl = render ? undefined : categoryLottie(slug);
  const poster = render ? undefined : categoryPoster(slug);

  const rootRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const animation = useRef<AnimationItem | null>(null);

  const posterMarkup = useMemo(
    () => (poster ? uniquifySvgIds(poster) : null),
    [poster],
  );

  /* Warm the player once the icon is on screen and the device can hover, so
     the first hover is instant without costing touch visitors anything. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !lottieUrl) return;

    let destroyed = false;
    let mounting: Promise<void> | null = null;

    const mount = () => {
      if (animation.current || destroyed || motion.reduced) return;
      mounting ??= loadPlayer()
        .then((lottie) => {
          if (destroyed || animation.current || !stageRef.current) return;
          animation.current = lottie.loadAnimation({
            container: stageRef.current,
            renderer: 'svg',
            loop: false,
            autoplay: false,
            path: lottieUrl,
            rendererSettings: { progressiveLoad: true, hideOnTransparent: true },
          });
          animation.current.addEventListener('DOMLoaded', () => {
            if (destroyed) return;
            // Hold the rest pose. Nothing moves until pop() asks it to.
            animation.current?.goToAndStop(0, true);
            root.classList.add('is-ready');
          });
        })
        .catch(() => {
          // The poster is already correct, so a failed player is not an error.
          root.classList.add('is-poster-only');
        });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          if (motion.hasHover && !motion.reduced) idle(mount);
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(root);

    const stopWatchingMotion = onMotionChange(() => {
      if (!motion.reduced || !animation.current) return;
      animation.current.destroy();
      animation.current = null;
      root.classList.remove('is-ready');
    });

    return () => {
      destroyed = true;
      observer.disconnect();
      stopWatchingMotion();
      animation.current?.destroy();
      animation.current = null;
    };
  }, [lottieUrl]);

  useImperativeHandle(
    ref,
    () => ({
      pop: () => {
        if (motion.reduced || !animation.current) return;
        animation.current.playSegments(HOVER, true);
      },
      artEl: () => imgRef.current ?? stageRef.current ?? rootRef.current,
    }),
    [],
  );

  const aria = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };

  if (render) {
    return (
      <div
        className="category-icon"
        data-icon={slug}
        data-kind="render"
        style={{ width: size, height: size }}
        ref={rootRef}
        {...aria}
      >
        <img
          className="category-icon__render"
          src={render}
          alt=""
          loading="lazy"
          decoding="async"
          width={size}
          height={size}
          ref={imgRef}
        />
      </div>
    );
  }

  if (posterMarkup || lottieUrl) {
    return (
      <div
        className="category-icon"
        data-icon={slug}
        data-kind="generated"
        style={{ width: size, height: size }}
        ref={rootRef}
        {...aria}
      >
        <div
          className="category-icon__poster"
          dangerouslySetInnerHTML={{ __html: posterMarkup ?? '' }}
        />
        <div className="category-icon__stage" ref={stageRef} />
      </div>
    );
  }

  /* Last resort — no art of any kind for this aisle. */
  return (
    <div
      className="category-icon category-icon--tile"
      data-icon={slug}
      data-kind="tile"
      style={
        {
          width: size,
          height: size,
          '--pastel': category.pastel,
          '--accent': category.accent,
        } as React.CSSProperties
      }
      ref={rootRef}
      {...aria}
    >
      <span className="category-icon__glyph">{category.glyph}</span>
    </div>
  );
}
