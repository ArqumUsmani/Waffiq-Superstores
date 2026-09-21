import { branches } from '../lib/data';
import { pick, t } from '../lib/i18n';
import { useLang } from '../state/app-state';
import { useReveal } from '../hooks/useReveal';

export function BranchSection() {
  useLang();
  const ref = useReveal<HTMLElement>();
  const branch = branches[0];
  if (!branch) return null;

  const name = pick(branch as unknown as Record<string, unknown>, 'name');

  return (
    <section className="section section--framed" id="branches" ref={ref} aria-labelledby="branches-title">
      <div className="section__frame">
        <header className="section__head">
          <div>
            <p className="eyebrow">{t('branches.eyebrow')}</p>
            <h2 id="branches-title">{t('branches.title')}</h2>
          </div>
          <p className="lede">{t('branches.sub')}</p>
        </header>

        <div className="branch-grid">
          <article className="branch-card is-flagship" data-reveal="" data-reveal-index={0}>
            <span className="branch-card__pin" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>

            <h2>{name}</h2>
            <p className="branch-card__address">{branch.address}</p>

            <dl className="branch-card__facts">
              <div>
                <dt>{t('branches.hours')}</dt>
                <dd>{branch.hoursSummary}</dd>
              </div>
              <div>
                <dt>{t('branches.phone')}</dt>
                <dd>{branch.phone ?? t('branches.placeholder')}</dd>
              </div>
            </dl>

            <a
              className="btn btn--solid"
              href={branch.maps}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('branches.directions')}
            </a>
          </article>

          <article className="branch-card" data-reveal="" data-reveal-index={1}>
            <h2>{t('branchCta.title')}</h2>
            <p className="branch-card__address">{t('branchCta.body')}</p>
            <a
              className="btn btn--ghost"
              href={branch.maps}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('branches.mapTitle')}
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
