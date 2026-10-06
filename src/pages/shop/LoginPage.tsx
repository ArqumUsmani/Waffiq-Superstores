import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { ShopPage } from '../../components/shop';
import { errorMessage } from '../../lib/api';
import { t } from '../../lib/i18n';
import { useLang } from '../../state/app-state';
import { loadUser, signIn, signUp, useAuth } from '../../state/auth';

/** Only ever back into this site: a `next` of "//elsewhere.example" is ignored. */
export const safeNext = (next: string | null, fallback = '/account'): string =>
  next && /^\/(?!\/)/.test(next) ? next : fallback;

export default function LoginPage() {
  useLang();
  const auth = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadUser();
  }, []);

  if (auth.user) return <Navigate to={next} replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'in') await signIn(email, password);
      else await signUp(name, email, phone, password);
    } catch (problem) {
      setError(errorMessage(problem));
      setBusy(false);
    }
  };

  return (
    <ShopPage title={t(mode === 'in' ? 'shop.auth.signInTitle' : 'shop.auth.signUpTitle')} narrow>
      <p className="lede">{t('shop.auth.lede')}</p>

      <div className="shop-tabs" role="tablist">
        {(['in', 'up'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            className={mode === tab ? 'is-current' : ''}
            onClick={() => {
              setMode(tab);
              setError('');
            }}
          >
            {t(tab === 'in' ? 'shop.auth.signInTab' : 'shop.auth.signUpTab')}
          </button>
        ))}
      </div>

      <form className="shop-form" onSubmit={submit}>
        {mode === 'up' ? (
          <label className="field">
            <span className="field__label">{t('shop.auth.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={120} />
          </label>
        ) : null}
        <label className="field">
          <span className="field__label">{t(mode === 'in' ? 'shop.auth.login' : 'shop.auth.email')}</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            /* Signing in also takes a mobile number, for accounts made before email. */
            type={mode === 'up' ? 'email' : 'text'}
            inputMode="email"
            autoComplete={mode === 'in' ? 'username' : 'email'}
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            required
            maxLength={190}
          />
          {mode === 'up' ? <small className="field__hint">{t('shop.auth.emailHint')}</small> : null}
        </label>
        {mode === 'up' ? (
        <label className="field">
          <span className="field__label">{t('shop.auth.phone')}</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t('shop.auth.phoneHint')}
            dir="ltr"
            required
          />
          <small className="field__hint">{t('shop.auth.phoneWhy')}</small>
        </label>
        ) : null}
        <label className="field">
          <span className="field__label">{t('shop.auth.password')}</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            placeholder={mode === 'up' ? t('shop.auth.passwordHint') : undefined}
            dir="ltr"
            required
            minLength={mode === 'up' ? 8 : 1}
            maxLength={100}
          />
        </label>
        {error ? (
          <p className="notice notice--warn" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn btn--solid" type="submit" disabled={busy}>
          {busy ? t('shop.auth.busy') : t(mode === 'in' ? 'shop.auth.submitIn' : 'shop.auth.submitUp')}
        </button>
        {mode === 'in' ? (
          <Link className="shop-form__link" to="/forgot">
            {t('shop.auth.forgot')}
          </Link>
        ) : null}
      </form>
    </ShopPage>
  );
}
