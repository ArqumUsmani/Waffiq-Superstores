/**
 * End-to-end checks of the store API against a running dev API
 * (npm run dev:api) and its local database.
 *
 * Run: node scripts/api-smoke.mjs
 * It signs in as the admin from .env.local, switches the store on, runs the
 * checks with a throwaway customer, and puts the switch back as it found it.
 */
import { readFileSync } from 'node:fs';

const BASE = process.env.API ?? 'http://localhost:8787/api';
const envFile = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
};

/** A tiny cookie jar per "browser". */
const client = () => {
  let cookie = '';
  return async (method, path, body) => {
    const response = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: response.status, data: await response.json().catch(() => ({})) };
  };
};

const admin = client();
const customer = client();
const stranger = client();

let r = await admin('POST', '/auth/login', { phone: envFile.ADMIN_PHONE, password: envFile.ADMIN_PASSWORD });
check('admin signs in', r.status === 200 && r.data.user?.role === 'admin');

const before = (await admin('GET', '/admin/settings')).data.settings;

/* --- store off --- */
await admin('PUT', '/admin/settings', { ...before, ecommerce: false });
r = await stranger('GET', '/products');
check('store off: no prices published', Object.keys(r.data.products ?? {}).length === 0);

const phone = `0311${String(Math.floor(1000000 + Math.random() * 8999999))}`;
const email = `smoke-${phone}@example.com`;
r = await customer('POST', '/auth/register', { name: 'Smoke Test', email, phone, password: 'correct-horse' });
check('customer registers', r.status === 200 && r.data.user?.role === 'customer');
r = await customer('POST', '/auth/register', { name: 'Again', email: `other-${email}`, phone, password: 'correct-horse' });
check('same number cannot register twice', r.status === 409);
r = await stranger('POST', '/auth/register', { name: 'Again', email: email.toUpperCase(), phone: `0312${phone.slice(4)}`, password: 'correct-horse' });
check('same email cannot register twice', r.status === 409);
r = await stranger('POST', '/auth/register', { name: 'No Email', email: 'not-an-email', phone: `0313${phone.slice(4)}`, password: 'correct-horse' });
check('a bad email is refused', r.status === 400);
r = await stranger('POST', '/auth/login', { login: email, password: 'correct-horse' });
check('sign in by email', r.status === 200 && r.data.user?.email === email);
await stranger('POST', '/auth/logout');
r = await stranger('POST', '/auth/forgot', { email: 'nobody-here@example.com' });
check('forgot password gives nothing away', r.status === 200 && r.data.ok === true);
r = await stranger('POST', '/auth/reset', { token: 'x'.repeat(43), password: 'another-horse' });
check('a made-up reset link is refused', r.status === 400);
r = await stranger('POST', '/auth/login', { phone, password: 'wrong-password' });
check('wrong password refused', r.status === 403);
r = await stranger('POST', '/auth/register', { name: 'X', phone: '12345', password: 'short' });
check('bad phone / short password refused', r.status === 400);

r = await customer('POST', '/orders', { items: [{ sku: 'x', qty: 1 }], fulfilment: 'pickup' });
check('store off: order refused', r.status === 403, r.data.error);

/* --- store on --- */
await admin('PUT', '/admin/settings', { ...before, ecommerce: true, minOrder: 500 });
const products = (await stranger('GET', '/products')).data.products;
check('store on: prices published', Object.keys(products).length > 250, `${Object.keys(products).length} products`);

const stocked = (await admin('GET', '/admin/products')).data.products.filter((p) => p.active && p.stock >= 5 && p.price >= 300);
const item = stocked[0];
const scarce = stocked[1];

r = await customer('GET', '/admin/summary');
check('customer cannot reach admin', r.status === 403);
r = await stranger('POST', '/orders', { items: [{ sku: item.sku, qty: 1 }], fulfilment: 'pickup' });
check('signed-out visitor cannot order', r.status === 401);

r = await customer('POST', '/orders', { items: [{ sku: item.sku, qty: 2, price: 1 }], fulfilment: 'pickup' });
check('pickup order placed', r.status === 200 && /^WF-\d+$/.test(r.data.order?.number ?? ''), r.data.order?.number ?? r.data.error);
check('price comes from the database, not the browser', r.data.order?.subtotal === item.price * 2, `Rs ${r.data.order?.subtotal} = 2 x ${item.price}`);
const number = r.data.order.number;
let now = (await admin('GET', `/admin/products?q=${encodeURIComponent(item.sku)}`)).data.products.find((p) => p.sku === item.sku);
check('stock dropped by 2', now.stock === item.stock - 2, `${item.stock} → ${now.stock}`);

r = await customer('POST', '/orders', { items: [{ sku: scarce.sku, qty: scarce.stock + 1 > 50 ? 50 : scarce.stock + 1 }], fulfilment: 'pickup' });
if (scarce.stock + 1 <= 50) check('cannot order more than is in stock', r.status === 409, r.data.error);

