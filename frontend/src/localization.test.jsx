import { formatDisplayDateTime, formatWarrantyDuration } from './localization.js';

describe('localized product presentation', () => {
  it.each(['days', 'months', 'years'])('uses Arabic-aware warranty grammar for %s', (unit) => {
    const expected = {
      days: ['يوم واحد', 'يومان', '٣ أيام', '١٠ أيام', '١١ يوماً', '٢٤ يوماً', '١٠٠ يوم'],
      months: ['شهر واحد', 'شهران', '٣ أشهر', '١٠ أشهر', '١١ شهراً', '٢٤ شهراً', '١٠٠ شهر'],
      years: ['سنة واحدة', 'سنتان', '٣ سنوات', '١٠ سنوات', '١١ سنة', '٢٤ سنة', '١٠٠ سنة'],
    }[unit];
    [1, 2, 3, 10, 11, 24, 100].forEach((value, index) => expect(formatWarrantyDuration(value, unit, 'ar')).toBe(expected[index]));
  });

  it('uses English pluralization and locale-aware reminder timestamps', () => {
    expect(formatWarrantyDuration(1, 'days', 'en')).toBe('1 day');
    expect(formatWarrantyDuration(2, 'years', 'en')).toBe('2 years');
    expect(formatDisplayDateTime('2026-07-18 14:00:02', 'ar')).toMatch(/[٠-٩]/);
    expect(formatDisplayDateTime('2026-07-18 14:00:02', 'en')).toMatch(/2026/);
    expect(formatDisplayDateTime(null, 'ar')).toBe('');
    expect(formatDisplayDateTime('invalid', 'ar')).toBe('invalid');
  });
});
