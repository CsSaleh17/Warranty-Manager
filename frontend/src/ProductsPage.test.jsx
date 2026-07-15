import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductsPage from './ProductsPage.jsx';

describe('ProductsPage', () => {
  it('shows an empty state and opens the add-product form', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });

    render(<ProductsPage />);

    expect(await screen.findByText('No products yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(screen.getByRole('heading', { name: 'Add product' })).toBeInTheDocument();
    expect(screen.getByLabelText('Product name')).toBeInTheDocument();
  });

  it('validates required fields before sending a product request', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });

    render(<ProductsPage />);

    await screen.findByText('No products yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));

    expect(await screen.findByText('Product name is required.')).toBeInTheDocument();
    expect(screen.getByText('Category is required.')).toBeInTheDocument();
    expect(screen.getByText('Store name is required.')).toBeInTheDocument();
    expect(screen.getByText('Purchase date is required.')).toBeInTheDocument();
    expect(screen.getByText('Warranty duration must be a positive whole number.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a future purchase date before sending a product request', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) });

    render(<ProductsPage />);

    await screen.findByText('No products yet.');
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
});
