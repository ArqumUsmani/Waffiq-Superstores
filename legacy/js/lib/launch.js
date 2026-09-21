/**
 * The "picked item becomes the page" transition: clone a source element
 * out of its card, arc it to the centre of the screen while it grows,
 * flood the viewport with the category's pastel from that point, then
 * navigate — used for the click on a category card, whatever the icon
 * underneath actually is (an interactive scene's chosen item, or a
 * category's plain static render).
 *
 * One shared body so every category gets the same feel; each caller
 * only supplies the element to fly and whatever it needs done first
 * (basket-scene.js drops the rest of the produce back into the crate,
 * category-icon.js has nothing to do beforehand).
 */
import { el } from './dom.js';
import { gsap } from './gsap-setup.js';

let launchLayer = null;
function getLaunchLayer() {
  launchLayer ??= el('div', { class: 'scene-launch', 'aria-hidden': 'true' });
  if (!launchLayer.isConnected) document.body.append(launchLayer);
  return launchLayer;
}

/**
 * @param {Object} options
 * @param {HTMLElement} options.sourceEl - the element to clone and fly.
 * @param {string} options.href - where to navigate once the grow completes.
 * @param {string} [options.pastel] - flood colour; falls back to the
 *   source element's own inherited `--pastel` custom property.
 * @param {number} [options.rotate] - the source's current visual
 *   rotation in degrees, if any — cloneNode copies the element alone,
 *   not an ancestor's transform, so a rotated source has to say so
 *   explicitly or the clone snaps upright for one frame.
 * @param {() => void} [options.beforeNavigate] - runs once the grow
 *   finishes, before the page actually navigates (basket-scene.js uses
 *   this to hand off which item was chosen via sessionStorage).
 */
export function launchAndNavigate({ sourceEl, href, pastel, rotate = 0, beforeNavigate }) {
  const rect = sourceEl.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  const layer = getLaunchLayer();
  const clone = sourceEl.cloneNode(true);
  clone.className = 'scene-launch__item';
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
  });
  layer.append(clone);
  sourceEl.style.visibility = 'hidden';

  gsap.set(clone, { rotate, transformOrigin: '50% 50%' });

  const resolvedPastel = pastel || getComputedStyle(sourceEl).getPropertyValue('--pastel').trim() || '#e4f2d3';
  const flood = el('div', { class: 'scene-launch__flood' });
  flood.style.setProperty('--flood-color', resolvedPastel);
  flood.style.setProperty('--flood-x', `${startX}px`);
  flood.style.setProperty('--flood-y', `${startY}px`);
  layer.append(flood);
  layer.classList.add('is-active');

  // Grown via real width/height, not a transform scale. A ~45x jump (a
  // 20px card icon to an 900px hero) is far past what a compositor keeps
  // sharp: transform-scale animations are backed by a bitmap rasterised
  // once at the start size, so stretching it that far blurs badly
  // regardless of the source being vector art or a high-res photo.
  // Animating layout width/height instead makes the browser re-render
  // the image at each size — real cost, but trivial for one clone over
  // well under a second.
  const midSize = rect.width * 1.2;
  const endSize = Math.min(window.innerWidth, window.innerHeight) * 0.62;
  const midCentreX = startX + (startX < window.innerWidth / 2 ? 40 : -40);
  const midCentreY = startY - window.innerHeight * 0.16;
  const endCentreX = window.innerWidth / 2;
  const endCentreY = window.innerHeight / 2;

  gsap.timeline({
    onComplete: () => {
      beforeNavigate?.();
      window.location.href = href;
    },
  })
    .to(clone, {
      keyframes: [
        {
          left: midCentreX - midSize / 2,
          top: midCentreY - midSize / 2,
          width: midSize,
          height: midSize,
          rotate: rotate * 0.3,
          duration: 0.38,
          ease: 'power2.out',
        },
        {
          left: endCentreX - endSize / 2,
          top: endCentreY - endSize / 2,
          width: endSize,
          height: endSize,
          rotate: 0,
          duration: 0.42,
          ease: 'power3.out',
        },
      ],
    }, 0)
    .to(flood, { '--flood-scale': 1, duration: 0.75, ease: 'power2.inOut' }, 0.05);
}
