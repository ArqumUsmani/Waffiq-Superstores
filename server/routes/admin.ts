/**
 * The admin API. Every route here sits behind requireAdmin (applied where
 * this router is mounted), and the role is read from the database on each
 * request — never trusted from the browser.
 *
 * "Sales" throughout means orders that were not cancelled. Days and hours
 * are Pakistan time (UTC+5, no daylight saving), since that is when the
 * shop's day starts and ends.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../auth.js';
import { rows, run, transaction } from '../db/pool.js';
import { getSettings, saveSettings } from '../settings.js';
import { Refusal, restock } from './shop.js';

export const admin = new Hono<AppEnv>();

const PKT = 'INTERVAL 5 HOUR';
const LIVE = "o.status <> 'cancelled'";

const parse = async <T>(c: { req: { json: () => Promise<unknown> } }, schema: z.ZodType<T>): Promise<T> => {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new Refusal(parsed.error.issues[0]?.message ?? 'Some details are missing.');
  return parsed.data;
};

const days = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : fallback;
};

/* ---------------- dashboard ---------------- */

admin.get('/summary', async (c) => {
  const windowTotals = async (sinceSql: string) => {
    const [sales] = await rows<{ revenue: number | null; orders: number }>(
      `SELECT SUM(o.total) AS revenue, COUNT(*) AS orders FROM orders o WHERE ${LIVE} AND o.created_at >= ${sinceSql}`,
    );
    const [customers] = await rows<{ n: number }>(
      `SELECT COUNT(*) AS n FROM users WHERE role = 'customer' AND created_at >= ${sinceSql}`,
    );
    const revenue = Number(sales?.revenue ?? 0);
    const orders = Number(sales?.orders ?? 0);
    return { revenue, orders, average: orders ? Math.round(revenue / orders) : 0, newCustomers: customers?.n ?? 0 };
  };
  /* "Today" starts at midnight in Pakistan, expressed back in UTC. */
  const todayStart = `(DATE(UTC_TIMESTAMP() + ${PKT}) - ${PKT})`;

  const series = await rows<{ day: string; revenue: number; orders: number }>(
    `SELECT DATE_FORMAT(DATE(o.created_at + ${PKT}), '%Y-%m-%d') AS day, SUM(o.total) AS revenue, COUNT(*) AS orders
     FROM orders o WHERE ${LIVE} AND o.created_at >= (UTC_TIMESTAMP() - INTERVAL 30 DAY)
     GROUP BY day ORDER BY day`,
  );
  const waiting = await rows<{ status: string; n: number }>(
    "SELECT status, COUNT(*) AS n FROM orders WHERE status NOT IN ('completed', 'cancelled') GROUP BY status",
  );
  const [stock] = await rows<{ low: number; out_of: number }>(
    'SELECT SUM(stock > 0 AND stock <= reorder_level) AS low, SUM(stock = 0) AS out_of FROM products WHERE active = 1',
  );

  return c.json({
    today: await windowTotals(todayStart),
    week: await windowTotals('(UTC_TIMESTAMP() - INTERVAL 7 DAY)'),
    month: await windowTotals('(UTC_TIMESTAMP() - INTERVAL 30 DAY)'),
    series: series.map((row) => ({ day: row.day, revenue: Number(row.revenue), orders: Number(row.orders) })),
    waiting: Object.fromEntries(waiting.map((row) => [row.status, Number(row.n)])),
    stock: { low: Number(stock?.low ?? 0), out: Number(stock?.out_of ?? 0) },
  });
});

/* ---------------- orders ---------------- */

const STATUSES = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'ready_for_pickup', 'completed', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];

/** What an order can move to next. Delivery and pickup part ways after packing. */
function nextStatuses(status: Status, fulfilment: 'delivery' | 'pickup'): Status[] {
  switch (status) {
    case 'placed':
      return ['confirmed', 'cancelled'];
    case 'confirmed':
      return ['packed', 'cancelled'];
    case 'packed':
      return [fulfilment === 'delivery' ? 'out_for_delivery' : 'ready_for_pickup', 'cancelled'];
    case 'out_for_delivery':
    case 'ready_for_pickup':
      return ['completed', 'cancelled'];
    default:
      return [];
  }
}

