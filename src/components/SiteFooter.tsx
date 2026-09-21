import logoOnLight from '../assets/logo/logo-on-light.svg?url';
import logoOnDark from '../assets/logo/logo-on-dark.svg?url';
import { t } from '../lib/i18n';
import { categories, totals } from '../lib/data';
import { pick } from '../lib/i18n';
import { useLang, useTheme } from '../state/app-state';
import { useSectionNav } from '../hooks/useSectionNav';
import { Link } from 'react-router';

export function SiteFooter({ onSearchOpen }: { onSearchOpen: () => void }) {
  useLang();
  const theme = useTheme();
  const { go } = useSectionNav();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" id="contact">
      <div className="site-footer__inner shell">
        <div className="site-footer__brand">
          <img
            className="site-footer__logo"
            src={theme === 'dark' ? logoOnDark : logoOnLight}
            alt={t('brand.name')}
            width={220}
            height={63}
          />
          <p className="site-footer__tagline">{t('footer.tagline')}</p>
          <p className="site-footer__stats">
            {totals.categories} · {totals.subcategories} · {totals.products}{' '}
            <span>{t('common.products')}</span>
          </p>
        </div>

        <div className="site-footer__cols">
          <div className="site-footer__col">
            <h2>{t('footer.explore')}</h2>
            <a
              href="#categories"
              onClick={(e) => {
                e.preventDefault();
                go('categories');
              }}
            >
              {t('nav.categories')}
            </a>
            <button type="button" onClick={onSearchOpen}>
              {t('search.open')}
            </button>
            <a
              href="#branches"
              onClick={(e) => {
                e.preventDefault();
                go('branches');
              }}
            >
              {t('nav.branches')}
            </a>
          </div>

          <div className="site-footer__col">
            <h2>{t('categories.title')}</h2>
            {categories.slice(0, 5).map((cat) => (
              <Link key={cat.slug} to={`/aisle/${cat.slug}`}>
                {pick(cat as unknown as Record<string, unknown>, 'en')}
              </Link>
            ))}
          </div>

          <div className="site-footer__col">
            <h2>{t('footer.connect')}</h2>
            {categories.slice(5).map((cat) => (
              <Link key={cat.slug} to={`/aisle/${cat.slug}`}>
                {pick(cat as unknown as Record<string, unknown>, 'en')}
              </Link>
            ))}
            <a href="https://wafiq.pk" rel="noopener noreferrer" target="_blank">
              wafiq.pk
            </a>
          </div>
        </div>
      </div>

      <div className="site-footer__bar shell">
        <p>
          © {year} {t('brand.name')}. <span>{t('footer.rights')}</span>
        </p>
        <p className="site-footer__note">{t('footer.note')}</p>
      </div>
    </footer>
  );
}
