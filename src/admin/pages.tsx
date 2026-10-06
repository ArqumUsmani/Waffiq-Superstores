import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api, errorMessage } from '../lib/api';
import { categories, getCategory } from '../lib/data';
import { rupees } from '../lib/money';
import { orderDate, type OrderStatus } from '../pages/shop/OrderPage';
import { refreshShop } from '../state/shop';
import { RevenueChart, fillDays, type DayPoint } from './charts';

/* ---------------- shared ---------------- */

/** Loads one admin endpoint, and again whenever its path changes. */
export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setData(await api<T>(path));
      setError('');
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, reload };
}

export function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <header className="adm-head">
        <h1>{title}</h1>
        {actions}
      </header>
      {children}
    </>
  );
}

export const Problem = ({ error }: { error: string }) =>
  error ? (
    <p className="adm-alert" role="alert">
      {error}
    </p>
  ) : null;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'New',
  confirmed: 'Confirmed',
  packed: 'Packed',
  out_for_delivery: 'Out for delivery',
  ready_for_pickup: 'Ready to collect',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** What the button that moves an order on is called. */
const ACTION_LABEL: Record<OrderStatus, string> = {
  placed: 'Placed',
  confirmed: 'Confirm order',
  packed: 'Mark as packed',
  out_for_delivery: 'Send out for delivery',
  ready_for_pickup: 'Ready to collect',
  completed: 'Mark as completed',
  cancelled: 'Cancel order',
};

export const StatusTag = ({ status }: { status: OrderStatus }) => (
  <span className={`adm-tag adm-tag--${status}`}>{STATUS_LABEL[status]}</span>
);

export const Thumb = ({ src }: { src: string | null }) =>
  src ? <img className="adm-thumb" src={src} alt="" width={36} height={36} loading="lazy" /> : <span className="adm-thumb" />;

/* ---------------- dashboard ---------------- */

interface Totals {
  revenue: number;
  orders: number;
  average: number;
  newCustomers: number;
}

interface Summary {
  today: Totals;
  week: Totals;
  month: Totals;
  series: DayPoint[];
  waiting: Partial<Record<OrderStatus, number>>;
  stock: { low: number; out: number };
}

const WINDOWS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'Last 30 days' },
] as const;

