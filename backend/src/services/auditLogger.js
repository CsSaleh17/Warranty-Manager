function productMutation(event, details = {}) {
  console.info(JSON.stringify({
    type: 'product_mutation_audit',
    event,
    productId: Number(details.productId) || null,
    userId: Number(details.userId) || null,
    outcome: details.outcome || 'unknown',
    timestamp: new Date().toISOString(),
  }));
}

function normalized(value, fallback) {
  const result = typeof value === 'string' ? value.replace(/[^a-z0-9_.:-]/gi, '_').slice(0, 64) : '';
  return result || fallback;
}

function securityEvent(event, details = {}) {
  console.info(JSON.stringify({
    type: 'security_audit',
    event: normalized(event, 'unknown'),
    userId: Number(details.userId) || null,
    outcome: normalized(details.outcome, 'unknown'),
    timestamp: new Date().toISOString(),
  }));
}

module.exports = { productMutation, securityEvent };
