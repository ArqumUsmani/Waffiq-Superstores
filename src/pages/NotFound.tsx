import { Link } from 'react-router';
import { t } from '../lib/i18n';
import { useLang } from '../state/app-state';

export default function NotFound() {
  useLang();
  return (
    <section className="section section--framed" style={{ paddingBlockStart: '8rem' }}>
      <div className="section__frame" style={{ textAlign: 'center' }}>
        <p className="eyebrow">{t('notFound.code')}</p>
        <h1>{t('notFound.title')}</h1>
        <p className="lede" style={{ marginInline: 'auto' }}>
          {t('notFound.body')}
        </p>
        <Link className="btn btn--solid" to="/">
          {t('notFound.cta')}
        </Link>
      </div>
    </section>
  );
}
