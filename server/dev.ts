/** Runs the API locally on :8787. Vite proxies /api here (vite.config.ts). */
import { serve } from '@hono/node-server';
import { loadLocalEnv } from './env.js';

loadLocalEnv();
const { app } = await import('./app.js');
const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`API on http://localhost:${port}/api`));
