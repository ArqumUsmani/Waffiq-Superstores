/**
 * The admin panel, at /admin.
 *
 * Its own chunk and its own layout: none of this is downloaded by a
 * customer, and none of the site's header, bag or scroll effects run here.
 * What is shown is only a convenience — every /api/admin route checks the
 * admin role itself, on the server.
 */
import './admin.css';
import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import { errorMessage } from '../lib/api';
import { loadUser, signIn, signOut, useAuth } from '../state/auth';
import { toggleTheme } from '../lib/theme';
import { Analytics } from './Analytics';
import { Customers, Dashboard, OrderDetail, Orders, Products, Settings } from './pages';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/settings', label: 'Settings' },
];

export function Component() {
  const auth = useAuth();

  useEffect(() => {
    document.title = 'Wafiq admin';
    void loadUser();
  }, []);

  if (!auth.ready) return <p className="adm-gate">One moment…</p>;
  if (!auth.user) return <AdminLogin />;
  if (auth.user.role !== 'admin') {
    return (
      <div className="adm-gate">
        <h1>Not an admin account</h1>
        <p>You are signed in as {auth.user.name}, which is a customer account.</p>
        <button className="adm-btn" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="adm">
      <aside className="adm-side">
        <a className="adm-side__brand" href="/">
          Wafiq <span>admin</span>
        </a>
        <nav aria-label="Admin">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'is-current' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="adm-side__foot">
          <span>{auth.user.name}</span>
          <button type="button" onClick={toggleTheme}>
            Light / dark
          </button>
          <a href="/">View the site</a>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="adm-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:number" element={<OrderDetail />} />
          <Route path="products" element={<Products />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="customers" element={<Customers />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<p className="adm-empty">No such page.</p>} />
        </Routes>
      </main>
    </div>
  );
}

function AdminLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(phone, password);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="adm-gate" onSubmit={submit}>
      <h1>Wafiq admin</h1>
      <label>
        Email or mobile number
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="text" autoComplete="username" autoCapitalize="none" required />
      </label>
      <label>
        Password
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
      </label>
      {error ? (
        <p className="adm-alert" role="alert">
          {error}
        </p>
      ) : null}
      <button className="adm-btn adm-btn--primary" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
