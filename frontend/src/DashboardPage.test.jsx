import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './DashboardPage.jsx';

describe('DashboardPage', () => {
  it('shows a safe error instead of crashing on an incomplete API response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    render(<DashboardPage onProducts={jest.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard data is invalid. Please refresh the page.');
  });

  it('renders the dashboard overview and recent-products table', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
      statistics: { total: 3, active: 1, expiringSoon: 1, expired: 1 },
      nearestExpiration: [],
      recentlyAdded: [{ id: 1, name: 'Laptop', category: 'Laptops', storeName: 'Store', purchaseDate: '2026-01-01', expirationDate: '2027-01-01', warrantyStatus: 'Active' }],
    }) });

    render(<DashboardPage onProducts={jest.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Warranty Overview' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Recently Added' })).toBeInTheDocument();
  });

  it('opens Add Product and requests complete serial-number search results from the dashboard API', async () => {
    const onProducts = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ statistics: {}, nearestExpiration: [], recentlyAdded: [], searchResults: [{ id: 1, name: 'Laptop', category: 'Laptops', storeName: 'Tech World', serialNumber: 'SN-A1B2C3D4E5', warrantyStatus: 'Active' }] }) });
    render(<DashboardPage onProducts={onProducts} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Product' }));
    expect(onProducts).toHaveBeenCalledWith('', { openAdd: true });
    fireEvent.change(screen.getByRole('textbox', { name: 'Search products...' }), { target: { value: 'SN-A1B2C3D4E5' } });
    expect(await screen.findByText('Laptop')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenLastCalledWith('/api/dashboard?search=SN-A1B2C3D4E5', expect.objectContaining({ credentials: 'include', signal: expect.any(AbortSignal) }));
  });

  it('keeps the latest search result when earlier requests finish later and restores normal content for blank search', async () => {
    const base = { statistics: {}, nearestExpiration: [], recentlyAdded: [{ id: 2, name: 'Normal content', warrantyStatus: 'Active' }], searchResults: [] };
    let resolveOld; let resolveLatest;
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => base })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLatest = resolve; }))
      .mockResolvedValue({ ok: true, json: async () => base });
    render(<DashboardPage />);
    const search = await screen.findByRole('textbox', { name: 'Search products...' });
    fireEvent.change(search, { target: { value: 'S' } });
    fireEvent.change(search, { target: { value: 'SYX0EXWNF' } });
    await waitFor(() => expect(resolveLatest).toBeDefined());
    resolveLatest({ ok: true, json: async () => ({ ...base, searchResults: [{ id: 13, name: 'Serial product', serialNumber: 'SYX0EXWNF', warrantyStatus: 'Active' }] }) });
    expect(await screen.findByText('Serial product')).toBeInTheDocument();
    resolveOld({ ok: true, json: async () => ({ ...base, searchResults: [] }) });
    await Promise.resolve();
    expect(screen.getByText('Serial product')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: '   ' } });
    expect(await screen.findByText('Normal content')).toBeInTheDocument();
  });
});
