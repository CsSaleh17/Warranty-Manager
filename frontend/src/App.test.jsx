import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

describe('App', () => {
  it('renders the application name', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Warranty Manager' })).toBeInTheDocument();
  });

  it('shows the application sidebar for an authenticated user', async () => {
    global.fetch = jest.fn((url) => {
      if (url === '/api/me') return Promise.resolve({ ok: true, json: async () => ({ user: { id: 1, fullName: 'Saleh Khalid', email: 'saleh@example.com' } }) });
      if (url === '/api/dashboard') return Promise.resolve({ ok: true, json: async () => ({ statistics: { total: 0, active: 0, expiringSoon: 0, expired: 0 }, recentlyAdded: [], nearestExpiration: [] }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<App />);

    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByText('Saleh Khalid')).toBeInTheDocument();
  });

  it('replaces an old dashboard status filter when a different dashboard card is selected', async () => {
    const dashboard = { statistics: { total: 2, active: 1, expiringSoon: 0, expired: 1 }, recentlyAdded: [], nearestExpiration: [] };
    const activeProduct = { id: 1, name: 'Active phone', category: 'Smartphones', storeName: 'Store', warrantyStatus: 'Active', remainingWarrantyDays: 60, expirationDate: '2026-12-31' };
    const expiredProduct = { id: 2, name: 'Expired camera', category: 'Cameras', storeName: 'Store', warrantyStatus: 'Expired', remainingWarrantyDays: -1, expirationDate: '2026-07-01' };
    global.fetch = jest.fn((url) => {
      if (url === '/api/me') return Promise.resolve({ ok: true, json: async () => ({ user: { id: 1, fullName: 'Test User', email: 'user@example.com' } }) });
      if (url === '/api/dashboard') return Promise.resolve({ ok: true, json: async () => dashboard });
      if (url === '/api/products?status=Active') return Promise.resolve({ ok: true, json: async () => ({ products: [activeProduct], pagination: { page: 1, limit: 12, totalItems: 1, totalPages: 1 }, availableFilters: { stores: [], categories: [] } }) });
      if (url === '/api/products?status=Expired') return Promise.resolve({ ok: true, json: async () => ({ products: [expiredProduct], pagination: { page: 1, limit: 12, totalItems: 1, totalPages: 1 }, availableFilters: { stores: [], categories: [] } }) });
      return Promise.resolve({ ok: true, json: async () => ({ products: [activeProduct, expiredProduct], pagination: { page: 1, limit: 12, totalItems: 2, totalPages: 1 }, availableFilters: { stores: [], categories: [] } }) });
    });

    render(<App />);
    await screen.findByText('Dashboard');
    expect(screen.queryByRole('button', { name: 'Expiring Soon', exact: true })).not.toBeInTheDocument();
    fireEvent.click((await screen.findByText('Active Warranties')).closest('button'));
    expect(await screen.findByText('Active phone')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    fireEvent.click((await screen.findByText('Expired Warranties')).closest('button'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/products?status=Expired', expect.any(Object)));
    expect(await screen.findByText('Expired camera')).toBeInTheDocument();
    expect(screen.queryByText('Active phone')).not.toBeInTheDocument();
    expect(window.location.search).toBe('?status=Expired');
  });

  it('renders a Not Found page for an unknown authenticated route', async () => {
    window.history.replaceState({}, '', '/does-not-exist');
    global.fetch = jest.fn((url) => url === '/api/me' ? Promise.resolve({ ok: true, json: async () => ({ user: { id: 1, fullName: 'Test User', email: 'user@example.com' } }) }) : Promise.resolve({ ok: true, json: async () => ({}) }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Dashboard' }));
    expect(window.location.pathname).toBe('/dashboard');
  });
});
