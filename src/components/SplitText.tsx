/**
 * SplitText — React Bits' scroll-revealed split-text component, adapted.
 *
 * Splits its text into chars, words or lines with GSAP's SplitText plugin
 * and staggers them in once the element scrolls into view, then never
 * replays.
 *
 * Differences from the upstream source, all to fit this codebase:
 *  - gsap, ScrollTrigger and SplitText come from lib/gsap-setup, never from
 *    'gsap' directly — the house defaults registered there are load-bearing.
 *  - `revertOnUpdate: true` on useGSAP. It is not the default, and without
 *    it a prop change re-runs the effect on top of a split that was never
 *    reverted.
 *  - Reduced motion renders the plain text and skips the split entirely.
 *  - Styling lives in main.css (.split-parent) rather than utility classes.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ElementType } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, ScrollTrigger, SplitText as GSAPSplitText } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';

export interface SplitTextProps {
  text: string;
  className?: string;
  /** Stagger between pieces, in ms. */
  delay?: number;
  /** Duration of each piece, in seconds. */
  duration?: number;
  ease?: string | ((t: number) => number);
  splitType?: 'chars' | 'words' | 'lines' | 'words, chars';
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  /** Fraction of the viewport from the bottom at which it starts (0–1). */
  threshold?: number;
  /** Extra offset on that start line, e.g. "-100px". */
  rootMargin?: string;
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
  textAlign?: CSSProperties['textAlign'];
  onLetterAnimationComplete?: () => void;
}

type SplitHost = HTMLElement & { _rbsplitInstance?: GSAPSplitText };

export function SplitText({
  text,
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  tag = 'p',
  textAlign = 'center',
  onLetterAnimationComplete,
}: SplitTextProps) {
  const ref = useRef<HTMLElement>(null);
  const animationCompletedRef = useRef(false);
  const onCompleteRef = useRef(onLetterAnimationComplete);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete;
  }, [onLetterAnimationComplete]);

  /* Splitting before the web font lands measures the fallback font's glyphs,
     and the pieces then sit at the wrong widths once it swaps in. */
  useEffect(() => {
    if (document.fonts.status === 'loaded') {
      setFontsLoaded(true);
    } else {
      void document.fonts.ready.then(() => setFontsLoaded(true));
    }
  }, []);

  useGSAP(
    () => {
      if (!ref.current || !text || !fontsLoaded || motion.reduced) return;
      if (animationCompletedRef.current) return;
      const el = ref.current as SplitHost;

      if (el._rbsplitInstance) {
        try {
          el._rbsplitInstance.revert();
        } catch {
          /* already reverted */
        }
        el._rbsplitInstance = undefined;
      }

      const startPct = (1 - threshold) * 100;
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
      const marginValue = marginMatch ? parseFloat(marginMatch[1]!) : 0;
      const marginUnit = marginMatch ? (marginMatch[2] ?? 'px') : 'px';
      const sign =
        marginValue === 0
          ? ''
          : marginValue < 0
            ? `-=${Math.abs(marginValue)}${marginUnit}`
            : `+=${marginValue}${marginUnit}`;
      const start = `top ${startPct}%${sign}`;

      let targets: Element[] = [];
      const assignTargets = (self: GSAPSplitText) => {
        if (splitType.includes('chars') && self.chars?.length) targets = self.chars;
        if (!targets.length && splitType.includes('words') && self.words.length) {
          targets = self.words;
        }
        if (!targets.length && splitType.includes('lines') && self.lines.length) {
          targets = self.lines;
        }
        if (!targets.length) targets = self.chars || self.words || self.lines;
      };

      const splitInstance = new GSAPSplitText(el, {
        type: splitType,
        smartWrap: true,
        autoSplit: splitType === 'lines',
        linesClass: 'split-line',
        wordsClass: 'split-word',
        charsClass: 'split-char',
        reduceWhiteSpace: false,
        onSplit: (self: GSAPSplitText) => {
          assignTargets(self);
          return gsap.fromTo(
            targets,
            { ...from },
            {
              ...to,
              duration,
              ease,
              stagger: delay / 1000,
              scrollTrigger: {
                trigger: el,
                start,
                once: true,
                fastScrollEnd: true,
                anticipatePin: 0.4,
              },
              onComplete: () => {
                animationCompletedRef.current = true;
                onCompleteRef.current?.();
              },
              willChange: 'transform, opacity',
              force3D: true,
            },
          );
        },
      });
      el._rbsplitInstance = splitInstance;

      return () => {
        ScrollTrigger.getAll().forEach((st) => {
          if (st.trigger === el) st.kill();
        });
        try {
          splitInstance.revert();
        } catch {
          /* already reverted */
        }
        el._rbsplitInstance = undefined;
      };
    },
    {
      dependencies: [
        text,
        delay,
        duration,
        ease,
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        threshold,
        rootMargin,
        fontsLoaded,
      ],
      scope: ref,
      revertOnUpdate: true,
    },
  );

  const Tag = (tag || 'p') as ElementType;

  return (
    <Tag
      ref={ref}
      className={`split-parent ${className}`.trim()}
      style={{ textAlign, wordWrap: 'break-word' }}
    >
      {text}
    </Tag>
  );
}
