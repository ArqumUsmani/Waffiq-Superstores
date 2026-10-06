import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { AddressForm, useAddresses } from '../../components/Addresses';
import { CartBlocker, CartTotals, ShopPage, canCheckOut } from '../../components/shop';
import { api, errorMessage } from '../../lib/api';
import { priceCart } from '../../lib/cart';
import { rupees } from '../../lib/money';
import { t } from '../../lib/i18n';
import { useLang } from '../../state/app-state';
import { loadUser, useAuth } from '../../state/auth';
import { emptyBag, useBag } from '../../state/bag';
import { refreshShop, useShop } from '../../state/shop';

type Fulfilment = 'delivery' | 'pickup';

export default function CheckoutPage() {
  useLang();
  const auth = useAuth();
  const bag = useBag();
  /* Set once the order has gone through: the bag has just been emptied, but
     this is not the "your bag is empty" case. */
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    void loadUser();
  }, []);

  if (!auth.ready) {
    return (
      <ShopPage title={t('shop.checkout.title')}>
        <p className="lede">{t('shop.loading')}</p>
      </ShopPage>
    );
  }
  if (!auth.user) return <Navigate to="/login?next=/checkout" replace />;
  if (!bag.some((item) => item.sku) && !placed) return <Navigate to="/cart" replace />;

  return (
    <ShopPage title={t('shop.checkout.title')}>
      <CheckoutForm phone={auth.user.phone} onPlaced={() => setPlaced(true)} />
    </ShopPage>
  );
}

/* Its own component so the address list is only asked for once someone is signed in. */
function CheckoutForm({ phone, onPlaced }: { phone: string; onPlaced: () => void }) {
  const shop = useShop();
  const navigate = useNavigate();
  const cart = priceCart(useBag(), shop);

  const [fulfilment, setFulfilment] = useState<Fulfilment>('delivery');
  const [addressId, setAddressId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { addresses, reload } = useAddresses();
  const chosen = addresses?.find((a) => a.id === addressId) ?? addresses?.[0] ?? null;
  const ready = canCheckOut(cart, shop.config) && (fulfilment === 'pickup' || chosen !== null);

  const place = async () => {
    setBusy(true);
    setError('');
    try {
      const { order } = await api<{ order: { number: string } }>('/orders', {
        method: 'POST',
        body: {
          items: cart.lines.map((line) => ({ sku: line.item.sku, qty: line.item.qty })),
          fulfilment,
          addressId: fulfilment === 'delivery' ? chosen?.id : undefined,
          notes,
        },
      });
      onPlaced();
      emptyBag();
      void refreshShop();
      navigate(`/order/${order.number}?placed=1`, { replace: true });
    } catch (problem) {
      setError(errorMessage(problem));
      setBusy(false);
      /* Most refusals are a price or stock that moved; show the new ones. */
      void refreshShop();
    }
  };

  return (
    <div className="shop-split">
      <div className="shop-stack">
        <fieldset className="shop-choice">
          <legend>{t('shop.checkout.how')}</legend>
          {(['delivery', 'pickup'] as const).map((kind) => (
            <label key={kind} className={`shop-option${fulfilment === kind ? ' is-chosen' : ''}`}>
              <input type="radio" name="fulfilment" checked={fulfilment === kind} onChange={() => setFulfilment(kind)} />
              <span>
                <strong>{t(`shop.checkout.${kind}`)}</strong>
                <small>{t(`shop.checkout.${kind}Body`)}</small>
              </span>
            </label>
          ))}
        </fieldset>

        {fulfilment === 'delivery' ? (
          <fieldset className="shop-choice">
            <legend>{t('shop.checkout.address')}</legend>
            <p className="shop-card__hint">{t('shop.checkout.areasNote', { areas: shop.config.deliveryAreas.join(', ') })}</p>
            {addresses === null ? <p>{t('shop.loading')}</p> : null}
            {addresses?.length === 0 && !adding ? <p>{t('shop.checkout.noAddress')}</p> : null}
            {addresses?.map((address) => (
              <label key={address.id} className={`shop-option${chosen?.id === address.id ? ' is-chosen' : ''}`}>
                <input type="radio" name="address" checked={chosen?.id === address.id} onChange={() => setAddressId(address.id)} />
                <span>
                  <strong>{address.line1}</strong>
                  <small>{[address.area, address.notes].filter(Boolean).join(' · ')}</small>
                </span>
              </label>
            ))}
            {adding || addresses?.length === 0 ? (
              <AddressForm
                areas={shop.config.deliveryAreas}
                onCancel={addresses?.length ? () => setAdding(false) : undefined}
                onSaved={async (address) => {
                  await reload();
                  setAddressId(address.id);
                  setAdding(false);
                }}
              />
            ) : (
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => setAdding(true)}>
                {t('shop.checkout.addAddress')}
              </button>
            )}
          </fieldset>
        ) : null}

        <label className="field">
          <span className="field__label">{t('shop.checkout.notes')}</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} />
        </label>
      </div>

      <aside className="shop-card">
        <h2 className="shop-card__title">{t('shop.checkout.summary')}</h2>
        <ul className="shop-summary">
          {cart.lines.map((line) => (
            <li key={line.item.key}>
              <span>
                {line.item.qty} × {line.item.name}
              </span>
              <span>{line.ok ? rupees(line.total) : '—'}</span>
            </li>
          ))}
        </ul>
        <CartTotals cart={cart} config={shop.config} fulfilment={fulfilment} />
        <p className="shop-card__hint">
          {t('shop.checkout.payment')}: {t(fulfilment === 'delivery' ? 'shop.checkout.cod' : 'shop.checkout.codPickup')}.{' '}
          {t('shop.checkout.contact', { phone: phone })}
        </p>
        <CartBlocker cart={cart} config={shop.config} />
        {error ? (
          <p className="notice notice--warn" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn btn--solid shop-card__cta" type="button" disabled={!ready || busy} onClick={place}>
          {busy ? t('shop.checkout.placing') : t('shop.checkout.place')}
        </button>
        <Link className="btn btn--ghost shop-card__cta" to="/cart">
          {t('shop.cart.title')}
        </Link>
      </aside>
    </div>
  );
}
