const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const { errorCode } = require('./services/invoiceVision');

const model = (process.env.GEMINI_MODELS || process.env.GEMINI_INVOICE_MODEL || 'gemini-3.5-flash').split(',')[0].trim();
const body = JSON.stringify({ contents: [{ parts: [{ text: 'Reply with OK.' }] }] });

function requestHealth() {
  return new Promise((resolve, reject) => {
    const request = https.request({ hostname: 'generativelanguage.googleapis.com', path: `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY || '')}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 12000 }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('timeout', () => { const error = new Error('timeout'); error.code = 'AI_TIMEOUT'; request.destroy(error); });
    request.on('error', reject);
    request.end(body);
  });
}

(async () => {
  const started = Date.now();
  try {
    if (!process.env.GEMINI_API_KEY) { const error = new Error('not configured'); error.code = 'AI_UNAVAILABLE'; throw error; }
    const status = await requestHealth();
    if (status < 200 || status >= 300) { const error = new Error('provider response'); error.status = status; throw error; }
    console.log(`Gemini health: success | model: ${model} | http_status: ${status} | elapsed_ms: ${Date.now() - started}`);
  } catch (error) {
    console.error(`Gemini health: failure | code: ${error.code === 'AI_TIMEOUT' ? 'AI_TIMEOUT' : errorCode(error)} | http_status: ${error.status || 'unavailable'} | elapsed_ms: ${Date.now() - started}`);
    process.exitCode = 1;
  }
})();
