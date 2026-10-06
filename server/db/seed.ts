/**
 * Fills the database from the site's catalogue.
 *
 *   npm run db:seed                    products + the admin account
 *   npm run db:seed -- --demo-orders   also ~60 days of made-up orders
 *   npm run db:seed -- --clear-demo    removes the made-up orders again
 *
 * Products come from src/data/products.json. A product already in the
 * database keeps its price and stock — re-running never undoes edits made
 * in the admin panel; it only adds new products and retires removed ones.
 *
 * Prices are PLACEHOLDERS: a plausible range per shelf, picked from the SKU
 * so they stay the same from run to run. Set the real ones in the admin
 * panel.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { loadLocalEnv } from '../env.js';

loadLocalEnv();
const { pool, rows, run } = await import('./pool.js');
const { normalisePhone } = await import('../auth.js');

interface CatalogueProduct {
  sku: string; name: string; nameUr: string; brand: string; category: string;
  subcategory: string; size: string; image: string | null; tags: string[];
}

/** Rupees, low to high, per shelf. */
const PRICE_RANGE: Record<string, [number, number]> = {
  'fresh-fruits': [120, 480], 'fresh-vegetables': [60, 320], 'herbs-leafy-greens': [30, 150],
  'dried-fruits-nuts': [450, 2400], 'cookies-biscuits': [40, 350], 'candies-jellies': [20, 300],
  chocolates: [80, 900], 'protein-bars': [180, 650], 'tea-sweeteners': [250, 1600], coffee: [450, 3200],
  'cereals-porridge': [350, 1500], 'spreads-honey-jams': [300, 1800], 'packed-milk': [70, 420],
  'powdered-milk': [600, 3200], 'condensed-milk': [280, 750], 'soft-drinks': [60, 380],
  'powdered-masalas': [80, 420], 'sauces-syrups': [220, 950], 'noodles-pasta': [50, 480],
  'baking-desserts': [120, 780], 'pickles-ketchups': [200, 900], 'spreads-chinese-sauces': [180, 850],
  'canned-fruit-veg': [300, 950], 'mushrooms-olives-oils': [450, 4200], 'tissues-foils': [120, 850],
  'lighters-matches': [60, 450], 'storage-wraps': [180, 1800], 'dish-washing': [120, 900],
  'toilet-cleaning': [220, 950], 'washing-cleaning': [180, 2400], 'insect-killers': [250, 1100],
  'air-fresheners': [300, 1300], diapers: [900, 4800], 'baby-care': [220, 1200],
  'hair-removal': [250, 1400], 'sanitary-pads': [180, 900], 'shampoos-soaps': [90, 1300],
  'oral-care': [150, 900], 'handwash-baby-oils': [220, 1100], 'intimate-care': [350, 1600],
};

/** Stable 32-bit hash: the same SKU always gets the same "random" numbers. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const unit = (text: string) => hash(text) / 0xffffffff;

function priceFor(p: CatalogueProduct): number {
  const [low, high] = PRICE_RANGE[p.subcategory] ?? [100, 1000];
  /* Skewed toward the low end, as real shelves are. */
  const raw = low + (high - low) * unit(`price:${p.sku}`) ** 1.7;
  const step = raw < 200 ? 5 : raw < 1000 ? 10 : 50;
  return Math.max(step, Math.round(raw / step) * step);
}

function stockFor(sku: string): { stock: number; reorder: number } {
  const roll = unit(`stock:${sku}`);
  const reorder = 6 + Math.floor(unit(`reorder:${sku}`) * 10);
  /* A few sold out and a few running low, so the admin screens have
     something to show from day one. */
  if (roll < 0.04) return { stock: 0, reorder };
  if (roll < 0.14) return { stock: 1 + Math.floor(unit(`low:${sku}`) * reorder), reorder };
  return { stock: 20 + Math.floor(unit(`qty:${sku}`) * 100), reorder };
}

