import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDisplayDate, formatDisplayDateTime, formatDisplayNumber, formatWarrantyDuration } from './localization.js';

function ProductDetailsPage({ productId, onBack, onEdit }) {
  const { t, i18n } = useTranslation();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products/${productId}`, { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        const contentType = response.headers?.get?.('content-type') || '';
        const data = contentType.includes('application/json') || !response.headers ? await response.json() : {};
        if (!response.ok) throw new Error(response.status === 404 ? t('errors.productNotFound') : t('detailsPage.loadError'));
        setProduct(data.product);
      })
      .catch((cause) => { if (cause.name !== 'AbortError') setError(cause.message || t('detailsPage.loadError')); });
    return () => controller.abort();
  }, [productId, t]);

  if (error) return <main className="products-page"><p role="alert" className="error">{error}</p><button onClick={onBack}>{t('detailsPage.back')}</button></main>;
  if (!product) return <main className="products-page"><p role="status">{t('detailsPage.loading')}</p></main>;

  const language = i18n.language;
  const days = Number(product.remainingWarrantyDays);
  const remaining = days < 0 ? t('products.expiredAgo', { count: formatDisplayNumber(Math.abs(days), language) }) : t('products.remainingDays', { count: formatDisplayNumber(days, language) });
  const status = t(`status.${product.warrantyStatus}`, { defaultValue: product.warrantyStatus });
  const category = t(`categories.${product.category}`, { defaultValue: product.category });
  const reminderTiming = product.reminderDaysBefore ? formatWarrantyDuration(product.reminderDaysBefore, 'days', language) : '';
  const reminder = product.reminderEnabled ? <>{t('detailsPage.enabled')}{reminderTiming ? ` (${t('detailsPage.beforeDuration', { duration: reminderTiming })})` : ''}{product.isReminded ? <> — {t('detailsPage.sent')}{product.reminderSentAt ? <> {t('common.on')} <bdi>{formatDisplayDateTime(product.reminderSentAt, language)}</bdi></> : ''}</> : ''}</> : t('detailsPage.disabled');

  return <main className="products-page product-details-page">
    <button type="button" className="secondary-button" onClick={onBack}>{t('detailsPage.back')}</button>
    <h1 dir="auto">{product.name}</h1>
    <p><strong>{status}</strong> · <span>{remaining}</span></p>
    <section className="product-form-card">
      <h2>{t('detailsPage.title')}</h2>
      <p><strong>{t('detailsPage.category')}</strong> {category}</p>
      <p><strong>{t('detailsPage.store')}</strong> <bdi>{product.storeName}</bdi></p>
      <p><strong>{t('detailsPage.purchaseDate')}</strong> <bdi>{formatDisplayDate(product.purchaseDate, language)}</bdi></p>
      <p><strong>{t('detailsPage.serial')}</strong> <bdi>{product.serialNumber || t('detailsPage.notProvided')}</bdi></p>
      <p><strong>{t('detailsPage.warranty')}</strong> {formatWarrantyDuration(product.warrantyDuration, product.warrantyUnit, language)}</p>
      <p><strong>{t('detailsPage.expires')}</strong> <bdi>{product.expirationDate ? formatDisplayDate(product.expirationDate, language) : t('detailsPage.unknown')}</bdi></p>
      <p><strong>{t('detailsPage.reminder')}</strong> {reminder}</p>
      <p><strong>{t('detailsPage.notes')}</strong> <span dir="auto">{product.notes || t('detailsPage.none')}</span></p>
    </section>
    <section className="product-form-card"><h2>{t('detailsPage.invoice')}</h2>{product.hasInvoice ? <><p dir="auto">{product.invoiceFileName}</p><a href={product.invoiceViewUrl} target="_blank" rel="noreferrer">{t('detailsPage.viewInvoice')}</a>{' · '}<a href={product.invoiceDownloadUrl}>{t('detailsPage.downloadInvoice')}</a></> : <p>{t('detailsPage.noInvoice')}</p>}</section>
    <button type="button" onClick={() => onEdit(product)}>{t('detailsPage.edit')}</button>
  </main>;
}

export default ProductDetailsPage;
