import { $, escapeHtml } from '../lib/dom.js';
import { getProduct, getCategory, getSubcategory, relatedProducts } from '../lib/data.js';
import { productArtwork } from '../components/product-tile.js';
import { productRail } from '../components/product-card.js';
import { initReveals } from '../components/reveal.js';
import { gsap } from '../lib/gsap-setup.js';
import { motion } from '../lib/motion-guard.js';
import { t, pick, isRtl } from '../lib/i18n.js';

export default function productPage() {
  const root = $('[data-product-page]');
  if (!root) return null;

  const sku = new URLSearchParams(window.location.search).get('sku') ?? '';
  const product = getProduct(sku);

  if (!product) {
    root.innerHTML = `
      <div class="empty-state shell">
        <h1>${escapeHtml(t('product.notFound'))}</h1>
        <p>${escapeHtml(t('product.notFoundBody'))}</p>
        <a class="btn btn--solid" href="/categories.html">${escapeHtml(t('product.browseAll'))}</a>
      </div>`;
    return null;
  }

  const category = getCategory(product.category);
  const shelf = getSubcategory(product.subcategory);

  const render = () => {
    document.title = `${product.name} — Wafiq Superstores`;
    root.style.setProperty('--pastel', category?.pastel ?? '#eceae7');
    root.style.setProperty('--accent', category?.accent ?? '#136f37');

    const name = isRtl() ? product.nameUr : product.name;
    const secondary = isRtl() ? product.name : product.nameUr;

    root.innerHTML = `
      <nav class="crumbs shell" aria-label="Breadcrumb">
        <a href="/categories.html">${escapeHtml(t('nav.categories'))}</a>
        <span aria-hidden="true">/</span>
        <a href="/category.html?cat=${encodeURIComponent(category.slug)}">${escapeHtml(pick(category, 'en'))}</a>
        <span aria-hidden="true">/</span>
        <a href="/category.html?cat=${encodeURIComponent(category.slug)}&shelf=${encodeURIComponent(shelf.slug)}">${escapeHtml(pick(shelf, 'en'))}</a>
      </nav>

      <article class="product shell">
        <div class="product__art" data-product-art>
          ${productArtwork(product, { alt: product.name, eager: true })}
          ${product.tags.includes('popular') ? `<span class="sticker sticker--pop">${escapeHtml(t('popular.eyebrow'))}</span>` : ''}
        </div>

        <div class="product__info">
          <p class="eyebrow">${escapeHtml(product.brand)}</p>
          <h1 class="product__name" data-product-title>${escapeHtml(name)}</h1>
          <p class="product__alt" ${isRtl() ? '' : 'lang="ur" dir="rtl"'}>${escapeHtml(secondary)}</p>

          <dl class="product__facts">
            <div><dt>${escapeHtml(t('product.packSize'))}</dt><dd>${escapeHtml(product.size)}</dd></div>
            <div><dt>${escapeHtml(t('product.brand'))}</dt><dd>${escapeHtml(product.brand)}</dd></div>
            <div><dt>${escapeHtml(t('product.aisle'))}</dt>
              <dd><a href="/category.html?cat=${encodeURIComponent(category.slug)}">${escapeHtml(pick(category, 'en'))}</a></dd></div>
            <div><dt>${escapeHtml(t('product.shelf'))}</dt>
              <dd><a href="/category.html?cat=${encodeURIComponent(category.slug)}&shelf=${encodeURIComponent(shelf.slug)}">${escapeHtml(pick(shelf, 'en'))}</a></dd></div>
          </dl>

          <h2 class="product__subhead">${escapeHtml(t('product.about'))}</h2>
          <p class="product__desc">${escapeHtml(product.desc)}</p>

          <p class="notice">${escapeHtml(t('product.listingNote'))}</p>

          <div class="product__actions">
            <a class="btn btn--solid" href="/branches.html">${escapeHtml(t('branchCta.cta'))}</a>
            <a class="btn btn--ghost" href="/category.html?cat=${encodeURIComponent(category.slug)}&shelf=${encodeURIComponent(shelf.slug)}">
              ${escapeHtml(t('product.back'))} ${escapeHtml(pick(shelf, 'en'))}
            </a>
          </div>
        </div>
      </article>

      <section class="section shell" aria-labelledby="related-title">
        <header class="section__head">
          <h2 id="related-title">${escapeHtml(t('product.related'))}</h2>
          <a class="btn btn--pill btn--sm" href="/category.html?cat=${encodeURIComponent(category.slug)}&shelf=${encodeURIComponent(shelf.slug)}">
            ${escapeHtml(t('common.showAll'))}
          </a>
        </header>
        <div data-related></div>
      </section>`;

    const related = relatedProducts(product, 6);
    $('[data-related]', root)?.replaceChildren(productRail(related));

    // Pairs with the card the visitor clicked, for a cross-document morph.
    const art = $('[data-product-art] .tile', root);
    if (art) art.style.viewTransitionName = 'product-art';

    initReveals(root);

    if (!motion.reduced) {
      gsap.from('[data-product-art]', { scale: 0.92, opacity: 0, duration: 0.7, ease: 'power3.out' });
      gsap.from('.product__info > *', {
        y: 22,
        opacity: 0,
        duration: 0.6,
        stagger: 0.06,
        ease: 'power3.out',
        delay: 0.1,
      });
    }
  };

  render();

  return { refresh: render };
}
