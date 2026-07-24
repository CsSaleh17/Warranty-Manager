export function translateApiError(message, t, status) {
  const value = String(message || '').trim().toLowerCase();
  const map = {
    'request origin is not allowed.': 'errors.requestOrigin', unauthorized: 'errors.unauthorized', 'access denied': 'errors.accessDenied',
    'invalid credentials': 'errors.invalidCredentials', 'email or password is incorrect.': 'errors.invalidCredentials', 'email already exists.': 'errors.emailExists', 'product not found': 'errors.productNotFound', 'network error': 'errors.network',
    'server unavailable': 'errors.serverUnavailable', 'failed to load products': 'errors.loadProducts', 'invoice scan failed': 'errors.invoiceScan',
  };
  const key = map[value] || (status === 401 ? 'errors.unauthorized' : status >= 500 ? 'errors.serverUnavailable' : 'errors.unknown');
  return t(key);
}

export function formatDisplayNumber(value, language) {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US').format(Number(value));
}

export function formatDisplayDate(value, language) {
  const raw = String(value || '').slice(0, 10);
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA-u-ca-gregory-nu-arab' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date);
}

export function formatDisplayDateTime(value, language) {
  if (!value) return '';
  const normalized = String(value).trim().replace(' ', 'T');
  const date = new Date(`${normalized}${/[zZ]|[+-]\d\d:?\d\d$/.test(normalized) ? '' : 'Z'}`);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA-u-ca-gregory-nu-arab' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }).format(date);
}

export function formatWarrantyDuration(value, unit, language) {
  const count = Number(value);
  if (!Number.isFinite(count)) return '';
  if (language !== 'ar') {
    const label = unit === 'days' ? 'day' : unit === 'months' ? 'month' : 'year';
    return `${formatDisplayNumber(count, language)} ${label}${count === 1 ? '' : 's'}`;
  }
  const forms = {
    days: ['يوم واحد', 'يومان', 'أيام', 'يوماً', 'يوم'],
    months: ['شهر واحد', 'شهران', 'أشهر', 'شهراً', 'شهر'],
    years: ['سنة واحدة', 'سنتان', 'سنوات', 'سنة', 'سنة'],
  }[unit] || ['يوم واحد', 'يومان', 'أيام', 'يوماً', 'يوم'];
  const lastTwo = Math.abs(count) % 100;
  if (count === 1) return forms[0];
  if (count === 2) return forms[1];
  const label = lastTwo >= 3 && lastTwo <= 10 ? forms[2] : lastTwo >= 11 && lastTwo <= 99 ? forms[3] : forms[4];
  return `${formatDisplayNumber(count, language)} ${label}`;
}
