import { useEffect, useState } from 'react';
import {
  fetchPlace,
  isConfigured,
  MAX_SHOWN,
  FALLBACK_MAPS_URL,
  type PlaceData,
} from '../lib/reviews';
import { t } from '../lib/i18n';
import { useLang } from '../state/app-state';
import { useReveal } from '../hooks/useReveal';

/** Five stars with the filled row clipped to the score. */
function Stars({ rating, label }: { rating: number; label?: string }) {
  return (
    <span
      className="stars"
      style={{ '--pct': `${Math.max(0, Math.min(5, rating)) * 20}%` } as React.CSSProperties}
      role="img"
      aria-label={label ?? `${rating} out of 5`}
    >
      <span className="stars__base" aria-hidden="true">
        ★★★★★
      </span>
      <span className="stars__fill" aria-hidden="true">
        ★★★★★
      </span>
    </span>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

type State =
  | { kind: 'unconfigured' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; data: PlaceData };

export function ReviewsSection() {
  const lang = useLang();
  const ref = useReveal<HTMLElement>();
  const [state, setState] = useState<State>(() =>
    isConfigured() ? { kind: 'loading' } : { kind: 'unconfigured' },
  );

  useEffect(() => {
    if (!isConfigured()) return;
    let alive = true;
    setState({ kind: 'loading' });
    fetchPlace()
      .then((data) => {
        if (alive) setState({ kind: 'loaded', data });
      })
      .catch(() => {
        if (alive) setState({ kind: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [lang]);

  return (
    <section className="section section--framed" id="reviews" ref={ref} aria-labelledby="reviews-title">
      <div className="section__frame">
        <header className="section__head">
          <div>
            <p className="eyebrow">{t('reviews.eyebrow')}</p>
            <h2 id="reviews-title">{t('reviews.title')}</h2>
          </div>
          <p className="lede">{t('reviews.sub')}</p>
        </header>

        <div className="reviews">
          {state.kind === 'loading' ? (
            <p className="reviews__loading">{t('common.loading')}…</p>
          ) : null}

          {state.kind === 'unconfigured' || state.kind === 'error' ? (
            <div className="reviews__placeholder">
              <p>{t(state.kind === 'error' ? 'reviews.error' : 'reviews.unconfigured')}</p>
              <a
                className="btn btn--ghost btn--sm"
                href={FALLBACK_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('reviews.onGoogle')}
              </a>
            </div>
          ) : null}

          {state.kind === 'loaded' ? (
            <>
              <div className="reviews__score">
                <strong>{state.data.rating ? state.data.rating.toFixed(1) : '—'}</strong>
                <Stars rating={state.data.rating ?? 0} />
                <span className="reviews__count">
                  {state.data.count} {t('reviews.count')}
                </span>
                <a
                  className="reviews__source"
                  href={state.data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('reviews.onGoogle')}
                </a>
              </div>

              {state.data.reviews.length ? (
                <div className="reviews__grid">
                  {state.data.reviews.slice(0, MAX_SHOWN).map((review, index) => (
                    <article className="review" key={review.id} data-reveal="" data-reveal-index={index}>
                      <header className="review__head">
                        {review.photo ? (
                          <img
                            className="review__avatar"
                            src={review.photo}
                            alt=""
                            width={40}
                            height={40}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="review__avatar review__avatar--initials">
                            {initials(review.author)}
                          </span>
                        )}
                        <span className="review__who">
                          <a
                            className="review__author"
                            href={review.authorUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {review.author}
                          </a>
                          <span className="review__when">{review.when}</span>
                        </span>
                      </header>
                      <Stars rating={review.rating} label={`${review.rating} out of 5`} />
                      {/* Review text is written by the public — rendered as
                          text, never as markup. */}
                      <p className="review__text">{review.text}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="reviews__empty">{t('reviews.none')}</p>
              )}

              <p className="reviews__attribution">
                {t('reviews.attribution')}{' '}
                <a href={state.data.url} target="_blank" rel="noopener noreferrer">
                  {t('reviews.viewAll')}
                </a>
              </p>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
