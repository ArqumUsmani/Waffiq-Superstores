/** Forgotten passwords: ask for a link by email, then set a new one from it. */
import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { ShopPage } from '../../components/shop';
import { errorMessage } from '../../lib/api';
import { t } from '../../lib/i18n';
import { useLang } from '../../state/app-state';
import { requestReset, resetPassword, useAuth } from '../../state/auth';

export function ForgotPage() {
  useLang();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState('busy');
    setError('');
    try {
      await requestReset(email);
      setState('sent');
    } catch (problem) {
      setError(errorMessage(problem));
      setState('idle');
    }
  };

  return (
    <ShopPage title={t('shop.auth.forgotTitle')} narrow>
      {state === 'sent' ? (
        <>
          <p className="notice">{t('shop.auth.forgotSent', { email })}</p>
          <Link className="btn btn--ghost" to="/login">
            {t('shop.auth.backToSignIn')}
          </Link>
        </>
      ) : (
        <form className="shop-form" onSubmit={submit}>
          <p className="lede">{t('shop.auth.forgotLede')}</p>
          <label className="field">
            <span className="field__label">{t('shop.auth.email')}</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" dir="ltr" required maxLength={190} />
          </label>
          {error ? (
            <p className="notice notice--warn" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn--solid" type="submit" disabled={state === 'busy'}>
            {state === 'busy' ? t('shop.auth.busy') : t('shop.auth.forgotSubmit')}
          </button>
          <Link className="shop-form__link" to="/login">
            {t('shop.auth.backToSignIn')}
          </Link>
        </form>
      )}
    </ShopPage>
  );
}

export function ResetPage() {
  useLang();
  const auth = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (done && auth.user) return <Navigate to="/account" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (problem) {
      setError(errorMessage(problem));
      setBusy(false);
    }
  };

  return (
    <ShopPage title={t('shop.auth.resetTitle')} narrow>
      <form className="shop-form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">{t('shop.auth.newPassword')}</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder={t('shop.auth.passwordHint')}
            dir="ltr"
            required
            minLength={8}
            maxLength={100}
          />
        </label>
        {error ? (
          <p className="notice notice--warn" role="alert">
            {error} <Link to="/forgot">{t('shop.auth.forgotSubmit')}</Link>
          </p>
        ) : null}
        <button className="btn btn--solid" type="submit" disabled={busy || !token}>
          {busy ? t('shop.auth.busy') : t('shop.auth.resetSubmit')}
        </button>
      </form>
    </ShopPage>
  );
}
