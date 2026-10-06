/**
 * The customer-facing API: the on/off flag, live prices and stock, accounts,
 * addresses and orders.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { PoolConnection } from 'mysql2/promise';
import {
  checkPassword,
  currentUser,
  endSession,
  hashPassword,
  normalisePhone,
  recordAttempt,
  requireUser,
  startSession,
  tooManyAttempts,
  type AppEnv,
} from '../auth.js';
import { rows, run, transaction } from '../db/pool.js';
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
    z.object({ name: z.string().trim().min(2, 'Please enter your name.').max(120), phone: z.string(), password }),
  );
  const phone = normalisePhone(input.phone);
  if (!phone) throw new Refusal('Enter a mobile number like 0300 1234567.');
  const taken = await rows('SELECT id FROM users WHERE phone = ?', [phone]);
  if (taken.length) throw new Refusal('That number already has an account. Sign in instead.', 409);

  const created = await run('INSERT INTO users (name, phone, password_hash) VALUES (?, ?, ?)', [
    input.name,
    phone,
    await hashPassword(input.password),
  ]);
  await startSession(c, created.insertId);
  return c.json({ user: { id: created.insertId, name: input.name, phone, role: 'customer' } });
});

shop.post('/auth/login', async (c) => {
  const input = await body(c, z.object({ phone: z.string(), password: z.string().max(100) }));
  const phone = normalisePhone(input.phone);
  /* One message for every failure: it must not reveal which numbers exist. */
  const wrong = new Refusal('That number and password do not match.', 403);
  if (!phone) throw wrong;
  if (await tooManyAttempts(phone)) {
    throw new Refusal('Too many attempts. Please try again in 15 minutes.', 403);
  }

  const found = await rows<{ id: number; name: string; role: 'customer' | 'admin'; password_hash: string }>(
    'SELECT id, name, role, password_hash FROM users WHERE phone = ?',
    [phone],
  );
  const user = found[0];
  const ok = user ? await checkPassword(input.password, user.password_hash) : false;
  await recordAttempt(phone, ok);
  if (!user || !ok) throw wrong;

  await startSession(c, user.id);
  return c.json({ user: { id: user.id, name: user.name, phone, role: user.role } });
});

shop.post('/auth/logout', (c) => {
  endSession(c);
  return c.json({ ok: true });
});

shop.get('/auth/me', async (c) => c.json({ user: await currentUser(c) }));

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
    return { number, subtotal, deliveryFee, total };
  });

  return c.json({ order });
});

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

/** A customer can change their mind until the store has started on it. */
shop.post('/orders/:number/cancel', requireUser, async (c) => {
  await transaction(async (conn) => {
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
  });
  return c.json({ ok: true });
});
