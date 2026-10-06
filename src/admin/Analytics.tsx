/**
 * Analytics and suggestions. Every suggestion carries the reason the server
 * worked out for it, in plain words, so nothing here has to be taken on
 * trust.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { getCategory, getSubcategory } from '../lib/data';
import { rupees } from '../lib/money';
import { Bars, BusyGrid } from './charts';
import { Page, Problem, Thumb, useLoad } from './pages';

interface Sold {
  sku: string;
  name: string;
  image: string | null;
  units: number;
  revenue: number;
}

interface Report {
  days: number;
  bestSellers: Sold[];
  topRevenue: Sold[];
  categories: { category: string; units: number; revenue: number }[];
  restock: { sku: string; name: string; image: string | null; stock: number; reorderLevel: number; units: number; daysLeft: number | null; suggestedOrder: number; reason: string }[];
  slow: { sku: string; name: string; image: string | null; stock: number; units: number; tiedUp: number; reason: string }[];
  performers: { sku: string; name: string; image: string | null; units: number; subcategory: string; reason: string }[];
  busy: { weekday: number; hour: number; orders: number }[];
}

const SPANS = [7, 30, 60, 90];

const edit = (name: string) => `/admin/products?q=${encodeURIComponent(name)}`;

export function Analytics() {
  const [span, setSpan] = useState(30);
  const { data, error } = useLoad<Report>(`/admin/analytics?days=${span}`);

  return (
    <Page
      title="Analytics"
      actions={
        <div className="adm-seg" role="tablist">
          {SPANS.map((days) => (
            <button key={days} type="button" role="tab" aria-selected={span === days} className={span === days ? 'is-current' : ''} onClick={() => setSpan(days)}>
              {days} days
            </button>
          ))}
        </div>
      }
    >
      <Problem error={error} />
      {data ? (
        <div className="adm-grid">
          <section className="adm-card adm-card--full">
            <h2>
              Needs restocking <span className="adm-count">{data.restock.length}</span>
            </h2>
            <p className="adm-sub">At or below the reorder level, or on course to run out within a week. The suggested order covers about three weeks of sales.</p>
            {data.restock.length ? (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="is-num">In stock</th>
                      <th className="is-num">Sold</th>
                      <th className="is-num">Days left</th>
                      <th className="is-num">Order</th>
                      <th>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.restock.map((row) => (
                      <tr key={row.sku} className={row.stock === 0 ? 'is-out' : 'is-low'}>
                        <td>
                          <Link className="adm-product" to={edit(row.name)}>
                            <Thumb src={row.image} />
                            <span>{row.name}</span>
                          </Link>
                        </td>
                        <td className="is-num">{row.stock}</td>
                        <td className="is-num">{row.units}</td>
                        <td className="is-num">{row.daysLeft ?? '—'}</td>
                        <td className="is-num">
                          <strong>{row.suggestedOrder || '—'}</strong>
                        </td>
                        <td>{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="adm-empty">Nothing needs restocking.</p>
            )}
          </section>

          <section className="adm-card">
            <h2>Best sellers, by units</h2>
            <Bars rows={data.bestSellers.map((p) => ({ key: p.sku, label: p.name, value: p.units, shown: String(p.units), note: rupees(p.revenue) }))} />
          </section>

          <section className="adm-card">
            <h2>Top earners, by revenue</h2>
            <Bars rows={data.topRevenue.map((p) => ({ key: p.sku, label: p.name, value: p.revenue, shown: rupees(p.revenue), note: `${p.units} sold` }))} />
          </section>

          <section className="adm-card">
            <h2>Aisles</h2>
            <Bars
              rows={data.categories.map((c) => ({
                key: c.category,
                label: getCategory(c.category)?.en ?? c.category,
                value: c.revenue,
                shown: rupees(c.revenue),
                note: `${c.units} units`,
              }))}
            />
          </section>

          <section className="adm-card">
            <h2>Busy times</h2>
            <p className="adm-sub">When orders come in, Pakistan time. Darker is busier.</p>
            <BusyGrid busy={data.busy} />
          </section>

          <section className="adm-card">
            <h2>
              Doing well <span className="adm-count">{data.performers.length}</span>
            </h2>
            <p className="adm-sub">Selling well ahead of the rest of their shelf — worth keeping in stock and giving more room.</p>
            <ul className="adm-list">
              {data.performers.map((row) => (
                <li key={row.sku}>
                  <Thumb src={row.image} />
                  <span>
                    <Link to={edit(row.name)}>{row.name}</Link>
                    <small>
                      {getSubcategory(row.subcategory)?.en ?? row.subcategory} · {row.units} sold. {row.reason}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
            {data.performers.length === 0 ? <p className="adm-empty">No stand-outs in this period.</p> : null}
          </section>

          <section className="adm-card">
            <h2>
              Slow movers <span className="adm-count">{data.slow.length}</span>
            </h2>
            <p className="adm-sub">In stock but barely selling — money sitting on the shelf. Consider a lower price, a promotion, or ordering less.</p>
            <ul className="adm-list">
              {data.slow.map((row) => (
                <li key={row.sku}>
                  <Thumb src={row.image} />
                  <span>
                    <Link to={edit(row.name)}>{row.name}</Link>
                    <small>
                      {row.reason} {row.stock} in stock, worth {rupees(row.tiedUp)}.
                    </small>
                  </span>
                </li>
              ))}
            </ul>
            {data.slow.length === 0 ? <p className="adm-empty">Everything in stock is selling.</p> : null}
          </section>
        </div>
      ) : null}
    </Page>
  );
}