admin.get('/orders', async (c) => {
  const status = c.req.query('status');
  const search = (c.req.query('q') ?? '').trim();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (status === 'open') where.push("status NOT IN ('completed', 'cancelled')");
  else if (status && (STATUSES as readonly string[]).includes(status)) {
    where.push('status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(number LIKE ? OR contact_name LIKE ? OR contact_phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const list = await rows(
    `SELECT number, status, fulfilment, contact_name, contact_phone, area, total, is_demo, created_at
     FROM orders ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 200`,
    params,
  );
  return c.json({ orders: list });
});

admin.get('/orders/:number', async (c) => {
  const found = await rows<{ id: number; status: Status; fulfilment: 'delivery' | 'pickup' }>(
    'SELECT * FROM orders WHERE number = ?',
    [c.req.param('number')],
  );
  const order = found[0];
  if (!order) throw new Refusal('No such order.', 404);
  const items = await rows('SELECT sku, name, size, price, qty FROM order_items WHERE order_id = ?', [order.id]);
  return c.json({ order: { ...order, items, next: nextStatuses(order.status, order.fulfilment) } });
});

admin.patch('/orders/:number', async (c) => {
  const input = await parse(c, z.object({ status: z.enum(STATUSES) }));
  await transaction(async (conn) => {
    const found = await rows<{ id: number; status: Status; fulfilment: 'delivery' | 'pickup' }>(
      'SELECT id, status, fulfilment FROM orders WHERE number = ? FOR UPDATE',
      [c.req.param('number')],
      conn,
    );
    const order = found[0];
    if (!order) throw new Refusal('No such order.', 404);
    if (!nextStatuses(order.status, order.fulfilment).includes(input.status)) {
      throw new Refusal(`An order that is "${order.status}" cannot move to "${input.status}".`, 409);
    }
    await run('UPDATE orders SET status = ? WHERE id = ?', [input.status, order.id], conn);
    if (input.status === 'cancelled') await restock(conn, order.id);
  });
  return c.json({ ok: true });
});

/* ---------------- products ---------------- */

admin.get('/products', async (c) => {
  const search = (c.req.query('q') ?? '').trim();
  const filter = c.req.query('filter');
  const category = c.req.query('category');
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (search) {
    where.push('(name LIKE ? OR brand LIKE ? OR sku LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (filter === 'low') where.push('active = 1 AND stock > 0 AND stock <= reorder_level');
  if (filter === 'out') where.push('active = 1 AND stock = 0');
  if (filter === 'off') where.push('active = 0');
  const list = await rows(
    `SELECT sku, name, brand, category, subcategory, size, image, price, stock, reorder_level, active
     FROM products ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY category, subcategory, name LIMIT 500`,
    params,
  );
  return c.json({ products: list });
});

admin.patch('/products/:sku', async (c) => {
  const input = await parse(
    c,
    z.object({
      price: z.number().int().min(1).max(1_000_000).optional(),
      stock: z.number().int().min(0).max(100_000).optional(),
      reorderLevel: z.number().int().min(0).max(100_000).optional(),
      active: z.boolean().optional(),
      note: z.string().trim().max(255).default(''),
    }),
  );
  const sku = c.req.param('sku');
  await transaction(async (conn) => {
    const found = await rows<{ stock: number }>('SELECT stock FROM products WHERE sku = ? FOR UPDATE', [sku], conn);
    const product = found[0];
    if (!product) throw new Refusal('No such product.', 404);
    if (input.price !== undefined) await run('UPDATE products SET price = ? WHERE sku = ?', [input.price, sku], conn);
    if (input.reorderLevel !== undefined) {
      await run('UPDATE products SET reorder_level = ? WHERE sku = ?', [input.reorderLevel, sku], conn);
    }
    if (input.active !== undefined) await run('UPDATE products SET active = ? WHERE sku = ?', [input.active ? 1 : 0, sku], conn);
    if (input.stock !== undefined && input.stock !== product.stock) {
      await run('UPDATE products SET stock = ? WHERE sku = ?', [input.stock, sku], conn);
      await run("INSERT INTO stock_movements (sku, delta, reason, note) VALUES (?, ?, 'adjust', ?)", [
        sku,
        input.stock - product.stock,
        input.note,
      ], conn);
    }
  });
  return c.json({ ok: true });
});

/* ---------------- customers ---------------- */

admin.get('/customers', async (c) => {
  const list = await rows(
    `SELECT u.id, u.name, u.phone, u.created_at, u.is_demo,
            COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS spent, MAX(o.created_at) AS last_order
     FROM users u LEFT JOIN orders o ON o.user_id = u.id AND ${LIVE}
     WHERE u.role = 'customer' GROUP BY u.id ORDER BY spent DESC LIMIT 300`,
  );
  return c.json({ customers: list });
});

/* ---------------- settings ---------------- */

admin.get('/settings', async (c) => c.json({ settings: await getSettings() }));

admin.put('/settings', async (c) => {
  const input = await parse(
    c,
    z.object({
      ecommerce: z.boolean(),
      deliveryFee: z.number().int().min(0).max(10_000),
      freeDeliveryOver: z.number().int().min(0).max(1_000_000),
      minOrder: z.number().int().min(0).max(100_000),
      deliveryAreas: z.array(z.string().trim().min(2).max(120)).max(100),
    }),
  );
  await saveSettings(input);
  return c.json({ settings: await getSettings() });
});

/* ---------------- analytics and suggestions ---------------- */

admin.get('/analytics', async (c) => {
  const span = days(c.req.query('days'), 30);
  const since = `(UTC_TIMESTAMP() - INTERVAL ${span} DAY)`;

  /* Units and revenue per product over the window; the base for most of what follows. */
  const sold = await rows<{
    sku: string; name: string; category: string; subcategory: string; image: string | null;
    price: number; stock: number; reorder_level: number; units: number; revenue: number;
  }>(
    `SELECT p.sku, p.name, p.category, p.subcategory, p.image, p.price, p.stock, p.reorder_level,
            COALESCE(s.units, 0) AS units, COALESCE(s.revenue, 0) AS revenue
     FROM products p
     LEFT JOIN (
       SELECT i.sku, SUM(i.qty) AS units, SUM(i.qty * i.price) AS revenue
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE ${LIVE} AND o.created_at >= ${since} GROUP BY i.sku
     ) s ON s.sku = p.sku
     WHERE p.active = 1`,
  );
  const products = sold.map((p) => ({ ...p, units: Number(p.units), revenue: Number(p.revenue) }));

  const bestSellers = [...products].filter((p) => p.units > 0).sort((a, b) => b.units - a.units).slice(0, 10);
  const topRevenue = [...products].filter((p) => p.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const byCategory = new Map<string, { category: string; units: number; revenue: number }>();
  for (const p of products) {
    const entry = byCategory.get(p.category) ?? { category: p.category, units: 0, revenue: 0 };
    entry.units += p.units;
    entry.revenue += p.revenue;
    byCategory.set(p.category, entry);
  }
  const categories = [...byCategory.values()].sort((a, b) => b.revenue - a.revenue);

  /* Restocking: already at or under the reorder level, or on course to run
     out within a week at the rate it has been selling. */
  const restock = products
    .map((p) => {
      const perDay = p.units / span;
      const daysLeft = perDay > 0 ? p.stock / perDay : null;
      return { ...p, perDay, daysLeft };
    })
    .filter((p) => p.stock <= p.reorder_level || (p.daysLeft !== null && p.daysLeft < 7))
    .map((p) => ({
      sku: p.sku, name: p.name, image: p.image, stock: p.stock, reorderLevel: p.reorder_level, units: p.units,
      daysLeft: p.daysLeft === null ? null : Math.round(p.daysLeft * 10) / 10,
      /* Enough for about three weeks of sales, and never less than the reorder level. */
      suggestedOrder: Math.max(Math.ceil(p.perDay * 21) - p.stock, p.reorder_level * 2 - p.stock, 0),
      reason:
        p.stock === 0
          ? 'Out of stock.'
          : p.daysLeft !== null && p.daysLeft < 7
            ? `Selling ${p.perDay.toFixed(1)} a day — about ${Math.max(1, Math.round(p.daysLeft))} day(s) of stock left.`
            : `Stock (${p.stock}) is at or below its reorder level (${p.reorder_level}).`,
    }))
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999) || a.stock - b.stock)
    .slice(0, 40);

  /* Slow movers: money sitting on the shelf. */
  const slow = products
    .filter((p) => p.stock > 0 && p.units <= 1)
    .map((p) => ({
      sku: p.sku, name: p.name, image: p.image, stock: p.stock, units: p.units, tiedUp: p.stock * p.price,
      reason: p.units === 0 ? `Nothing sold in ${span} days.` : `Only 1 sold in ${span} days.`,
    }))
    .sort((a, b) => b.tiedUp - a.tiedUp)
    .slice(0, 20);

  /* Good performers: well ahead of the other products on the same shelf. */
  const shelf = new Map<string, { units: number; count: number }>();
  for (const p of products) {
    const entry = shelf.get(p.subcategory) ?? { units: 0, count: 0 };
    entry.units += p.units;
    entry.count += 1;
    shelf.set(p.subcategory, entry);
  }
  const performers = products
    .map((p) => {
      const s = shelf.get(p.subcategory)!;
      const average = s.count ? s.units / s.count : 0;
      return { ...p, average, ratio: average > 0 ? p.units / average : 0 };
    })
    .filter((p) => p.units >= 5 && p.ratio >= 1.8)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 10)
    .map((p) => ({
      sku: p.sku, name: p.name, image: p.image, units: p.units, subcategory: p.subcategory,
      reason: `Sells ${p.ratio.toFixed(1)}x the average for its shelf (${p.average.toFixed(1)} units).`,
    }));

  const busy = await rows<{ weekday: number; hour: number; orders: number }>(
    `SELECT WEEKDAY(o.created_at + ${PKT}) AS weekday, HOUR(o.created_at + ${PKT}) AS hour, COUNT(*) AS orders
     FROM orders o WHERE ${LIVE} AND o.created_at >= ${since} GROUP BY weekday, hour`,
  );

  return c.json({
    days: span,
    bestSellers,
    topRevenue,
    categories,
    restock,
    slow,
    performers,
    busy: busy.map((row) => ({ weekday: Number(row.weekday), hour: Number(row.hour), orders: Number(row.orders) })),
  });
});
