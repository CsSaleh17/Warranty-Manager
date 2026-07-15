import { useEffect, useState } from 'react';

const emptyForm = {
  name: '', category: '', storeName: '', purchaseDate: '', warrantyDuration: '', warrantyUnit: 'months', serialNumber: '', notes: '',
};
const categories = ['Smartphones', 'Laptops', 'Tablets', 'Televisions and Screens', 'Gaming Devices', 'Cameras', 'Home Appliances', 'Kitchen Appliances', 'Accessories', 'Furniture', 'Automotive Products', 'Other'];

function validateProductForm(form) {
  const errors = {};
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const warrantyDuration = Number(form.warrantyDuration);

  if (!form.name.trim()) errors.name = 'Product name is required.';
  if (!form.category.trim()) errors.category = 'Category is required.';
  if (!form.storeName.trim()) errors.storeName = 'Store name is required.';
  if (!form.purchaseDate) errors.purchaseDate = 'Purchase date is required.';
  else if (form.purchaseDate > todayString) errors.purchaseDate = 'Purchase date must be valid and cannot be in the future.';
  if (!Number.isInteger(warrantyDuration) || warrantyDuration <= 0) errors.warrantyDuration = 'Warranty duration must be a positive whole number.';
  if (!['days', 'months', 'years'].includes(form.warrantyUnit)) errors.warrantyUnit = 'Warranty unit must be days, months, or years.';

  return errors;
}

function downloadFileName(contentDisposition, fallback) {
  const match = /filename=(?:"([^"]+)"|([^;\s]+))/i.exec(contentDisposition || '');
  return match?.[1] || match?.[2] || fallback || 'invoice';
}