r = await customer('POST', '/orders', { items: [{ sku: item.sku, qty: 1 }], fulfilment: 'delivery' });
check('delivery needs an address', r.status === 400, r.data.error);
r = await customer('POST', '/addresses', { line1: 'House 1, Street 2', area: 'Nowhere Town' });
r = await customer('POST', '/orders', { items: [{ sku: item.sku, qty: 1 }], fulfilment: 'delivery', addressId: r.data.address.id });
check('delivery outside the areas refused', r.status === 400, r.data.error);
r = await customer('POST', '/addresses', { line1: 'House 1, Street 2', area: before.deliveryAreas[0] });
const goodAddress = r.data.address.id;
r = await customer('POST', '/orders', { items: [{ sku: item.sku, qty: 1 }], fulfilment: 'delivery', addressId: goodAddress });
if (item.price < 500) check('order under the minimum refused', r.status === 400, r.data.error);
r = await customer('POST', '/orders', { items: [{ sku: item.sku, qty: 2 }], fulfilment: 'delivery', addressId: goodAddress });
const sub = item.price * 2;
const expectFee = before.freeDeliveryOver > 0 && sub >= before.freeDeliveryOver ? 0 : before.deliveryFee;
check('delivery order adds the fee', r.status === 200 && r.data.order?.deliveryFee === expectFee && r.data.order?.total === sub + expectFee, `Rs ${sub} + fee Rs ${r.data.order?.deliveryFee} = Rs ${r.data.order?.total}`);
const second = r.data.order.number;

r = await customer('GET', '/orders');
check('customer sees their orders', r.data.orders?.length === 2);
r = await stranger('GET', `/orders/${number}`);
check('others cannot read an order', r.status === 401);

/* --- admin flow --- */
r = await admin('PATCH', `/admin/orders/${number}`, { status: 'completed' });
check('status cannot skip steps', r.status === 409, r.data.error);
for (const status of ['confirmed', 'packed', 'ready_for_pickup', 'completed']) {
  r = await admin('PATCH', `/admin/orders/${number}`, { status });
  if (r.status !== 200) break;
}
check('order moved through to completed', r.status === 200);

r = await customer('POST', `/orders/${second}/cancel`);
check('customer cancels an unstarted order', r.status === 200);
now = (await admin('GET', `/admin/products?q=${encodeURIComponent(item.sku)}`)).data.products.find((p) => p.sku === item.sku);
check('cancelling returned the stock', now.stock === item.stock - 2, `back to ${now.stock}`);
r = await customer('POST', `/orders/${number}/cancel`);
check('completed order cannot be cancelled', r.status === 409);

r = await admin('PATCH', `/admin/products/${encodeURIComponent(item.sku)}`, { price: item.price + 10, stock: item.stock, note: 'smoke test' });
const published = (await stranger('GET', '/products')).data.products[item.sku];
check('admin price edit shows in the shop', published.price === item.price + 10);
await admin('PATCH', `/admin/products/${encodeURIComponent(item.sku)}`, { price: item.price });

r = await admin('GET', '/admin/summary');
check('dashboard figures', r.status === 200 && r.data.month.orders > 0, `30 days: ${r.data.month.orders} orders, Rs ${r.data.month.revenue.toLocaleString()}`);
r = await admin('GET', '/admin/analytics?days=30');
check('analytics', r.status === 200 && r.data.bestSellers.length > 0, `best seller: ${r.data.bestSellers[0]?.name} (${r.data.bestSellers[0]?.units}) · ${r.data.restock.length} to restock · ${r.data.slow.length} slow`);

/* --- lists and recommendations --- */
r = await customer('GET', '/recommendations');
check('recommendations', r.status === 200 && Array.isArray(r.data.regulars) && r.data.suggested.length > 0, `${r.data.regulars?.length} regulars, ${r.data.suggested?.length} suggested`);
const anySku = r.data.suggested[0];
r = await customer('POST', '/lists', { name: 'Weekly shop', cadence: 'weekly', items: [{ sku: anySku, qty: 2 }, { sku: 'no-such-product', qty: 1 }] });
const listId = r.data.id;
r = await customer('GET', '/lists');
const saved = r.data.lists?.find((l) => l.id === listId);
check('a list is saved, unknown products dropped', saved?.cadence === 'weekly' && saved.items.length === 1 && saved.items[0].qty === 2);
r = await stranger('PUT', `/lists/${listId}`, { name: 'Hijack', cadence: 'none', items: [] });
check('lists need a sign-in', r.status === 401);
r = await admin('PUT', `/lists/${listId}`, { name: 'Hijack', cadence: 'none', items: [] });
check("another account cannot change someone's list", r.status === 404);
r = await customer('PUT', `/lists/${listId}`, { name: 'Monthly', cadence: 'monthly', items: [{ sku: anySku, qty: 5 }] });
r = await customer('GET', '/lists');
check('a list can be changed', r.data.lists.find((l) => l.id === listId)?.items[0]?.qty === 5);
await customer('DELETE', `/lists/${listId}`);
r = await customer('GET', '/lists');
check('a list can be deleted', !r.data.lists.some((l) => l.id === listId));

/* --- sign-in rate limit --- */
let limited = false;
for (let i = 0; i < 10; i += 1) {
  r = await stranger('POST', '/auth/login', { phone, password: `nope-${i}` });
  if (/Too many/.test(r.data.error ?? '')) limited = true;
}
check('repeated wrong passwords are paused', limited);

await admin('PUT', '/admin/settings', before);
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
