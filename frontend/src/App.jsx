import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n.js';
import { translateApiError } from './localization.js';
import ProductsPage from './ProductsPage.jsx';
import DashboardPage from './DashboardPage.jsx';
import ProfilePage from './ProfilePage.jsx';
import ProductDetailsPage from './ProductDetailsPage.jsx';
import { ForgotPasswordPage, ResetPasswordPage } from './PasswordResetPage.jsx';

function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return <button type="button" className="language-switcher" onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}>{t('language')}</button>;
}

function authenticatedRoute(pathname = window.location.pathname) {
  if (pathname === '/' || pathname === '/dashboard') return { page: 'dashboard' };
  if (pathname === '/profile') return { page: 'profile' };
  const details = pathname.match(/^\/products\/(\d+)$/);
  if (details) return { page: 'details', productId: Number(details[1]) };
  if (pathname === '/products' || pathname === '/products/new') return { page: 'products' };
  return { page: 'notFound' };
}

function NotFoundPage({ onDashboard }) {
  const { t } = useTranslation();
  return <main className="products-page"><h1>{t('notFound.title')}</h1><p>{t('notFound.message')}</p><button type="button" onClick={onDashboard}>{t('notFound.back')}</button></main>;
}

function App() {
  const { t, i18n } = useTranslation();
  const initialRoute = authenticatedRoute();
  const [mode, setMode] = useState('register'); const [form, setForm] = useState({ fullName: '', email: '', password: '' }); const [errors, setErrors] = useState({}); const [message, setMessage] = useState(''); const [isSubmitting, setIsSubmitting] = useState(false); const [authenticatedUser, setAuthenticatedUser] = useState(null); const [page, setPage] = useState(initialRoute.page); const [productStatusFilter, setProductStatusFilter] = useState(''); const [openAdd, setOpenAdd] = useState(window.location.pathname === '/products/new'); const [selectedProductId, setSelectedProductId] = useState(initialRoute.productId || null); const [isCheckingSession, setIsCheckingSession] = useState(false); const [publicPage, setPublicPage] = useState(() => window.location.pathname === '/reset-password' ? 'reset' : window.location.pathname === '/forgot-password' ? 'forgot' : 'login');
  useEffect(() => { fetch('/api/me').then(async r => (r.ok ? r.json() : null)).then(data => { if (data?.user) { const route = authenticatedRoute(); setAuthenticatedUser(data.user); setPage(route.page); setSelectedProductId(route.productId || null); } }).catch(() => {}).finally(() => setIsCheckingSession(false)); }, []);
  useEffect(() => { const syncRoute = () => { const route = authenticatedRoute(); setPage(route.page); setSelectedProductId(route.productId || null); setOpenAdd(window.location.pathname === '/products/new'); }; window.addEventListener('popstate', syncRoute); return () => window.removeEventListener('popstate', syncRoute); }, []);
  function switchMode(next) { setMode(next); setForm({ fullName: '', email: '', password: '' }); setErrors({}); setMessage(''); }
  async function handleSubmit(event) { event.preventDefault(); setErrors({}); setMessage(''); const nextErrors = {}; if (mode === 'register' && !form.fullName.trim()) nextErrors.fullName = t('authValidation.fullNameRequired'); else if (mode === 'register' && form.fullName.trim().length < 2) nextErrors.fullName = t('authValidation.fullNameMin'); if (!form.email.trim()) nextErrors.email = t('authValidation.emailRequired'); else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = t('authValidation.emailInvalid'); if (!form.password) nextErrors.password = t('authValidation.passwordRequired'); else if (mode === 'register' && form.password.length < 8) nextErrors.password = t('authValidation.passwordMin', { count: i18n.language === 'ar' ? '٨' : 8 }); if (Object.keys(nextErrors).length) return setErrors(nextErrors); setIsSubmitting(true); try { const response = await fetch(mode === 'register' ? '/api/register' : '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'register' ? form : { email: form.email, password: form.password }) }); const data = await response.json(); if (!response.ok) { setErrors(data.errors ? Object.fromEntries(Object.keys(data.errors).map((key) => [key, key === 'email' ? t('authValidation.emailInvalid') : key === 'password' ? t('authValidation.passwordMin', { count: i18n.language === 'ar' ? '٨' : 8 }) : t('authValidation.fullNameMin')])) : { form: translateApiError(data.error, t, response.status) }); return; } setMessage(t('auth.registered')); setForm({ fullName: '', email: '', password: '' }); if (mode === 'login') { window.history.pushState({}, '', '/dashboard'); setAuthenticatedUser(data.user); setPage('dashboard'); setMessage(''); } } catch { setErrors({ form: translateApiError('Network error', t) }); } finally { setIsSubmitting(false); } }
  if (authenticatedUser) {
    const logout = async () => { await fetch('/api/logout', { method: 'POST' }); window.history.pushState({}, '', '/'); setAuthenticatedUser(null); setPage('login'); switchMode('login'); };
    const openDashboard = () => { window.history.pushState({}, '', '/dashboard'); setPage('dashboard'); };
    const openProfile = () => { window.history.pushState({}, '', '/profile'); setPage('profile'); };
    const openProducts = (status = '', options = {}) => { const query = status ? `?${new URLSearchParams({ status })}` : ''; const pathname = options.openAdd ? '/products/new' : '/products'; window.history.pushState({}, '', `${pathname}${query}`); setProductStatusFilter(status); setOpenAdd(Boolean(options.openAdd)); setPage('products'); };
    const openDetails = (id) => { window.history.pushState({}, '', `/products/${id}`); setSelectedProductId(id); setPage('details'); };
    return <div className="authenticated-shell">
      <nav className="app-nav" aria-label={t('nav.main')}>
        <div className="nav-brand"><span className="brand-mark" aria-hidden="true">✓</span><span>{t('appName')}</span></div>
        <div className="nav-links">
          <button className={page === 'dashboard' ? 'nav-active' : ''} onClick={openDashboard}><span aria-hidden="true">⌂</span>{t('nav.dashboard')}</button>
          <button className={page === 'products' ? 'nav-active' : ''} onClick={() => openProducts()}><span aria-hidden="true">▣</span>{t('nav.products')}</button>
        </div>
        <div className="nav-account"><LanguageSwitcher /><button className={page === 'profile' ? 'nav-active' : ''} onClick={openProfile}>{t('nav.profile')}</button><button className="nav-logout" onClick={logout}>{t('nav.logout')}</button></div>
        <div className="nav-user"><span className="user-avatar" aria-hidden="true">{authenticatedUser.fullName?.slice(0, 1).toUpperCase()}</span><span><strong>{authenticatedUser.fullName}</strong><small>{authenticatedUser.email}</small></span></div>
      </nav>
      <div className="app-content">{page === 'dashboard' && <DashboardPage onProducts={openProducts} onDetails={openDetails} user={authenticatedUser} />}{page === 'products' && <ProductsPage user={authenticatedUser} initialMessage={message} statusFilter={productStatusFilter} openAdd={openAdd} onDetails={openDetails} />}{page === 'details' && <ProductDetailsPage productId={selectedProductId} onBack={() => openProducts()} onEdit={() => openProducts('', { openAdd: false })} />}{page === 'profile' && <ProfilePage onUserUpdated={setAuthenticatedUser} onSessionExpired={logout} />}{page === 'notFound' && <NotFoundPage onDashboard={openDashboard} />}</div>
    </div>;
  }
  if (publicPage === 'forgot') return <ForgotPasswordPage onLogin={() => { window.history.pushState({}, '', '/'); setPublicPage('login'); }} />;
  if (publicPage === 'reset') return <ResetPasswordPage onLogin={() => { window.history.pushState({}, '', '/'); setPublicPage('login'); }} />;
  return <main className="app-shell"><section className="registration-card" aria-labelledby="account-title"><div className="auth-header"><div className="auth-brand"><span className="brand-mark" aria-hidden="true">W</span></div><LanguageSwitcher /></div><h1 id="account-title">{t('appName')}</h1><h2 className="auth-title">{mode === 'register' ? t('auth.createTitle') : t('auth.welcome')}</h2><div className="mode-switch" aria-label={t('auth.action')}><button type="button" className={mode === 'register' ? 'mode-active' : ''} onClick={() => switchMode('register')}>{t('auth.register')}</button><button type="button" className={mode === 'login' ? 'mode-active' : ''} onClick={() => switchMode('login')}>{t('auth.login')}</button></div><p>{mode === 'register' ? t('auth.createHelp') : t('auth.loginHelp')}</p><form onSubmit={handleSubmit} noValidate>{mode === 'register' && <><label htmlFor="fullName">{t('auth.fullName')}</label><input id="fullName" name="fullName" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />{errors.fullName && <p className="field-error">{errors.fullName}</p>}</>}<label htmlFor="email">{t('auth.email')}</label><input id="email" name="email" type="email" dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />{errors.email && <p className="field-error">{errors.email}</p>}<label htmlFor="password">{t('auth.password')}</label><input id="password" name="password" type="password" dir="ltr" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />{errors.password && <p className="field-error">{errors.password}</p>}{errors.form && <p className="form-message error" role="alert">{errors.form}</p>}{message && <p className="form-message success" role="status">{message}</p>}<button type="submit" disabled={isSubmitting}>{isSubmitting ? (mode === 'register' ? t('auth.creating') : t('auth.loggingIn')) : (mode === 'register' ? t('auth.create') : t('auth.login'))}</button>{mode === 'login' && <button type="button" className="secondary-button" onClick={() => { window.history.pushState({}, '', '/forgot-password'); setPublicPage('forgot'); }}>{t('auth.forgot')}</button>}</form></section></main>;
}
export default App;
