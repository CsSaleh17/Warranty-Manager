const { createEmailService, EmailDeliveryError } = require('../src/services/emailService');

const httpsConfig = {
  email: {
    provider: 'https_api', from: 'Warranty <no-reply@example.test>',
    httpsApiUrl: 'https://api.resend.com/emails', httpsApiKey: 'test-api-key',
    httpsTimeoutMs: 25, httpsMaxRetries: 1,
  },
  smtp: {},
};

const message = { to: 'recipient@example.test', subject: 'Warranty reminder', text: 'Your warranty expires soon.', idempotencyKey: 'reminder-5' };

describe('email delivery service', () => {
  it('accepts an HTTPS API response only when the provider returns an id', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'email-123' }) });
    const service = createEmailService({ config: httpsConfig, fetch });
    await expect(service.send(message)).resolves.toEqual({ provider: 'https_api', id: 'email-123' });
    expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }));
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-api-key');
    expect(fetch.mock.calls[0][1].headers['Idempotency-Key']).toBe('reminder-5');
  });

  it('does not accept a provider rejection as delivered', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ message: 'invalid recipient' }) });
    const service = createEmailService({ config: httpsConfig, fetch });
    await expect(service.send(message)).rejects.toMatchObject({ code: 'provider_rejected', retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a timeout once and reports a retryable failure without leaking the API key', async () => {
    const fetch = jest.fn().mockImplementation((_url, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const service = createEmailService({ config: httpsConfig, fetch, sleep: jest.fn().mockResolvedValue() });
    await expect(service.send(message)).rejects.toMatchObject({ code: 'timeout', retryable: true });
    await expect(service.send(message)).rejects.not.toThrow('test-api-key');
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('retries a network failure once and leaves it retryable', async () => {
    const fetch = jest.fn().mockRejectedValue(new Error('socket failure'));
    const service = createEmailService({ config: httpsConfig, fetch, sleep: jest.fn().mockResolvedValue() });
    await expect(service.send(message)).rejects.toMatchObject({ code: 'network_failure', retryable: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid provider configuration and recipient addresses before sending', async () => {
    const fetch = jest.fn();
    expect(() => createEmailService({ config: { ...httpsConfig, email: { ...httpsConfig.email, httpsApiUrl: 'http://not-tls.example' } }, fetch })).toThrow('HTTPS');
    const service = createEmailService({ config: httpsConfig, fetch });
    await expect(service.send({ ...message, to: 'not-an-email' })).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps SMTP available through the same interface', async () => {
    const sendMail = jest.fn().mockResolvedValue({ accepted: ['recipient@example.test'], messageId: 'smtp-123' });
    const nodemailer = { createTransport: jest.fn(() => ({ sendMail })) };
    const service = createEmailService({ config: { email: { provider: 'smtp', from: 'Warranty <no-reply@example.test>' }, smtp: { host: 'smtp.example.test', port: 587, secure: false, requireTls: true, user: '', password: '' } }, nodemailer });
    await expect(service.send(message)).resolves.toEqual({ provider: 'smtp', id: 'smtp-123' });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: message.to, subject: message.subject, text: message.text }));
  });
});
