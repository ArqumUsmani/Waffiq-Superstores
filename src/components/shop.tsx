/**
 * The pieces the online store adds to the catalogue: the add-to-bag button,
 * the priced list of what is in the bag, and the gate that keeps the shop's
 * own pages out of sight while the store is switched off.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { bagItemFor, type Cart } from '../lib/cart';
import { rupees } from '../lib/money';
import { t } from '../lib/i18n';
import { addToBag, setBagQty } from '../state/bag';
import { deliveryFeeFor, useShop, type ShopConfig } from '../state/shop';
import NotFound from '../pages/NotFound';
import type { Product } from '../lib/types';

/** The round plus button. `artFrom` finds the picture that flies into the bag. */
export function AddButton({
  product,
  artFrom,
  className = '',
}: {
  product: Product;
  /** A selector, looked up from the nearest [data-add-scope] ancestor. */
  artFrom: string;
  className?: string;
}) {
  return (
    <button
      className={`aisle-item__plus ${className}`.trim()}
      type="button"
      aria-label={t('shop.addNamed', { name: product.name })}
      onClick={(event) => {
        const scope = event.currentTarget.closest('[data-add-scope]');
        addToBag(bagItemFor(product), scope?.querySelector(artFrom));
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}

/** Every line in the bag, with its quantity control and what it comes to. */
export function CartLines({ cart, onNavigate }: { cart: Cart; onNavigate?: () => void }) {
  return (
    <ul className="cart-lines">
      {cart.lines.map(({ item, offer, max, ok, total }) => (
        <li className={`cart-line${ok ? '' : ' is-blocked'}`} key={item.key}>
          <Link className="cart-line__art" to={`/product/${encodeURIComponent(item.sku!)}`} onClick={onNavigate} tabIndex={-1} aria-hidden="true">
            {item.image ? <img src={item.image} alt="" width={96} height={96} loading="lazy" /> : <span>{item.emoji}</span>}
          </Link>
          <div className="cart-line__body">
            <Link className="cart-line__name" to={`/product/${encodeURIComponent(item.sku!)}`} onClick={onNavigate}>
              {item.name}
            </Link>
            <p className="cart-line__meta">
              {[item.size, offer ? `${rupees(offer.price)} ${t('shop.cart.each')}` : null].filter(Boolean).join(' · ')}
            </p>
            {ok ? null : (
              <p className="cart-line__warn" role="alert">
                {max > 0 ? t('shop.cart.onlyLeft', { n: max }) : t('shop.cart.gone')}
              </p>
            )}
          </div>
          <div className="cart-line__side">
            <div className="stepper" role="group" aria-label={`${t('shop.cart.qty')} — ${item.name}`}>
              <button type="button" aria-label={item.qty === 1 ? t('shop.cart.remove') : t('shop.cart.less')} onClick={() => setBagQty(item.key, item.qty - 1)}>
                −
              </button>
              <output aria-live="polite">{item.qty}</output>
              <button type="button" aria-label={t('shop.cart.more')} disabled={item.qty >= max} onClick={() => setBagQty(item.key, item.qty + 1)}>
                +
              </button>
            </div>
            <p className="cart-line__total">{ok ? rupees(total) : '—'}</p>
            <button className="cart-line__remove" type="button" onClick={() => setBagQty(item.key, 0)}>
              {t('shop.cart.remove')}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Subtotal, delivery and total. Without `fulfilment` the delivery line is left open. */
export function CartTotals({
  cart,
  config,
  fulfilment,
}: {
  cart: Cart;
  config: ShopConfig;
  fulfilment?: 'delivery' | 'pickup';
}) {
  const fee = fulfilment === 'delivery' ? deliveryFeeFor(config, cart.subtotal) : 0;
  return (
    <dl className="cart-totals">
      <div>
        <dt>{t('shop.cart.subtotal')}</dt>
        <dd>{rupees(cart.subtotal)}</dd>
      </div>
      {fulfilment ? (
        <>
          {fulfilment === 'delivery' ? (
            <div>
              <dt>{t('shop.cart.delivery')}</dt>
              <dd>{fee ? rupees(fee) : t('shop.cart.free')}</dd>
            </div>
          ) : null}
          <div className="cart-totals__total">
            <dt>{t('shop.cart.total')}</dt>
            <dd>{rupees(cart.subtotal + fee)}</dd>
          </div>
        </>
      ) : (
        <div>
          <dt>{t('shop.cart.delivery')}</dt>
          <dd>{t('shop.cart.deliveryLater')}</dd>
        </div>
      )}
    </dl>
  );
}

/** Why the bag cannot go to checkout yet, if it cannot. */
export function CartBlocker({ cart, config }: { cart: Cart; config: ShopConfig }) {
  if (cart.blocked) return <p className="notice notice--warn">{t('shop.cart.fix')}</p>;
  if (cart.subtotal < config.minOrder) {
    return (
      <p className="notice notice--warn">
        {t('shop.cart.min', { amount: rupees(config.minOrder), more: rupees(config.minOrder - cart.subtotal) })}
      </p>
    );
  }
  return null;
}

export const canCheckOut = (cart: Cart, config: ShopConfig): boolean =>
  cart.lines.length > 0 && !cart.blocked && cart.subtotal >= config.minOrder;

/** The frame every shop page sits in. */
export function ShopPage({ title, eyebrow, children, narrow = false }: { title: string; eyebrow?: string; children: ReactNode; narrow?: boolean }) {
  return (
    <section className="section section--framed shop-page">
      <div className={`section__frame${narrow ? ' shop-page__narrow' : ''}`}>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="shop-page__title">{title}</h1>
        {children}
      </div>
    </section>
  );
}

/**
 * Shop pages exist only while the store is on. Off, they are the same "not
 * found" any other unknown address gets — the site gives no hint of a shop.
 */
export function ShopGate({ children }: { children: ReactNode }) {
  const shop = useShop();
  if (!shop.ready) {
    return (
      <section className="section section--framed shop-page">
        <div className="section__frame">
          <p className="lede">{t('shop.loading')}</p>
        </div>
      </section>
    );
  }
  return shop.enabled ? <>{children}</> : <NotFound />;
}
