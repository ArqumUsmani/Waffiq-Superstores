/**
 * The customer-facing API: the on/off flag, live prices and stock, accounts,
 * addresses and orders.
 */
import { createHash, randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { PoolConnection } from 'mysql2/promise';
import {
  checkPassword,
  currentUser,
  endSession,
  hashPassword,
  normaliseEmail,
  normalisePhone,
  recordAttempt,
  requireUser,
  startSession,
  tooManyAttempts,
  type AppEnv,
} from '../auth.js';
import { rows, run, transaction } from '../db/pool.js';
import { sendOrderEmail, sendResetEmail, type OrderForEmail } from '../email.js';
import { env } from '../env.js';
import { deliveryFeeFor, getSettings } from '../settings.js';

export const shop = new Hono<AppEnv>();

/** A refusal the customer should read, as opposed to a bug. */
export class Refusal extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

const body = async <T>(c: { req: { json: () => Promise<unknown> } }, schema: z.ZodType<T>): Promise<T> => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new Refusal('That request could not be read.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Refusal(parsed.error.issues[0]?.message ?? 'Some details are missing.');
  return parsed.data;
};

/* ---------------- config and catalogue ---------------- */

shop.get('/config', async (c) => {
  const s = await getSettings();
  return c.json({
    ecommerce: s.ecommerce,
    deliveryFee: s.deliveryFee,
    freeDeliveryOver: s.freeDeliveryOver,
    minOrder: s.minOrder,
    deliveryAreas: s.deliveryAreas,
  });
});

/** Price and availability for every product on sale, keyed by SKU. */
shop.get('/products', async (c) => {
  const s = await getSettings();
  if (!s.ecommerce) return c.json({ products: {} });
  const list = await rows<{ sku: string; price: number; stock: number }>(
    'SELECT sku, price, stock FROM products WHERE active = 1',
  );
  const products: Record<string, { price: number; stock: number }> = {};
  /* Exact stock is the shop's business; customers only need "enough". */
  for (const p of list) products[p.sku] = { price: p.price, stock: Math.min(p.stock, 20) };
  return c.json({ products });
});

/* ---------------- accounts ---------------- */

const password = z.string().min(8, 'Use a password of at least 8 characters.').max(100);

shop.post('/auth/register', async (c) => {
  const input = await body(
    c,
    z.object({
      name: z.string().trim().min(2, 'Please enter your name.').max(120),
      email: z.string().max(190),
      phone: z.string(),
      password,
    }),
  );
  const email = normaliseEmail(input.email);
  if (!email) throw new Refusal('Enter an email address like name@example.com.');
  /* The phone stays: the store calls it to confirm an order and the rider calls it at the door. */
  const phone = normalisePhone(input.phone);
  if (!phone) throw new Refusal('Enter a mobile number like 0300 1234567.');
  const taken = await rows<{ email: string | null }>('SELECT email FROM users WHERE email = ? OR phone = ?', [email, phone]);
  if (taken.length) {
    throw new Refusal(
      taken.some((row) => row.email === email)
        ? 'That email already has an account. Sign in instead.'
        : 'That mobile number already has an account. Sign in instead.',
      409,
    );
  }

  const created = await run('INSERT INTO users (name, phone, email, password_hash) VALUES (?, ?, ?, ?)', [
    input.name,
    phone,
    email,
    await hashPassword(input.password),
  ]);
  await startSession(c, created.insertId);
  return c.json({ user: { id: created.insertId, name: input.name, phone, email, role: 'customer' } });
});

shop.post('/auth/login', async (c) => {
  /* `login` is an email address or a mobile number; `phone` is the older name for the same field. */
  const input = await body(
    c,
    z.object({ login: z.string().max(190).optional(), phone: z.string().max(190).optional(), password: z.string().max(100) }),
  );
  const typed = (input.login ?? input.phone ?? '').trim();
  const byEmail = typed.includes('@');
  const key = byEmail ? normaliseEmail(typed) : normalisePhone(typed);
  /* One message for every failure: it must not reveal which accounts exist. */
  const wrong = new Refusal('Those details and password do not match.', 403);
  if (!key) throw wrong;
  if (await tooManyAttempts(key)) {
    throw new Refusal('Too many attempts. Please try again in 15 minutes.', 403);
  }

  const found = await rows<{
    id: number; name: string; phone: string; email: string | null; role: 'customer' | 'admin'; password_hash: string;
  }>(`SELECT id, name, phone, email, role, password_hash FROM users WHERE ${byEmail ? 'email' : 'phone'} = ?`, [key]);
  const user = found[0];
  const ok = user ? await checkPassword(input.password, user.password_hash) : false;
  await recordAttempt(key, ok);
  if (!user || !ok) throw wrong;

  await startSession(c, user.id);
  return c.json({ user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role } });
});

