import { CategoryCard } from './CategoryCard';
import { categories } from '../lib/data';
import { t } from '../lib/i18n';
import { useLang } from '../state/app-state';
import { useReveal } from '../hooks/useReveal';

/** The "10 Aisles" grid. Auto-fills 1 → 2 → 3 → 4 columns from the existing CSS. */
export function CategoriesSection() {
  useLang();
  const ref = useReveal<HTMLElement>();

  return (
    <section className="section section--framed" id="categories" ref={ref} aria-labelledby="categories-title">
      <div className="section__frame">
        <header className="section__head">
          <div>
            <p className="eyebrow">{t('categories.eyebrow')}</p>
            <h2 id="categories-title">{t('categories.title')}</h2>
          </div>
          <p className="lede">{t('categories.sub')}</p>
        </header>

        <div className="category-grid">
          {categories.map((category, index) => (
            <CategoryCard key={category.slug} category={category} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
