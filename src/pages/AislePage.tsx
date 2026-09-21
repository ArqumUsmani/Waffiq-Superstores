import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import aislesJson from '../data/aisles.json';
import { categories, countInCategory, getCategory } from '../lib/data';
import { pick, t } from '../lib/i18n';
import { gsap } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { useLang } from '../state/app-state';
import { useReveal } from '../hooks/useReveal';
import { useLaunch, type Arrival } from '../components/LaunchProvider';
import { CategoryIcon } from '../components/CategoryIcon';
import type { Aisle } from '../lib/types';

const AISLES = aislesJson as Aisle[];
const aisleBySlug = new Map(AISLES.map((a) => [a.slug, a]));

export default function AislePage() {
  const { slug } = useParams();
  useLang();
  const category = getCategory(slug);
  const aisle = slug ? aisleBySlug.get(slug) : undefined;

  const { takeArrival } = useLaunch();
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useReveal<HTMLDivElement>([slug]);
  const [cart, setCart] = useState<Record<string, number>>({});

  /* The arrival half of the launch transition. The wash is rendered *only*
     when an arrival is actually in flight — defaulting it to opaque and
     relying on JS to clear it would leave a direct visit staring at a blank
     pastel block. Consumed once behind a ref, because StrictMode invokes
     effects twice and the arrival is one-shot. */
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;
    const pending = takeArrival();
    if (pending && pending.slug === slug && !motion.reduced) setArrival(pending);
  }, [slug, takeArrival]);

  useLayoutEffect(() => {
    if (!arrival) return;
    const art = headerRef.current?.querySelector<HTMLElement>('.category-icon');
    const wash = headerRef.current?.querySelector<HTMLElement>('[data-aisle-wash]');

    /* kill(), not revert(): a revert would restore the wash to opaque, and
       StrictMode's second pass would then have nothing to fade. */
    const tl = gsap.timeline();
    if (art) {
      tl.fromTo(
        art,
        { scale: 0.7, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, ease: 'power3.out' },
        0,
      );
    }
    if (wash) tl.to(wash, { opacity: 0, duration: 0.55, ease: 'power2.out' }, 0.1);

    return () => {
      tl.kill();
    };
  }, [arrival]);

  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, n) => sum + n, 0),
    [cart],
  );

  if (!category || !aisle) {
    return (
      <section className="section section--framed">
        <div className="section__frame">
          <h1>{t('category.notFound')}</h1>
          <p className="lede">{t('category.notFoundBody')}</p>
          <Link className="btn btn--solid" to="/">
            {t('notFound.cta')}
          </Link>
        </div>
      </section>
    );
  }

  const name = pick(category as unknown as Record<string, unknown>, 'en');
  const blurb = pick(category as unknown as Record<string, unknown>, 'blurbEn');
  const total = countInCategory(category.slug);
  const others = categories.filter((c) => c.slug !== category.slug);

  const step = (key: string, delta: number) =>
    setCart((prev) => {
      const next = Math.max(0, (prev[key] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[key];
      else copy[key] = next;
      return copy;
    });

  return (
    <>
      <div
        className="aisle-header"
        ref={headerRef}
        style={
          {
            '--pastel': category.pastel,
            '--accent': category.accent,
          } as React.CSSProperties
        }
      >
        {arrival ? <span className="aisle-header__wash" data-aisle-wash aria-hidden="true" /> : null}
        <div className="shell aisle-header__inner">
          <nav className="aisle-header__crumbs" aria-label="Breadcrumb">
            <Link to="/">{t('nav.home')}</Link>
            <span aria-hidden="true">/</span>
            <span>{name}</span>
          </nav>

          <div className="aisle-header__art">
            <CategoryIcon category={category} size={168} label={name} />
          </div>

          <h1 className="aisle-header__title">{name}</h1>
          <p className="aisle-header__blurb">{blurb}</p>

          <p className="aisle-header__meta">
            <span>
              {category.subcategories.length} {t('aisle.shelves')}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {total} {t('aisle.products')}
            </span>
            <span aria-hidden="true">·</span>
            <span aria-live="polite">🛒 {cartCount} in cart</span>
          </p>
        </div>
      </div>

      <section className="section section--framed">
        <div className="section__frame">
          <div className="aisle-items" ref={gridRef}>
            {aisle.items.map((item, index) => {
              const key = `${aisle.slug}:${item.name}`;
              const qty = cart[key] ?? 0;
              return (
                <article className="aisle-item" key={key} data-reveal="" data-reveal-index={index}>
                  <div className="aisle-item__tile" aria-hidden="true">
                    <span className="aisle-item__emoji">{item.emoji}</span>
                    {item.tag ? <span className="aisle-item__tag">{item.tag}</span> : null}
                  </div>
                  <h3 className="aisle-item__name">{item.name}</h3>
                  <p className="aisle-item__unit">{item.unit}</p>
                  <p className="aisle-item__price">Rs {item.price.toLocaleString('en-PK')}</p>

                  {qty === 0 ? (
                    <button
                      className="btn btn--solid btn--sm aisle-item__add"
                      type="button"
                      onClick={() => step(key, 1)}
                    >
                      Add
                    </button>
                  ) : (
                    <div className="aisle-item__stepper">
                      <button type="button" onClick={() => step(key, -1)} aria-label={`Remove one ${item.name}`}>
                        −
                      </button>
                      <span aria-live="polite">{qty}</span>
                      <button type="button" onClick={() => step(key, 1)} aria-label={`Add one ${item.name}`}>
                        +
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <p className="aisle-items__note">
            Showing {aisle.items.length} of {total} —{' '}
            <a
              href="#branches"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('branches')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {t('branchCta.cta')}
            </a>
          </p>

          <div className="aisle-others">
            <h2 className="aisle-others__title">{t('categories.title')}</h2>
            <div className="aisle-others__chips">
              {others.map((other) => (
                <Link className="pill" key={other.slug} to={`/aisle/${other.slug}`}>
                  {pick(other as unknown as Record<string, unknown>, 'en')}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