shop.post('/auth/logout', (c) => {
  endSession(c);
  return c.json({ ok: true });
});

shop.get('/auth/me', async (c) => c.json({ user: await currentUser(c) }));

/* ---------------- forgotten passwords ---------------- */

/**
 * The site's own address, for links in emails. Set SITE_URL to pin it;
 * otherwise it is taken from the request.
 */
export function siteOrigin(c: Context): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const url = new URL(c.req.url);
  return `${env.production ? 'https' : url.protocol.replace(':', '')}://${c.req.header('host') ?? url.host}`;
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

shop.post('/auth/forgot', async (c) => {
  const input = await body(c, z.object({ email: z.string().max(190) }));
  const email = normaliseEmail(input.email);
  if (!email) throw new Refusal('Enter an email address like name@example.com.');
  /* Throttled like sign-in, so this cannot be used to flood someone's inbox. */
  const throttle = `reset:${email}`;
  if (!(await tooManyAttempts(throttle))) {
    await recordAttempt(throttle, false);
    const found = await rows<{ id: number; name: string }>('SELECT id, name FROM users WHERE email = ?', [email]);
    const user = found[0];
    if (user) {
      const token = randomBytes(32).toString('base64url');
      await run('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 1 HOUR)', [
        user.id,
        tokenHash(token),
      ]);
      await sendResetEmail(email, user.name, `${siteOrigin(c)}/reset?token=${token}`);
    }
  }
  /* The same answer whether or not the address has an account. */
  return c.json({ ok: true });
});

shop.post('/auth/reset', async (c) => {
  const input = await body(c, z.object({ token: z.string().min(20).max(200), password }));
  const done = await transaction(async (conn) => {
    const found = await rows<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > UTC_TIMESTAMP() FOR UPDATE',
      [tokenHash(input.token)],
      conn,
    );
    const reset = found[0];
    if (!reset) return null;
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(input.password), reset.user_id], conn);
    /* This link, and any other still outstanding for the account, is spent. */
    await run('UPDATE password_resets SET used = 1 WHERE user_id = ?', [reset.user_id], conn);
    return reset.user_id;
  });
  if (!done) throw new Refusal('That link has expired or was already used. Ask for a new one.', 400);
  await startSession(c, done);
  return c.json({ user: await rows('SELECT id, name, phone, email, role FROM users WHERE id = ?', [done]).then((r) => r[0]) });
});

/* ---------------- addresses ---------------- */

const addressInput = z.object({
  line1: z.string().trim().min(5, 'Please enter the house and street.').max(255),
  area: z.string().trim().min(2, 'Please choose an area.').max(120),
  notes: z.string().trim().max(255).default(''),
});

shop.get('/addresses', requireUser, async (c) => {
  const list = await rows('SELECT id, line1, area, notes FROM addresses WHERE user_id = ? ORDER BY id DESC', [
    c.get('user').id,
  ]);
  return c.json({ addresses: list });
});

shop.post('/addresses', requireUser, async (c) => {
  const input = await body(c, addressInput);
  const created = await run('INSERT INTO addresses (user_id, line1, area, notes) VALUES (?, ?, ?, ?)', [
    c.get('user').id,
    input.line1,
    input.area,
    input.notes,
  ]);
  return c.json({ address: { id: created.insertId, ...input } });
});

shop.delete('/addresses/:id', requireUser, async (c) => {
  await run('DELETE FROM addresses WHERE id = ? AND user_id = ?', [Number(c.req.param('id')), c.get('user').id]);
  return c.json({ ok: true });
});

/* ---------------- orders ---------------- */

const orderInput = z.object({
  items: z
    .array(z.object({ sku: z.string().max(120), qty: z.number().int().min(1).max(50) }))
    .min(1, 'Your bag is empty.')
    .max(100),
  fulfilment: z.enum(['delivery', 'pickup']),
  addressId: z.number().int().optional(),
  notes: z.string().trim().max(500).default(''),
});

