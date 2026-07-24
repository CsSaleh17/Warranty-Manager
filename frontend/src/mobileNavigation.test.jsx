import { render, screen } from '@testing-library/react';
import i18n from './i18n.js';
import App from './App.jsx';

function authenticatedFetch(url) {
  if (url === '/api/me') return Promise.resolve({ ok: true, json: async () => ({ user: { id: 1, fullName: 'Saleh', email: 'saleh@example.com' } }) });
  if (url === '/api/dashboard') return Promise.resolve({ ok: true, json: async () => ({ statistics: { total: 0, active: 0, expiringSoon: 0, expired: 0 }, recentlyAdded: [], nearestExpiration: [] }) });
  return Promise.resolve({ ok: true, json: async () => ({}) });
}

describe('mobile navigation', () => {
  const originalWidth = window.innerWidth;
  beforeEach(() => Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 }));
  afterEach(() => Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth }));

  it.each(['en', 'ar'])('keeps every primary action directly available at 375px in %s', async (language) => {
    await i18n.changeLanguage(language);
    global.fetch = jest.fn(authenticatedFetch);
    render(<App />);
    const nav = await screen.findByRole('navigation', { name: i18n.t('nav.main') });
    expect(nav).toHaveClass('app-nav');
    ['dashboard', 'products', 'profile', 'logout'].forEach((key) => expect(screen.getByRole('button', { name: i18n.t(`nav.${key}`) })).toBeVisible());
    expect(screen.getByRole('button', { name: i18n.t('language') })).toBeVisible();
  });
});
