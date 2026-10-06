import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { AddressForm, useAddresses } from '../../components/Addresses';
import { ShopPage } from '../../components/shop';
import { api } from '../../lib/api';
import { rupees } from '../../lib/money';
import { t } from '../../lib/i18n';
import { useLang } from '../../state/app-state';
import { loadUser, signOut, useAuth } from '../../state/auth';
import { useShop } from '../../state/shop';
import { InstallCard } from '../../components/AppBar';
import { Recommendations, useRecommendations } from '../../components/Recommendations';
import { orderDate, type OrderStatus } from './OrderPage';

interface OrderRow {
  number: string;
  status: OrderStatus;
  fulfilment: 'delivery' | 'pickup';
  total: number;
  created_at: string;
}

export default function AccountPage() {
  useLang();
  const auth = useAuth();

  useEffect(() => {
    void loadUser();
  }, []);

  if (!auth.ready) {
    return (
      <ShopPage title={t('shop.acct.title')}>
        <p className="lede">{t('shop.loading')}</p>
      </ShopPage>
    );
  }
  if (!auth.user) return <Navigate to="/login?next=/account" replace />;

  return (
    <ShopPage title={t('shop.acct.hello', { name: auth.user.name })} eyebrow={t('shop.acct.title')}>
      <p className="shop-account__who">
        <span dir="ltr">{[auth.user.email, auth.user.phone].filter(Boolean).join(' · ')}</span>
        <Link className="btn btn--solid btn--sm" to="/lists">
          {t('shop.lists.title')}
        </Link>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => void signOut()}>
          {t('shop.auth.signOut')}
        </button>
        {auth.user.role === 'admin' ? (
          <a className="btn btn--pill btn--sm" href="/admin">
            {t('shop.acct.admin')}
          </a>
        ) : null}
      </p>
      <InstallCard />
      <div className="shop-split shop-split--even">
        <Orders />
        <SavedAddresses />
      </div>
      <AccountRecs />
    </ShopPage>
  );
}

function AccountRecs() {
  return <Recommendations recs={useRecommendations()} />;
}

function Orders() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  /* Re-read now and then, so a status the store changes shows up here too. */
  useEffect(() => {
    const load = () => {
      if (document.hidden) return;
      api<{ orders: OrderRow[] }>('/orders').then(
        (data) => setOrders(data.orders),
        () => setOrders((current) => current ?? []),
      );
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="shop-stack" aria-labelledby="acct-orders">
      <h2 className="shop-card__title" id="acct-orders">
        {t('shop.acct.orders')}
      </h2>
      {orders === null ? <p>{t('shop.loading')}</p> : null}
      {orders?.length === 0 ? <p>{t('shop.acct.noOrders')}</p> : null}
      <ul className="order-list">
        {orders?.map((order) => (
          <li key={order.number}>
            <Link to={`/order/${order.number}`}>
              <span>
                <strong>{order.number}</strong>
                <small>{orderDate(order.created_at)}</small>
              </span>
              <span className={`status status--${order.status}`}>{t(`shop.order.s.${order.status}`)}</span>
              <span className="order-list__total">{rupees(order.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SavedAddresses() {
  const shop = useShop();
  const { addresses, reload, remove } = useAddresses();
  const [adding, setAdding] = useState(false);

  return (
    <section className="shop-stack" aria-labelledby="acct-addresses">
      <h2 className="shop-card__title" id="acct-addresses">
        {t('shop.acct.addresses')}
      </h2>
      {addresses === null ? <p>{t('shop.loading')}</p> : null}
      {addresses?.length === 0 && !adding ? <p>{t('shop.checkout.noAddress')}</p> : null}
      <ul className="order-list">
        {addresses?.map((address) => (
          <li key={address.id}>
            <div>
              <span>
                <strong>{address.line1}</strong>
                <small>{[address.area, address.notes].filter(Boolean).join(' · ')}</small>
              </span>
              <button className="cart-line__remove" type="button" onClick={() => void remove(address.id)}>
                {t('shop.checkout.deleteAddress')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {adding ? (
        <AddressForm
          areas={shop.config.deliveryAreas}
          onCancel={() => setAdding(false)}
          onSaved={async () => {
            await reload();
            setAdding(false);
          }}
        />
      ) : (
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setAdding(true)}>
          {t('shop.checkout.addAddress')}
        </button>
      )}
    </section>
  );
}