/**
 * Puts stock back for a cancelled order. Shared with the admin panel.
 * Must run inside the transaction that marks the order cancelled.
 */
export async function restock(conn: PoolConnection, orderId: number): Promise<void> {
  const items = await rows<{ sku: string; qty: number }>('SELECT sku, qty FROM order_items WHERE order_id = ?', [
    orderId,
  ], conn);
  for (const item of items) {
    await run('UPDATE products SET stock = stock + ? WHERE sku = ?', [item.qty, item.sku], conn);
    await run("INSERT INTO stock_movements (sku, delta, reason, order_id) VALUES (?, ?, 'cancel', ?)", [
      item.sku,
      item.qty,
      orderId,
    ], conn);
  }
}

shop.post('/orders', requireUser, async (c) => {
  const user = c.get('user');
  const input = await body(c, orderInput);
  const settings = await getSettings();
  if (!settings.ecommerce) throw new Refusal('Online ordering is switched off at the moment.', 403);

  /* The same SKU sent twice counts once, with the quantities added. */
  const wanted = new Map<string, number>();
  for (const item of input.items) wanted.set(item.sku, (wanted.get(item.sku) ?? 0) + item.qty);

  const order = await transaction(async (conn) => {
    let addressLine = '';
    let area = '';
    if (input.fulfilment === 'delivery') {
      const found = await rows<{ line1: string; area: string; notes: string }>(
        'SELECT line1, area, notes FROM addresses WHERE id = ? AND user_id = ?',
        [input.addressId ?? 0, user.id],
        conn,
      );
      const address = found[0];
      if (!address) throw new Refusal('Please choose a delivery address.');
      if (!settings.deliveryAreas.includes(address.area)) {
        throw new Refusal(`We do not deliver to ${address.area} yet. You can still collect from the store.`);
      }
      addressLine = address.notes ? `${address.line1} (${address.notes})` : address.line1;
      area = address.area;
    }

    /* Lock the rows in SKU order, so two orders for the same items queue up
       instead of deadlocking, and neither can take stock the other has. */
    const skus = [...wanted.keys()].sort();
    const products = await rows<{ sku: string; name: string; size: string; price: number; stock: number; active: number }>(
      `SELECT sku, name, size, price, stock, active FROM products WHERE sku IN (${skus.map(() => '?').join(',')}) ORDER BY sku FOR UPDATE`,
      skus,
      conn,
    );
    const bySku = new Map(products.map((p) => [p.sku, p]));

    let subtotal = 0;
    const lines: { sku: string; name: string; size: string; price: number; qty: number }[] = [];
    for (const sku of skus) {
      const qty = wanted.get(sku)!;
      const product = bySku.get(sku);
      if (!product || !product.active) throw new Refusal('An item in your bag is no longer on sale.', 409);
      if (product.stock < qty) {
        throw new Refusal(
          product.stock === 0 ? `${product.name} has just sold out.` : `Only ${product.stock} of ${product.name} left.`,
          409,
        );
      }
      /* The price is the database's, whatever the browser believed. */
      subtotal += product.price * qty;
      lines.push({ sku, name: product.name, size: product.size, price: product.price, qty });
    }

    if (subtotal < settings.minOrder) {
      throw new Refusal(`The minimum order is Rs ${settings.minOrder.toLocaleString('en-PK')}.`);
    }
    const deliveryFee = input.fulfilment === 'delivery' ? deliveryFeeFor(settings, subtotal) : 0;
    const total = subtotal + deliveryFee;

    const created = await run(
      `INSERT INTO orders (user_id, fulfilment, contact_name, contact_phone, address_line, area, notes, subtotal, delivery_fee, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, input.fulfilment, user.name, user.phone, addressLine, area, input.notes, subtotal, deliveryFee, total],
      conn,
    );
    const id = created.insertId;
    const number = `WF-${String(100000 + id)}`;
    await run('UPDATE orders SET number = ? WHERE id = ?', [number, id], conn);

    for (const line of lines) {
      await run('INSERT INTO order_items (order_id, sku, name, size, price, qty) VALUES (?, ?, ?, ?, ?, ?)', [
        id,
        line.sku,
        line.name,
        line.size,
        line.price,
        line.qty,
      ], conn);
      await run('UPDATE products SET stock = stock - ? WHERE sku = ?', [line.qty, line.sku], conn);
      await run("INSERT INTO stock_movements (sku, delta, reason, order_id) VALUES (?, ?, 'sale', ?)", [
        line.sku,
        -line.qty,
        id,
      ], conn);
    }
    return { id, number, subtotal, deliveryFee, total };
  });

  await notify(c, order.id);
  return c.json({ order: { number: order.number, subtotal: order.subtotal, deliveryFee: order.deliveryFee, total: order.total } });
});

/** Emails the customer where their order now stands. Never throws. */
export async function notify(c: Context, orderId: number): Promise<void> {
  try {
    const found = await rows<OrderForEmail & { id: number; email: string | null }>(
      `SELECT o.id, o.number, o.status, o.fulfilment, o.contact_name, o.address_line, o.area, o.subtotal, o.delivery_fee, o.total, u.email
       FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`,
      [orderId],
    );
    const order = found[0];
    if (!order?.email) return;
    const items = await rows<{ name: string; qty: number; price: number }>('SELECT name, qty, price FROM order_items WHERE order_id = ?', [orderId]);
    await sendOrderEmail(order.email, { ...order, items }, siteOrigin(c));
  } catch (error) {
    console.error('Order email failed:', error);
  }
}

const ORDER_FIELDS =
  'id, number, status, fulfilment, contact_name, contact_phone, address_line, area, notes, subtotal, delivery_fee, total, created_at';

shop.get('/orders', requireUser, async (c) => {
  const list = await rows(
    'SELECT number, status, fulfilment, total, created_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50',
    [c.get('user').id],
  );
  return c.json({ orders: list });
});

shop.get('/orders/:number', requireUser, async (c) => {
  const found = await rows<{ id: number }>(`SELECT ${ORDER_FIELDS} FROM orders WHERE number = ? AND user_id = ?`, [
    c.req.param('number'),
    c.get('user').id,
  ]);
  const order = found[0];
  if (!order) throw new Refusal('We could not find that order.', 404);
  const items = await rows('SELECT sku, name, size, price, qty FROM order_items WHERE order_id = ?', [order.id]);
  return c.json({ order: { ...order, items } });
});

/**
 * Just the status — small enough for the order page to ask every few
 * seconds, so a step the store takes shows up without a reload.
 */
shop.get('/orders/:number/status', requireUser, async (c) => {
  const found = await rows<{ status: string; updated_at: string }>(
    'SELECT status, updated_at FROM orders WHERE number = ? AND user_id = ?',
    [c.req.param('number'), c.get('user').id],
  );
  if (!found[0]) throw new Refusal('We could not find that order.', 404);
  return c.json(found[0]);
});

/** A customer can change their mind until the store has started on it. */
shop.post('/orders/:number/cancel', requireUser, async (c) => {
  const cancelled = await transaction(async (conn) => {
    const found = await rows<{ id: number; status: string }>(
      'SELECT id, status FROM orders WHERE number = ? AND user_id = ? FOR UPDATE',
      [c.req.param('number'), c.get('user').id],
      conn,
    );
    const order = found[0];
    if (!order) throw new Refusal('We could not find that order.', 404);
    if (order.status !== 'placed') {
      throw new Refusal('This order is already being prepared. Please call the store to change it.', 409);
    }
    await run("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id], conn);
    await restock(conn, order.id);
    return order.id;
  });
  await notify(c, cancelled);
  return c.json({ ok: true });
});

/* ---------------- recommendations ---------------- */

/**
 * What this customer buys again and again, and what others buy from the
 * same aisles. SKUs only — the page already has the catalogue.
 */
shop.get('/recommendations', requireUser, async (c) => {
  const userId = c.get('user').id;
  const regulars = await rows<{ sku: string; orders: number; qty: number }>(
    `SELECT i.sku, COUNT(DISTINCT o.id) AS orders, ROUND(AVG(i.qty)) AS qty
     FROM order_items i JOIN orders o ON o.id = i.order_id JOIN products p ON p.sku = i.sku AND p.active = 1
     WHERE o.user_id = ? AND o.status <> 'cancelled'
     GROUP BY i.sku ORDER BY orders DESC, SUM(i.qty) DESC LIMIT 16`,
    [userId],
  );
  const suggested = await rows<{ sku: string }>(
    `SELECT p.sku
     FROM products p
     LEFT JOIN (
       SELECT i.sku, SUM(i.qty) AS units FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.status <> 'cancelled' AND o.created_at >= (UTC_TIMESTAMP() - INTERVAL 60 DAY) GROUP BY i.sku
     ) s ON s.sku = p.sku
     WHERE p.active = 1 AND p.stock > 0
       AND p.sku NOT IN (SELECT i.sku FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.user_id = ?)
     ORDER BY
       (p.category IN (SELECT DISTINCT p2.category FROM order_items i JOIN orders o ON o.id = i.order_id
                       JOIN products p2 ON p2.sku = i.sku WHERE o.user_id = ?)) DESC,
       COALESCE(s.units, 0) DESC
     LIMIT 8`,
    [userId, userId],
  );
  return c.json({
    regulars: regulars.map((row) => ({ sku: row.sku, orders: Number(row.orders), qty: Math.max(1, Number(row.qty)) })),
    suggested: suggested.map((row) => row.sku),
  });
});

/* ---------------- shopping lists ---------------- */

const listInput = z.object({
  name: z.string().trim().min(1, 'Give the list a name.').max(80),
  cadence: z.enum(['weekly', 'monthly', 'none']).default('none'),
  items: z.array(z.object({ sku: z.string().max(120), qty: z.number().int().min(1).max(50) })).max(100).default([]),
});

async function writeListItems(conn: PoolConnection, listId: number, items: { sku: string; qty: number }[]): Promise<void> {
  await run('DELETE FROM list_items WHERE list_id = ?', [listId], conn);
  if (!items.length) return;
  /* Only products that exist; the same one twice counts once. */
  const wanted = new Map(items.map((item) => [item.sku, item.qty]));
  const skus = [...wanted.keys()];
  const real = await rows<{ sku: string }>(`SELECT sku FROM products WHERE sku IN (${skus.map(() => '?').join(',')})`, skus, conn);
  for (const { sku } of real) {
    await run('INSERT INTO list_items (list_id, sku, qty) VALUES (?, ?, ?)', [listId, sku, wanted.get(sku)!], conn);
  }
}

shop.get('/lists', requireUser, async (c) => {
  const lists = await rows<{ id: number; name: string; cadence: string }>(
    'SELECT id, name, cadence FROM lists WHERE user_id = ? ORDER BY id',
    [c.get('user').id],
  );
  const items = lists.length
    ? await rows<{ list_id: number; sku: string; qty: number }>(
        `SELECT list_id, sku, qty FROM list_items WHERE list_id IN (${lists.map(() => '?').join(',')}) ORDER BY sku`,
        lists.map((list) => list.id),
      )
    : [];
  return c.json({
    lists: lists.map((list) => ({
      ...list,
      items: items.filter((item) => item.list_id === list.id).map(({ sku, qty }) => ({ sku, qty })),
    })),
  });
});

shop.post('/lists', requireUser, async (c) => {
  const input = await body(c, listInput);
  const userId = c.get('user').id;
  const id = await transaction(async (conn) => {
    const [count] = await rows<{ n: number }>('SELECT COUNT(*) AS n FROM lists WHERE user_id = ?', [userId], conn);
    if ((count?.n ?? 0) >= 20) throw new Refusal('That is the most lists an account can keep. Delete one first.');
    const created = await run('INSERT INTO lists (user_id, name, cadence) VALUES (?, ?, ?)', [userId, input.name, input.cadence], conn);
    await writeListItems(conn, created.insertId, input.items);
    return created.insertId;
  });
  return c.json({ id });
});

shop.put('/lists/:id', requireUser, async (c) => {
  const input = await body(c, listInput);
  const id = Number(c.req.param('id'));
  await transaction(async (conn) => {
    const mine = await rows('SELECT id FROM lists WHERE id = ? AND user_id = ? FOR UPDATE', [id, c.get('user').id], conn);
    if (!mine.length) throw new Refusal('We could not find that list.', 404);
    await run('UPDATE lists SET name = ?, cadence = ? WHERE id = ?', [input.name, input.cadence, id], conn);
    await writeListItems(conn, id, input.items);
  });
  return c.json({ ok: true });
});

shop.delete('/lists/:id', requireUser, async (c) => {
  await run('DELETE FROM lists WHERE id = ? AND user_id = ?', [Number(c.req.param('id')), c.get('user').id]);
  return c.json({ ok: true });
});
