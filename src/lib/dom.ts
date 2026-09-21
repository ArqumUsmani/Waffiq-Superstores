/**
 * Small DOM helpers shared across components.
 *
 * `el()` from the vanilla build is gone — JSX replaces it. Everything here
 * is either measurement, per-frame throttling, or string work that still has
 * no JSX equivalent.
 */

/** Escapes text that will be interpolated into an innerHTML string. */
export const escapeHtml = (value: unknown): string =>
  String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch,
  );

/**
 * Wraps each character of an element's text in a span, so headlines can be
 * revealed per character without pulling in a splitting library.
 * Word boundaries stay intact so wrapping still behaves.
 *
 * This mutates the element's children, so any node it is pointed at must be
 * uncontrolled as far as React is concerned — render the text once and
 * remount with a key rather than re-rendering its children.
 */
export function splitChars(node: HTMLElement): HTMLSpanElement[] {
  const source = node.textContent ?? '';
  node.textContent = '';
  const chars: HTMLSpanElement[] = [];

  for (const word of source.split(/(\s+)/)) {
    if (/^\s+$/.test(word)) {
      node.append(document.createTextNode(word));
      continue;
    }
    const wordEl = document.createElement('span');
    wordEl.className = 'split-word';
    for (const char of [...word]) {
      const span = document.createElement('span');
      span.className = 'split-char';
      span.textContent = char;
      wordEl.append(span);
      chars.push(span);
    }
    node.append(wordEl);
  }

  node.setAttribute('aria-label', source);
  return chars;
}

/**
 * Suffixes every id in a block of SVG markup, and the references to it.
 *
 * The same poster file gets inlined in several places on a page (hero
 * objects, aisle panels, category cards). Without this they all declare the
 * same gradient id, and every copy after the first paints with the first
 * one's gradient. The counter is deliberately global and per-call — memoise
 * the result per component instance, never per slug.
 */
let svgIdSeq = 0;
export function uniquifySvgIds(markup: string): string {
  if (!markup) return markup;
  const suffix = `-u${(svgIdSeq += 1)}`;
  return markup
    .replace(/\bid="([^"]+)"/g, (_, id: string) => `id="${id}${suffix}"`)
    .replace(/url\(#([^)"']+)\)/g, (_, id: string) => `url(#${id}${suffix})`)
    .replace(
      /\b(xlink:href|href)="#([^"]+)"/g,
      (_, attr: string, id: string) => `${attr}="#${id}${suffix}"`,
    );
}

/** requestAnimationFrame-throttled callback, for pointer and scroll handlers. */
export function rafThrottle<A extends unknown[]>(
  fn: (...args: A) => void,
): (...args: A) => void {
  let queued = false;
  let lastArgs: A;
  return (...args: A) => {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...lastArgs);
    });
  };
}

/**
 * Reads the layout direction as a multiplier for horizontal motion.
 * Every horizontal tween multiplies by this so RTL mirrors correctly.
 */
export const dirFactor = (): 1 | -1 =>
  document.documentElement.getAttribute('dir') === 'rtl' ? -1 : 1;

/** Fires once the element first enters the viewport. */
export function onceVisible(
  node: Element,
  callback: (target: Element) => void,
  rootMargin = '0px 0px -10% 0px',
): () => void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.disconnect();
        callback(entry.target);
      }
    },
    { rootMargin },
  );
  observer.observe(node);
  return () => observer.disconnect();
}
