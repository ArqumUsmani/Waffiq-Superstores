/**
 * Hero — the street scene, with a headlight that toggles the site theme.
 *
 * Two renders of the same shot are stacked: a day frame and a night frame in
 * which the windows glow, the string lights are lit and the scooter's
 * headlight throws a beam across the cobbles. Both have a transparent sky, so
 * SkyLayer shows through behind them.
 *
 * Clicking the headlight runs a filament flicker — an irregular stutter, not a
 * fade — that drives `--lit`, which in turn drives the night frame's opacity
 * and the lamp glow. The theme is committed *partway through* that timeline,
 * at the moment the filament catches, so the lamp coming on reads as the thing
 * that causes night to fall. Same idea as the launch transition committing its
 * route the frame the flood turns opaque.
 *
 * The sky is deliberately not on `--lit`; it transitions off `[data-theme]` in
 * CSS, so it eases smoothly while the lamp stutters.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useGSAP } from '@gsap/react';
import { SkyLayer } from './SkyLayer';
import { AisleMarquee } from './hero-parts';
import { Icon } from './Icon';
import { gsap } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { setTheme, toggleTheme } from '../lib/theme';
import { horn, peep, rooster, toggleMuted } from '../lib/sfx';
import { setAmbienceScene, setAmbiencePresence } from '../lib/ambience';
import { t, toggleLang } from '../lib/i18n';
import { branches } from '../lib/data';
import { useLang, useTheme } from '../state/app-state';
import { useMuted } from '../hooks/useMuted';

/**
 * Where the lamp sits in the art, measured by diffing the two renders for the
 * brightest pixels present at night and absent by day.
 */
const LAMP_X = '75.78%';
const LAMP_Y = '71.17%';

/** Irregular on purpose — an even ramp reads as a fade, not a filament. */
const FLICKER_ON = [
  { value: 0.55, at: 0.04 },
  { value: 0.12, at: 0.11 },
  { value: 0.9, at: 0.17 },
  { value: 0.35, at: 0.26 },
  { value: 1, at: 0.34 },
];
const FLICKER_OFF = [
  { value: 0.5, at: 0.05 },
  { value: 0.68, at: 0.12 },
  { value: 0, at: 0.26 },
];

