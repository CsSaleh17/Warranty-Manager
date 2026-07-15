import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

describe('RegistrationForm', () => {
  it('shows fields for full name, email, and password', () => {
    render(<App />);

    expect(screen.getByRole('textbox', { name: 'Full name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email address' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('submits registration data and shows the success message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Registration successful.' }),
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ava Smith' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ava@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'SecurePass1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Ava Smith', email: 'ava@example.com', password: 'SecurePass1!' }),
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Registration successful.');
    expect(screen.getByLabelText('Full name')).toHaveValue('');
    expect(screen.getByLabelText('Email address')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('shows API validation errors to the user', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ errors: { email: 'Enter a valid email address.' } }),
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
  });
});
