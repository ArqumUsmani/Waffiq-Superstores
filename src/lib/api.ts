/**
 * The one way the site talks to its API (server/, mounted at /api).
 *
 * Same origin in production and through Vite's proxy in development, so the
 * session cookie rides along without any CORS set-up.
 */

/** An answer from the API that is not a success — its message is safe to show. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Give up after this long. The store is optional; the site never waits on it. */
  timeoutMs?: number;
}

const OFFLINE = 'We could not reach the store. Check your connection and try again.';

export async function api<T>(path: string, { method = 'GET', body, timeoutMs = 15000 }: ApiOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    /* A static host with no API answers /api with the site's own HTML. */
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;
    if (!response.ok || !isJson) {
      throw new ApiError(typeof data?.error === 'string' ? data.error : OFFLINE, response.status || 503);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(OFFLINE, 0);
  } finally {
    window.clearTimeout(timer);
  }
}

/** The message to show for anything a request threw. */
export const errorMessage = (error: unknown): string => (error instanceof ApiError ? error.message : OFFLINE);
