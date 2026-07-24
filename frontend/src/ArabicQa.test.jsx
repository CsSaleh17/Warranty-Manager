import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from './i18n.js';
import DashboardPage from './DashboardPage.jsx';
import ProductsPage from './ProductsPage.jsx';
import ProfilePage from './ProfilePage.jsx';
import App from './App.jsx';
import ProductDetailsPage from './ProductDetailsPage.jsx';

const dashboardData = {
  statistics: { total: 2, active: 1, expiringSoon: 0, expired: 1 },
  nearestExpiration: [{ id: 1, name: 'Laptop X', category: 'Laptops', storeName: 'متجر التقنية', serialNumber: 'SN-1', purchaseDate: '2026-07-01', expirationDate: '2026-07-23', warrantyStatus: 'Expiring Soon', remainingWarrantyDays: 5 }],
  recentlyAdded: [{ id: 2, name: 'Camera', category: 'Cameras', storeName: 'Photo Store', serialNumber: 'CAM-9', purchaseDate: '2025-01-01', expirationDate: '2026-06-01', warrantyStatus: 'Expired', remainingWarrantyDays: -38 }],
};

describe('Arabic exploratory QA regressions', () => {
  beforeEach(() => { i18n.changeLanguage('ar'); window.history.replaceState({}, '', '/'); });

  it('localizes dashboard-owned text, dates, numbers, punctuation, and search results', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => dashboardData });
    render(<DashboardPage onProducts={jest.fn()} user={{ fullName: 'Saleh' }} />);
    expect(await screen.findByText(/(?:صباح|مساء) الخير،/)).toBeInTheDocument();
    expect(screen.getByText('هذا العام')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'المنتج' })).toBeInTheDocument();
    expect(screen.queryByText('2025-01-01')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'ابحث عن المنتجات...' }), { target: { value: 'غير موجود' } });
    expect(screen.getByRole('status')).toHaveTextContent('لا توجد منتجات تطابق بحثك.');
    expect(screen.queryByText('Laptop X')).not.toBeInTheDocument();
  });

  it('uses Arabic product validation and expired wording while preserving invalid input', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [{ id: 2, name: 'Camera', category: 'Cameras', storeName: 'Store', warrantyStatus: 'Expired', remainingWarrantyDays: -38, expirationDate: '2026-06-01', reminderEnabled: false, hasInvoice: false }], pagination: { totalItems: 1 }, availableFilters: { stores: [], categories: [] } }) });
    render(<ProductsPage />);
    expect(await screen.findByText('منتهي منذ ٣٨ يوماً')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إضافة منتج' }));
    fireEvent.change(screen.getByLabelText('تاريخ الشراء'), { target: { value: '2099-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ المنتج' }));
    expect(screen.getByText('اسم المنتج مطلوب.')).toBeInTheDocument();
    expect(screen.getByText('لا يمكن أن يكون تاريخ الشراء في المستقبل.')).toBeInTheDocument();
    expect(screen.getByLabelText('تاريخ الشراء')).toHaveValue('2099-01-01');
    expect(screen.queryByText('Email reminder')).not.toBeInTheDocument();
  });

  it('localizes filter navigation and delete confirmation', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [{ id: 2, name: 'Camera', category: 'Cameras', storeName: 'Store', warrantyStatus: 'Active', remainingWarrantyDays: 40, expirationDate: '2027-06-01', reminderEnabled: false, hasInvoice: false }], pagination: { totalItems: 1 }, availableFilters: { stores: [], categories: [] } }) });
    render(<ProductsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'عوامل التصفية' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'الحالة' }));
    expect(screen.getByRole('button', { name: /رجوع/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('هل تريد حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.');
    expect(screen.getByRole('dialog')).toHaveTextContent('Camera');
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('validates and localizes profile updates without false success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ success: true, data: { fullName: 'Saleh', email: 'saleh@example.com', createdAt: '2026-01-01T00:00:00.000Z' } }) });
    render(<ProfilePage onUserUpdated={jest.fn()} onSessionExpired={jest.fn()} />);
    fireEvent.change(await screen.findByLabelText('الاسم الكامل'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ الاسم' }));
    expect(screen.getByRole('alert')).toHaveTextContent('الاسم الكامل مطلوب.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('تم تحديث الملف الشخصي بنجاح.')).not.toBeInTheDocument();
  });

  it('gives Profile a refreshable route and responds to browser navigation', async () => {
    window.history.replaceState({}, '', '/profile');
    global.fetch = jest.fn((url) => {
      if (url === '/api/me') return Promise.resolve({ ok: true, json: async () => ({ user: { id: 1, fullName: 'Saleh', email: 'saleh@example.com' } }) });
      if (url === '/api/profile') return Promise.resolve({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ success: true, data: { fullName: 'Saleh', email: 'saleh@example.com', createdAt: '2026-01-01T00:00:00.000Z' } }) });
      return Promise.resolve({ ok: true, json: async () => dashboardData });
    });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'الملف الشخصي' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/profile');
    act(() => { window.history.pushState({}, '', '/dashboard'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await waitFor(() => expect(screen.getByText('نظرة عامة على الضمانات')).toBeInTheDocument());
  });

  it('localizes product details without altering user-entered values', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ product: { id: 3, name: 'Laptop Pro X', category: 'Laptops', storeName: 'Tech Store', purchaseDate: '2026-01-01', expirationDate: '2027-01-01', serialNumber: 'SN-ABC-9', warrantyDuration: 1, warrantyUnit: 'years', warrantyStatus: 'Active', remainingWarrantyDays: 100, reminderEnabled: false, notes: '', hasInvoice: false } }) });
    render(<ProductDetailsPage productId={3} onBack={jest.fn()} onEdit={jest.fn()} />);
    expect(await screen.findByRole('heading', { name: 'تفاصيل المنتج' })).toBeInTheDocument();
    expect(screen.getByText('Laptop Pro X')).toBeInTheDocument();
    expect(screen.getByText(/SN-ABC-9/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تعديل المنتج' })).toBeInTheDocument();
    expect(screen.queryByText('Product details')).not.toBeInTheDocument();
  });

  it('uses Arabic grammar and localized reminder timestamps in product details', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ product: { id: 4, name: 'Phone', category: 'Smartphones', storeName: 'Store', purchaseDate: '2026-01-01', expirationDate: '2028-01-01', serialNumber: 'SER-4', warrantyDuration: 24, warrantyUnit: 'months', warrantyStatus: 'Active', remainingWarrantyDays: 100, reminderEnabled: true, reminderDaysBefore: 3, isReminded: true, reminderSentAt: '2026-07-18 14:00:02', notes: '', hasInvoice: false } }) });
    render(<ProductDetailsPage productId={4} onBack={jest.fn()} onEdit={jest.fn()} />);
    expect(await screen.findByText(/٢٤ شهراً/)).toBeInTheDocument();
    expect(screen.getByText(/٣ أيام/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-07-18 14:00:02/)).not.toBeInTheDocument();
    expect(screen.getByText((content, element) => element.tagName === 'P' && element.textContent.includes('تم الإرسال') && element.textContent.includes('٢٠٢٦'))).toBeInTheDocument();
  });
});
