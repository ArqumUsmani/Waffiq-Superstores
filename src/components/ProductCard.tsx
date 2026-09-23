/**
 * Product card — pack size and a View arrow rather than a price. The 202-item
 * catalogue is a stock listing; the priced items live only on aisle pages.
 */
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { getCategory, getSubcategory } from '../lib/data';
import { isRtl, pick, t } from '../lib/i18n';
import { useLang } from '../state/app-state';
import type { Product } from '../lib/types';

export function ProductArt({
  product,
  eager = false,
}: {
  product: Product;
  eager?: boolean;
}) {
  if (!product.image) return null;
  return (
    <img
      className="tile"
      src={product.image}
      alt={product.name}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      width={400}
      height={400}
    />
  );
}

export function ProductCard({
  product,
  index = 0,
  eager = false,
}: {
  product: Product;
  index?: number;
  eager?: boolean;
}) {
  useLang();
  const category = getCategory(product.category);
  const shelf = getSubcategory(product.subcategory);
  const rtl = isRtl();
  const name = rtl ? product.nameUr : product.name;
  const secondary = rtl ? product.name : product.nameUr;

  return (
    <Link
      className="product-card"
      to={`/product/${encodeURIComponent(product.sku)}`}
      data-sku={product.sku}
      data-reveal=""
      data-reveal-index={index}
      aria-label={`${product.name} — ${t('product.viewProduct')}`}
    >
      <span
        className="product-card__art"
        style={{ '--aisle': category?.accent ?? '#136f37' } as React.CSSProperties}
      >
        <ProductArt product={product} eager={eager} />
        {product.tags.includes('popular') ? <span className="product-card__flag">★</span> : null}
      </span>
      <span className="product-card__body">
        <span className="product-card__brand">{product.brand}</span>
        <span className="product-card__name">{name}</span>
        <span className="product-card__alt" {...(rtl ? {} : { lang: 'ur', dir: 'rtl' })}>
          {secondary}
        </span>
        <span className="product-card__shelf">
          {pick(shelf as unknown as Record<string, unknown>, 'en')}
        </span>
      </span>
      <span className="product-card__foot">
        <span className="pill pill--quiet">{product.size}</span>
        <span className="icon-btn icon-btn--sm" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </span>
    </Link>
  );
}

/** A row where the hovered card lifts and its neighbours recede. */
export function ProductRail({ products, eager = 0 }: { products: Product[]; eager?: number }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      className={`product-rail${focused ? ' is-focused' : ''}`}
      ref={ref}
      onPointerEnter={() => setFocused(true)}
      onPointerLeave={() => setFocused(false)}
    >
      {products.map((product, index) => (
        <ProductCard key={product.sku} product={product} index={index} eager={index < eager} />
      ))}
    </div>
  );
}
