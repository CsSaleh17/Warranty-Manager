import { fireEvent, render, screen } from '@testing-library/react';
import i18n from './i18n.js';
import { ForgotPasswordPage, ResetPasswordPage } from './PasswordResetPage.jsx';

describe('Arabic password validation', () => {
  beforeEach(() => { i18n.changeLanguage('ar'); global.fetch = jest.fn(); });
  it('uses application validation rather than native email validation', () => { render(<ForgotPasswordPage onLogin={() => {}} />); const form = screen.getByRole('button', { name: 'إرسال رابط إعادة التعيين' }).closest('form'); expect(form).toHaveAttribute('novalidate'); fireEvent.click(screen.getByRole('button', { name: 'إرسال رابط إعادة التعيين' })); expect(screen.getByRole('alert')).toHaveTextContent('البريد الإلكتروني مطلوب.'); });
  it('shows Arabic reset-password validation', () => { window.history.replaceState({}, '', '/reset-password?token=test'); render(<ResetPasswordPage onLogin={() => {}} />); fireEvent.click(screen.getByRole('button', { name: 'إعادة تعيين كلمة المرور' })); expect(screen.getByRole('alert')).toHaveTextContent('كلمة المرور مطلوبة.'); });
});
