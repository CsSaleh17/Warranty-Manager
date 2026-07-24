const { createWorker } = require('tesseract.js');
let workerPromise;
let queue = Promise.resolve();
function worker() { if (!workerPromise) workerPromise = createWorker('ara+eng').catch((error) => { workerPromise = undefined; throw error; }); return workerPromise; }
function recognizeInvoiceText(image) { const task = queue.then(async () => (await (await worker()).recognize(image)).data.text); queue = task.catch(() => undefined); return task; }
async function resetInvoiceOcrWorker() { const activeWorker = await workerPromise; workerPromise = undefined; queue = Promise.resolve(); if (activeWorker) await activeWorker.terminate(); }
module.exports = { recognizeInvoiceText, resetInvoiceOcrWorker };
