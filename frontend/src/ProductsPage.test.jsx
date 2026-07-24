import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProductsPage from './ProductsPage.jsx';

describe('ProductsPage', () => {
  it('renders stored XSS payloads as text instead of executable markup', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [{ id: 9, name: payload, category: 'Other', storeName: 'Store', warrantyStatus: 'Active', remainingWarrantyDays: 50, expirationDate: '2027-01-01' }] }) });
    render(<ProductsPage />);
    expect(await screen.findByText(payload)).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('shows an empty state and opens the add-product form', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });

    render(<ProductsPage />);

    expect(await screen.findByText('You have not added any products yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(screen.getByRole('heading', { name: 'Add product' })).toBeInTheDocument();
    expect(screen.getByLabelText('Product name')).toBeInTheDocument();
  });

  it('validates required fields before sending a product request', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });

    render(<ProductsPage />);

    await screen.findByText('You have not added any products yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));

    expect(await screen.findByText('Product name is required.')).toBeInTheDocument();
    expect(screen.getByText('Category is required.')).toBeInTheDocument();
    expect(screen.getByText('Store name is required.')).toBeInTheDocument();
    expect(screen.getByText('Purchase date is required.')).toBeInTheDocument();
    expect(screen.getByText('Warranty duration must be a positive whole number.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps reminders disabled by default and reveals timing only when enabled', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });
    render(<ProductsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    const reminder = screen.getByRole('checkbox', { name: 'Send me an email reminder before the warranty expires' });
    expect(reminder).not.toBeChecked();
    expect(screen.queryByLabelText('Remind me before')).not.toBeInTheDocument();
    fireEvent.click(reminder);
    expect(screen.getByLabelText('Remind me before')).toHaveAttribute('max', '3650');
  });

  it('validates enabled reminder timing before saving', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });
    render(<ProductsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send me an email reminder before the warranty expires' }));
    fireEvent.change(screen.getByLabelText('Remind me before'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByText('Reminder days must be a whole number between 1 and 3650.')).toBeInTheDocument();
    expect(screen.getByText('Add valid warranty information before enabling a reminder.')).toBeInTheDocument();
  });

  it('submits enabled reminder fields in the real add-product form payload', async () => {
    const entries = [];
    const OriginalFormData = global.FormData;
    global.FormData = class { append(key, value) { entries.push([key, String(value)]); } };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Product added successfully.' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [] }) });
    render(<ProductsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Reminder laptop' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Laptops' } });
    fireEvent.change(screen.getByLabelText('Store name'), { target: { value: 'Store' } });
    fireEvent.change(screen.getByLabelText('Purchase date'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Warranty duration'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send me an email reminder before the warranty expires' }));
    fireEvent.change(screen.getByLabelText('Remind me before'), { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => expect(entries).toEqual(expect.arrayContaining([['reminderEnabled', 'true'], ['reminderDaysBefore', '14']])));
    global.FormData = OriginalFormData;
  });

  it('displays compact reminder information on product cards', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [{ id: 21, name: 'Laptop', category: 'Electronics', storeName: 'Store', warrantyStatus: 'Active', remainingWarrantyDays: 50, expirationDate: '2026-12-31', reminderEnabled: true, reminderDaysBefore: 14, isReminded: true, reminderSentAt: '2026-07-16 09:00:00' }] }) });
    render(<ProductsPage />);
    expect(await screen.findByText('Email reminder: Enabled')).toBeInTheDocument();
    expect(screen.getByText('Timing: 14 days before expiration')).toBeInTheDocument();
    expect(screen.getByText((content, element) => element.tagName === 'P' && element.textContent.includes('Status: Sent on') && element.textContent.includes('2026'))).toBeInTheDocument();
    expect(screen.queryByText(/2026-07-16 09:00:00/)).not.toBeInTheDocument();
  });

  it('places focus on the product name and cycles focus in the product dialog', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });
    render(<ProductsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    const dialog = screen.getByRole('dialog', { name: 'Add product' });
    const productName = screen.getByLabelText('Product name');
    await waitFor(() => expect(productName).toHaveFocus());
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByLabelText('Category')).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(productName).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Add product' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add product' })).toHaveFocus());
  });

  it('focuses the product name for edit and Cancel for delete, then restores the opener', async () => {
    const product = { id: 7, name: 'Laptop', category: 'Laptops', storeName: 'Store', purchaseDate: '2026-01-01', warrantyDuration: 12, warrantyUnit: 'months', warrantyStatus: 'Active', remainingWarrantyDays: 100, expirationDate: '2027-01-01' };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [product] }) });
    render(<ProductsPage />);
    const edit = await screen.findByRole('button', { name: 'Edit' });
    fireEvent.click(edit);
    await waitFor(() => expect(screen.getByLabelText('Product name')).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus());
    const remove = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(remove);
    const deleteDialog = screen.getByRole('dialog', { name: 'Delete this product? This cannot be undone.' });
    await waitFor(() => expect(within(deleteDialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    fireEvent.keyDown(deleteDialog, { key: 'Tab' });
    expect(within(deleteDialog).getByRole('button', { name: 'Delete' })).toHaveFocus();
    fireEvent.keyDown(deleteDialog, { key: 'Tab', shiftKey: true });
    expect(within(deleteDialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus());
  });

  it('saves a valid native date value through the controlled form', async () => {
    const entries = [];
    const OriginalFormData = global.FormData;
    global.FormData = class { append(key, value) { entries.push([key, String(value)]); } };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ products: [] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Product added successfully.' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ products: [] }) });
    render(<ProductsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Date test' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Laptops' } });
    fireEvent.change(screen.getByLabelText('Store name'), { target: { value: 'Store' } });
    fireEvent.change(screen.getByLabelText('Purchase date'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Warranty duration'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => expect(entries).toEqual(expect.arrayContaining([['purchaseDate', '2026-01-01']])));
    global.FormData = OriginalFormData;
  });

  it('retains an ISO value entered by the native date input event', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });
    render(<ProductsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    const purchaseDate = screen.getByLabelText('Purchase date');
    fireEvent.input(purchaseDate, { target: { value: '2026-07-18' } });
    expect(purchaseDate).toHaveValue('2026-07-18');
  });

  it('preloads and submits an updated native purchase date while editing', async () => {
    const entries = [];
    const OriginalFormData = global.FormData;
    global.FormData = class { append(key, value) { entries.push([key, String(value)]); } };
    const product = { id: 9, name: 'Date laptop', category: 'Laptops', storeName: 'Store', purchaseDate: '2026-07-18', warrantyDuration: 12, warrantyUnit: 'months', warrantyStatus: 'Active', remainingWarrantyDays: 100, expirationDate: '2027-07-18' };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ products: [product] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Product updated successfully.' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ products: [{ ...product, purchaseDate: '2026-07-17' }] }) });
    render(<ProductsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const purchaseDate = screen.getByLabelText('Purchase date');
    expect(purchaseDate).toHaveValue('2026-07-18');
    fireEvent.input(purchaseDate, { target: { value: '2026-07-17' } });
    expect(purchaseDate).toHaveValue('2026-07-17');
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => expect(entries).toEqual(expect.arrayContaining([['purchaseDate', '2026-07-17']])));
    global.FormData = OriginalFormData;
  });

  it('rejects a future purchase date before sending a product request', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });

    render(<ProductsPage />);

    await screen.findByText('You have not added any products yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Samsung Galaxy S24' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Smartphone' } });
    fireEvent.change(screen.getByLabelText('Store name'), { target: { value: 'Jarir Bookstore' } });
    fireEvent.change(screen.getByLabelText('Purchase date'), { target: { value: '2099-01-01' } });
    fireEvent.change(screen.getByLabelText('Warranty duration'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));

    expect(await screen.findByText('Purchase date must be valid and cannot be in the future.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('downloads an invoice through a credentialed Blob request', async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectURL = jest.fn(() => 'blob:invoice');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [{
        id: 21, name: 'Laptop', category: 'Electronics', storeName: 'Store', warrantyStatus: 'Active',
        remainingWarrantyDays: 50, expirationDate: '2026-12-31', hasInvoice: true,
        invoiceFileName: 'receipt.pdf', invoiceMimeType: 'application/pdf',
        invoiceViewUrl: '/api/products/21/invoice/view', invoiceDownloadUrl: '/api/products/21/invoice/download',
      }] }) })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'attachment; filename="receipt.pdf"' },
        blob: async () => new Blob(['PDF bytes'], { type: 'application/pdf' }),
      });

    render(<ProductsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Download Invoice' }));

    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/api/products/21/invoice/download', {
      method: 'GET', credentials: 'include',
    }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:invoice'));
    click.mockRestore();
  });

  it('keeps image invoice cards compact until the invoice is viewed', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [{
      id: 22, name: 'Camera', category: 'Electronics', storeName: 'Store', warrantyStatus: 'Active',
      remainingWarrantyDays: 50, expirationDate: '2026-12-31', hasInvoice: true,
      invoiceFileName: 'receipt.jpg', invoiceMimeType: 'image/jpeg',
      invoiceViewUrl: '/api/products/22/invoice/view', invoiceDownloadUrl: '/api/products/22/invoice/download',
    }] }) });

    render(<ProductsPage />);

    expect(await screen.findByText('receipt.jpg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Invoice' })).toHaveAttribute('href', '/api/products/22/invoice/view');
    expect(screen.queryByAltText('Camera invoice')).not.toBeInTheDocument();
  });

  it('opens one filter category at a time and requests the selected status', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [], pagination: { page: 1, limit: 12, totalItems: 0, totalPages: 0 }, availableFilters: { stores: ['Jarir'], categories: ['Smartphones'] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [], pagination: { page: 1, limit: 12, totalItems: 0, totalPages: 0 }, availableFilters: { stores: ['Jarir'], categories: ['Smartphones'] } }) });
    render(<ProductsPage />);
    await screen.findByText('You have not added any products yet.');
    expect(screen.queryByPlaceholderText('Search products, stores, serial numbers, or categories...')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Status' }));
    expect(screen.getByRole('button', { name: '← Back' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Store' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Active' }));
    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/api/products?status=Active', expect.any(Object)));
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
  });

  it('clears filters without resetting the selected sort', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [], pagination: { page: 1, limit: 12, totalItems: 0, totalPages: 0 }, availableFilters: { stores: [], categories: [] } }) });
    window.history.replaceState({}, '', '/products?status=Active&sort=name_asc');
    render(<ProductsPage />);
    await screen.findByText('No products match your current filters.');
    fireEvent.click(screen.getByRole('button', { name: 'Filters (1)' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear filters' }));
    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/api/products?sort=name_asc', expect.any(Object)));
    expect(screen.getByLabelText('Sort')).toHaveValue('name_asc');
  });

  it('closes the filter menu with Escape and restores focus to Filters', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });
    render(<ProductsPage />);
    const filtersButton = await screen.findByRole('button', { name: 'Filters' });
    fireEvent.click(filtersButton);
    expect(screen.getByRole('menu', { name: 'Filter products' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Filter products' })).not.toBeInTheDocument());
    expect(filtersButton).toHaveFocus();
  });

  it('restores the full list and matching count after clearing a dashboard status filter', async () => {
    const activeProduct = { id: 1, name: 'Active phone', category: 'Smartphones', storeName: 'Store', warrantyStatus: 'Active', remainingWarrantyDays: 60, expirationDate: '2026-12-31' };
    const expiringProduct = { id: 2, name: 'Expiring tablet', category: 'Tablets', storeName: 'Store', warrantyStatus: 'Expiring Soon', remainingWarrantyDays: 10, expirationDate: '2026-08-01' };
    const expiredProduct = { id: 3, name: 'Expired camera', category: 'Cameras', storeName: 'Store', warrantyStatus: 'Expired', remainingWarrantyDays: -2, expirationDate: '2026-07-01' };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [activeProduct], pagination: { page: 1, limit: 12, totalItems: 1, totalPages: 1 }, availableFilters: { stores: ['Store'], categories: ['Smartphones', 'Tablets', 'Cameras'] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [activeProduct, expiringProduct, expiredProduct], pagination: { page: 1, limit: 12, totalItems: 3, totalPages: 1 }, availableFilters: { stores: ['Store'], categories: ['Smartphones', 'Tablets', 'Cameras'] } }) });
    window.history.replaceState({}, '', '/products?status=Active&page=2');

    render(<ProductsPage statusFilter="Active" />);

    expect(await screen.findByText('Active phone')).toBeInTheDocument();
    expect(screen.queryByText('Expiring tablet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters (1)' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear filters' }));

    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/api/products', expect.any(Object)));
    expect(await screen.findByText('3 matching products')).toBeInTheDocument();
    expect(screen.getByText('Active phone')).toBeInTheDocument();
    expect(screen.getByText('Expiring tablet')).toBeInTheDocument();
    expect(screen.getByText('Expired camera')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('synchronizes filters when browser navigation changes the URL', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [], pagination: { page: 1, limit: 12, totalItems: 0, totalPages: 0 }, availableFilters: { stores: [], categories: [] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [], pagination: { page: 1, limit: 12, totalItems: 0, totalPages: 0 }, availableFilters: { stores: [], categories: [] } }) });
    window.history.replaceState({}, '', '/products?status=Active');
    render(<ProductsPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/api/products?status=Active', expect.any(Object)));

    window.history.pushState({}, '', '/products?status=Expired');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/api/products?status=Expired', expect.any(Object)));
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
  });
});
