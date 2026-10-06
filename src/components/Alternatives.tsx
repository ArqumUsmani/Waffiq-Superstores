/**
 * "That one is out of stock — here is what we have instead."
 *
 * Alternatives come from the same shelf, nearest in price (lib/cart.ts).
 * Shown wherever a customer runs into something they cannot buy: a product
 * page, a line in the cart, or a saved list being added to the bag.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { alternativesFor, bagItemFor, splitByStock } from '../lib/cart';
import { rupees } from '../lib/money';
import { t } from '../lib/i18n';
import { addManyToBag, addToBag } from '../state/bag';
import { useShop } from '../state/shop';
import type { Product } from '../lib/types';

export function Alternatives({
  sku,
  action,
  onPick,
  onNavigate,
}: {
  sku: string;
  /** What the button says; defaults to "Add to bag". */
  action?: string;
  /** Instead of adding to the bag — e.g. swap it for the line in the cart. */
  onPick?: (product: Product) => void;
  onNavigate?: () => void;
}) {
  const shop = useShop();
  const [picked, setPicked] = useState<string[]>([]);
  const options = alternativesFor(sku, shop);
  if (!options.length) return <p className="alts__none">{t('shop.alts.none')}</p>;

  return (
    <ul className="alts">
      {options.map((product) => (
        <li key={product.sku}>
          <Link className="alts__art" to={`/product/${encodeURIComponent(product.sku)}`} onClick={onNavigate} tabIndex={-1} aria-hidden="true">
            {product.image ? <img src={product.image} alt="" width={96} height={96} loading="lazy" /> : null}
          </Link>
          <span className="alts__body">
            <Link to={`/product/${encodeURIComponent(product.sku)}`} onClick={onNavigate}>
              {product.name}
            </Link>
            <small>{[product.size, rupees(shop.offers[product.sku]!.price)].filter(Boolean).join(' · ')}</small>
          </span>
          <button
            className="btn btn--solid btn--sm"
            type="button"
            disabled={picked.includes(product.sku)}
            onClick={() => {
              if (onPick) onPick(product);
              else addToBag(bagItemFor(product), null);
              setPicked((list) => [...list, product.sku]);
            }}
          >
            {picked.includes(product.sku) ? t('shop.alts.added') : (action ?? t('shop.add'))}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Adds a batch of items (a list, an earlier order) to the bag. Whatever is
 * in stock goes in; for whatever is not, `prompt` is the dialog to render.
 */
export function useAddWanted() {
  const shop = useShop();
  const [missing, setMissing] = useState<Product[]>([]);
  const [added, setAdded] = useState(0);

  const add = useCallback(
    (wanted: { sku: string; qty: number }[]) => {
      const { ready, missing: gone } = splitByStock(wanted, shop);
      addManyToBag(ready.map(({ product, qty }) => ({ item: bagItemFor(product), qty })));
      setAdded(ready.length);
      setMissing(gone);
      return { added: ready.length, missing: gone.length };
    },
    [shop],
  );

  const prompt = missing.length ? <StockPrompt missing={missing} added={added} onClose={() => setMissing([])} /> : null;
  return { add, prompt };
}

function StockPrompt({ missing, added, onClose }: { missing: Product[]; added: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog className="stock-prompt" ref={ref} onClose={onClose} aria-labelledby="stock-prompt-title" data-lenis-prevent="">
      <h2 id="stock-prompt-title">{t(missing.length === 1 ? 'shop.alts.titleOne' : 'shop.alts.titleMany', { n: missing.length })}</h2>
      {added > 0 ? <p className="stock-prompt__added">{t('shop.alts.restAdded', { n: added })}</p> : null}
      {missing.map((product) => (
        <section key={product.sku}>
          <h3>
            {product.name} <span className="pill pill--quiet">{t('shop.outOfStock')}</span>
          </h3>
          <p className="stock-prompt__instead">{t('shop.alts.instead')}</p>
          <Alternatives sku={product.sku} onNavigate={() => ref.current?.close()} />
        </section>
      ))}
      <button className="btn btn--ghost stock-prompt__done" type="button" onClick={() => ref.current?.close()}>
        {t('shop.alts.done')}
      </button>
    </dialog>
  );
}
