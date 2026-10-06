/**
 * Product card — pack size and a View arrow rather than a price. The
 * catalogue is a stock listing; the priced items live only on aisle pages.
 */
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { getCategory, getSubcategory } from '../lib/data';
import { isRtl, pick, t } from '../lib/i18n';
import { useLang } from '../state/app-state';
import { rupees } from '../lib/money';
import { useBag } from '../state/bag';
import { offerFor, useShop } from '../state/shop';
import { AddButton } from './shop';
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

  /* With the online store on, the card also carries a price and a way to
     buy. With it off — the default — none of this renders. */
  const shop = useShop();
  const bag = useBag();
  const offer = offerFor(shop, product.sku);
  const inBag = shop.enabled ? (bag.find((item) => item.sku === product.sku)?.qty ?? 0) : 0;
  const buyable = offer !== null && offer.stock > 0 && inBag < offer.stock;

  const card = (
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
        {/* Not every listing names a pack size; an empty span keeps the
            arrow pinned to the end of the row. */}
        {offer ? (
          <span className="product-card__offer">
            {offer.stock > 0 ? (
              <strong className="product-card__price">{rupees(offer.price)}</strong>
            ) : (
              <span className="pill pill--quiet">{t('shop.outOfStock')}</span>
            )}
            <small>{inBag > 0 ? t('shop.inBag', { n: inBag }) : product.size}</small>
          </span>
        ) : product.size ? (
          <span className="pill pill--quiet">{product.size}</span>
        ) : (
          <span />
        )}
        <span className={`icon-btn icon-btn--sm${buyable ? ' product-card__go' : ''}`} aria-hidden="true">
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

  if (!shop.enabled) return card;
  /* A button cannot sit inside a link, so the card gets a wrapper and the
     button is laid over its corner. */
  return (
    <div className="product-cell" data-add-scope="">
      {card}
      {buyable ? <AddButton product={product} artFrom=".tile" className="product-cell__add" /> : null}
    </div>
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
