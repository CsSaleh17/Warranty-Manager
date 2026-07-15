import { useEffect, useState } from 'react';
import ProductsPage from './ProductsPage.jsx';
import DashboardPage from './DashboardPage.jsx';
import ExpiringSoonPage from './ExpiringSoonPage.jsx';
import ProfilePage from './ProfilePage.jsx';

function App() {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [productStatusFilter, setProductStatusFilter] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => { if (data?.user) { setAuthenticatedUser(data.user); setPage('dashboard'); } })
      .catch(() => {})
      .finally(() => setIsCheckingSession(false));
  }, []);

  function switchMode(nextMode) {
    setMode(nextMode);
    setForm({ fullName: '', email: '', password: '' });
    setErrors({});
    setMessage('');
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(mode === 'register' ? '/api/register' : '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? form : { email: form.email, password: form.password }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setErrors({ form: data.error || 'Request could not be completed.' });
        }
        return;
      }

      setMessage(data.message);
      setForm({ fullName: '', email: '', password: '' });
      if (mode === 'login') {
        setAuthenticatedUser(data.user);
        setPage('dashboard');
        setMessage('');
      }
    } catch {
      setErrors({ form: 'Unable to reach the server. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authenticatedUser) {
    const logout = async () => { await fetch('/api/logout', { method: 'POST' }); setAuthenticatedUser(null); setPage('login'); setMode('login'); setForm({ fullName: '', email: '', password: '' }); setErrors({}); setMessage(''); };
    return <><nav className="app-nav" aria-label="Main navigation"><div className="nav-brand"><span className="brand-mark" aria-hidden="true">W</span><span>Warranty Manager</span></div><div className="nav-links"><button className={page === 'dashboard' ? 'nav-active' : ''} onClick={() => setPage('dashboard')}>Dashboard</button><button className={page === 'products' ? 'nav-active' : ''} onClick={() => { setProductStatusFilter(''); setPage('products'); }}>Products</button><button className={page === 'expiring' ? 'nav-active' : ''} onClick={() => setPage('expiring')}>Expiring Soon</button></div><div className="nav-account"><button className={page === 'profile' ? 'nav-active' : ''} onClick={() => setPage('profile')}>Profile</button><button className="nav-logout" onClick={logout}>Log out</button></div></nav>{page === 'dashboard' && <DashboardPage onProducts={(status) => { setProductStatusFilter(status); setPage('products'); }} />}{page === 'products' && <ProductsPage user={authenticatedUser} initialMessage={message} statusFilter={productStatusFilter} />}{page === 'expiring' && <ExpiringSoonPage />}{page === 'profile' && <ProfilePage onUserUpdated={setAuthenticatedUser} onSessionExpired={logout} />}</>;
  }

  return (
    <main className="app-shell">
      <section className="registration-card" aria-labelledby="account-title">
        <div className="auth-brand"><span className="brand-mark" aria-hidden="true">W</span></div>
        <h1 id="account-title">Warranty Manager</h1>
        <h2 className="auth-title">{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
        <div className="mode-switch" aria-label="Account action">
          <button type="button" className={mode === 'register' ? 'mode-active' : ''} onClick={() => switchMode('register')}>Register</button>
          <button type="button" className={mode === 'login' ? 'mode-active' : ''} onClick={() => switchMode('login')}>Log in</button>
        </div>
        <p>{mode === 'register' ? 'Create your account to get started.' : 'Log in to your account.'}</p>
        <form onSubmit={handleSubmit} noValidate>
          {mode === 'register' && <>
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" name="fullName" type="text" value={form.fullName} onChange={handleChange} aria-describedby="fullName-error" />
            {errors.fullName && <p id="fullName-error" className="field-error">{errors.fullName}</p>}
          </>}

          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} aria-describedby="email-error" />
          {errors.email && <p id="email-error" className="field-error">{errors.email}</p>}

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" value={form.password} onChange={handleChange} aria-describedby="password-error" />
          {errors.password && <p id="password-error" className="field-error">{errors.password}</p>}

          {errors.form && <p className="form-message error" role="alert">{errors.form}</p>}
          {message && <p className="form-message success" role="status">{message}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (mode === 'register' ? 'Creating account...' : 'Logging in...') : (mode === 'register' ? 'Create account' : 'Log in')}
          </button>
        </form>
        {authenticatedUser && <p className="form-message success">Logged in as {authenticatedUser.fullName}.</p>}
      </section>
    </main>
  );
}

export default App;
