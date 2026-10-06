import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router';
import { PartyPoppers } from '../../components/PartyPoppers';
import { ShopPage } from '../../components/shop';
import { api, errorMessage } from '../../lib/api';
import { rupees } from '../../lib/money';
import { t } from '../../lib/i18n';
import { useLang } from '../../state/app-state';
import { loadUser, useAuth } from '../../state/auth';
import { refreshShop } from '../../state/shop';

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled';

interface Order {
  number: string;
  status: OrderStatus;
  fulfilment: 'delivery' | 'pickup';
  contact_name: string;
  contact_phone: string;
  address_line: string;
  area: string;
  notes: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  items: { sku: string; name: string; size: string; price: number; qty: number }[];
}

/** The API's times are UTC, written "2026-10-06 09:30:00". */
export const orderDate = (stamp: string): string =>
  new Date(`${stamp.replace(' ', 'T')}Z`).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });

const stepsFor = (fulfilment: Order['fulfilment']): OrderStatus[] => [
  'placed',
  'confirmed',
  'packed',
  fulfilment === 'delivery' ? 'out_for_delivery' : 'ready_for_pickup',
  'completed',
];

export default function OrderPage() {
  useLang();
  const { number = '' } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const auth = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadUser();
  }, []);

  const load = useCallback(async () => {
    try {
      setOrder((await api<{ order: Order }>(`/orders/${encodeURIComponent(number)}`)).order);
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }, [number]);

  useEffect(() => {
    if (auth.user) void load();
  }, [auth.user, load]);

  if (auth.ready && !auth.user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (error && !order) {
    return (
      <ShopPage title={t('shop.order.notFound')} narrow>
        <p className="lede">{error}</p>
        <Link className="btn btn--solid" to="/account">
          {t('shop.order.all')}
        </Link>
      </ShopPage>
    );
  }
  if (!order) {
    return (
      <ShopPage title={t('shop.order.title', { number })}>
        <p className="lede">{t('shop.loading')}</p>
      </ShopPage>
    );
  }

  const justPlaced = params.get('placed') === '1' && order.status === 'placed';
  const steps = stepsFor(order.fulfilment);
  const reached = steps.indexOf(order.status);

  const cancel = async () => {
    if (!window.confirm(t('shop.order.cancelConfirm'))) return;
    setBusy(true);
    setError('');
    try {
      await api(`/orders/${encodeURIComponent(order.number)}/cancel`, { method: 'POST' });
      await load();
      /* The stock is back on the shelf. */
      void refreshShop();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ShopPage
      title={justPlaced ? t('shop.order.placedTitle') : t('shop.order.title', { number: order.number })}
      eyebrow={justPlaced ? t('shop.order.title', { number: order.number }) : t('shop.order.placedOn', { date: orderDate(order.created_at) })}
    >
      {justPlaced ? <PartyPoppers id={order.number} /> : null}
      {justPlaced ? <p className="lede">{t('shop.order.placedBody')}</p> : null}

      {order.status === 'cancelled' ? (
        <p className="notice notice--warn">{t('shop.order.cancelled')}</p>
      ) : (
        <ol className="order-steps" aria-label={t('shop.order.status')}>
          {steps.map((step, index) => (
            <li
              key={step}
              className={index < reached ? 'is-done' : index === reached ? 'is-current' : ''}
              aria-current={index === reached ? 'step' : undefined}
            >
              {t(`shop.order.s.${step}`)}
            </li>
          ))}
        </ol>
      )}

      <div className="shop-split">
        <div className="shop-stack">
          <h2 className="shop-card__title">{t('shop.order.items')}</h2>
          <ul className="shop-summary shop-summary--roomy">
            {order.items.map((item) => (
              <li key={item.sku}>
                <span>
                  {item.qty} × {item.name}
                  {item.size ? <small> · {item.size}</small> : null}
                </span>
                <span>{rupees(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="shop-card">
          <dl className="cart-totals">
            <div>
              <dt>{t('shop.cart.subtotal')}</dt>
              <dd>{rupees(order.subtotal)}</dd>
            </div>
            {order.fulfilment === 'delivery' ? (
              <div>
                <dt>{t('shop.cart.delivery')}</dt>
                <dd>{order.delivery_fee ? rupees(order.delivery_fee) : t('shop.cart.free')}</dd>
              </div>
            ) : null}
            <div className="cart-totals__total">
              <dt>{t('shop.cart.total')}</dt>
              <dd>{rupees(order.total)}</dd>
            </div>
          </dl>
          <dl className="order-facts">
            <dt>{t(order.fulfilment === 'delivery' ? 'shop.order.deliverTo' : 'shop.order.pickupFrom')}</dt>
            <dd>
              {order.fulfilment === 'delivery' ? `${order.address_line}, ${order.area}` : t('shop.order.pickupAddress')}
            </dd>
            <dt>{t('shop.order.payment')}</dt>
            <dd>{t(order.fulfilment === 'delivery' ? 'shop.checkout.cod' : 'shop.checkout.codPickup')}</dd>
            {order.notes ? (
              <>
                <dt>{t('shop.order.notes')}</dt>
                <dd>{order.notes}</dd>
              </>
            ) : null}
          </dl>
          {error ? (
            <p className="notice notice--warn" role="alert">
              {error}
            </p>
          ) : null}
          {order.status === 'placed' ? (
            <button className="btn btn--ghost shop-card__cta" type="button" onClick={cancel} disabled={busy}>
              {t('shop.order.cancel')}
            </button>
          ) : null}
          <Link className="btn btn--solid shop-card__cta" to="/#categories">
            {t('shop.order.continue')}
          </Link>
          <Link className="btn btn--ghost shop-card__cta" to="/account">
            {t('shop.order.all')}
          </Link>
        </aside>
      </div>
    </ShopPage>
  );
}
