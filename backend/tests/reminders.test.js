jest.mock('../src/config/database', () => ({ execute: jest.fn() }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const database = require('../src/config/database');
const nodemailer = require('nodemailer');
const { runDueReminders } = require('../src/services/reminders');

describe('warranty reminders', () => {
  beforeEach(() => { jest.resetAllMocks(); process.env.SMTP_FROM = 'reminders@example.com'; process.env.FRONTEND_URL = 'http://localhost:5173'; });

  it('sends a due reminder to the owner and marks it sent only after delivery', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'sent' });
    nodemailer.createTransport.mockReturnValue({ sendMail });
    database.execute
      .mockResolvedValueOnce([[{ id: 5, name: 'Laptop', store_name: 'Tech Store', category: 'Electronics', serial_number: 'A-1', expiration_date: '2026-08-01', reminder_days_before: 7, email: 'owner@example.com' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await expect(runDueReminders()).resolves.toEqual({ processed: 1, sent: 1 });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'reminders@example.com', to: 'owner@example.com', text: expect.stringContaining('http://localhost:5173/products/5') }));
    expect(sendMail.mock.calls[0][0].to).not.toBe(process.env.SMTP_USER);
    expect(database.execute.mock.calls[2][0]).toContain('is_reminded = 1');
  });

  it('releases a claim after delivery failure and continues with other reminders', async () => {
    const sendMail = jest.fn().mockRejectedValueOnce(new Error('SMTP down')).mockResolvedValueOnce({ messageId: 'sent' });
    nodemailer.createTransport.mockReturnValue({ sendMail });
    database.execute
      .mockResolvedValueOnce([[{ id: 1, name: 'One', expiration_date: '2026-08-01', reminder_days_before: 7, email: 'one@example.com' }, { id: 2, name: 'Two', expiration_date: '2026-08-01', reminder_days_before: 7, email: 'two@example.com' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([{ affectedRows: 1 }]);

    await expect(runDueReminders()).resolves.toEqual({ processed: 2, sent: 1 });
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(database.execute.mock.calls[2][0]).toContain('reminder_claim_token = NULL');
  });

  it('does not send when another runner has already claimed a reminder', async () => {
    const sendMail = jest.fn();
    nodemailer.createTransport.mockReturnValue({ sendMail });
    database.execute.mockResolvedValueOnce([[{ id: 1, name: 'One', expiration_date: '2026-08-01', reminder_days_before: 7, email: 'one@example.com' }]]).mockResolvedValueOnce([{ affectedRows: 0 }]);
    await expect(runDueReminders()).resolves.toEqual({ processed: 1, sent: 0 });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