async function seedProducts(): Promise<CatalogueProduct[]> {
  const catalogue = JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/products.json'), 'utf8')) as CatalogueProduct[];
  const existing = new Set((await rows<{ sku: string }>('SELECT sku FROM products')).map((r) => r.sku));
  let added = 0;
  for (const p of catalogue) {
    if (existing.has(p.sku)) {
      /* Catalogue facts follow the catalogue; price and stock are the shop's. */
      await run(
        'UPDATE products SET name = ?, name_ur = ?, brand = ?, category = ?, subcategory = ?, size = ?, image = ? WHERE sku = ?',
        [p.name, p.nameUr, p.brand, p.category, p.subcategory, p.size, p.image, p.sku],
      );
      continue;
    }
    const { stock, reorder } = stockFor(p.sku);
    await run(
      `INSERT INTO products (sku, name, name_ur, brand, category, subcategory, size, image, price, stock, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.sku, p.name, p.nameUr, p.brand, p.category, p.subcategory, p.size, p.image, priceFor(p), stock, reorder],
    );
    if (stock > 0) await run("INSERT INTO stock_movements (sku, delta, reason) VALUES (?, ?, 'seed')", [p.sku, stock]);
    added += 1;
  }
  /* Gone from the catalogue: taken off sale, not deleted — old orders still name it. */
  const live = new Set(catalogue.map((p) => p.sku));
  let retired = 0;
  for (const sku of existing) {
    if (!live.has(sku)) {
      await run('UPDATE products SET active = 0 WHERE sku = ?', [sku]);
      retired += 1;
    }
  }
  console.log(`Products: ${catalogue.length} in catalogue, ${added} added, ${retired} retired.`);
  return catalogue;
}

async function seedAdmin(): Promise<void> {
  const phone = normalisePhone(process.env.ADMIN_PHONE ?? '');
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!phone || password.length < 8) {
    console.log('Admin: skipped — set ADMIN_PHONE (03xxxxxxxxx) and ADMIN_PASSWORD (8+ characters).');
    return;
  }
  const found = await rows<{ id: number }>('SELECT id FROM users WHERE phone = ?', [phone]);
  if (found[0]) {
    await run("UPDATE users SET role = 'admin' WHERE id = ?", [found[0].id]);
    console.log(`Admin: ${phone} already exists; made sure it is an admin (password unchanged).`);
    return;
  }
  await run("INSERT INTO users (name, phone, password_hash, role) VALUES ('Store admin', ?, ?, 'admin')", [
    phone,
    await bcrypt.hash(password, 10),
  ]);
  console.log(`Admin: created ${phone}.`);
}

async function clearDemo(): Promise<void> {
  const orders = await run('DELETE FROM orders WHERE is_demo = 1');
  const users = await run('DELETE FROM users WHERE is_demo = 1');
  console.log(`Demo data removed: ${orders.affectedRows} orders, ${users.affectedRows} customers.`);
}

/**
 * Made-up history, so the dashboard and analytics can be seen working before
 * there are real customers. Everything is flagged is_demo and stock is left
 * alone. A fixed seed makes it the same every time.
 */
async function seedDemoOrders(catalogue: CatalogueProduct[]): Promise<void> {
  await clearDemo();
  let state = 20261006;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)]!;

  const prices = new Map(
    (await rows<{ sku: string; price: number }>('SELECT sku, price FROM products')).map((r) => [r.sku, r.price]),
  );
  /* Some products are simply more popular: a few sell a lot, most a little,
     and about a fifth not at all — which is what makes "slow movers" real. */
  const weighted: CatalogueProduct[] = [];
  for (const p of catalogue) {
    const appeal = unit(`appeal:${p.sku}`);
    const copies = appeal < 0.2 ? 0 : appeal > 0.92 ? 14 : appeal > 0.75 ? 6 : p.tags.includes('popular') ? 4 : 1;
    for (let i = 0; i < copies; i += 1) weighted.push(p);
  }

  const names = ['Ayesha Khan', 'Bilal Ahmed', 'Fatima Malik', 'Hamza Raza', 'Sana Iqbal', 'Usman Tariq', 'Zainab Hussain', 'Ali Shah', 'Maryam Butt', 'Omar Farooq', 'Hira Aslam', 'Saad Qureshi', 'Noor Javed', 'Imran Siddiqui', 'Mahnoor Akram', 'Danish Mirza', 'Rabia Anwar', 'Faisal Chaudhry', 'Amna Riaz', 'Kashif Mehmood'];
  const areas = ['Gulberg Greens', 'Gulberg Residencia', 'Gulberg Business Square', 'Ghauri Town', 'Koral Town'];
  const customers: { id: number; name: string; phone: string }[] = [];
  for (const [index, name] of names.entries()) {
    const phone = `0300${String(5550000 + index)}`;
    const created = await run(
      "INSERT INTO users (name, phone, password_hash, is_demo, created_at) VALUES (?, ?, '!', 1, UTC_TIMESTAMP() - INTERVAL ? DAY)",
      [name, phone, Math.floor(random() * 60)],
    );
    customers.push({ id: created.insertId, name, phone });
  }

  let count = 0;
  for (let daysAgo = 60; daysAgo >= 0; daysAgo -= 1) {
    const weekday = new Date(Date.now() - daysAgo * 86400000).getUTCDay();
    /* Busier at weekends, and a gentle rise over the two months. */
    const base = 3 + (60 - daysAgo) / 15 + (weekday === 0 || weekday === 6 ? 3 : 0);
    const today = Math.round(base * (0.6 + random() * 0.8));
    for (let n = 0; n < today; n += 1) {
      const customer = pick(customers);
      const fulfilment = random() < 0.7 ? 'delivery' : 'pickup';
      /* Two daily peaks, in Pakistan time: late morning and evening. */
      const hourPkt = Math.round(random() < 0.45 ? 10 + random() * 3 : 17 + random() * 4);
      const minutesAgo = daysAgo * 1440 + (24 - hourPkt + 5) * 60 - Math.floor(random() * 60);
      if (minutesAgo < 0) continue;

      const lines = new Map<string, number>();
      const size = 2 + Math.floor(random() * 6);
      for (let i = 0; i < size; i += 1) {
        const p = pick(weighted);
        lines.set(p.sku, (lines.get(p.sku) ?? 0) + 1 + Math.floor(random() * 2));
      }
      let subtotal = 0;
      for (const [sku, qty] of lines) subtotal += (prices.get(sku) ?? 0) * qty;
      const fee = fulfilment === 'delivery' && subtotal < 3000 ? 150 : 0;
      const roll = random();
      const status = daysAgo === 0 ? pick(['placed', 'confirmed', 'packed']) : roll < 0.06 ? 'cancelled' : 'completed';

      const created = await run(
        `INSERT INTO orders (user_id, status, fulfilment, contact_name, contact_phone, address_line, area, subtotal, delivery_fee, total, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, UTC_TIMESTAMP() - INTERVAL ? MINUTE)`,
        [customer.id, status, fulfilment, customer.name, customer.phone,
          fulfilment === 'delivery' ? `House ${1 + Math.floor(random() * 300)}, Street ${1 + Math.floor(random() * 40)}` : '',
          fulfilment === 'delivery' ? pick(areas) : '', subtotal, fee, subtotal + fee, minutesAgo],
      );
      await run('UPDATE orders SET number = ? WHERE id = ?', [`WF-${100000 + created.insertId}`, created.insertId]);
      const bySku = new Map(catalogue.map((p) => [p.sku, p]));
      for (const [sku, qty] of lines) {
        const p = bySku.get(sku)!;
        await run('INSERT INTO order_items (order_id, sku, name, size, price, qty) VALUES (?, ?, ?, ?, ?, ?)', [
          created.insertId, sku, p.name, p.size, prices.get(sku) ?? 0, qty,
        ]);
      }
      count += 1;
    }
  }
  console.log(`Demo data: ${customers.length} customers, ${count} orders over 60 days (flagged is_demo).`);
}

const args = new Set(process.argv.slice(2));
if (args.has('--clear-demo')) {
  await clearDemo();
} else {
  const catalogue = await seedProducts();
  await seedAdmin();
  if (args.has('--demo-orders')) await seedDemoOrders(catalogue);
}
await pool().end();
