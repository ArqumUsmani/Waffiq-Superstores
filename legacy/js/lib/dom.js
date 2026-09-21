/** Small DOM helpers shared across components. */

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/**
 * Builds an element from a tag, a props object and children.
 * `class` and `dataset` get special handling; everything else is set as
 * an attribute, so `el('a', { href, 'aria-label': '…' })` works.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') {
      // Custom properties have to go through setProperty — assigning them
      // onto the style object is silently ignored.
      for (const [prop, val] of Object.entries(value)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    }
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? '' : value);
  }

  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Escapes text that will be interpolated into an innerHTML string. */
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );

/**
 * Wraps each character of an element's text in a span, so headlines can
 * be revealed per character without pulling in a splitting library.
 * Word boundaries stay intact so wrapping still behaves.
 */
export function splitChars(node) {
  const source = node.textContent ?? '';
  node.textContent = '';
  const chars = [];

  for (const word of source.split(/(\s+)/)) {
    if (/^\s+$/.test(word)) {
      node.append(document.createTextNode(word));
      continue;
    }
    const wordEl = el('span', { class: 'split-word' });
    for (const char of [...word]) {
      const span = el('span', { class: 'split-char' }, char);
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
 * objects, aisle panels, category cards). Without this they all declare
 * the same gradient id, and every copy after the first paints with the
 * first one's gradient.
 */
let svgIdSeq = 0;
export function uniquifySvgIds(markup) {
  if (!markup) return markup;
  const suffix = `-u${(svgIdSeq += 1)}`;
  return markup
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${id}${suffix}"`)
    .replace(/url\(#([^)"']+)\)/g, (_, id) => `url(#${id}${suffix})`)
    .replace(/\b(xlink:href|href)="#([^"]+)"/g, (_, attr, id) => `${attr}="#${id}${suffix}"`);
}

/** requestAnimationFrame-throttled callback, for pointer and scroll handlers. */
export function rafThrottle(fn) {
  let queued = false;
  let lastArgs;
  return (...args) => {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...lastArgs);
    });
  };
}

/** Reads the layout direction as a multiplier for horizontal motion. */
export const dirFactor = () =>
  document.documentElement.getAttribute('dir') === 'rtl' ? -1 : 1;

/** Fires once the element first enters the viewport. */
export function onceVisible(node, callback, rootMargin = '0px 0px -10% 0px') {
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
