/**
 * What this customer buys regularly, and what they might like — worked out
 * on the server from their own orders.
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getProduct } from '../lib/data';
import { t } from '../lib/i18n';
import { useAuth } from '../state/auth';
import { ProductRail } from './ProductCard';
import type { Product } from '../lib/types';

export interface Recs {
  regulars: { sku: string; orders: number; qty: number }[];
  suggested: string[];
}

/** null while loading, or when nobody is signed in. */
export function useRecommendations(): Recs | null {
  const { user } = useAuth();
  const [recs, setRecs] = useState<Recs | null>(null);

  useEffect(() => {
    if (!user) {
      setRecs(null);
      return;
    }
    let live = true;
    api<Recs>('/recommendations').then(
      (data) => live && setRecs(data),
      () => live && setRecs({ regulars: [], suggested: [] }),
    );
    return () => {
      live = false;
    };
  }, [user]);

  return recs;
}

const known = (skus: string[]): Product[] => skus.map((sku) => getProduct(sku)).filter((p): p is Product => p !== null);

export function Recommendations({ recs, only }: { recs: Recs | null; only?: 'regulars' | 'suggested' }) {
  if (!recs) return null;
  const regulars = known(recs.regulars.map((r) => r.sku));
  const suggested = known(recs.suggested);
  return (
    <>
      {regulars.length && only !== 'suggested' ? (
        <section className="shop-recs" aria-labelledby="recs-again">
          <h2 className="shop-card__title" id="recs-again">
            {t('shop.recs.again')}
          </h2>
          <ProductRail products={regulars} />
        </section>
      ) : null}
      {suggested.length && only !== 'regulars' ? (
        <section className="shop-recs" aria-labelledby="recs-like">
          <h2 className="shop-card__title" id="recs-like">
            {t(regulars.length ? 'shop.recs.like' : 'shop.recs.popular')}
          </h2>
          <ProductRail products={suggested} />
        </section>
      ) : null}
    </>
  );
}
