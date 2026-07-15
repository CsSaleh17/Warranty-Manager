import '@testing-library/jest-dom';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Authentication is required.' }),
  });
});
