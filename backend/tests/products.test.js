jest.mock('../src/config/database', () => ({
  execute: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const database = require('../src/config/database');
const auditLogger = require('../src/services/auditLogger');
const app = require('../src/app');
const frontendOrigin = 'http://localhost:5173';

const productInput = {
  name: 'Laptop Pro',
  category: 'Electronics',
  storeName: 'Tech Store',
  purchaseDate: '2026-01-15',
  warrantyDuration: 2,
  warrantyUnit: 'months',
  serialNumber: 'SER-123',
  notes: 'Office laptop',
};

const invoiceDirectory = path.resolve(__dirname, '../uploads/invoices');
const testInvoiceFiles = ['owner-invoice.jpg', 'owner-invoice.png', 'owner-invoice.pdf'];

async function authenticatedAgent() {
  const agent = request.agent(app);
  database.execute.mockResolvedValueOnce([[
    { id: 7, full_name: 'Ava Smith', email: 'ava@example.com', password_hash: 'hashed-password' },
  ]]);
  bcrypt.compare.mockResolvedValueOnce(true);
  const response = await agent.post('/api/login').set('Origin', frontendOrigin).send({ email: 'ava@example.com', password: 'SecurePass1!' });
  expect(response.status).toBe(200);
  return agent;
}

describe('product management endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(auditLogger, 'productMutation').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    testInvoiceFiles.forEach((fileName) => fs.rmSync(path.join(invoiceDirectory, fileName), { force: true }));
  });

  it('requires authentication to access products', async () => {
    const response = await request(app).get('/api/products');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication is required.' });
  });

  it('validates required product fields for an authenticated user', async () => {
    const agent = await authenticatedAgent();
    const response = await agent.post('/api/products').set('Origin', frontendOrigin).send({});

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(expect.objectContaining({
      name: 'Product name is required.',
      category: 'Category is required.',
      storeName: 'Store name is required.',
      purchaseDate: 'Purchase date is required.',
      warrantyDuration: 'Warranty duration must be a positive whole number.',
      warrantyUnit: 'Warranty unit must be days, months, or years.',
    }));
  });

  it('rejects an invoice whose bytes do not match its claimed image type', async () => {
    const agent = await authenticatedAgent();
    fs.mkdirSync(invoiceDirectory, { recursive: true });
    const before = new Set(fs.readdirSync(invoiceDirectory));
    const response = await agent.post('/api/products').set('Origin', frontendOrigin)
      .field('name', productInput.name).field('category', productInput.category)
      .field('storeName', productInput.storeName).field('purchaseDate', productInput.purchaseDate)
      .field('warrantyDuration', String(productInput.warrantyDuration)).field('warrantyUnit', productInput.warrantyUnit)
      .field('invoiceAction', 'save')
      .attach('invoice', Buffer.from('<script>alert(1)</script>'), { filename: 'invoice.jpg', contentType: 'image/jpeg' });
    const created = fs.readdirSync(invoiceDirectory).filter((name) => !before.has(name));
    created.forEach((name) => fs.rmSync(path.join(invoiceDirectory, name), { force: true }));
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invoice file content does not match its declared type.' });
    expect(database.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized invoice attachments before persistence', async () => {
    const agent = await authenticatedAgent();
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    oversized.set([0xff, 0xd8, 0xff]);
    const response = await agent.post('/api/products').set('Origin', frontendOrigin)
      .field('name', productInput.name).attach('invoice', oversized, { filename: 'large.jpg', contentType: 'image/jpeg' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invoice attachment must be 10 MB or smaller.');
    expect(database.execute).toHaveBeenCalledTimes(1);
  });

  it('replaces traversal-style upload names with a server-generated filename', async () => {
    const agent = await authenticatedAgent();
    fs.mkdirSync(invoiceDirectory, { recursive: true });
    const before = new Set(fs.readdirSync(invoiceDirectory));
    database.execute.mockResolvedValueOnce([{ insertId: 41 }]);
    const response = await agent.post('/api/products').set('Origin', frontendOrigin)
      .field('name', productInput.name).field('category', productInput.category)
      .field('storeName', productInput.storeName).field('purchaseDate', productInput.purchaseDate)
      .field('warrantyDuration', String(productInput.warrantyDuration)).field('warrantyUnit', productInput.warrantyUnit)
      .field('invoiceAction', 'save')
      .attach('invoice', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { filename: '../../invoice.jpg', contentType: 'image/jpeg' });
    const created = fs.readdirSync(invoiceDirectory).filter((name) => !before.has(name));
    const insertCall = database.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO products'));
    created.forEach((name) => fs.rmSync(path.join(invoiceDirectory, name), { force: true }));
    expect(response.status).toBe(201);
    expect(insertCall[1][10]).toMatch(/^[0-9a-f-]{36}\.jpg$/i);
    expect(insertCall[1][10]).not.toContain('..');
  });

  it('rejects a missing body, future purchase date, and non-numeric warranty duration', async () => {
    const agent = await authenticatedAgent();

    const missingBodyResponse = await agent.post('/api/products').set('Origin', frontendOrigin);
    const invalidProductResponse = await agent.post('/api/products').set('Origin', frontendOrigin).send({
      ...productInput,
      purchaseDate: '2099-01-01',
      warrantyDuration: true,
    });

    expect(missingBodyResponse.status).toBe(400);
    expect(missingBodyResponse.body.errors).toEqual(expect.objectContaining({
      name: 'Product name is required.',
      warrantyDuration: 'Warranty duration must be a positive whole number.',
    }));
    expect(invalidProductResponse.status).toBe(400);
    expect(invalidProductResponse.body.errors).toEqual(expect.objectContaining({
      purchaseDate: 'Purchase date must be valid and cannot be in the future.',
      warrantyDuration: 'Warranty duration must be a positive whole number.',
    }));
  });

  it('rejects product values that exceed backend and database bounds', async () => {
    const agent = await authenticatedAgent();
    const response = await agent.post('/api/products').set('Origin', frontendOrigin).send({
      ...productInput,
      name: 'n'.repeat(256),
      storeName: 's'.repeat(256),
      warrantyDuration: 3651,
    });
    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(expect.objectContaining({
      name: 'Product name must be 255 characters or fewer.',
      storeName: 'Store name must be 255 characters or fewer.',
      warrantyDuration: 'Warranty duration must be a whole number between 1 and 3650.',
    }));
    expect(database.execute).toHaveBeenCalledTimes(1);
  });

  it('accepts today and past purchase dates but never persists a future date', async () => {
    const agent = await authenticatedAgent();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const past = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
    database.execute.mockResolvedValueOnce([{ insertId: 31 }]).mockResolvedValueOnce([{ insertId: 32 }]);
    const todayResponse = await agent.post('/api/products').set('Origin', frontendOrigin).send({ ...productInput, purchaseDate: today });
    const pastResponse = await agent.post('/api/products').set('Origin', frontendOrigin).send({ ...productInput, purchaseDate: past });
    const futureResponse = await agent.post('/api/products').set('Origin', frontendOrigin).send({ ...productInput, purchaseDate: '2099-01-01' });
    expect(todayResponse.status).toBe(201);
    expect(pastResponse.status).toBe(201);
    expect(futureResponse.status).toBe(400);
    expect(futureResponse.body.errors.purchaseDate).toMatch(/future/);
    expect(database.execute.mock.calls.filter(([sql]) => sql.includes('INSERT INTO products'))).toHaveLength(2);
  });

  it('creates an owned product with calculated warranty information', async () => {
    const agent = await authenticatedAgent();
    database.execute.mockResolvedValueOnce([{ insertId: 21 }]);

    const response = await agent.post('/api/products').set('Origin', frontendOrigin).send({ ...productInput, user_id: 999 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      message: 'Product added successfully.',
      product: expect.objectContaining({
        id: 21,
        name: 'Laptop Pro',
        expirationDate: '2026-03-15',
        warrantyStatus: 'Expired',
        remainingWarrantyDays: expect.any(Number),
      }),
    }));
    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO products'),
      [7, 'Laptop Pro', 'Other', 'Tech Store', '2026-01-15', 2, 'months', '2026-03-15', 'SER-123', 'Office laptop', null, false, null],
    );
    expect(auditLogger.productMutation).toHaveBeenCalledWith('product_create', { productId: 21, userId: 7, outcome: 'success' });
  });

  it('audits only safe mutation metadata and does not audit reads', async () => {
    const write = jest.spyOn(console, 'info').mockImplementation(() => {});
    const agent = await authenticatedAgent();
    database.execute.mockResolvedValueOnce([{ insertId: 31 }]);
    await agent.post('/api/products').set('Origin', frontendOrigin).send({ ...productInput, notes: 'private notes', serialNumber: 'SERIAL-SECRET' });
    expect(auditLogger.productMutation).toHaveBeenCalledWith('product_create', { productId: 31, userId: 7, outcome: 'success' });
    const [event, details] = auditLogger.productMutation.mock.calls.at(-1);
    expect(JSON.stringify({ event, details })).not.toMatch(/private notes|SERIAL-SECRET|password|invoice/i);
    database.execute.mockResolvedValueOnce([[]]);
    await agent.get('/api/products');
    expect(auditLogger.productMutation).toHaveBeenCalledTimes(1);
    write.mockRestore();
  });

  it('persists an enabled reminder and maps database boolean values safely', async () => {
    const agent = await authenticatedAgent();
    database.execute.mockResolvedValueOnce([{ insertId: 22 }]);
    const create = await agent.post('/api/products').set('Origin', frontendOrigin).send({ ...productInput, reminderEnabled: 'true', reminderDaysBefore: '14', is_reminded: 'true', reminder_sent_at: '2026-01-01' });
    expect(create.status).toBe(201);
    expect(database.execute).toHaveBeenLastCalledWith(expect.stringContaining('reminder_enabled, reminder_days_before'), expect.arrayContaining([true, 14]));

    database.execute.mockResolvedValueOnce([[{ id: 22, ...productInput, store_name: productInput.storeName, purchase_date: productInput.purchaseDate, warranty_duration: 2, warranty_unit: 'months', expiration_date: '2026-03-15', serial_number: null, notes: null, invoice_path: null, reminder_enabled: '0', reminder_days_before: null, is_reminded: '0', reminder_sent_at: null }]]);
    const list = await agent.get('/api/products');
    expect(list.body.products[0]).toEqual(expect.objectContaining({ reminderEnabled: false, isReminded: false }));

    database.execute.mockResolvedValueOnce([[{ invoice_path: null, expiration_date: '2026-03-15', reminder_enabled: 0, reminder_days_before: null, is_reminded: 0, reminder_sent_at: null }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
    const enabledEdit = await agent.put('/api/products/22').set('Origin', frontendOrigin).send({ ...productInput, invoiceAction: 'none', reminderEnabled: 'true', reminderDaysBefore: '7' });
    expect(enabledEdit.status).toBe(200);
    expect(database.execute).toHaveBeenLastCalledWith(expect.stringContaining('reminder_enabled = ?, reminder_days_before = ?'), expect.arrayContaining([true, 7, false, null, 22, 7]));

    database.execute.mockResolvedValueOnce([[{ invoice_path: null, expiration_date: '2026-03-15', reminder_enabled: 1, reminder_days_before: 7, is_reminded: 0, reminder_sent_at: null }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
    const disabledEdit = await agent.put('/api/products/22').set('Origin', frontendOrigin).send({ ...productInput, reminderEnabled: 'false', reminderDaysBefore: '' });
    expect(disabledEdit.status).toBe(200);
    expect(database.execute).toHaveBeenLastCalledWith(expect.stringContaining('reminder_enabled = ?, reminder_days_before = ?'), expect.arrayContaining([false, null, false, null, 22, 7]));
  });

  it('rejects invalid enabled reminder values instead of saving them as disabled', async () => {
    const agent = await authenticatedAgent();
    const response = await agent.post('/api/products').set('Origin', frontendOrigin).send({ ...productInput, reminderEnabled: 'true', reminderDaysBefore: '1.5' });
    expect(response.status).toBe(400);
    expect(response.body.errors.reminderDaysBefore).toMatch(/whole number/);
    expect(database.execute).toHaveBeenCalledTimes(1);
  });

  it('lists and retrieves only products belonging to the authenticated user', async () => {
    const agent = await authenticatedAgent();
    const row = {
      id: 21,
      name: 'Laptop Pro',
      category: 'Electronics',
      store_name: 'Tech Store',
      purchase_date: '2026-01-15',
      warranty_duration: 2,
      warranty_unit: 'months',
      expiration_date: '2026-03-15',
      serial_number: 'SER-123',
      notes: 'Office laptop',
    };
    database.execute.mockResolvedValueOnce([[row]]).mockResolvedValueOnce([[row]]);

    const listResponse = await agent.get('/api/products');
    const detailResponse = await agent.get('/api/products/21');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.products).toHaveLength(1);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.product).toEqual(expect.objectContaining({ id: 21, name: 'Laptop Pro' }));
    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE id = ? AND user_id = ?'),
      [21, 7],
    );
  });

  it('returns protected invoice metadata in the product list', async () => {
    const agent = await authenticatedAgent();
    database.execute.mockResolvedValueOnce([[{
      id: 21, name: 'Laptop Pro', category: 'Electronics', store_name: 'Tech Store', purchase_date: '2026-01-15',
      warranty_duration: 2, warranty_unit: 'months', expiration_date: '2026-03-15', serial_number: null, notes: null,
      invoice_path: 'owner-invoice.jpg',
    }]]);

    const response = await agent.get('/api/products');

    expect(response.status).toBe(200);
    expect(response.body.products[0]).toEqual(expect.objectContaining({
      hasInvoice: true,
      invoiceFileName: 'owner-invoice.jpg',
      invoiceMimeType: 'image/jpeg',
      invoiceViewUrl: '/api/products/21/invoice/view',
      invoiceDownloadUrl: '/api/products/21/invoice/download',
    }));
  });

  it('searches, filters, sorts, and paginates only the authenticated user products', async () => {
    const agent = await authenticatedAgent();
    const rows = [
      { id: 1, name: 'iPhone 15 Pro', category: 'Smartphones', store_name: 'Jarir', purchase_date: '2026-01-01', warranty_duration: 12, warranty_unit: 'months', expiration_date: '2027-01-01', serial_number: 'ABC-123', notes: null, invoice_path: null, created_at: '2026-01-02' },
      { id: 2, name: 'Laptop', category: 'Laptops', store_name: 'Other', purchase_date: '2025-01-01', warranty_duration: 1, warranty_unit: 'years', expiration_date: '2026-01-01', serial_number: 'XYZ-999', notes: null, invoice_path: null, created_at: '2026-01-01' },
    ];
    database.execute.mockResolvedValueOnce([rows]);
    const response = await agent.get('/api/products?search=jarir&category=Smartphones&sort=name_asc&page=1&limit=1');
    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(1);
    expect(response.body.products[0].name).toBe('iPhone 15 Pro');
    expect(response.body.pagination).toEqual({ page: 1, limit: 1, totalItems: 1, totalPages: 1 });
    expect(response.body.availableFilters.stores).toEqual(['Jarir', 'Other']);
  });

  it('uses safe defaults for invalid product-list query values', async () => {
    const agent = await authenticatedAgent();
    database.execute.mockResolvedValueOnce([[]]);
    const response = await agent.get('/api/products?sort=DROP%20TABLE&page=-1&limit=999&purchaseDateFrom=bad');
    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ page: 1, limit: 50, totalItems: 0, totalPages: 0 });
    expect(database.execute).toHaveBeenLastCalledWith(expect.stringContaining('WHERE user_id = ?'), [7]);
  });

  it('allows an owner to download JPG, PNG, and PDF invoice bytes as attachments', async () => {
    fs.mkdirSync(invoiceDirectory, { recursive: true });
    const jpgBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const pdfBytes = Buffer.from('%PDF-1.4');
    fs.writeFileSync(path.join(invoiceDirectory, 'owner-invoice.jpg'), jpgBytes);
    fs.writeFileSync(path.join(invoiceDirectory, 'owner-invoice.png'), pngBytes);
    fs.writeFileSync(path.join(invoiceDirectory, 'owner-invoice.pdf'), pdfBytes);
    const agent = await authenticatedAgent();
    database.execute
      .mockResolvedValueOnce([[{ invoice_path: 'owner-invoice.jpg' }]])
      .mockResolvedValueOnce([[{ invoice_path: 'owner-invoice.png' }]])
      .mockResolvedValueOnce([[{ invoice_path: 'owner-invoice.pdf' }]]);

    const imageResponse = await agent.get('/api/products/21/invoice/download');
    const pngResponse = await agent.get('/api/products/21/invoice/download');
    const pdfResponse = await agent.get('/api/products/21/invoice/download');

    expect(imageResponse.status).toBe(200);
    expect(imageResponse.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(imageResponse.headers['content-disposition']).toMatch(/^attachment; filename="owner-invoice\.jpg"/);
    expect(imageResponse.headers['cache-control']).toBe('private, no-store');
    expect(imageResponse.headers['accept-ranges']).toBe('none');
    expect(imageResponse.body).toEqual(jpgBytes);
    expect(pngResponse.status).toBe(200);
    expect(pngResponse.headers['content-type']).toMatch(/^image\/png/);
    expect(pngResponse.headers['content-disposition']).toMatch(/^attachment; filename="owner-invoice\.png"/);
    expect(pngResponse.body).toEqual(pngBytes);
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers['content-type']).toMatch(/^application\/pdf/);
    expect(pdfResponse.headers['content-disposition']).toMatch(/^attachment; filename="owner-invoice\.pdf"/);
    expect(pdfResponse.body).toEqual(pdfBytes);
  });

  it('removes a valid temporary upload when the database write fails', async () => {
    const agent = await authenticatedAgent();
    fs.mkdirSync(invoiceDirectory, { recursive: true });
    const before = new Set(fs.readdirSync(invoiceDirectory));
    database.execute.mockRejectedValueOnce(new Error('database unavailable'));
    const response = await agent.post('/api/products').set('Origin', frontendOrigin)
      .field('name', productInput.name).field('category', productInput.category)
      .field('storeName', productInput.storeName).field('purchaseDate', productInput.purchaseDate)
      .field('warrantyDuration', String(productInput.warrantyDuration)).field('warrantyUnit', productInput.warrantyUnit)
      .field('invoiceAction', 'save')
      .attach('invoice', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { filename: 'invoice.jpg', contentType: 'image/jpeg' });
    expect(response.status).toBe(500);
    expect(fs.readdirSync(invoiceDirectory).filter((name) => !before.has(name))).toEqual([]);
    expect(response.text).not.toMatch(/database unavailable|uploads[\\/]/i);
  });

  it('does not expose missing or unowned invoices', async () => {
    const unauthenticatedResponse = await request(app).get('/api/products/21/invoice/view');
    const agent = await authenticatedAgent();
    database.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ invoice_path: 'owner-invoice.jpg' }]]);

    const unownedResponse = await agent.get('/api/products/21/invoice/view');
    const missingFileResponse = await agent.get('/api/products/21/invoice/download');

    expect(unauthenticatedResponse.status).toBe(401);
    expect(unownedResponse.status).toBe(404);
    expect(missingFileResponse.status).toBe(404);
  });

  it('updates and deletes products only when they belong to the authenticated user', async () => {
    const agent = await authenticatedAgent();
    database.execute
      .mockResolvedValueOnce([[{ invoice_path: null }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[]]);

    const updateResponse = await agent.put('/api/products/21').set('Origin', frontendOrigin).send({ ...productInput, name: 'Updated Laptop' });
    const deleteResponse = await agent.delete('/api/products/99').set('Origin', frontendOrigin);

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.product).toEqual(expect.objectContaining({ id: 21, name: 'Updated Laptop' }));
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.body).toEqual({ error: 'Product not found.' });
    expect(auditLogger.productMutation).toHaveBeenCalledWith('product_update', { productId: 21, userId: 7, outcome: 'success' });
    expect(auditLogger.productMutation).toHaveBeenCalledWith('product_delete', { productId: 99, userId: 7, outcome: 'not_found' });
    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining('SELECT invoice_path FROM products'),
      [99, 7],
    );
  });
});
