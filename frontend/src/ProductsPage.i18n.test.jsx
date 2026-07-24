import { fireEvent, render, screen } from '@testing-library/react';
import i18n from './i18n.js';
import ProductsPage from './ProductsPage.jsx';

describe('ProductsPage Arabic localization', () => {
  beforeEach(() => {
    i18n.changeLanguage('ar');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [], pagination: { totalItems: 0 }, availableFilters: { stores: [], categories: [] } }) });
  });

  it('renders Arabic product, filter, and custom invoice-picker controls', async () => {
    render(<ProductsPage />);
    await screen.findByText('لم تضف أي منتجات بعد.');
    fireEvent.click(screen.getByRole('button', { name: 'إضافة منتج' }));

    expect(screen.getByText('مسح الفاتورة أو إرفاقها (اختياري)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'اختيار ملف الفاتورة' })).toBeInTheDocument();
    expect(screen.getByText('لم يتم اختيار ملف')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
    fireEvent.click(screen.getByRole('button', { name: 'عوامل التصفية' }));
    expect(screen.getByRole('heading', { name: 'تصفية المنتجات' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'الحالة' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'مسح عوامل التصفية' })).toBeInTheDocument();
  });

  it('translates known category and warranty-status values on product cards', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [{ id: 1, name: 'Phone', category: 'Laptops', storeName: 'Store', warrantyStatus: 'Active', remainingWarrantyDays: 6, expirationDate: '2026-07-23', reminderEnabled: false, hasInvoice: false }], pagination: { totalItems: 1 }, availableFilters: { stores: [], categories: [] } }) });
    render(<ProductsPage />);

    expect(await screen.findByText('أجهزة لابتوب · Store')).toBeInTheDocument();
    expect(screen.getByText('ساري')).toBeInTheDocument();
  });
});