export function HeroScene() {
  const theme = useTheme();
  const lang = useLang();
  const muted = useMuted();
  const dark = theme === 'dark';
  const busy = useRef(false);
  const branch = branches[0];

  const rootRef = useRef<HTMLElement>(null);

  /* Scoped context so any tween made in the click handler is reverted on
     unmount. `contextSafe` is what puts it inside that scope. */
  const { contextSafe } = useGSAP({ scope: rootRef });

  /* Keep the paint in step with the theme when it is changed from somewhere
     else — the header button, or the OS preference.
     Skipped while our own flicker is running: the theme commits partway
     through that timeline, and re-syncing here would snap `--lit` straight
     to its final value and swallow the stutter. */
  useLayoutEffect(() => {
    if (busy.current || !rootRef.current) return;
    gsap.set(rootRef.current, { '--lit': dark ? 1 : 0 });
  }, [dark]);

  /* Crossfade the soundscape with the sky. Runs on every theme change, not
     just ones started here, so the header button moves it too. */
  useEffect(() => {
    setAmbienceScene(dark ? 'night' : 'day');
  }, [dark]);

  /* The soundscape belongs to the hero, so it ducks away as the hero
     leaves the screen and comes back when it returns. Unmounting (a route
     change) counts as leaving. */
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setAmbiencePresence(Boolean(entry?.isIntersecting)),
      /* A sliver is enough to keep it alive, so it does not flicker on and
         off while the hero is half out of frame. */
      { threshold: 0.12 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      setAmbiencePresence(false);
    };
  }, []);

  /* Dawn. Seeded with the theme at mount so a visitor who arrives in light
     mode is not crowed at on page load — only a real night-to-day flip
     counts, wherever it was triggered from. */
  const wasDark = useRef(dark);
  useEffect(() => {
    if (wasDark.current && !dark) {
      /* A beat behind the light, so it follows the horn rather than
         landing on top of it. */
      const timer = window.setTimeout(rooster, 260);
      wasDark.current = dark;
      return () => window.clearTimeout(timer);
    }
    wasDark.current = dark;
    return undefined;
  }, [dark]);

  const toggle = contextSafe(() => {
    const root = rootRef.current;
    const next = dark ? 'light' : 'dark';

    if (!root || motion.reduced) {
      setTheme(next);
      return;
    }

    if (busy.current) return;
    busy.current = true;

    /* The horn sounds on the press itself, before anything lights. */
    horn();

    const steps = dark ? FLICKER_OFF : FLICKER_ON;
    const timeline = gsap.timeline({
      onComplete: () => {
        busy.current = false;
      },
    });

    for (const step of steps) {
      timeline.set(root, { '--lit': step.value }, step.at);
    }

    /* Commit while the filament is still stuttering, not at either end. */
    timeline.call(
      () => {
        setTheme(next);
      },
      undefined,
      steps[Math.floor(steps.length / 2)]!.at,
    );

    /* Settle smoothly out of the last stutter. */
    timeline.to(
      root,
      { '--lit': dark ? 0 : 1, duration: 0.22, ease: 'power2.out' },
      steps[steps.length - 1]!.at,
    );
  });

  return (
    <section
      className="hero-scene"
      id="home"
      ref={rootRef}
      aria-labelledby="hero-title"
      style={{ '--lamp-x': LAMP_X, '--lamp-y': LAMP_Y } as CSSProperties}
    >
      {/* The frames hide the headline, but the page still needs one. */}
      <h1 className="sr-only" id="hero-title">
        {t('heroBag.titleLead')} {t('heroBag.titleAccent')}
      </h1>

      <SkyLayer />

      {/* The header is hidden over the hero, so these live here instead —
          sound especially, since the mute flag persists and a visitor who
          muted would otherwise have no way to turn it back on from the top
          of the page. Same classes as their counterparts in the bar, and
          the same state behind them, so each stays one control rather than
          drifting into a second. */}
      <div className="hero-scene__controls">
        <button
          className={`icon-btn${muted ? ' is-muted' : ''}`}
          type="button"
          onClick={toggleMuted}
          /* aria-pressed tracks "is sound on", the opposite of the muted
             flag — matching how the theme toggle reads "is dark". */
          aria-pressed={!muted}
          aria-label={t(muted ? 'sound.toOn' : 'sound.toOff')}
        >
          <span className="icon-btn__swap icon-btn__swap--sound">
            <Icon name="soundOn" className="ico--sound-on" />
            <Icon name="soundOff" className="ico--sound-off" />
          </span>
        </button>

        <button
          className="icon-btn"
          type="button"
          onClick={toggleTheme}
          aria-pressed={dark}
          aria-label={t(dark ? 'theme.toLight' : 'theme.toDark')}
        >
          <span className="icon-btn__swap">
            <Icon name="sun" className="ico--sun" />
            <Icon name="moon" className="ico--moon" />
          </span>
        </button>

        <button
          className="lang-toggle"
          type="button"
          onClick={toggleLang}
          aria-label={t('lang.label')}
        >
          {/* Shows the language you would switch *to*. */}
          <span className="lang-toggle__value">{lang === 'ur' ? 'English' : 'اردو'}</span>
        </button>
      </div>

      <div className="hero-scene__art">
        <img
          className="hero-scene__frame hero-scene__frame--day"
          src="/assets/scene-day.webp"
          width={1800}
          height={1005}
          alt={t('heroScene.alt')}
          decoding="async"
          fetchPriority="high"
        />
        {/* Rendered at all times so the browser has it before the first
            toggle; a lazy fetch here would show a gap mid-flicker. */}
        <img
          className="hero-scene__frame hero-scene__frame--night"
          src="/assets/scene-night.webp"
          width={1800}
          height={1005}
          alt=""
          aria-hidden="true"
          decoding="async"
        />

        <span className="hero-scene__lamp" aria-hidden="true" />

        <button
          className="hero-scene__headlight"
          type="button"
          onClick={toggle}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') peep();
          }}
          onFocus={peep}
          aria-pressed={dark}
          aria-label={t(dark ? 'theme.toLight' : 'theme.toDark')}
        >
          <span className="hero-scene__headlight-ring" aria-hidden="true" />
        </button>
      </div>

      <p className="hero-scene__badge">
        <span className="hero-grocery__dot" aria-hidden="true" />
        {t('heroBag.badge')}
        {branch ? ` · ${branch.hoursSummary}` : ''}
      </p>

      <AisleMarquee />
    </section>
  );
}
