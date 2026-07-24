import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDisplayDate, formatDisplayDateTime, formatDisplayNumber, formatWarrantyDuration, translateApiError } from './localization.js';

const emptyForm = {
  name: '', category: '', storeName: '', purchaseDate: '', warrantyDuration: '', warrantyUnit: 'months', serialNumber: '', notes: '', reminderEnabled: false, reminderDaysBefore: '',
};
const categories = ['Smartphones', 'Laptops', 'Tablets', 'Televisions and Screens', 'Gaming Devices', 'Cameras', 'Home Appliances', 'Kitchen Appliances', 'Accessories', 'Furniture', 'Automotive Products', 'Other'];
const asBoolean = (value) => value === true || value === 1 || value === '1';

function translateCategory(value, t) { return t(`categories.${value}`, { defaultValue: value }); }
function translateWarrantyStatus(value, t) { return t(`status.${value}`, { defaultValue: value }); }
function formatDaysRemaining(days, t, language) { return Number(days) < 0 ? t('products.expiredAgo', { count: formatDisplayNumber(Math.abs(days), language) }) : t('products.remainingDays', { count: formatDisplayNumber(days, language) }); }
function formatReminderTiming(days, t, language) { return t('products.timingDuration', { duration: formatWarrantyDuration(days, 'days', language) }); }

function LocalizedProductCard({ product, t, language, onDetails, onEdit, onDelete, onDownload }) {
  const category = translateCategory(product.category, t);
  const status = translateWarrantyStatus(product.warrantyStatus, t);
  const reminderStatus = product.isReminded ? t('common.sent') : t('common.notSent');
  return <div className="localized-product-card">
    <h2 dir="auto">{product.name}</h2>
    <p dir="auto">{category} · {product.storeName}</p>
    <p><strong>{status}</strong> · <span>{formatDaysRemaining(product.remainingWarrantyDays, t, language)}</span></p>
    <p>{t('products.expires', { date: formatDisplayDate(product.expirationDate, language) })}</p>
    <section className="invoice-section"><h3>{t('products.reminder')}</h3><p>{t('products.reminder')}: {product.reminderEnabled ? t('common.enabled') : t('common.disabled')}</p>{product.reminderEnabled && <><p>{formatReminderTiming(product.reminderDaysBefore, t, language)}</p><p>{t('products.statusLabel', { status: reminderStatus })}{product.reminderSentAt ? <> {t('common.on')} <bdi>{formatDisplayDateTime(product.reminderSentAt, language)}</bdi></> : ''}</p></>}</section>
    <section className="invoice-section"><h3>{t('products.invoice')}</h3>{product.hasInvoice ? <><p dir="ltr">{product.invoiceFileName}</p><p><a href={product.invoiceViewUrl} target="_blank" rel="noreferrer">{t('products.viewInvoice')}</a> · <button type="button" className="invoice-download-button" onClick={() => onDownload(product)}>{t('products.download')}</button></p></> : <p>{t('products.noInvoice')}</p>}</section>
    <div className="form-actions">{onDetails && <button type="button" onClick={() => onDetails(product.id)}>{t('common.details')}</button>}<button id={`edit-product-${product.id}`} type="button" onClick={(event) => onEdit(product, event.currentTarget)}>{t('common.edit')}</button><button id={`delete-product-${product.id}`} type="button" className="delete-button" onClick={(event) => onDelete(product.id, event.currentTarget)}>{t('common.delete')}</button></div>
  </div>;
}
function validateProductForm(form, hasInvoice = false, t = (key) => key) {
  const errors = {};
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const warrantyDuration = Number(form.warrantyDuration);

  if (!hasInvoice && !form.name.trim()) errors.name = t('validation.name');
  if (!hasInvoice && !form.category.trim()) errors.category = t('validation.category');
  if (!hasInvoice && !form.storeName.trim()) errors.storeName = t('validation.store');
  if (!form.purchaseDate) errors.purchaseDate = t('validation.dateRequired');
  else if (form.purchaseDate > todayString) errors.purchaseDate = t('validation.dateFuture');
  if (!Number.isInteger(warrantyDuration) || warrantyDuration <= 0) errors.warrantyDuration = t('validation.duration');
  if (!['days', 'months', 'years'].includes(form.warrantyUnit)) errors.warrantyUnit = t('validation.unit');
  if (form.reminderEnabled) {
    const reminderDays = Number(form.reminderDaysBefore);
    if (!form.purchaseDate || !Number.isInteger(warrantyDuration) || warrantyDuration <= 0) errors.reminderEnabled = t('validation.reminder');
    if (!Number.isInteger(reminderDays) || reminderDays < 1 || reminderDays > 3650) errors.reminderDaysBefore = t('validation.reminderDays');
  }

  return errors;
}

