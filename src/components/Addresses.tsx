/**
 * Saved delivery addresses: the list, and the form that adds to it. Shared
 * by the checkout (where one is picked) and the account page (where they
 * are only kept in order).
 */
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { t } from '../lib/i18n';

export interface Address {
  id: number;
  line1: string;
  area: string;
  notes: string;
}

export function useAddresses() {
  const [addresses, setAddresses] = useState<Address[] | null>(null);

  const reload = useCallback(async () => {
    try {
      setAddresses((await api<{ addresses: Address[] }>('/addresses')).addresses);
    } catch {
      setAddresses([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const remove = async (id: number) => {
    await api(`/addresses/${id}`, { method: 'DELETE' });
    await reload();
  };

  return { addresses, reload, remove };
}

export function AddressForm({
  areas,
  onSaved,
  onCancel,
}: {
  areas: string[];
  onSaved: (address: Address) => void;
  onCancel?: () => void;
}) {
  const [line1, setLine1] = useState('');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { address } = await api<{ address: Address }>('/addresses', { method: 'POST', body: { line1, area, notes } });
      onSaved(address);
      setLine1('');
      setNotes('');
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="shop-form shop-form--inset" onSubmit={submit}>
      <label className="field">
        <span className="field__label">{t('shop.checkout.line1')}</span>
        <input value={line1} onChange={(e) => setLine1(e.target.value)} autoComplete="street-address" required minLength={5} maxLength={255} />
      </label>
      <label className="field">
        <span className="field__label">{t('shop.checkout.area')}</span>
        <select value={area} onChange={(e) => setArea(e.target.value)} required>
          <option value="">{t('shop.checkout.chooseArea')}</option>
          {areas.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">{t('shop.checkout.addressNotes')}</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={255} />
      </label>
      {error ? (
        <p className="notice notice--warn" role="alert">
          {error}
        </p>
      ) : null}
      <div className="shop-form__row">
        <button className="btn btn--solid btn--sm" type="submit" disabled={busy}>
          {t('shop.checkout.saveAddress')}
        </button>
        {onCancel ? (
          <button className="btn btn--ghost btn--sm" type="button" onClick={onCancel}>
            {t('shop.checkout.cancel')}
          </button>
        ) : null}
      </div>
    </form>
  );
}
