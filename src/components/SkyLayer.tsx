/**
 * The hero's procedural sky.
 *
 * Sits behind the scene render, whose sky is fully transparent. Everything
 * here reacts to the `[data-theme]` attribute through ordinary CSS
 * transitions on `transform` and `opacity` — no JS. That keeps the sky
 * easing smoothly (1.2–1.6s) while the headlight flickers fast, and means
 * the global prefers-reduced-motion killswitch disables it for free.
 *
 * Day: sun high, clouds drifting. Night: sun sinks below the horizon, the
 * moon rises, and the stars fade up in a scatter and then twinkle.
 */
import type { CSSProperties } from 'react';

/** Deterministic, so the sky never reshuffles between renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  x: number;
  y: number;
  size: number;
  /** Twinkle period. */
  dur: number;
  /** Twinkle phase, so they are never in sync. */
  delay: number;
  /** Fade-up order, so they light one after another rather than together. */
  lightDelay: number;
}

const STARS: Star[] = (() => {
  const rand = mulberry32(0x5eed);
  return Array.from({ length: 60 }, (): Star => {
    // Biased towards the upper sky, where the scene render is transparent.
    const y = Math.pow(rand(), 1.6) * 62;
    return {
      x: rand() * 100,
      y,
      size: 1 + rand() * 2.2,
      dur: 2.4 + rand() * 3.6,
      delay: -rand() * 6,
      lightDelay: rand() * 0.9,
    };
  });
})();

export function SkyLayer() {
  return (
    <div className="hero-scene__sky" aria-hidden="true">
      <span className="hero-scene__sun" />

      <span className="hero-scene__moon">
        <span className="hero-scene__crater" style={{ '--cx': '30%', '--cy': '34%', '--cs': '22%' } as CSSProperties} />
        <span className="hero-scene__crater" style={{ '--cx': '62%', '--cy': '56%', '--cs': '16%' } as CSSProperties} />
        <span className="hero-scene__crater" style={{ '--cx': '46%', '--cy': '18%', '--cs': '11%' } as CSSProperties} />
      </span>

      <div className="hero-scene__stars">
        {STARS.map((star, i) => (
          <span
            key={i}
            className="hero-scene__star"
            style={
              {
                '--x': `${star.x}%`,
                '--y': `${star.y}%`,
                '--size': `${star.size}px`,
                '--dur': `${star.dur}s`,
                '--delay': `${star.delay}s`,
                '--light-delay': `${star.lightDelay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="hero-scene__clouds">
        <span className="hero-scene__cloud" style={{ '--y': '14%', '--scale': '1', '--dur': '90s' } as CSSProperties} />
        <span className="hero-scene__cloud" style={{ '--y': '30%', '--scale': '0.7', '--dur': '130s', '--delay': '-40s' } as CSSProperties} />
        <span className="hero-scene__cloud" style={{ '--y': '6%', '--scale': '1.25', '--dur': '160s', '--delay': '-90s' } as CSSProperties} />
      </div>
    </div>
  );
}
