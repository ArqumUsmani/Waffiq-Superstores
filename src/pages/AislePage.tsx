import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import aislesJson from '../data/aisles.json';
import { categories, countInCategory, getCategory, productsInCategory } from '../lib/data';
import { pick, t } from '../lib/i18n';
import { gsap } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { scrollTo } from '../lib/smooth-scroll';
import { useLang } from '../state/app-state';
import { useReveal } from '../hooks/useReveal';
import { useLaunch, type Arrival } from '../components/LaunchProvider';
import { CategoryIcon } from '../components/CategoryIcon';
import { ProductCard } from '../components/ProductCard';
import { addToBag, bagCount, useBag } from '../state/bag';
import { AddButton } from '../components/shop';
import { rupees } from '../lib/money';
import { offerFor, useShop } from '../state/shop';
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
  const shop = useShop();
  /* The store switching on swaps in cards that can be bought; they need the
     reveal set up again. */
  const gridRef = useReveal<HTMLDivElement>([slug, shop.enabled]);
  const shelfRef = useReveal<HTMLDivElement>([slug, shop.enabled]);
  const bag = useBag();

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

  const cartCount = bagCount(bag);

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
  const shelfProducts = productsInCategory(category.slug);
  /* With the store on, the strip at the top shows real products that can be
     bought — the popular ones first — instead of the showcase items. */
  const featured = shop.enabled
    ? [...shelfProducts]
        .filter((p) => (offerFor(shop, p.sku)?.stock ?? 0) > 0)
        .sort((a, b) => Number(b.tags.includes('popular')) - Number(a.tags.includes('popular')))
        .slice(0, 4)
    : [];

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
            {featured.map((product, index) => {
              const qty = bag.find((entry) => entry.sku === product.sku)?.qty ?? 0;
              return (
                <article className="aisle-item" key={product.sku} data-reveal="" data-reveal-index={index} data-add-scope="">
                  <div className="aisle-item__tile">
                    {product.image ? (
                      <img className="aisle-item__photo" src={product.image} alt="" width={480} height={480} loading="lazy" decoding="async" />
                    ) : null}
                    <AddButton product={product} artFrom=".aisle-item__photo" />
                  </div>
                  <h3 className="aisle-item__name">
                    <Link to={`/product/${encodeURIComponent(product.sku)}`}>{product.name}</Link>
                  </h3>
                  <p className="aisle-item__unit">{product.size || product.brand}</p>
                  <p className="aisle-item__price">{rupees(offerFor(shop, product.sku)!.price)}</p>
                  {qty > 0 ? <p className="aisle-item__qty">{t('shop.inBag', { n: qty })}</p> : null}
                </article>
              );
            })}
            {(shop.enabled ? [] : aisle.items).map((item, index) => {
              const key = `${aisle.slug}:${item.name}`;
              const qty = bag.find((entry) => entry.key === key)?.qty ?? 0;
              return (
                <article className="aisle-item" key={key} data-reveal="" data-reveal-index={index}>
                  <div className="aisle-item__tile">
                    {item.image ? (
                      <img
                        className="aisle-item__photo"
                        src={item.image}
                        alt=""
                        width={480}
                        height={480}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="aisle-item__emoji" aria-hidden="true">
                        {item.emoji}
                      </span>
                    )}
                    {item.tag ? <span className="aisle-item__tag">{item.tag}</span> : null}
                    {/* The picture is what flies into the bag, so the
                        click hands it over as the starting point. */}
                    <button
                      className="aisle-item__plus"
                      type="button"
                      aria-label={`Add ${item.name} to your bag`}
                      onClick={(event) => {
                        const tile = event.currentTarget.closest('.aisle-item__tile');
                        const art = tile?.querySelector('.aisle-item__photo, .aisle-item__emoji');
                        addToBag({ key, name: item.name, image: item.image, emoji: item.emoji }, art);
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </div>
                  <h3 className="aisle-item__name">{item.name}</h3>
                  <p className="aisle-item__unit">{item.unit}</p>
                  <p className="aisle-item__price">Rs {item.price.toLocaleString('en-PK')}</p>
                  {qty > 0 ? <p className="aisle-item__qty">×{qty} in your bag</p> : null}
                </article>
              );
            })}
          </div>

          <p className="aisle-items__note">
            Showing {shop.enabled ? featured.length : aisle.items.length} of {total} —{' '}
            <a
              href="#full-shelf"
              onClick={(event) => {
                event.preventDefault();
                const target = document.getElementById('full-shelf');
                if (target) scrollTo(target);
              }}
            >
              see the full shelf
            </a>{' '}
            or{' '}
            <Link to="/#branches">{t('branchCta.cta').toLowerCase()}</Link>
          </p>

          <section className="aisle-shelf" id="full-shelf" aria-labelledby="full-shelf-title">
            <h2 className="aisle-others__title" id="full-shelf-title">
              {t('category.all')} · {total} {t('aisle.products')}
            </h2>
            <div className="product-grid" ref={shelfRef}>
              {shelfProducts.map((product, index) => (
                <ProductCard key={product.sku} product={product} index={index} />
              ))}
            </div>
          </section>

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
