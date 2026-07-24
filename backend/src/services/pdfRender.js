async function renderPdfPages(buffer, maxPages = 2) {
  const { pdf } = await import('pdf-to-img');
  const document = await pdf(`data:application/pdf;base64,${buffer.toString('base64')}`, { scale: 2 });
  try {
    const pages = [];
    for (let page = 1; page <= Math.min(document.length, maxPages); page += 1) pages.push(await document.getPage(page));
    return pages;
  } finally {
    document.destroy();
  }
}

module.exports = { renderPdfPages };
