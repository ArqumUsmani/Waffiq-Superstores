import { useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { getCategory, getProduct, getSubcategory, relatedProducts } from '../lib/data';
import { isRtl, pick, t } from '../lib/i18n';
import { gsap } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { useLang } from '../state/app-state';
import { useReveal } from '../hooks/useReveal';
import { ProductArt, ProductRail } from '../components/ProductCard';

const asRecord = (value: unknown) => value as Record<string, unknown>;

export default function ProductPage() {
  const { sku } = useParams();
  const lang = useLang();
  const product = getProduct(sku);
  const category = product ? getCategory(product.category) : null;
  const shelf = product ? getSubcategory(product.subcategory) : null;

  const pageRef = useRef<HTMLDivElement>(null);
  const relatedRef = useReveal<HTMLElement>([sku]);

  useEffect(() => {
    if (product) document.title = `${product.name} — Wafiq Superstores`;
    return () => {
      document.title = 'Wafiq Superstores — Everything you need, all in one place';
    };
  }, [product]);

  /* Same entry as the vanilla page: art scales in, the info column rises
     item by item. */
  useLayoutEffect(() => {
    const root = pageRef.current;
    if (!root || !product || motion.reduced) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-product-art]', { scale: 0.92, opacity: 0, duration: 0.7, ease: 'power3.out' });
      gsap.from('.product__info > *', {
        y: 22,
        opacity: 0,
        duration: 0.6,
        stagger: 0.06,
        ease: 'power3.out',
        delay: 0.1,
      });
    }, root);
    return () => ctx.revert();
  }, [sku, lang, product]);

  if (!product || !category || !shelf) {
    return (
      <div className="empty-state shell" style={{ paddingBlock: '8rem 4rem' }}>
        <h1>{t('product.notFound')}</h1>
        <p>{t('product.notFoundBody')}</p>
        <Link className="btn btn--solid" to="/#categories">
          {t('product.browseAll')}
        </Link>
      </div>
    );
  }

  const rtl = isRtl();
  const name = rtl ? product.nameUr : product.name;
  const secondary = rtl ? product.name : product.nameUr;
  const aisleName = pick(asRecord(category), 'en');
  const shelfName = pick(asRecord(shelf), 'en');
  const aisleHref = `/aisle/${category.slug}`;

  return (
    <div
      className="product-page"
      ref={pageRef}
      style={
        { '--pastel': category.pastel, '--accent': category.accent, paddingBlockStart: '7rem' } as React.CSSProperties
      }
    >
      <nav className="crumbs shell" aria-label="Breadcrumb">
        <Link to="/">{t('nav.home')}</Link>
        <span aria-hidden="true">/</span>
        <Link to={aisleHref}>{aisleName}</Link>
        <span aria-hidden="true">/</span>
        <span>{shelfName}</span>
      </nav>

      <article className="product shell">
        <div className="product__art" data-product-art>
          <ProductArt product={product} eager />
          {product.tags.includes('popular') ? (
            <span className="sticker sticker--pop">{t('popular.eyebrow')}</span>
          ) : null}
        </div>

        <div className="product__info">
          <p className="eyebrow">{product.brand}</p>
          <h1 className="product__name">{name}</h1>
          <p className="product__alt" {...(rtl ? {} : { lang: 'ur', dir: 'rtl' })}>
            {secondary}
          </p>

          <dl className="product__facts">
            <div>
              <dt>{t('product.packSize')}</dt>
              <dd>{product.size}</dd>
            </div>
            <div>
              <dt>{t('product.brand')}</dt>
              <dd>{product.brand}</dd>
            </div>
            <div>
              <dt>{t('product.aisle')}</dt>
              <dd>
                <Link to={aisleHref}>{aisleName}</Link>
              </dd>
            </div>
            <div>
              <dt>{t('product.shelf')}</dt>
              <dd>{shelfName}</dd>
            </div>
          </dl>

          <h2 className="product__subhead">{t('product.about')}</h2>
          <p className="product__desc">{product.desc}</p>

          <p className="notice">{t('product.listingNote')}</p>

          <div className="product__actions">
            <Link className="btn btn--solid" to="/#branches">
              {t('branchCta.cta')}
            </Link>
            <Link className="btn btn--ghost" to={aisleHref}>
              {t('product.back')} {aisleName}
            </Link>
          </div>
        </div>
      </article>

      <section className="section shell" ref={relatedRef} aria-labelledby="related-title">
        <header className="section__head">
          <h2 id="related-title">{t('product.related')}</h2>
          <Link className="btn btn--pill btn--sm" to={aisleHref}>
            {t('common.showAll')}
          </Link>
        </header>
        <ProductRail products={relatedProducts(product, 6)} />
      </section>
    </div>
  );
}
