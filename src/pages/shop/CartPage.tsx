import { Link } from 'react-router';
import { CartBlocker, CartLines, CartTotals, ShopPage, canCheckOut } from '../../components/shop';
import { priceCart } from '../../lib/cart';
import { rupees } from '../../lib/money';
import { t } from '../../lib/i18n';
import { useLang } from '../../state/app-state';
import { useBag } from '../../state/bag';
import { useShop } from '../../state/shop';
import { useAuth } from '../../state/auth';
import { createList } from '../../state/lists';
import { Recommendations, useRecommendations } from '../../components/Recommendations';
import { useNavigate } from 'react-router';

export default function CartPage() {
  useLang();
  const shop = useShop();
  const cart = priceCart(useBag(), shop);
  const { user } = useAuth();
  const recs = useRecommendations();
  const navigate = useNavigate();

  if (!cart.lines.length) {
    return (
      <ShopPage title={t('shop.cart.empty')} narrow>
        <p className="lede">{t('shop.cart.emptyBody')}</p>
        <Link className="btn btn--solid" to="/#categories">
          {t('shop.cart.browse')}
        </Link>
      </ShopPage>
    );
  }

  const ready = canCheckOut(cart, shop.config);
  return (
    <ShopPage
      title={t('shop.cart.title')}
      eyebrow={cart.units === 1 ? t('shop.cart.item') : t('shop.cart.items', { n: cart.units })}
    >
      <div className="shop-split">
        <CartLines cart={cart} alternatives />
        <aside className="shop-card">
          <CartTotals cart={cart} config={shop.config} />
          {shop.config.freeDeliveryOver > 0 ? (
            <p className="shop-card__hint">{t('shop.cart.freeOver', { amount: rupees(shop.config.freeDeliveryOver) })}</p>
          ) : null}
          <CartBlocker cart={cart} config={shop.config} />
          {ready ? (
            <Link className="btn btn--solid shop-card__cta" to="/checkout">
              {t('shop.cart.checkout')}
            </Link>
          ) : null}
          <Link className="btn btn--ghost shop-card__cta" to="/#categories">
            {t('shop.cart.keepShopping')}
          </Link>
          {user ? (
            <button
              className="shop-form__link"
              type="button"
              onClick={() =>
                void createList(
                  t('shop.lists.weeklyName'),
                  'weekly',
                  cart.lines.map((line) => ({ sku: line.item.sku!, qty: Math.min(50, line.item.qty) })),
                ).then(() => navigate('/lists'))
              }
            >
              {t('shop.lists.saveBag')}
            </button>
          ) : null}
        </aside>
      </div>
      <Recommendations recs={recs} only="regulars" />
    </ShopPage>
  );
}
