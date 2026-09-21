/**
 * Light / dark theme state.
 *
 * The first paint is handled by the inline bootstrap in each page's
 * <head>; this module only owns changes made after load.
 */
const STORAGE_KEY = 'wafiq:theme';
const listeners = new Set();

const systemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function stored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  return systemPrefersDark() ? 'dark' : 'light';
}

export function setTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);

  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode — the choice just will not persist */
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === 'dark' ? '#0d1410' : '#136f37');

  listeners.forEach((cb) => cb(next));
}

export const toggleTheme = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');

export function onThemeChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Follows the OS while the visitor has not made an explicit choice. */
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  if (stored()) return;
  document.documentElement.setAttribute('data-theme', event.matches ? 'dark' : 'light');
  listeners.forEach((cb) => cb(event.matches ? 'dark' : 'light'));
});