function ProductsPage({ user, initialMessage = '', statusFilter = '', onDetails }) {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(initialMessage);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [saveScannedInvoice, setSaveScannedInvoice] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanError, setScanError] = useState('');
  const [removeInvoice, setRemoveInvoice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadProducts() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load products.');
      setProducts(data.products);
      setErrors({});
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setMessage('');
    setInvoiceFile(null); setRemoveInvoice(false);
    setIsFormOpen(true);
  }

  function openEditForm(product) {
    setEditingId(product.id);
    setForm({
      name: product.name, category: product.category, storeName: product.storeName, purchaseDate: product.purchaseDate,
      warrantyDuration: String(product.warrantyDuration), warrantyUnit: product.warrantyUnit,
      serialNumber: product.serialNumber || '', notes: product.notes || '',
    });
    setErrors({});
    setMessage('');
    setInvoiceFile(null); setRemoveInvoice(false);
    setIsFormOpen(true);
  }

  async function submitProduct(event) {
    event.preventDefault();
    if (isSubmitting) return;
    setErrors({});
    setMessage('');
    const clientErrors = validateProductForm(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }
    const isEditing = editingId !== null;
    setIsSubmitting(true);
    try {
      const body = new FormData();
      Object.entries({ ...form, warrantyDuration: Number(form.warrantyDuration), removeInvoice }).forEach(([key, value]) => body.append(key, value));
      if (invoiceFile && saveScannedInvoice) body.append('invoice', invoiceFile);
      const response = await fetch(isEditing ? `/api/products/${editingId}` : '/api/products', {
        method: isEditing ? 'PUT' : 'POST',
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.errors || { form: data.error || 'Unable to save product.' });
        return;
      }
      setMessage(data.message);
      setIsFormOpen(false);
      await loadProducts();
    } catch {
      setErrors({ form: 'Unable to reach the server. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteProduct(id) {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    setMessage('');
    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to delete product.');
      setMessage(data.message);
      await loadProducts();
    } catch (error) {
      setErrors({ form: error.message });
    }
  }

  async function downloadInvoice(product) {
    try {
      const response = await fetch(product.invoiceDownloadUrl, { method: 'GET', credentials: 'include' });
      if (!response.ok) throw new Error('Unable to download invoice.');
      const blob = await response.blob();
      if (blob.size === 0) throw new Error('The downloaded invoice is empty.');

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadFileName(response.headers.get('content-disposition'), product.invoiceFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error) {
      setErrors({ form: error.message || 'Unable to download invoice.' });
    }
  }

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function analyzeInvoice() {
    if (!invoiceFile) { setErrors({ form: 'Select an invoice first.' }); return; }
    setIsAnalyzing(true); setErrors({}); setScanError('');
    try {
      const body = new FormData(); body.append('invoice', invoiceFile);
      const response = await fetch('/api/invoices/analyze', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invoice analysis failed.');
      const detected = { name: data.fields.productName, storeName: data.fields.storeName, purchaseDate: data.fields.purchaseDate, serialNumber: data.fields.serialNumber, warrantyDuration: data.fields.warrantyDuration, warrantyUnit: data.fields.warrantyUnit, category: data.fields.category };
      const conflict = Object.entries(detected).some(([key, value]) => value && form[key] && form[key] !== value);
      if (conflict && !window.confirm('Replace values you already entered with detected invoice values?')) { setMessage(data.message); return; }
      setForm((current) => ({ ...current, ...Object.fromEntries(Object.entries(detected).filter(([, value]) => value)) }));
      setMessage(data.message);
    } catch (error) { setScanError(error.message); } finally { setIsAnalyzing(false); }
  }

  return (
    <main className="products-page">
      <header className="products-header">
        <div><h1>Products</h1><p>Manage your warranties in one place.</p>{user && <p>Logged in as {user.fullName}.</p>}</div>
        <button type="button" onClick={openAddForm}>Add product</button>
      </header>

      {message && <p className="form-message success" role="status">{message}</p>}
      {errors.form && <p className="form-message error" role="alert">{errors.form}</p>}

      {isFormOpen && <section className="product-form-card" aria-labelledby="product-form-title">
        <h2 id="product-form-title">{editingId === null ? 'Add product' : 'Edit product'}</h2>
        <form onSubmit={submitProduct} noValidate>
          <fieldset className="invoice-section"><legend>Scan or attach invoice (optional)</legend>
            <p>Take a photo or choose an invoice image/PDF, then analyze it to fill available product fields.</p>
            <label htmlFor="invoice-file">Capture or choose invoice</label>
            <input id="invoice-file" aria-label="Invoice attachment" type="file" accept="image/*,application/pdf" capture="environment" onChange={(event) => { const file = event.target.files[0] || null; setInvoiceFile(file); setSaveScannedInvoice(Boolean(file)); setRemoveInvoice(false); setScanError(''); }} />
            <button type="button" onClick={analyzeInvoice} disabled={!invoiceFile || isAnalyzing}>{isAnalyzing ? 'Analyzing invoice...' : 'Scan invoice'}</button>
            {scanError && <p className="field-error" role="alert">{scanError}</p>}
            {invoiceFile && <>{invoiceFile.type.startsWith('image/') && <img className="invoice-preview" src={URL.createObjectURL(invoiceFile)} alt="Selected invoice preview" />}<p>{invoiceFile.name} selected. <button type="button" className="secondary-button" onClick={() => { setInvoiceFile(null); setSaveScannedInvoice(false); }}>Remove or replace file</button></p></>}
            <label><input type="checkbox" checked={saveScannedInvoice} onChange={(event) => setSaveScannedInvoice(event.target.checked)} /> Save this invoice with the product</label>
            {editingId !== null && !invoiceFile && <label><input type="checkbox" checked={removeInvoice} onChange={(event) => setRemoveInvoice(event.target.checked)} /> Remove stored invoice</label>}
          </fieldset>
          <label htmlFor="product-name">Product name</label>
          <input id="product-name" name="name" value={form.name} onChange={updateForm} />
          {errors.name && <p className="field-error">{errors.name}</p>}
          <label htmlFor="category">Category</label>
          <select id="category" name="category" value={categories.includes(form.category) ? form.category : 'Other'} onChange={updateForm}><option value="">Select a category</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
          {errors.category && <p className="field-error">{errors.category}</p>}
          <label htmlFor="storeName">Store name</label>
          <input id="storeName" name="storeName" value={form.storeName} onChange={updateForm} />
          {errors.storeName && <p className="field-error">{errors.storeName}</p>}
          <label htmlFor="purchaseDate">Purchase date</label>
          <input id="purchaseDate" name="purchaseDate" type="date" value={form.purchaseDate} onChange={updateForm} />
          {errors.purchaseDate && <p className="field-error">{errors.purchaseDate}</p>}
          <label htmlFor="warrantyDuration">Warranty duration</label>
          <input id="warrantyDuration" name="warrantyDuration" type="number" min="1" value={form.warrantyDuration} onChange={updateForm} />
          {errors.warrantyDuration && <p className="field-error">{errors.warrantyDuration}</p>}
          <label htmlFor="warrantyUnit">Warranty unit</label>
          <select id="warrantyUnit" name="warrantyUnit" value={form.warrantyUnit} onChange={updateForm}><option value="days">Days</option><option value="months">Months</option><option value="years">Years</option></select>
          {errors.warrantyUnit && <p className="field-error">{errors.warrantyUnit}</p>}
          <label htmlFor="serialNumber">Serial number</label>
          <input id="serialNumber" name="serialNumber" value={form.serialNumber} onChange={updateForm} />
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" value={form.notes} onChange={updateForm} />
          <div className="form-actions"><button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving product...' : 'Save product'}</button><button type="button" className="secondary-button" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>Cancel</button></div>
        </form>
      </section>}

      {isLoading ? <p role="status">Loading products...</p> : products.filter((product) => !statusFilter || product.warrantyStatus === statusFilter).length === 0 ? <p className="empty-state">{statusFilter ? 'No products match this filter.' : 'No products yet.'}</p> : <section className="product-grid" aria-label="Your products">
        {products.filter((product) => !statusFilter || product.warrantyStatus === statusFilter).map((product) => <article className="product-card" key={product.id}>
          <h2>{product.name}</h2><p>{product.category} · {product.storeName}</p>
          <p><strong>{product.warrantyStatus}</strong> · {product.remainingWarrantyDays} days remaining</p>
          <p>Expires: {product.expirationDate}</p>
          <section className="invoice-section"><h3>Invoice Attachment</h3>{product.hasInvoice ? <><p>{product.invoiceFileName}</p><p><a href={product.invoiceViewUrl} target="_blank" rel="noreferrer">View Invoice</a> · <button type="button" className="invoice-download-button" onClick={() => downloadInvoice(product)}>Download Invoice</button></p></> : <p>No invoice attached</p>}</section>
          <div className="form-actions">{onDetails && <button type="button" onClick={() => onDetails(product.id)}>Details</button>}<button type="button" onClick={() => openEditForm(product)}>Edit</button><button type="button" className="delete-button" onClick={() => deleteProduct(product.id)}>Delete</button></div>
        </article>)}
      </section>}
    </main>
  );
}

export default ProductsPage;
