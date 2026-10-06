/** "Add to a list" for one product — shown to signed-in customers on the product page. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { t } from '../lib/i18n';
import { useAuth } from '../state/auth';
import { addToList, createList, loadLists, useLists } from '../state/lists';

export function SaveToList({ sku }: { sku: string }) {
  const { user } = useAuth();
  const lists = useLists();
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (user && lists === null) void loadLists();
  }, [user, lists]);

  if (!user) return null;

  const pick = async (value: string) => {
    if (!value) return;
    try {
      if (value === 'new-weekly') await createList(t('shop.lists.weeklyName'), 'weekly', [{ sku, qty: 1 }]);
      else if (value === 'new-monthly') await createList(t('shop.lists.monthlyName'), 'monthly', [{ sku, qty: 1 }]);
      else {
        const list = lists?.find((l) => String(l.id) === value);
        if (list) await addToList(list, sku);
      }
      setSaved(t('shop.lists.savedTo'));
    } catch {
      setSaved('');
    }
  };

  return (
    <p className="save-to-list">
      <select value="" onChange={(e) => void pick(e.target.value)} aria-label={t('shop.lists.addTo')}>
        <option value="">{t('shop.lists.addTo')}</option>
        {lists?.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
        <option value="new-weekly">{t('shop.lists.newWeekly')}</option>
        <option value="new-monthly">{t('shop.lists.newMonthly')}</option>
      </select>
      {saved ? (
        <span role="status">
          {saved} <Link to="/lists">{t('shop.lists.title')}</Link>
        </span>
      ) : null}
    </p>
  );
}
