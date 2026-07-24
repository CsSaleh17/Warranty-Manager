import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from './i18n.js';
import ProfilePage from './ProfilePage.jsx';

const profileResponse = { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ success: true, data: { fullName: 'Saleh', email: 'saleh@example.com', createdAt: '2026-01-01' } }) };

async function fillPasswordForm() {
  const arabic = i18n.language === 'ar';
  fireEvent.change(await screen.findByLabelText(arabic ? 'كلمة المرور الحالية' : 'Current password'), { target: { value: 'WrongPass1!' } });
  fireEvent.change(screen.getByLabelText(arabic ? 'كلمة المرور الجديدة' : 'New password'), { target: { value: 'NewSecure1!' } });
  fireEvent.change(screen.getByLabelText(arabic ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'), { target: { value: 'NewSecure1!' } });
  fireEvent.click(screen.getByRole('button', { name: /Change password|تغيير كلمة المرور/ }));
}

describe('Profile password feedback', () => {
  beforeEach(() => i18n.changeLanguage('en'));

  it('shows the localized wrong-current-password error from structured JSON', async () => {
    await i18n.changeLanguage('ar');
    global.fetch = jest.fn().mockResolvedValueOnce(profileResponse).mockResolvedValueOnce({ ok: false, status: 400, headers: { get: () => 'application/json' }, json: async () => ({ errors: { currentPassword: 'Current password is incorrect.' } }) });
    render(<ProfilePage onUserUpdated={jest.fn()} onSessionExpired={jest.fn()} />);
    await fillPasswordForm();
    expect(await screen.findByRole('alert')).toHaveTextContent('كلمة المرور الحالية غير صحيحة.');
  });

  it('never exposes an HTML/JSON parser error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(profileResponse).mockResolvedValueOnce({ ok: false, status: 404, headers: { get: () => 'text/html' }, json: async () => { throw new SyntaxError("Unexpected token '<'"); } });
    render(<ProfilePage onUserUpdated={jest.fn()} onSessionExpired={jest.fn()} />);
    await fillPasswordForm();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unable to change password. Please try again.'));
    expect(screen.queryByText(/Unexpected token|DOCTYPE/i)).not.toBeInTheDocument();
  });

  it('relocalizes a visible password error when the language changes', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(profileResponse).mockResolvedValueOnce({ ok: false, status: 400, headers: { get: () => 'application/json' }, json: async () => ({ errors: { currentPassword: 'Current password is incorrect.' } }) });
    render(<ProfilePage onUserUpdated={jest.fn()} onSessionExpired={jest.fn()} />);
    await fillPasswordForm();
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('profile.currentPasswordIncorrect'));
    await i18n.changeLanguage('ar');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('profile.currentPasswordIncorrect')));
  });

  it.each([['en', 'profile.completePasswords'], ['ar', 'profile.completePasswords'], ['en', 'profile.passwordMismatch'], ['ar', 'profile.passwordMismatch']])('localizes client password validation for %s', async (language, expectedKey) => {
    await i18n.changeLanguage(language);
    global.fetch = jest.fn().mockResolvedValueOnce(profileResponse);
    render(<ProfilePage onUserUpdated={jest.fn()} onSessionExpired={jest.fn()} />);
    const submit = await screen.findByRole('button', { name: i18n.t('profile.changePassword') });
    if (expectedKey.endsWith('passwordMismatch')) {
      fireEvent.change(screen.getByLabelText(i18n.t('profile.currentPassword')), { target: { value: 'Current1!' } });
      fireEvent.change(screen.getByLabelText(i18n.t('profile.newPassword')), { target: { value: 'NewSecure1!' } });
      fireEvent.change(screen.getByLabelText(i18n.t('profile.confirmPassword')), { target: { value: 'Different1!' } });
    }
    fireEvent.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t(expectedKey));
  });
});