function downloadFileName(contentDisposition, fallback) {
  const match = /filename=(?:"([^"]+)"|([^;\s]+))/i.exec(contentDisposition || '');
  return match?.[1] || match?.[2] || fallback || 'invoice';
}

function filtersFromLocation(defaultStatus = '') {
  const query = new URLSearchParams(window.location.search);
  return {
    status: query.get('status') || defaultStatus,
    store: query.get('store') || '',
    category: query.get('category') || '',
    remainingDaysPreset: query.get('remainingDaysPreset') || '',
    warrantyDurationPreset: query.get('warrantyDurationPreset') || '',
    sort: query.get('sort') || 'recent',
    page: Number(query.get('page')) || 1,
  };
}

function ProductsPage({ user, initialMessage = '', statusFilter = '', onDetails, openAdd = false }) {
  const { t, i18n } = useTranslation();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deliveryState, setDeliveryState] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(initialMessage);
  const [selectedInvoiceFile, setSelectedInvoiceFile] = useState(null);
  const [selectedInvoicePreviewUrl, setSelectedInvoicePreviewUrl] = useState('');
  const [existingInvoice, setExistingInvoice] = useState(null);
  const [invoiceAction, setInvoiceAction] = useState('none');
  const [invoiceScanStatus, setInvoiceScanStatus] = useState('idle');
  const [invoiceScanMessage, setInvoiceScanMessage] = useState('');
  const fileInputRef = useRef(null);
  const scanControllerRef = useRef(null);
  const productsControllerRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState(() => filtersFromLocation(statusFilter));
  const [availableFilters, setAvailableFilters] = useState({ stores: [], categories: [] });
  const [pagination, setPagination] = useState(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterMenu, setFilterMenu] = useState('main');
  const [productPendingDeletion, setProductPendingDeletion] = useState(null);
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);
  const addButtonRef = useRef(null);
  const productDialogRef = useRef(null);
  const restoreDialogFocusRef = useRef(null);
  const confirmationDialogRef = useRef(null);
  const restoreDeleteFocusRef = useRef(null);
  const productDialogWasOpenRef = useRef(false);
  const deleteDialogWasOpenRef = useRef(false);

  function focusableElements(container) {
    return [...(container?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') || [])].filter((element) => !element.hidden);
  }

  function closeProductForm() {
    setIsFormOpen(false);
  }

  function handleProductDialogKeyDown(event) {
    if (event.key === 'Escape' && !isSubmitting) { event.preventDefault(); closeProductForm(); return; }
    if (event.key !== 'Tab') return;
    const controls = focusableElements(productDialogRef.current);
    if (!controls.length) { event.preventDefault(); return; }
    const currentIndex = controls.indexOf(document.activeElement);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    event.preventDefault(); controls[nextIndex].focus();
  }

  function closeDeleteConfirmation() {
    setProductPendingDeletion(null);
  }

  function handleDeleteDialogKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); closeDeleteConfirmation(); return; }
    if (event.key !== 'Tab') return;
    const controls = focusableElements(confirmationDialogRef.current);
    if (!controls.length) { event.preventDefault(); return; }
    const currentIndex = controls.indexOf(document.activeElement);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    event.preventDefault(); controls[nextIndex].focus();
  }

  useEffect(() => {
    if (isFormOpen) { productDialogWasOpenRef.current = true; window.setTimeout(() => productDialogRef.current?.querySelector('#product-name')?.focus(), 0); }
    else if (productDialogWasOpenRef.current) { productDialogWasOpenRef.current = false; window.setTimeout(() => document.getElementById(restoreDialogFocusRef.current || 'add-product-button')?.focus(), 0); }
  }, [isFormOpen]);
  useEffect(() => {
    if (productPendingDeletion) { deleteDialogWasOpenRef.current = true; window.setTimeout(() => confirmationDialogRef.current?.querySelector('button')?.focus(), 0); }
    else if (deleteDialogWasOpenRef.current) { deleteDialogWasOpenRef.current = false; window.setTimeout(() => document.getElementById(restoreDeleteFocusRef.current)?.focus(), 0); }
  }, [productPendingDeletion]);

  async function loadProducts(nextFilters = filters) {
    const controller = new AbortController(); productsControllerRef.current?.abort(); productsControllerRef.current = controller;
    setIsLoading(true);
    try {
      const query = new URLSearchParams(Object.entries(nextFilters).filter(([, value]) => value && value !== 'recent' && value !== 1));
      const response = await fetch(`/api/products${query.size ? `?${query}` : ''}`, { signal: controller.signal });
      const data = await response.json();
      if (productsControllerRef.current !== controller) return;
      if (!response.ok) throw new Error(translateApiError(data.error, t, response.status));
      setProducts(data.products);
      setAvailableFilters(data.availableFilters || { stores: [], categories: [] }); setPagination(data.pagination || null);
      setErrors({});
    } catch (error) {
      if (error.name !== 'AbortError') setErrors({ form: error.message });
    } finally {
      if (productsControllerRef.current === controller) setIsLoading(false);
    }
  }

  useEffect(() => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value && value !== 'recent' && value !== 1));
    window.history.replaceState({}, '', `/products${query.size ? `?${query}` : ''}`);
    loadProducts();
  }, [filters]);

  useEffect(() => {
    const syncFiltersFromUrl = () => setFilters(filtersFromLocation());
    window.addEventListener('popstate', syncFiltersFromUrl);
    return () => window.removeEventListener('popstate', syncFiltersFromUrl);
  }, []);

  function changeFilter(name, value) { setFilters((current) => ({ ...current, [name]: value, page: name === 'page' ? value : 1 })); }
  function clearFilters() { setFilters((current) => ({ ...current, status: '', store: '', category: '', remainingDaysPreset: '', warrantyDurationPreset: '', page: 1 })); }
  function closeFilterPanel(restoreFocus = false) {
    setFilterPanelOpen(false); setFilterMenu('main');
    if (restoreFocus) window.setTimeout(() => filterButtonRef.current?.focus(), 0);
  }
  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape' && filterPanelOpen) closeFilterPanel(true);
      if (event.type === 'mousedown' && filterPanelOpen && !filterPanelRef.current?.contains(event.target) && !filterButtonRef.current?.contains(event.target)) closeFilterPanel();
    };
    window.addEventListener('keydown', close); window.addEventListener('mousedown', close);
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('mousedown', close); };
  }, [filterPanelOpen]);
  const activeFilters = Object.entries(filters).filter(([key, value]) => value && key !== 'page' && key !== 'sort');
  const hasAppliedFilters = activeFilters.length > 0;
  const filterChipValue = (key, value) => key === 'category' ? translateCategory(value, t) : key === 'status' ? translateWarrantyStatus(value, t) : value;
  const categoryLabel = (value) => t(`categories.${value}`, { defaultValue: value });
  const statusLabel = (value) => t(`status.${value}`, { defaultValue: value });
  const filterMenus = {
    status: { title: t('filters.status'), field: 'status', allLabel: t('filters.allStatuses'), options: [{ value: 'Active', label: t('status.Active') }, { value: 'Expiring Soon', label: t('status.Expiring Soon') }, { value: 'Expired', label: t('status.Expired') }] },
    store: { title: t('filters.store'), field: 'store', allLabel: t('filters.allStores'), options: availableFilters.stores.map((value) => ({ value, label: value })) },
    category: { title: t('filters.category'), field: 'category', allLabel: t('filters.allCategories'), options: availableFilters.categories.map((value) => ({ value, label: categoryLabel(value) })) },
    remaining: { title: t('filters.remaining'), field: 'remainingDaysPreset', allLabel: t('filters.allRemaining'), options: [{ value: '7', label: t('filters.within7') }, { value: '30', label: t('filters.within30') }, { value: '60', label: t('filters.within60') }, { value: '90', label: t('filters.within90') }, { value: 'more-90', label: t('filters.more90') }, { value: 'expired', label: t('filters.alreadyExpired') }] },
    length: { title: t('filters.length'), field: 'warrantyDurationPreset', allLabel: t('filters.allLengths'), options: [{ value: 'lt-6m', label: t('filters.less6') }, { value: '6-12m', label: t('filters.six12') }, { value: '1-2y', label: t('filters.one2') }, { value: 'gt-2y', label: t('filters.more2') }] },
  };

  function openAddForm(opener = addButtonRef.current) {
    restoreDialogFocusRef.current = opener?.id || 'add-product-button';
    setEditingId(null);
    setDeliveryState(null);
    setForm(emptyForm);
    setErrors({});
    setMessage('');
    clearSelectedInvoice(); setExistingInvoice(null); setInvoiceAction('none');
    setIsFormOpen(true);
  }

  useEffect(() => { if (openAdd) openAddForm(); }, [openAdd]);

  function openEditForm(product, opener = document.activeElement) {
    restoreDialogFocusRef.current = opener?.id || `edit-product-${product.id}`;
    setEditingId(product.id);
    setDeliveryState({ isReminded: asBoolean(product.isReminded), reminderSentAt: product.reminderSentAt || null });
    setForm({
      name: product.name, category: product.category, storeName: product.storeName, purchaseDate: product.purchaseDate,
      warrantyDuration: String(product.warrantyDuration), warrantyUnit: product.warrantyUnit,
      serialNumber: product.serialNumber || '', notes: product.notes || '', reminderEnabled: asBoolean(product.reminderEnabled), reminderDaysBefore: product.reminderDaysBefore ?? '',
    });
    setErrors({});
    setMessage('');
    clearSelectedInvoice(); setExistingInvoice(product.hasInvoice ? { fileName: product.invoiceFileName } : null); setInvoiceAction(product.hasInvoice ? 'keep' : 'none');
    setIsFormOpen(true);
  }

  async function submitProduct(event) {
    event.preventDefault();
    if (isSubmitting) return;
    setErrors({});
    setMessage('');
    const clientErrors = validateProductForm(form, Boolean(selectedInvoiceFile && ['save', 'replace'].includes(invoiceAction)) || Boolean(existingInvoice && invoiceAction === 'keep'), t);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }
    const isEditing = editingId !== null;
    setIsSubmitting(true);
    try {
      const body = new FormData();
      Object.entries({ ...form, reminderEnabled: form.reminderEnabled ? 'true' : 'false', reminderDaysBefore: form.reminderEnabled ? form.reminderDaysBefore : '', warrantyDuration: Number(form.warrantyDuration), invoiceAction }).forEach(([key, value]) => body.append(key, value));
      if (selectedInvoiceFile && ['save', 'replace'].includes(invoiceAction)) body.append('invoice', selectedInvoiceFile);
      const response = await fetch(isEditing ? `/api/products/${editingId}` : '/api/products', {
        method: isEditing ? 'PUT' : 'POST',
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        const fieldTranslations = { name: 'validation.name', category: 'validation.category', storeName: 'validation.store', purchaseDate: data.errors?.purchaseDate?.toLowerCase().includes('future') ? 'validation.dateFuture' : 'validation.dateRequired', warrantyDuration: 'validation.duration', warrantyUnit: 'validation.unit', reminderEnabled: 'validation.reminder', reminderDaysBefore: 'validation.reminderDays' };
        setErrors(data.errors ? Object.fromEntries(Object.keys(data.errors).map((key) => [key, fieldTranslations[key] ? t(fieldTranslations[key]) : t('common.error')])) : { form: translateApiError(data.error, t, response.status) });
        return;
      }
      setMessage(t(isEditing ? 'products.updated' : 'products.added'));
      setIsFormOpen(false);
      await loadProducts();
    } catch {
      setErrors({ form: t('products.saveError') });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteProduct(id) {
    setMessage('');
    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(translateApiError(data.error, t, response.status));
      setMessage(t('products.deleted'));
      await loadProducts();
    } catch (error) {
      setErrors({ form: error.message });
    }
  }

  function requestDelete(product, opener = document.activeElement) { restoreDeleteFocusRef.current = opener?.id || `delete-product-${product.id}`; setProductPendingDeletion(product); }

  async function downloadInvoice(product) {
    try {
      const response = await fetch(product.invoiceDownloadUrl, { method: 'GET', credentials: 'include' });
      if (!response.ok) throw new Error(t('products.downloadError'));
      const blob = await response.blob();
      if (blob.size === 0) throw new Error(t('products.emptyDownload'));

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadFileName(response.headers.get('content-disposition'), product.invoiceFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error) {
      setErrors({ form: error.message || t('products.downloadError') });
    }
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function clearSelectedInvoice() {
    scanControllerRef.current?.abort();
    if (selectedInvoicePreviewUrl) URL.revokeObjectURL(selectedInvoicePreviewUrl);
    setSelectedInvoiceFile(null); setSelectedInvoicePreviewUrl(''); setInvoiceAction(existingInvoice ? 'keep' : 'none');
    setInvoiceScanStatus('idle'); setInvoiceScanMessage(''); setErrors((current) => ({ ...current, form: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function selectInvoice(file) {
    clearSelectedInvoice();
    if (!file) return;
    setSelectedInvoiceFile(file); setInvoiceAction(existingInvoice ? 'replace' : 'save');
    if (file.type.startsWith('image/')) setSelectedInvoicePreviewUrl(URL.createObjectURL(file));
  }

  async function analyzeInvoice() {
    if (!selectedInvoiceFile) { setErrors({ form: t('products.selectInvoice') }); return; }
    const controller = new AbortController(); scanControllerRef.current?.abort(); scanControllerRef.current = controller;
    setInvoiceScanStatus('scanning'); setInvoiceScanMessage(''); setErrors({});
    try {
      const body = new FormData(); body.append('invoice', selectedInvoiceFile);
      const response = await fetch('/api/invoices/analyze', { method: 'POST', body, signal: controller.signal });
      const data = await response.json();
      if (scanControllerRef.current !== controller) return;
      if (!response.ok) throw new Error(t('products.analysisFailed'));
      const detected = { name: data.fields.productName, storeName: data.fields.storeName, purchaseDate: data.fields.purchaseDate, serialNumber: data.fields.serialNumber, warrantyDuration: data.fields.warrantyDuration, warrantyUnit: data.fields.warrantyUnit, category: data.fields.category };
      const conflict = Object.entries(detected).some(([key, value]) => value && form[key] && form[key] !== value);
      if (!Object.values(detected).some(Boolean)) { setInvoiceScanStatus('warning'); setInvoiceScanMessage(t('products.scanWarning')); return; }
      if (conflict && !window.confirm(t('products.replaceConfirm'))) { setInvoiceScanStatus('success'); setInvoiceScanMessage(t('products.scanWarning')); return; }
      setForm((current) => ({ ...current, ...Object.fromEntries(Object.entries(detected).filter(([, value]) => value)) }));
      setInvoiceScanStatus('warning'); setInvoiceScanMessage(t('products.scanWarning'));
    } catch (error) { if (error.name !== 'AbortError') { setInvoiceScanStatus('error'); setInvoiceScanMessage(error.message); } } finally { if (scanControllerRef.current === controller) setInvoiceScanStatus((status) => status === 'scanning' ? 'idle' : status); }
  }

  return (
    <main className="products-page products-reference">
      {!isFormOpen && <header className="products-header">
        <div><h1>{t('products.title')}</h1><p>{t('products.intro')}</p>{user && <p>{t('products.loggedIn', { name: user.fullName })}</p>}</div>
        <button id="add-product-button" ref={addButtonRef} type="button" onClick={(event) => openAddForm(event.currentTarget)}>{t('products.add')}</button>
      </header>}

      {message && <p className="form-message success" role="status">{message}</p>}
      {errors.form && <p className="form-message error" role="alert">{errors.form}</p>}

      {!isFormOpen && <section className="filter-toolbar" aria-label={t('products.productFilters')}>
        <div className="filter-toolbar-controls">
          <button ref={filterButtonRef} type="button" className="secondary-button" aria-expanded={filterPanelOpen} aria-haspopup="menu" onClick={() => { setFilterPanelOpen((open) => !open); setFilterMenu('main'); }}>{t('products.filters')}{activeFilters.length ? ` (${activeFilters.length})` : ''}</button>
          <label className="sort-control">{t('sorting.label')}<select value={filters.sort} onChange={(event) => changeFilter('sort', event.target.value)}><option value="recent">{t('sorting.recent')}</option><option value="oldest">{t('sorting.oldest')}</option><option value="name_asc">{t('sorting.nameAsc')}</option><option value="name_desc">{t('sorting.nameDesc')}</option><option value="purchase_newest">{t('sorting.purchaseNewest')}</option><option value="purchase_oldest">{t('sorting.purchaseOldest')}</option><option value="expiration_nearest">{t('sorting.expirationNearest')}</option><option value="expiration_farthest">{t('sorting.expirationFarthest')}</option></select></label>
          {pagination && <p role="status">{t('products.matching', { count: formatDisplayNumber(pagination.totalItems, i18n.language) })}</p>}
        </div>
        {filterPanelOpen && <section ref={filterPanelRef} className="filter-panel" role="menu" aria-label={t('filters.title')}>
          {filterMenu === 'main' ? <>
            <h2>{t('filters.title')}</h2>
            {Object.entries(filterMenus).map(([key, menu]) => <button className="filter-menu-row" type="button" role="menuitem" key={key} onClick={() => setFilterMenu(key)}>{menu.title}<span aria-hidden="true">›</span></button>)}
            <button className="filter-menu-row" type="button" role="menuitem" onClick={clearFilters} disabled={!hasAppliedFilters}>{t('filters.clear')}</button>
          </> : <>
            <button className="filter-back" type="button" onClick={() => setFilterMenu('main')}>{t('products.back')}</button>
            <h2>{filterMenus[filterMenu].title}</h2>
            {[{ value: '', label: filterMenus[filterMenu].allLabel }, ...filterMenus[filterMenu].options].map((option) => <button className="filter-menu-row" type="button" role="menuitemradio" aria-checked={filters[filterMenus[filterMenu].field] === option.value} key={option.value || 'all'} onClick={() => { changeFilter(filterMenus[filterMenu].field, option.value); setFilterMenu('main'); }}>{option.label}{filters[filterMenus[filterMenu].field] === option.value && <span aria-label={t('common.selected')}>✓</span>}</button>)}
          </>}
        </section>}
      </section>}
      {activeFilters.length > 0 && <p className="active-filter-chips localized-filter-chips" aria-label={t('products.activeFilters')}>{activeFilters.map(([key, value]) => <button type="button" key={key} aria-label={`${t('filterLabels.remove')}: ${t(`filterLabels.${key}`, { defaultValue: key })}`} onClick={() => changeFilter(key, '')}>{t(`filterLabels.${key}`, { defaultValue: key })}: {filterChipValue(key, value)} ×</button>)}</p>}
      {isFormOpen && <section ref={productDialogRef} tabIndex="-1" className="product-form-card" role="dialog" aria-modal="true" aria-labelledby="product-form-title" onKeyDown={handleProductDialogKeyDown}>
        <h2 id="product-form-title">{editingId === null ? t('products.addTitle') : t('products.editTitle')}</h2>
        <form onSubmit={submitProduct} noValidate>
          <fieldset className="invoice-section"><legend>{t('products.scan')}</legend>
            <p>{t('products.scanHelp')}</p>
            <input ref={fileInputRef} id="invoice-file" className="visually-hidden" aria-label={t('products.attachment')} type="file" accept="image/*,application/pdf" capture="environment" onChange={(event) => selectInvoice(event.target.files[0] || null)} />
            <button type="button" className="file-picker-button" onClick={() => fileInputRef.current?.click()}>{t('products.chooseFile')}</button><span className="file-picker-name" dir="ltr">{selectedInvoiceFile?.name || t('products.noFile')}</span>
            <button type="button" onClick={analyzeInvoice} disabled={!selectedInvoiceFile || invoiceScanStatus === 'scanning'}>{invoiceScanStatus === 'scanning' ? t('products.analyzing') : t('products.scanButton')}</button>
            {invoiceScanMessage && <p className={`form-message ${invoiceScanStatus === 'warning' || invoiceScanStatus === 'no_data' ? 'warning' : 'error'}`} role={invoiceScanStatus === 'error' ? 'alert' : 'status'}>{invoiceScanMessage}</p>}
            {selectedInvoiceFile && <>{selectedInvoicePreviewUrl && <img className="invoice-preview" src={selectedInvoicePreviewUrl} alt={t('products.preview')} />}<p><bdi>{t('products.selectedFile', { name: selectedInvoiceFile.name })}</bdi> <button type="button" className="secondary-button" onClick={clearSelectedInvoice}>{t('products.removeFile')}</button></p></>}
            {(existingInvoice || selectedInvoiceFile) && <fieldset className="invoice-action-group"><legend>{t('products.invoiceAction')}</legend>{existingInvoice && <label className="invoice-control" htmlFor="invoice-action-keep"><input id="invoice-action-keep" name="invoice-action" type="radio" checked={invoiceAction === 'keep'} onChange={() => { setInvoiceAction('keep'); }} /> <span>{t('products.keep')}</span></label>}{selectedInvoiceFile && <label className="invoice-control" htmlFor="invoice-action-replace"><input id="invoice-action-replace" name="invoice-action" type="radio" checked={invoiceAction === (existingInvoice ? 'replace' : 'save')} onChange={() => setInvoiceAction(existingInvoice ? 'replace' : 'save')} /> <span>{existingInvoice ? t('products.replace') : t('products.saveInvoice')}</span></label>}{existingInvoice && <label className="invoice-control destructive-control" htmlFor="invoice-action-remove"><input id="invoice-action-remove" name="invoice-action" type="radio" checked={invoiceAction === 'remove'} onChange={() => { clearSelectedInvoice(); setInvoiceAction('remove'); }} /> <span>{t('products.removeInvoice')}</span></label>}</fieldset>}
          </fieldset>
          <label htmlFor="product-name">{t('products.productName')}</label>
          <input id="product-name" name="name" value={form.name} onChange={updateForm} />
          {errors.name && <p className="field-error" role="alert">{errors.name}</p>}
          <label htmlFor="category">{t('products.category')}</label>
          <select id="category" name="category" value={form.category || ''} onChange={updateForm}><option value="" disabled>{t('products.selectCategory')}</option>{!categories.includes(form.category) && form.category && <option value={form.category}>{categoryLabel(form.category)}</option>}{categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}</select>
          {errors.category && <p className="field-error" role="alert">{errors.category}</p>}
          <label htmlFor="storeName">{t('products.storeName')}</label>
          <input id="storeName" name="storeName" value={form.storeName} onChange={updateForm} dir="auto" />
          {errors.storeName && <p className="field-error" role="alert">{errors.storeName}</p>}
          <label htmlFor="purchaseDate">{t('products.purchaseDate')}</label>
          <input id="purchaseDate" name="purchaseDate" type="date" value={form.purchaseDate} onInput={updateForm} onChange={updateForm} />
          {errors.purchaseDate && <p className="field-error" role="alert">{errors.purchaseDate}</p>}
          <label htmlFor="warrantyDuration">{t('products.duration')}</label>
          <input id="warrantyDuration" name="warrantyDuration" type="number" min="1" value={form.warrantyDuration} onChange={updateForm} />
          {errors.warrantyDuration && <p className="field-error" role="alert">{errors.warrantyDuration}</p>}
          <label htmlFor="warrantyUnit">{t('products.unit')}</label>
          <select id="warrantyUnit" name="warrantyUnit" value={form.warrantyUnit} onChange={updateForm}><option value="days">{t('products.daysUnit')}</option><option value="months">{t('products.months')}</option><option value="years">{t('products.years')}</option></select>
          {errors.warrantyUnit && <p className="field-error" role="alert">{errors.warrantyUnit}</p>}
          <fieldset className="invoice-section"><legend>{t('products.reminder')}</legend><label><input type="checkbox" name="reminderEnabled" checked={form.reminderEnabled} onChange={(event) => setForm((current) => ({ ...current, reminderEnabled: event.target.checked, reminderDaysBefore: event.target.checked ? current.reminderDaysBefore : '' }))} /> {t('products.sendReminder')}</label>{errors.reminderEnabled && <p className="field-error" role="alert">{errors.reminderEnabled}</p>}{form.reminderEnabled && <><label htmlFor="reminderDaysBefore">{t('products.remindBefore')}</label><input id="reminderDaysBefore" name="reminderDaysBefore" type="number" min="1" max="3650" step="1" value={form.reminderDaysBefore} onChange={updateForm} /><span>{t('products.daysUnit')}</span>{errors.reminderDaysBefore && <p className="field-error" role="alert">{errors.reminderDaysBefore}</p>}</>}{editingId !== null && deliveryState && <p className="reminder-status">{t('products.delivery', { status: deliveryState.isReminded ? t('common.sent') : t('common.notSent') })}{deliveryState.reminderSentAt ? ` ${t('common.on')} ${formatDisplayDate(deliveryState.reminderSentAt, i18n.language)}` : ''}</p>}</fieldset>
          <label htmlFor="serialNumber">{t('products.serial')}</label>
          <input id="serialNumber" name="serialNumber" value={form.serialNumber} onChange={updateForm} dir="ltr" />
          <label htmlFor="notes">{t('products.notes')}</label>
          <textarea id="notes" name="notes" value={form.notes} onChange={updateForm} />
          <div className="form-actions"><button type="submit" disabled={isSubmitting}>{isSubmitting ? t('products.saving') : t('products.save')}</button><button type="button" className="secondary-button" onClick={closeProductForm} disabled={isSubmitting}>{t('common.cancel')}</button></div>
        </form>
      </section>}

      {!isFormOpen && (isLoading ? <p role="status">{t('products.load')}</p> : products.length === 0 ? <p className="empty-state">{hasAppliedFilters ? t('products.noMatch') : t('products.noProducts')}</p> : <section className="product-grid" aria-label={t('products.yourProducts')}>
        {products.map((product) => <article className="product-card" key={product.id}><LocalizedProductCard product={product} t={t} language={i18n.language} onDetails={onDetails} onEdit={openEditForm} onDelete={(id, opener) => requestDelete(product, opener)} onDownload={downloadInvoice} /></article>)}
      </section>)}
      {!isFormOpen && pagination?.totalPages > 1 && <div className="form-actions"><button type="button" disabled={pagination.page <= 1} onClick={() => changeFilter('page', pagination.page - 1)}>{t('products.previous')}</button><span>{t('products.page', { page: formatDisplayNumber(pagination.page, i18n.language), total: formatDisplayNumber(pagination.totalPages, i18n.language) })}</span><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => changeFilter('page', pagination.page + 1)}>{t('products.next')}</button></div>}
      {productPendingDeletion && <section ref={confirmationDialogRef} className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-product-title" onKeyDown={handleDeleteDialogKeyDown}><div className="confirmation-card"><h2 id="delete-product-title">{t('products.deleteConfirm')}</h2><p dir="auto">{productPendingDeletion.name}</p><div className="form-actions"><button type="button" className="secondary-button" autoFocus onClick={closeDeleteConfirmation}>{t('common.cancel')}</button><button type="button" className="delete-button" onClick={async () => { const id = productPendingDeletion.id; setProductPendingDeletion(null); await deleteProduct(id); }}>{t('common.delete')}</button></div></div></section>}
    </main>
  );
}

export default ProductsPage;
