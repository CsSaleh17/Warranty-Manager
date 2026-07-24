const { cleanStoreName, normalizeCategory } = require('../src/services/categories');

describe('legacy product normalization', () => {
  it.each([
    ['Name: Tech World Electronics', 'Tech World Electronics'],
    ['Store: Jarir Bookstore', 'Jarir Bookstore'],
    ['Store Name: Extra', 'Extra'],
    ['The Name Shop', 'The Name Shop'],
    ['Name Electronics', 'Name Electronics'],
  ])('cleans only a known OCR prefix in %s', (input, expected) => expect(cleanStoreName(input)).toBe(expected));

  it.each([['Smartphone', 'Smartphones'], ['Laptop', 'Laptops'], ['Tablet', 'Tablets']])('normalizes %s to %s', (input, expected) => expect(normalizeCategory(input)).toBe(expected));
});
