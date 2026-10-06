/**
 * Vercel entry point for the API. vercel.json sends every /api/* request
 * here; the Hono app does its own routing from the original URL.
 */
import { getRequestListener } from '@hono/node-server';
import { app } from '../server/app.js';

/* Hono reads the request body itself; Vercel must not consume it first. */
export const config = { api: { bodyParser: false } };

export default getRequestListener(app.fetch);
