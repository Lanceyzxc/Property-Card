function printSelected() {
  const selected = getSelectedCards();
  if (!selected || selected.length === 0) {
    showAlert('No cards selected to print.');
    return;
  }
  printCards(selected);
}

function printCards(cardsToPrint) {
  const cards = cardsToPrint === undefined
    ? Array.from(document.querySelectorAll('.card-ui-wrapper'))
    : Array.from(cardsToPrint || []).filter(Boolean);
  if (cards.length === 0) {
    showAlert('No cards available to print.');
    return;
  }

  document.querySelector('.print-sheet')?.remove();
  const printSheet = document.createElement('div');
  printSheet.className = 'print-sheet';
  const fieldColorMode = localStorage.getItem('fieldColorMode') || 'enhanced';
  printSheet.classList.toggle('field-color-plain', fieldColorMode === 'plain');

  // Keep this page size synchronized with the print CSS grid; changing it can cause cards to overlap or spill onto another sheet.
  cards.forEach((cardWrapper, index) => {
    if (index % 10 === 0) {
      const page = document.createElement('div');
      page.className = 'print-page';
      page.innerHTML = '<div class="print-tags-grid"></div>';
      printSheet.appendChild(page);
    }

    const data = getCardData(cardWrapper);
    const inputs = [
      ['ICS/PAR No.:', data.icsParNo, true],
      ['Property No.:', data.propertyNo, true],
      ['Date Acquired:', data.dateAcquired, true],
      ['Acquisition Cost:', data.acquisitionCost, true],
      ['Fund:', data.fund, false],
      ['Location:', data.endUserLocation, false],
      ['Requested by:', data.requestedBy, false],
      ['Supplier:', data.supplier, false],
      ['P.O/J.O/Contract Ref:', data.reference, false],
      ['Item Description:', data.itemDescription, false]
    ];
    const card = document.createElement('div');
    card.className = 'print-tag-card';
    card.innerHTML = `
      <div class="print-tag-top-bar"></div>
      <div class="print-tag-header"><h1>UCN PROPERTY TAG</h1></div>
      <div class="print-tag-body"><div class="print-qr-box"></div></div>`;
    card.querySelector('.print-tag-header').style.backgroundColor = data.color || '#ffffff';

    const body = card.querySelector('.print-tag-body');
    inputs.forEach(([label, value, shortLine]) => {
      const row = document.createElement('div');
      row.className = 'print-input-row';
      row.innerHTML = `<span class="print-input-label"></span><span class="print-input-line"></span>`;
      row.querySelector('.print-input-label').textContent = label;
      row.querySelector('.print-input-line').textContent = value || '';
      if (shortLine) row.querySelector('.print-input-line').classList.add('print-short-line');
      body.appendChild(row);
    });

    const sourceQr = cardWrapper.querySelector('.qr-box canvas, .qr-box img');
    if (sourceQr) {
      const qrImage = document.createElement('img');
      qrImage.src = sourceQr.tagName === 'CANVAS' ? sourceQr.toDataURL('image/png') : sourceQr.src;
      qrImage.alt = 'QR code';
      card.querySelector('.print-qr-box').appendChild(qrImage);
    }
    printSheet.lastElementChild.querySelector('.print-tags-grid').appendChild(card);
  });

  document.body.appendChild(printSheet);
  window.setTimeout(() => {
    window.print();
    window.setTimeout(() => printSheet.remove(), 250);
  }, 50);
}