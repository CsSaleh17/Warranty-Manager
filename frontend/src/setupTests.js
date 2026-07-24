import '@testing-library/jest-dom';
import i18n from './i18n.js';

beforeEach(() => {
  i18n.changeLanguage('en');
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Authentication is required.' }),
  });
});
