/**
 * Hero — storefront variation.
 *
 * The interchangeable alternate to HeroScene: same deep-green section,
 * same background layer, same pointer-tilt stage, floating glass cards and
 * aisle marquee — but the centrepiece is the transparent storefront render
 * (public/assets/storefront.webp) in front of a stroked ghost "WAFIQ".
 *
 * To use it, swap `HeroScene` for `Hero` in pages/Home.tsx.
 */
import { Link } from 'react-router';
import { BackgroundLayers } from './Background';
import { AisleMarquee, HeroCards, useStageTilt } from './hero-parts';
import { t } from '../lib/i18n';
import { useMagnet } from '../hooks/useMagnet';

export function Hero() {
  const ctaRef = useMagnet<HTMLAnchorElement>();
  const stageRef = useStageTilt<HTMLDivElement>();

  return (
    <section className="hero-grocery hero-grocery--storefront" id="home" aria-labelledby="hero-title">
      <div className="hero-grocery__bg" aria-hidden="true">
        <BackgroundLayers />
      </div>

      <div className="shell hero-grocery__inner">
        <p className="hero-grocery__badge">
          <span className="hero-grocery__dot" aria-hidden="true" />
          {t('heroBag.badge')}
        </p>

        <h1 className="hero-grocery__title" id="hero-title">
          {t('heroBag.titleLead')}{' '}
          <span className="hero-grocery__accent">
            {t('heroBag.titleAccent')}
            <svg
              className="hero-grocery__underline"
              viewBox="0 0 300 18"
              fill="none"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <path
                d="M4 12.5C52 5.5 108 3.5 160 6.5C212 9.5 260 13 296 8"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                pathLength={1}
              />
            </svg>
          </span>
        </h1>

        <p className="hero-grocery__sub">{t('heroBag.sub')}</p>

        <div className="hero-grocery__actions">
          <Link className="btn btn--light" to="/aisle/fruits-vegetables" ref={ctaRef}>
            <span>{t('heroBag.ctaPrimary')}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <Link className="btn btn--ghost" to="/#branches" style={{ color: '#fff', borderColor: 'rgb(255 255 255 / 0.3)' }}>
            <span>{t('heroBag.ctaSecondary')}</span>
          </Link>
        </div>

        <div className="hero-grocery__stage" ref={stageRef}>
          <p className="hero-grocery__ghost" aria-hidden="true">
            WAFIQ
          </p>
          <span className="hero-grocery__glow" aria-hidden="true" />

          <div className="hero-grocery__storefront" data-tilt>
            <img
              src="/assets/storefront.webp"
              width={2200}
              height={856}
              alt={t('heroGate.alt')}
              decoding="async"
              fetchPriority="high"
            />
            <span className="bag__shadow" aria-hidden="true" />
          </div>

          <HeroCards />
        </div>
      </div>

      <AisleMarquee />
    </section>
  );
}
