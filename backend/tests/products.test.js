jest.mock('../src/config/database', () => ({
  execute: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const database = require('../src/config/database');
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
  });

  afterEach(() => {
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
      [7, 'Laptop Pro', 'Electronics', 'Tech Store', '2026-01-15', 2, 'months', '2026-03-15', 'SER-123', 'Office laptop', null],
    );
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
    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining('SELECT invoice_path FROM products'),
      [99, 7],
    );
  });
});
