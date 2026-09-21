/**
 * The living background: a fixed, airy backdrop behind the light half of
 * the site. Blurred green/lime orbs that pulse, a green dot grid masked to
 * fade at the edges, and a dozen produce emoji drifting at very low
 * opacity. Deliberately quiet — it should read as texture, not decoration.
 *
 * All motion is CSS keyframes, so the global prefers-reduced-motion
 * killswitch in tailwind.css stops it without any JS involvement.
 */
import type { CSSProperties } from 'react';

interface Orb {
  size: string;
  x: string;
  y: string;
  colour: string;
  dur: string;
  delay: string;
}

const ORBS: Orb[] = [
  { size: '38rem', x: '-12%', y: '-18%', colour: 'color-mix(in oklab, var(--color-lime) 30%, transparent)', dur: '16s', delay: '0s' },
  { size: '32rem', x: '62%', y: '8%', colour: 'color-mix(in oklab, var(--color-green) 26%, transparent)', dur: '20s', delay: '-5s' },
  { size: '28rem', x: '28%', y: '64%', colour: 'color-mix(in oklab, var(--color-lime) 22%, transparent)', dur: '24s', delay: '-11s' },
];

export const PRODUCE = ['🍎', '🥦', '🍌', '🥕', '🍅', '🫐', '🥑', '🍞', '🧀', '🥛', '🍇', '🌶️'];

/** Scattered but deterministic, so the layout never jumps between renders. */
const SPOTS = [
  { x: '6%', y: '12%', size: '2.4rem', dur: '26s' },
  { x: '22%', y: '38%', size: '1.9rem', dur: '31s' },
  { x: '38%', y: '8%', size: '2.1rem', dur: '28s' },
  { x: '54%', y: '52%', size: '2.6rem', dur: '34s' },
  { x: '71%', y: '18%', size: '2rem', dur: '29s' },
  { x: '88%', y: '44%', size: '2.3rem', dur: '25s' },
  { x: '14%', y: '72%', size: '2.2rem', dur: '33s' },
  { x: '33%', y: '88%', size: '1.8rem', dur: '27s' },
  { x: '58%', y: '78%', size: '2.5rem', dur: '30s' },
  { x: '79%', y: '86%', size: '2rem', dur: '36s' },
  { x: '92%', y: '8%', size: '1.9rem', dur: '32s' },
  { x: '47%', y: '28%', size: '1.7rem', dur: '24s' },
];

/** Shared by the fixed page background and the hero's own dark layer. */
export function BackgroundLayers({ orbs = true }: { orbs?: boolean }) {
  return (
    <>
      {orbs
        ? ORBS.map((orb, i) => (
            <span
              key={i}
              className="living-bg__orb"
              style={
                {
                  width: orb.size,
                  height: orb.size,
                  insetInlineStart: orb.x,
                  insetBlockStart: orb.y,
                  background: orb.colour,
                  '--dur': orb.dur,
                  '--delay': orb.delay,
                } as CSSProperties
              }
            />
          ))
        : null}

      <span className="living-bg__grid" />

      {SPOTS.map((spot, i) => (
        <span
          key={i}
          className="living-bg__produce"
          style={
            {
              '--x': spot.x,
              '--y': spot.y,
              '--size': spot.size,
              '--dur': spot.dur,
              '--delay': `${-i * 2.3}s`,
            } as CSSProperties
          }
        >
          {PRODUCE[i % PRODUCE.length]}
        </span>
      ))}
    </>
  );
}

export function Background() {
  return (
    <div className="living-bg" aria-hidden="true">
      <BackgroundLayers />
    </div>
  );
}
