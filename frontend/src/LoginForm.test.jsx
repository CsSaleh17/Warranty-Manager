import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

describe('LoginForm', () => {
  it('submits login credentials and shows the logged-in user', async () => {
    global.fetch = jest.fn().mockImplementation((url) => Promise.resolve(url === '/api/me'
      ? { ok: false, json: async () => ({ error: 'Authentication is required.' }) }
      : url === '/api/dashboard'
        ? { ok: true, json: async () => ({ statistics: { total: 1, active: 1, expiringSoon: 0, expired: 0 }, recentlyAdded: [], nearestExpiration: [] }) }
        : {
          ok: true,
          json: async () => ({
            message: 'Login successful.',
            user: { id: 7, fullName: 'Ava Smith', email: 'ava@example.com' },
          }),
        }));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ava@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'SecurePass1!' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Log in' }).find((button) => button.type === 'submit'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ava@example.com', password: 'SecurePass1!' }),
      });
    });

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Total Products')).toBeInTheDocument();
  });

  it('shows the API login error without exposing which credential failed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Email or password is incorrect.' }),
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Log in' }).find((button) => button.type === 'submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });
});
