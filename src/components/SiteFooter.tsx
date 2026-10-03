/**
 * Footer — a dark rounded panel with the Wafiq carrier bag riding its top
 * edge, contact and links either side of the brand, and a giant "WAFIQ"
 * wordmark along the bottom that rises letter by letter as it scrolls in.
 *
 * Every line of contact copy comes from the branch record. Where the data
 * has nothing (no phone yet, no social accounts) the slot is left out
 * rather than filled with something invented.
 */
import { Link } from 'react-router';
import { Icon } from './Icon';
import { SplitText } from './SplitText';
import { t } from '../lib/i18n';
import { branches, totals } from '../lib/data';
import { FALLBACK_MAPS_URL, getCachedReviewSummary } from '../lib/reviews';
import { NAV } from './nav-model';
import { useLang } from '../state/app-state';
import { useSectionNav } from '../hooks/useSectionNav';

/* ---------------------------------------------------------------- *
   Contour lines
 * ---------------------------------------------------------------- */

/**
 * Topographic rings behind the panel, built once at module load from two
 * fixed centres and a sum of sines — deterministic, so the texture never
 * shifts between renders.
 */
const CONTOURS: string[] = (() => {
  const centres = [
    { x: 250, y: 520, rings: 7, base: 70, step: 62, seed: 1.3 },
    { x: 1010, y: 90, rings: 6, base: 60, step: 70, seed: 4.1 },
  ];
  const paths: string[] = [];
  for (const c of centres) {
    for (let ring = 0; ring < c.rings; ring += 1) {
      const radius = c.base + ring * c.step;
      const points: string[] = [];
      const steps = 96;
      for (let i = 0; i <= steps; i += 1) {
        const a = (i / steps) * Math.PI * 2;
        const wobble =
          Math.sin(a * 3 + c.seed + ring * 0.35) * 0.09 +
          Math.sin(a * 5 - c.seed * 2 + ring * 0.2) * 0.05 +
          Math.sin(a * 2 + ring * 0.6) * 0.07;
        const r = radius * (1 + wobble);
        points.push(`${(c.x + Math.cos(a) * r * 1.35).toFixed(1)} ${(c.y + Math.sin(a) * r).toFixed(1)}`);
      }
      paths.push(`M${points.join('L')}Z`);
    }
  }
  return paths;
})();

function Contours() {
  return (
    <svg
      className="site-footer__contours"
      viewBox="0 0 1200 640"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {CONTOURS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------- *
   Footer
 * ---------------------------------------------------------------- */

export function SiteFooter({ onSearchOpen }: { onSearchOpen: () => void }) {
  useLang();
  const { go } = useSectionNav();
  const year = new Date().getFullYear();
  const branch = branches[0];
  const summary = getCachedReviewSummary();
  const mapsUrl = branch?.maps ?? FALLBACK_MAPS_URL;

  /* The footer is itself the "Contact" target, so it is left out here. */
  const quick = NAV.filter((item) => item.id !== 'contact');

  return (
    <footer className="site-footer" id="contact">
      <div className="site-footer__panel">
        <div className="site-footer__texture" aria-hidden="true">
          <Contours />
        </div>

        <img
          className="site-footer__bag"
          src="/assets/footer-bag.webp"
          width={1024}
          height={1024}
          alt=""
          loading="lazy"
          decoding="async"
        />

        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <h2 className="site-footer__title">{t('brand.name')}</h2>
            <p className="site-footer__tagline">{t('brand.tagline')}</p>

            <div className="site-footer__ctas">
              <a
                className="footer-cta footer-cta--lime"
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('branches.directions')}
                <span className="footer-cta__icon" aria-hidden="true">
                  <Icon name="arrow" />
                </span>
              </a>
              <a
                className="footer-cta footer-cta--deep"
                href="#categories"
                onClick={(event) => {
                  event.preventDefault();
                  go('categories');
                }}
              >
                {t('footer.browse')}
                <span className="footer-cta__icon" aria-hidden="true">
                  <Icon name="arrow" />
                </span>
              </a>
            </div>
          </div>

          <div className="site-footer__contact">
            <h2 className="site-footer__heading">{t('footer.contact')}</h2>
            <address>
              {branch?.address}
              {branch?.hoursSummary ? <span>{branch.hoursSummary}</span> : null}
              {branch?.phone ? (
                <a href={`tel:${branch.phone.replace(/[^\d+]/g, '')}`}>{branch.phone}</a>
              ) : null}
            </address>
          </div>

          <nav className="site-footer__quick" aria-labelledby="footer-quick">
            <h2 className="site-footer__heading" id="footer-quick">
              {t('footer.quick')}
            </h2>
            <ul>
              {quick.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/#${item.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      go(item.id);
                    }}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              ))}
              <li>
                <button type="button" onClick={onSearchOpen}>
                  {t('search.open')}
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="site-footer__bar">
          <ul className="site-footer__badges">
            {/* Only once Google has actually returned a rating — never an
                invented figure. */}
            {summary?.rating ? (
              <li className="footer-badge">
                <strong>{summary.rating.toFixed(1)}</strong>
                {t('footer.rating')}
              </li>
            ) : null}
            <li className="footer-badge">
              <strong>{totals.products}</strong>
              {t('footer.shelf')}
            </li>
            <li className="footer-badge">
              <strong>{totals.categories}</strong>
              {t('footer.aisles')}
            </li>
          </ul>

          <p className="site-footer__note">{t('footer.note')}</p>

          <p className="site-footer__legal">
            © {year} {t('brand.name')}. {t('footer.rights')}
          </p>
        </div>

        {/* Decorative: the name is already the footer's heading. Latin capitals
            in both languages — it is the brand mark, as printed on the bag. */}
        <div className="site-footer__wordmark" aria-hidden="true" lang="en" dir="ltr">
          <SplitText
            text="WAFIQ"
            tag="span"
            className="site-footer__wordmark-text"
            splitType="chars"
            delay={90}
            duration={1.1}
            ease="power4.out"
            from={{ yPercent: 100, opacity: 0 }}
            to={{ yPercent: 0, opacity: 1 }}
            /* Starts as soon as the top of the word shows. The word sits at
               the very bottom of the page, so a later start line could sit
               below anything the page can scroll to and never fire. */
            threshold={0}
            rootMargin="-24px"
            textAlign="center"
          />
        </div>
      </div>
    </footer>
  );
}
