import { fireEvent, render, screen } from '@testing-library/react';
import App from './App.jsx';

describe('application localization', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
  });

  it('switches the application interface to Arabic and enables RTL direction', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'العربية' }));

    expect(await screen.findByRole('heading', { name: 'مدير الضمان' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});