export function Dashboard() {
  const { data, error } = useLoad<Summary>('/admin/summary');
  const settings = useLoad<{ settings: { ecommerce: boolean } }>('/admin/settings');
  const [period, setPeriod] = useState<(typeof WINDOWS)[number]['key']>('today');
  const totals = data?.[period];
  const waiting = data ? Object.entries(data.waiting) : [];

  return (
    <Page
      title="Dashboard"
      actions={
        <div className="adm-seg" role="tablist">
          {WINDOWS.map((w) => (
            <button key={w.key} type="button" role="tab" aria-selected={period === w.key} className={period === w.key ? 'is-current' : ''} onClick={() => setPeriod(w.key)}>
              {w.label}
            </button>
          ))}
        </div>
      }
    >
      <Problem error={error} />
      {settings.data && !settings.data.settings.ecommerce ? (
        <p className="adm-alert adm-alert--info">
          The online store is switched off — customers see the listing site only. <Link to="/admin/settings">Switch it on in Settings</Link>.
        </p>
      ) : null}

      <div className="adm-stats">
        <Stat label="Revenue" value={totals ? rupees(totals.revenue) : '—'} />
        <Stat label="Orders" value={totals ? String(totals.orders) : '—'} />
        <Stat label="Average order" value={totals ? rupees(totals.average) : '—'} />
        <Stat label="New customers" value={totals ? String(totals.newCustomers) : '—'} />
      </div>

      <div className="adm-grid">
        <section className="adm-card adm-card--wide">
          <h2>Revenue, last 30 days</h2>
          {data ? <RevenueChart series={fillDays(data.series, 30)} /> : null}
        </section>

        <section className="adm-card">
          <h2>Needs your attention</h2>
          <ul className="adm-todo">
            {waiting.length === 0 && data ? <li>No orders waiting.</li> : null}
            {waiting.map(([status, n]) => (
              <li key={status}>
                <Link to={`/admin/orders?status=${status}`}>
                  <strong>{n}</strong> {STATUS_LABEL[status as OrderStatus].toLowerCase()} order{n === 1 ? '' : 's'}
                </Link>
              </li>
            ))}
            {data?.stock.out ? (
              <li>
                <Link to="/admin/products?filter=out">
                  <strong>{data.stock.out}</strong> product{data.stock.out === 1 ? '' : 's'} out of stock
                </Link>
              </li>
            ) : null}
            {data?.stock.low ? (
              <li>
                <Link to="/admin/products?filter=low">
                  <strong>{data.stock.low}</strong> running low
                </Link>
              </li>
            ) : null}
            <li>
              <Link to="/admin/analytics">See what to restock, and what is not selling</Link>
            </li>
          </ul>
        </section>
      </div>
    </Page>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="adm-stat">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

/* ---------------- orders ---------------- */

interface OrderRow {
  number: string;
  status: OrderStatus;
  fulfilment: 'delivery' | 'pickup';
  contact_name: string;
  contact_phone: string;
  area: string;
  total: number;
  is_demo: number;
  created_at: string;
}

const ORDER_FILTERS: { key: string; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: '', label: 'All' },
  ...(Object.keys(STATUS_LABEL) as OrderStatus[]).map((key) => ({ key, label: STATUS_LABEL[key] })),
];

export function Orders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'open';
  const [q, setQ] = useState('');
  const { data, error } = useLoad<{ orders: OrderRow[] }>(
    `/admin/orders?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`,
  );

  return (
    <Page
      title="Orders"
      actions={<input className="adm-search" type="search" placeholder="Order number, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />}
    >
      <div className="adm-chips">
        {ORDER_FILTERS.map((filter) => (
          <button key={filter.key} type="button" className={status === filter.key ? 'is-current' : ''} onClick={() => setParams({ status: filter.key })}>
            {filter.label}
          </button>
        ))}
      </div>
      <Problem error={error} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Placed</th>
              <th>Customer</th>
              <th>How</th>
              <th className="is-num">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.orders.map((order) => (
              <tr key={order.number}>
                <td>
                  <Link to={`/admin/orders/${order.number}`}>{order.number}</Link>
                  {order.is_demo ? <span className="adm-tag adm-tag--demo">demo</span> : null}
                </td>
                <td>{orderDate(order.created_at)}</td>
                <td>
                  {order.contact_name}
                  <small>{order.contact_phone}</small>
                </td>
                <td>{order.fulfilment === 'delivery' ? `Delivery · ${order.area}` : 'Pickup'}</td>
                <td className="is-num">{rupees(order.total)}</td>
                <td>
                  <StatusTag status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.orders.length === 0 ? <p className="adm-empty">No orders here.</p> : null}
      </div>
    </Page>
  );
}

interface OrderFull extends OrderRow {
  address_line: string;
  notes: string;
  subtotal: number;
  delivery_fee: number;
  items: { sku: string; name: string; size: string; price: number; qty: number }[];
  next: OrderStatus[];
}

export function OrderDetail() {
  const { number = '' } = useParams();
  const { data, error, reload } = useLoad<{ order: OrderFull }>(`/admin/orders/${encodeURIComponent(number)}`);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const order = data?.order;

  const move = async (status: OrderStatus) => {
    if (status === 'cancelled' && !window.confirm('Cancel this order? Its items go back into stock.')) return;
    setBusy(true);
    setProblem('');
    try {
      await api(`/admin/orders/${encodeURIComponent(number)}`, { method: 'PATCH', body: { status } });
      await reload();
    } catch (failure) {
      setProblem(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={`Order ${number}`} actions={<Link className="adm-btn" to="/admin/orders">All orders</Link>}>
      <Problem error={error || problem} />
      {order ? (
        <div className="adm-grid">
          <section className="adm-card adm-card--wide">
            <h2>
              Items <StatusTag status={order.status} />
              {order.is_demo ? <span className="adm-tag adm-tag--demo">demo</span> : null}
            </h2>
            <table className="adm-table">
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.sku}>
                    <td>
                      {item.qty} × {item.name}
                      <small>{item.size}</small>
                    </td>
                    <td className="is-num">{rupees(item.price)}</td>
                    <td className="is-num">{rupees(item.price * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Subtotal</td>
                  <td className="is-num">{rupees(order.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={2}>Delivery</td>
                  <td className="is-num">{rupees(order.delivery_fee)}</td>
                </tr>
                <tr className="is-total">
                  <td colSpan={2}>Total — cash</td>
                  <td className="is-num">{rupees(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="adm-card">
            <h2>Customer</h2>
            <dl className="adm-facts">
              <dt>Name</dt>
              <dd>{order.contact_name}</dd>
              <dt>Phone</dt>
              <dd>
                <a href={`tel:${order.contact_phone}`}>{order.contact_phone}</a>
              </dd>
              <dt>{order.fulfilment === 'delivery' ? 'Deliver to' : 'Collecting from store'}</dt>
              <dd>{order.fulfilment === 'delivery' ? `${order.address_line}, ${order.area}` : 'Gulberg Arena Mall'}</dd>
              {order.notes ? (
                <>
                  <dt>Note</dt>
                  <dd>{order.notes}</dd>
                </>
              ) : null}
              <dt>Placed</dt>
              <dd>{orderDate(order.created_at)}</dd>
            </dl>
            <div className="adm-actions">
              {order.next.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`adm-btn ${status === 'cancelled' ? 'adm-btn--danger' : 'adm-btn--primary'}`}
                  disabled={busy}
                  onClick={() => void move(status)}
                >
                  {ACTION_LABEL[status]}
                </button>
              ))}
              {order.next.length === 0 ? <p className="adm-empty">Nothing more to do on this order.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </Page>
  );
}

/* ---------------- products ---------------- */

interface ProductRow {
  sku: string;
  name: string;
  brand: string;
  category: string;
  size: string;
  image: string | null;
  price: number;
  stock: number;
  reorder_level: number;
  active: number;
}

export function Products() {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') ?? '';
  const category = params.get('category') ?? '';
  /* Analytics links here with a product's name already filled in. */
  const [q, setQ] = useState(params.get('q') ?? '');
  const { data, error, reload } = useLoad<{ products: ProductRow[] }>(
    `/admin/products?q=${encodeURIComponent(q)}&filter=${encodeURIComponent(filter)}&category=${encodeURIComponent(category)}`,
  );
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <Page
      title="Products"
      actions={
        <>
          <select className="adm-search" value={filter} onChange={(e) => set('filter', e.target.value)} aria-label="Stock filter">
            <option value="">All stock levels</option>
            <option value="low">Running low</option>
            <option value="out">Out of stock</option>
            <option value="off">Not on sale</option>
          </select>
          <select className="adm-search" value={category} onChange={(e) => set('category', e.target.value)} aria-label="Aisle">
            <option value="">All aisles</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.en}
              </option>
            ))}
          </select>
          <input className="adm-search" type="search" placeholder="Name, brand or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
        </>
      }
    >
      <Problem error={error} />
      <div className="adm-table-wrap">
        <table className="adm-table adm-table--edit">
          <thead>
            <tr>
              <th>Product</th>
              <th>Aisle</th>
              <th>Price (Rs)</th>
              <th>In stock</th>
              <th>Reorder at</th>
              <th>On sale</th>
              <th />
            </tr>
          </thead>
          <tbody>{data?.products.map((product) => <ProductEditor key={product.sku} product={product} onSaved={reload} />)}</tbody>
        </table>
        {data && data.products.length === 0 ? <p className="adm-empty">No products match.</p> : null}
      </div>
      {data ? <p className="adm-foot">{data.products.length} product(s). Prices and stock change on the shop as soon as they are saved.</p> : null}
    </Page>
  );
}

function ProductEditor({ product, onSaved }: { product: ProductRow; onSaved: () => Promise<void> }) {
  const [price, setPrice] = useState(String(product.price));
  const [stock, setStock] = useState(String(product.stock));
  const [reorder, setReorder] = useState(String(product.reorder_level));
  const [active, setActive] = useState(Boolean(product.active));
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');

  const stockChanged = Number(stock) !== product.stock;
  const dirty =
    Number(price) !== product.price || stockChanged || Number(reorder) !== product.reorder_level || active !== Boolean(product.active);

  const save = async () => {
    setState('saving');
    setError('');
    try {
      await api(`/admin/products/${encodeURIComponent(product.sku)}`, {
        method: 'PATCH',
        body: { price: Number(price), stock: Number(stock), reorderLevel: Number(reorder), active, note },
      });
      await onSaved();
      setNote('');
      setState('saved');
    } catch (problem) {
      setError(errorMessage(problem));
      setState('idle');
    }
  };

  const level = !product.active ? '' : product.stock === 0 ? ' is-out' : product.stock <= product.reorder_level ? ' is-low' : '';
  return (
    <tr className={level}>
      <td>
        <span className="adm-product">
          <Thumb src={product.image} />
          <span>
            {product.name}
            <small>{[product.brand, product.size].filter(Boolean).join(' · ')}</small>
          </span>
        </span>
      </td>
      <td>{getCategory(product.category)?.en ?? product.category}</td>
      <td>
        <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`Price of ${product.name}`} />
      </td>
      <td>
        <input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} aria-label={`Stock of ${product.name}`} />
        {stockChanged ? (
          <input className="adm-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (delivery, damaged…)" maxLength={255} />
        ) : null}
      </td>
      <td>
        <input type="number" min={0} value={reorder} onChange={(e) => setReorder(e.target.value)} aria-label={`Reorder level of ${product.name}`} />
      </td>
      <td>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} aria-label={`${product.name} on sale`} />
      </td>
      <td>
        {dirty ? (
          <button className="adm-btn adm-btn--primary" type="button" disabled={state === 'saving'} onClick={() => void save()}>
            Save
          </button>
        ) : state === 'saved' ? (
          <span className="adm-saved">Saved</span>
        ) : null}
        {error ? <small className="adm-error">{error}</small> : null}
      </td>
    </tr>
  );
}

/* ---------------- customers ---------------- */

interface CustomerRow {
  id: number;
  name: string;
  phone: string;
  created_at: string;
  is_demo: number;
  orders: number;
  spent: number | string;
  last_order: string | null;
}

export function Customers() {
  const { data, error } = useLoad<{ customers: CustomerRow[] }>('/admin/customers');
  return (
    <Page title="Customers">
      <Problem error={error} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th className="is-num">Orders</th>
              <th className="is-num">Spent</th>
              <th>Last order</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {data?.customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  {customer.name}
                  {customer.is_demo ? <span className="adm-tag adm-tag--demo">demo</span> : null}
                </td>
                <td>{customer.phone}</td>
                <td className="is-num">{customer.orders}</td>
                <td className="is-num">{rupees(Number(customer.spent))}</td>
                <td>{customer.last_order ? orderDate(customer.last_order) : '—'}</td>
                <td>{orderDate(customer.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.customers.length === 0 ? <p className="adm-empty">No customers yet.</p> : null}
      </div>
    </Page>
  );
}

/* ---------------- settings ---------------- */

interface ShopSettings {
  ecommerce: boolean;
  deliveryFee: number;
  freeDeliveryOver: number;
  minOrder: number;
  deliveryAreas: string[];
}

export function Settings() {
  const { data, error } = useLoad<{ settings: ShopSettings }>('/admin/settings');
  const [form, setForm] = useState<ShopSettings | null>(null);
  const [areas, setAreas] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!data) return;
    setForm(data.settings);
    setAreas(data.settings.deliveryAreas.join('\n'));
  }, [data]);

  const save = async (next: ShopSettings) => {
    setState('saving');
    setProblem('');
    try {
      const body = { ...next, deliveryAreas: areas.split('\n').map((line) => line.trim()).filter(Boolean) };
      const saved = await api<{ settings: ShopSettings }>('/admin/settings', { method: 'PUT', body });
      setForm(saved.settings);
      setState('saved');
      /* This browser's copy of the site should follow the switch too. */
      void refreshShop();
    } catch (failure) {
      setProblem(errorMessage(failure));
      setState('idle');
    }
  };

  const number = (key: 'deliveryFee' | 'freeDeliveryOver' | 'minOrder', label: string, hint: string) => (
    <label className="adm-field">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        value={form?.[key] ?? 0}
        onChange={(e) => {
          setState('idle');
          setForm((f) => (f ? { ...f, [key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : f));
        }}
      />
      <small>{hint}</small>
    </label>
  );

  return (
    <Page title="Settings">
      <Problem error={error || problem} />
      {form ? (
        <div className="adm-grid">
          <section className={`adm-card adm-switch${form.ecommerce ? ' is-on' : ''}`}>
            <h2>Online store</h2>
            <p>
              {form.ecommerce
                ? 'On. Customers see prices, can add to the bag, and can place cash-on-delivery or pickup orders.'
                : 'Off. The website is a listing site only: no prices, no accounts, no checkout — exactly as it was before the store was added.'}
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={form.ecommerce}
              className="adm-toggle"
              disabled={state === 'saving'}
              onClick={() => void save({ ...form, ecommerce: !form.ecommerce })}
            >
              <span />
              {form.ecommerce ? 'Store is ON — switch off' : 'Store is OFF — switch on'}
            </button>
          </section>

          <section className="adm-card">
            <h2>Delivery</h2>
            {number('deliveryFee', 'Delivery fee (Rs)', 'Charged on every delivery order.')}
            {number('freeDeliveryOver', 'Free delivery over (Rs)', 'Orders at or above this pay no delivery fee. 0 means never free.')}
            {number('minOrder', 'Minimum order (Rs)', 'Smaller orders cannot be placed.')}
            <label className="adm-field">
              <span>Delivery areas</span>
              <textarea
                rows={6}
                value={areas}
                onChange={(e) => {
                  setState('idle');
                  setAreas(e.target.value);
                }}
              />
              <small>One per line. Customers can only have orders delivered to these.</small>
            </label>
            <div className="adm-actions">
              <button className="adm-btn adm-btn--primary" type="button" disabled={state === 'saving'} onClick={() => void save(form)}>
                Save delivery settings
              </button>
              {state === 'saved' ? <span className="adm-saved">Saved</span> : null}
            </div>
          </section>
        </div>
      ) : null}
    </Page>
  );
}
