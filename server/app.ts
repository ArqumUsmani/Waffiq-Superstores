/**
 * The API, as one Hono app.
 *
 * It is mounted two ways and behaves the same in both: on Vercel through
 * api/index.ts, and locally through server/dev.ts (with Vite proxying /api
 * to it). All routes live under /api.
 */
import { Hono } from 'hono';
import { requireAdmin, type AppEnv } from './auth.js';
import { admin } from './routes/admin.js';
import { Refusal, shop } from './routes/shop.js';

export const app = new Hono<AppEnv>().basePath('/api');

app.onError((error, c) => {
  /* A refusal is an answer for the customer; anything else is a fault, and
     its detail stays in the server log rather than going to the browser. */
  if (error instanceof Refusal) return c.json({ error: error.message }, error.status);
  console.error(error);
  return c.json({ error: 'Something went wrong on our side. Please try again.' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found.' }, 404));

app.use('/admin/*', requireAdmin);
app.route('/admin', admin);
app.route('/', shop);
