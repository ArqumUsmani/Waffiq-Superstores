/**
 * Shopping lists: the things a household buys every week or every month,
 * kept so they can go into the bag in one tap instead of being hunted down
 * aisle by aisle each time.
 */
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useAddWanted } from '../../components/Alternatives';
import { useRecommendations } from '../../components/Recommendations';
import { ShopPage } from '../../components/shop';
import { errorMessage } from '../../lib/api';
import { getProduct } from '../../lib/data';
import { rupees } from '../../lib/money';
import { t } from '../../lib/i18n';
import { useLang } from '../../state/app-state';
import { loadUser, useAuth } from '../../state/auth';
import { createList, deleteList, loadLists, saveList, useLists, type Cadence, type ShoppingList } from '../../state/lists';
import { useShop } from '../../state/shop';

const CADENCES: Cadence[] = ['weekly', 'monthly', 'none'];

export default function ListsPage() {
  useLang();
  const auth = useAuth();
  const lists = useLists();
  const recs = useRecommendations();
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState<Cadence>('weekly');
  const [error, setError] = useState('');

  useEffect(() => {
    void loadUser();
  }, []);
  useEffect(() => {
    if (auth.user) void loadLists();
  }, [auth.user]);

  if (auth.ready && !auth.user) return <Navigate to="/login?next=/lists" replace />;

  const guard = async (work: () => Promise<unknown>) => {
    setError('');
    try {
      await work();
    } catch (problem) {
      setError(errorMessage(problem));
    }
  };

  /* Bought in at least two separate orders: a habit, not a one-off. */
  const regulars = (recs?.regulars ?? []).filter((r) => r.orders >= 2);

  return (
    <ShopPage title={t('shop.lists.title')} eyebrow={t('shop.acct.title')}>
      <p className="lede">{t('shop.lists.lede')}</p>
      {error ? (
        <p className="notice notice--warn" role="alert">
          {error}
        </p>
      ) : null}

      {regulars.length >= 3 && lists?.length === 0 ? (
        <div className="notice shop-suggest">
          <p>{t('shop.lists.suggest', { n: regulars.length })}</p>
          <button
            className="btn btn--solid btn--sm"
            type="button"
            onClick={() => void guard(() => createList(t('shop.lists.regularName'), 'weekly', regulars.map(({ sku, qty }) => ({ sku, qty }))))}
          >
            {t('shop.lists.suggestCta')}
          </button>
        </div>
      ) : null}

      {lists === null ? <p>{t('shop.loading')}</p> : null}
      <div className="shop-lists">
        {lists?.map((list) => <ListCard key={list.id} list={list} onError={setError} />)}
      </div>

      <form
        className="shop-form shop-form--inset shop-lists__new"
        onSubmit={(event) => {
          event.preventDefault();
          void guard(async () => {
            await createList(name, cadence);
            setName('');
          });
        }}
      >
        <h2 className="shop-card__title">{t('shop.lists.new')}</h2>
        <label className="field">
          <span className="field__label">{t('shop.lists.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('shop.lists.namePlaceholder')} required maxLength={80} />
        </label>
        <label className="field">
          <span className="field__label">{t('shop.lists.cadence')}</span>
          <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
            {CADENCES.map((c) => (
              <option key={c} value={c}>
                {t(`shop.lists.c.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn--solid btn--sm" type="submit">
          {t('shop.lists.create')}
        </button>
        <p className="shop-card__hint">{t('shop.lists.how')}</p>
      </form>
    </ShopPage>
  );
}

function ListCard({ list, onError }: { list: ShoppingList; onError: (message: string) => void }) {
  const shop = useShop();
  const { add, prompt } = useAddWanted();
  /* Everything is ticked to start with; untick what is not needed this time. */
  const [skipped, setSkipped] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const save = (next: ShoppingList) => saveList(next).catch((problem) => onError(errorMessage(problem)));
  const chosen = list.items.filter((item) => !skipped.includes(item.sku));
  const total = chosen.reduce((sum, item) => {
    const offer = shop.offers[item.sku];
    return sum + (offer && offer.stock > 0 ? offer.price * item.qty : 0);
  }, 0);

  return (
    <section className="shop-card shop-list" aria-label={list.name}>
      {prompt}
      <header className="shop-list__head">
        <h2 className="shop-card__title">{list.name}</h2>
        <select value={list.cadence} onChange={(e) => void save({ ...list, cadence: e.target.value as Cadence })} aria-label={t('shop.lists.cadence')}>
          {CADENCES.map((c) => (
            <option key={c} value={c}>
              {t(`shop.lists.c.${c}`)}
            </option>
          ))}
        </select>
      </header>

      {list.items.length === 0 ? <p className="shop-card__hint">{t('shop.lists.empty')}</p> : null}
      <ul className="shop-list__items">
        {list.items.map((item) => {
          const product = getProduct(item.sku);
          if (!product) return null;
          const offer = shop.offers[item.sku];
          const out = !offer || offer.stock === 0;
          return (
            <li key={item.sku} className={out ? 'is-out' : ''}>
              <input
                type="checkbox"
                checked={!skipped.includes(item.sku)}
                onChange={(e) => setSkipped((s) => (e.target.checked ? s.filter((sku) => sku !== item.sku) : [...s, item.sku]))}
                aria-label={product.name}
              />
              <span className="shop-list__name">
                <Link to={`/product/${encodeURIComponent(item.sku)}`}>{product.name}</Link>
                <small>
                  {out ? t('shop.outOfStock') : [product.size, rupees(offer.price)].filter(Boolean).join(' · ')}
                </small>
              </span>
              <span className="stepper" role="group" aria-label={`${t('shop.cart.qty')} — ${product.name}`}>
                <button
                  type="button"
                  aria-label={item.qty === 1 ? t('shop.cart.remove') : t('shop.cart.less')}
                  onClick={() =>
                    void save({
                      ...list,
                      items: item.qty === 1 ? list.items.filter((i) => i.sku !== item.sku) : list.items.map((i) => (i.sku === item.sku ? { ...i, qty: i.qty - 1 } : i)),
                    })
                  }
                >
                  −
                </button>
                <output>{item.qty}</output>
                <button
                  type="button"
                  aria-label={t('shop.cart.more')}
                  disabled={item.qty >= 50}
                  onClick={() => void save({ ...list, items: list.items.map((i) => (i.sku === item.sku ? { ...i, qty: i.qty + 1 } : i)) })}
                >
                  +
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      {list.items.length ? (
        <p className="shop-list__total">
          <span>{t('shop.lists.selected', { n: chosen.length })}</span>
          <strong>{rupees(total)}</strong>
        </p>
      ) : null}
      {note ? (
        <p className="shop-card__hint" role="status">
          {note}
        </p>
      ) : null}
      <div className="shop-form__row">
        <button
          className="btn btn--solid btn--sm"
          type="button"
          disabled={chosen.length === 0}
          onClick={() => {
            const result = add(chosen);
            setNote(result.added ? t('shop.lists.addedNote', { n: result.added }) : '');
          }}
        >
          {t('shop.lists.addToBag')}
        </button>
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          onClick={() => {
            if (window.confirm(t('shop.lists.deleteConfirm', { name: list.name }))) void deleteList(list.id).catch((problem) => onError(errorMessage(problem)));
          }}
        >
          {t('shop.lists.delete')}
        </button>
      </div>
    </section>
  );
}
