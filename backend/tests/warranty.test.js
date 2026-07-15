const { calculateWarranty, getWarrantyStatus } = require('../src/services/warranty');

describe('warranty calculations', () => {
  const today = new Date(Date.UTC(2026, 6, 15));

  it('calculates the supplied Samsung product warranty on the backend', () => {
    expect(calculateWarranty('2026-07-01', 2, 'years', today)).toEqual({
      expirationDate: '2028-07-01',
      remainingWarrantyDays: 717,
      warrantyStatus: 'Active',
    });
  });

  it('assigns Active, Expiring Soon, and Expired status from remaining days', () => {
    expect(getWarrantyStatus('2026-08-15', today)).toEqual({ remainingWarrantyDays: 31, warrantyStatus: 'Active' });
    expect(getWarrantyStatus('2026-08-14', today)).toEqual({ remainingWarrantyDays: 30, warrantyStatus: 'Expiring Soon' });
    expect(getWarrantyStatus('2026-07-14', today)).toEqual({ remainingWarrantyDays: -1, warrantyStatus: 'Expired' });
  });

  it('treats today and 30 days as expiring soon, but 31 days as active', () => {
    expect(getWarrantyStatus('2026-07-15', today)).toEqual({ remainingWarrantyDays: 0, warrantyStatus: 'Expiring Soon' });
    expect(getWarrantyStatus('2026-08-14', today)).toEqual({ remainingWarrantyDays: 30, warrantyStatus: 'Expiring Soon' });
    expect(getWarrantyStatus('2026-08-15', today)).toEqual({ remainingWarrantyDays: 31, warrantyStatus: 'Active' });
  });

  it('calculates leap-year and end-of-month expiration dates correctly', () => {
    expect(calculateWarranty('2024-02-29', 1, 'years', new Date(Date.UTC(2024, 1, 29)))).toEqual({
      expirationDate: '2025-03-01', remainingWarrantyDays: 366, warrantyStatus: 'Active',
    });
    expect(calculateWarranty('2026-01-31', 1, 'months', new Date(Date.UTC(2026, 0, 31)))).toEqual({
      expirationDate: '2026-03-03', remainingWarrantyDays: 31, warrantyStatus: 'Active',
    });
  });
});
