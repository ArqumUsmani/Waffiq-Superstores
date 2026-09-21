import { $ } from '../lib/dom.js';
import { initHero } from '../components/hero-cluster.js';
import { initHeroGate } from '../components/hero-gate.js';
import { initHeroStorefront } from '../components/hero-storefront.js';
import { initAisleRail } from '../components/aisle-rail.js';
import { brandMarquee } from '../components/marquee.js';
import { productRail } from '../components/product-card.js';
import { popularProducts } from '../lib/data.js';
import { mountReviews } from '../components/reviews.js';

export default function home() {
  let disposeHero = initHero();
  const disposeHeroGate = initHeroGate($('[data-hero-gate]'));
  let disposeHeroStorefront = initHeroStorefront($('[data-hero-storefront]'));
  let disposeRail = initAisleRail();

  const marqueeHost = $('[data-marquee]');
  const railHost = $('[data-popular]');

  const fillMarquee = () => {
    if (!marqueeHost) return;
    marqueeHost.replaceChildren(brandMarquee({ brands: popularBrandOrder() }));
  };

  const fillPopular = () => {
    if (!railHost) return;
    railHost.replaceChildren(productRail(popularProducts(10), { eager: 4 }));
  };

  fillMarquee();
  fillPopular();
  mountReviews($('[data-reviews]'));

  return {
    /**
     * Language switches re-render anything carrying catalogue text.
     * The hero is rebuilt too: applyTranslations() resets the headline to
     * plain text, so its per-character split has to be re-made.
     */
    refresh() {
      fillPopular();
      mountReviews($('[data-reviews]'), { force: true });
      disposeRail();
      disposeRail = initAisleRail();
      disposeHero();
      disposeHero = initHero();
      disposeHeroStorefront();
      disposeHeroStorefront = initHeroStorefront($('[data-hero-storefront]'));
    },
    destroy() {
      disposeHero();
      disposeHeroGate();
      disposeHeroStorefront();
      disposeRail();
    },
  };
}

/** Leads with the brands shoppers recognise, then the rest of the shelf. */
function popularBrandOrder() {
  const leading = [
    'Tapal',
    "Olper's",
    'Shan',
    'National',
    'Nestle',
    'Dettol',
    'Surf Excel',
    'Molfix',
    'Colgate',
    'Knorr',
    'Rafhan',
    'Buldak',
    'Murree',
    'Lipton',
    'Harpic',
    'Lux',
  ];
  return leading;
}
