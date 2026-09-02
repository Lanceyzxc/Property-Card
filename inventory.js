const firebaseConfig = {
  apiKey: "AIzaSyA1q2b0fyIidVRspGg31_xF_vpOu8dYRug",
  authDomain: "ucn-property-tag-b7e0a.firebaseapp.com",
  projectId: "ucn-property-tag-b7e0a",
  storageBucket: "ucn-property-tag-b7e0a.firebasestorage.app",
  messagingSenderId: "252936858515",
  appId: "1:252936858515:web:3026ba3bfdb080949ad666",
  measurementId: "G-TSRG9YCCHN"
};

let inventoryRecords = [];
let qrRenderGeneration = 0;
const DEFAULT_PROPERTY_CUSTODIAN = 'Arsenio Gem A. Garcillanosa';

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function inventoryTagSortKey(record) {
  return text(record.savedAt) || text(record.cardId);
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function ensureInventoryTags(records, firestore) {
  const year = String(new Date().getFullYear()).slice(-2);
  const usedNumbers = new Set();

  records.forEach(record => {
    const match = text(record.inventoryTag).match(/^(\d{2})-(\d+)$/);
    if (match && match[1] === year) usedNumbers.add(Number(match[2]));
  });

  let nextNumber = 1;
  const missingRecords = records
    .filter(record => !text(record.inventoryTag))
    .sort((left, right) => inventoryTagSortKey(left).localeCompare(inventoryTagSortKey(right)));

  const batch = firestore.batch();
  missingRecords.forEach(record => {
    while (usedNumbers.has(nextNumber)) nextNumber += 1;
    record.inventoryTag = `${year}-${String(nextNumber).padStart(4, '0')}`;
    usedNumbers.add(nextNumber);
    nextNumber += 1;
    batch.update(firestore.collection('propertyTags').doc(record.cardId), { inventoryTag: record.inventoryTag });
  });

  if (missingRecords.length) await batch.commit();
}

function field(label, value, fieldName, className = '') {
  return `<div class="tag-field ${className}"><span>${label}</span><strong contenteditable="true" role="textbox" spellcheck="false" data-field="${fieldName}">${escapeHtml(value)}</strong></div>`;
}

function getPublicBaseUrl() {
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://ucnprocards.vercel.app';
  const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';

  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return 'https://ucnprocards.vercel.app';
  }

  return origin.replace(/\/$/, '');
}

function getInventoryQrUrl(record) {
  const formName = /SPLV|SPHV/i.test(text(record.propertyNo)) ? 'ics.html' : 'par.html';
  const fallbackUrl = `${getPublicBaseUrl()}/${formName}?id=${encodeURIComponent(record.cardId)}`;

  if (!record || !record.cardId) return fallbackUrl;
  if (!record.qrUrl) return fallbackUrl;

  try {
    const url = new URL(record.qrUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '0.0.0.0') {
      return fallbackUrl;
    }
    return record.qrUrl;
  } catch (error) {
    return fallbackUrl;
  }
}

function renderInventoryQRCodes() {
  if (!window.QRCode) return Promise.resolve();
  const generation = ++qrRenderGeneration;
  const containers = [...document.querySelectorAll('.inventory-qr')];
  let position = 0;

  return new Promise(resolve => {
    function renderNextBatch() {
      if (generation !== qrRenderGeneration) {
        resolve();
        return;
      }
    const batchEnd = Math.min(position + 8, containers.length);
    for (; position < batchEnd; position += 1) {
      const container = containers[position];
      const index = Number(container.closest('.inventory-tag-wrap').dataset.recordIndex);
      const record = inventoryRecords[index];
      if (!record) continue;
      container.innerHTML = '';
      new QRCode(container, {
        text: getInventoryQrUrl(record),
        width: 64,
        height: 64,
        correctLevel: QRCode.CorrectLevel.M
      });
    }
      if (position < containers.length) {
        window.requestAnimationFrame(renderNextBatch);
      } else {
        resolve();
      }
    }

    window.requestAnimationFrame(renderNextBatch);
  });
}

function renderTags() {
  const grid = document.getElementById('inventory-grid');
  const query = document.getElementById('inventory-search').value.trim().toLowerCase();
  const department = document.getElementById('inventory-department').value;
  const records = inventoryRecords.filter(record => {
    const haystack = [record.itemDescription, record.propertyNo, record.serialNo, record.dept, record.endUserLocation]
      .map(text).join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (department === 'ALL' || record.dept === department);
  });

  grid.classList.remove('is-loading');
  grid.setAttribute('aria-busy', 'false');

  document.getElementById('inventory-count').textContent = records.length;
  document.getElementById('inventory-visible-count').textContent = records.length;
  if (!records.length) {
    grid.innerHTML = '<div class="empty-inventory">No inventory tags found.</div>';
    return;
  }

  grid.innerHTML = records.map((record) => `
    <article class="inventory-tag-wrap" data-record-index="${inventoryRecords.indexOf(record)}">
      <label class="tag-select"><input type="checkbox" class="tag-checkbox"><span>Select</span></label>
      <div class="inventory-card">
        <div class="inventory-header">
          <div class="inventory-logo"><img src="ucn.png" alt="UCN logo"></div>
          <div class="inventory-qr" aria-label="QR code for property record"></div>
          <div class="inventory-title">
            <h3>GOVERNMENT PROPERTY</h3>
            <div class="office-line" contenteditable="true" role="textbox" spellcheck="false" data-field="dept">${escapeHtml(record.dept)}</div>
            <small>Office/Location</small>
          </div>
          <div class="inventory-number">
            <div class="inventory-no-value"><span>No.</span><strong contenteditable="true" role="textbox" spellcheck="false" data-field="inventoryTag">${escapeHtml(record.inventoryTag)}</strong></div>
            <small>Inventory Tag</small>
          </div>
        </div>
        <div class="tag-fields">
          ${field('Article', record.itemDescription, 'itemDescription', 'full')}
          ${field('Property No.', record.propertyNo, 'propertyNo')}
          ${field('Serial No.', record.serialNo, 'serialNo')}
          ${field('Serviceable', record.serviceable, 'serviceable')}
          ${field('Unserviceable', record.unserviceable, 'unserviceable')}
          ${field('Unit/Quantity', record.unitQuantity || `${text(record.quantity)} ${text(record.unit)}`.trim(), 'unitQuantity')}
          ${field('Acquisition Cost', record.acquisitionCost, 'acquisitionCost')}
        </div>
        <div class="tag-dates">
          ${field('Date (Acquired)', record.dateAcquired, 'dateAcquired')}
          ${field('Date (Counted)', record.dateCounted, 'dateCounted')}
        </div>
        <div class="tag-signatures">
          ${field('COA Representative', record.coaRepresentative, 'coaRepresentative')}
          ${field('Property Custodian', record.propertyCustodian || DEFAULT_PROPERTY_CUSTODIAN, 'propertyCustodian')}
        </div>
      </div>
    </article>
  `).join('');
  setupInventoryEditing();
  fitSignatureNames();
  renderInventoryQRCodes();
}

function getSelectedInventoryCards() {
  const selectedEntries = [...document.querySelectorAll('.inventory-tag-wrap')]
    .filter((wrap) => wrap.querySelector('.tag-checkbox')?.checked)
    .map((wrap) => inventoryRecords[Number(wrap.dataset.recordIndex)])
    .filter(Boolean);
  return selectedEntries;
}

function hasVisibleInventoryQr(record) {
  const index = inventoryRecords.findIndex(item => item.cardId === record.cardId);
  if (index === -1) return false;

  const liveTag = document.querySelector(`.inventory-tag-wrap[data-record-index="${index}"]`);
  if (!liveTag) return false;

  return !!liveTag.querySelector('.inventory-qr img, .inventory-qr canvas');
}

function buildInventoryPrintPage(records) {
  const page = document.createElement('div');
  page.className = 'inventory-print-page';

  records.forEach((record) => {
    const container = document.createElement('div');
    container.className = 'inventory-print-card-container';

    const scaler = document.createElement('div');
    scaler.className = 'inventory-print-card-scaler';

    const card = document.createElement('div');
    card.className = 'inventory-print-card';

    const hasQr = hasVisibleInventoryQr(record);

    const header = document.createElement('div');
    header.className = 'inventory-print-header';
    header.innerHTML = `
      <div class="inventory-print-header-left"><img src="ucn.png" alt="UCN Logo"></div>
      <div class="inventory-print-header-center">
        <div class="inventory-print-main-title">GOVERNMENT PROPERTY</div>
        <div class="inventory-print-office-block">
          <div class="inventory-print-office-val">${escapeHtml(record.dept || 'GASS')}</div>
          <div class="inventory-print-office-line"></div>
          <div class="inventory-print-office-label">Office/Location</div>
        </div>
      </div>
      <div class="inventory-print-header-right">
        <div class="inventory-print-qr-wrapper">
          <div class="inventory-print-tag-number"><span class="inventory-print-no-text">No.</span><span class="inventory-print-no-val">${escapeHtml(record.inventoryTag || '')}</span></div>
          <div class="inventory-print-tag-label">Inventory Tag</div>
          ${hasQr ? '<div class="inventory-print-qr-box"></div>' : ''}
        </div>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'inventory-print-body-section';

    const addField = (label, value) => {
      const row = document.createElement('div');
      row.className = 'inventory-print-form-row';
      row.innerHTML = `<span class="inventory-print-label">${label}</span><div class="inventory-print-input-line">${escapeHtml(value || '')}</div>`;
      return row;
    };

    const fieldPair = (leftLabel, leftValue, rightLabel, rightValue) => {
      const row = document.createElement('div');
      row.className = 'inventory-print-split-row';

      const left = document.createElement('div');
      left.className = 'inventory-print-split-col';
      left.innerHTML = `<span class="inventory-print-label">${leftLabel}</span><div class="inventory-print-input-line">${escapeHtml(leftValue || '')}</div>`;

      const right = document.createElement('div');
      right.className = 'inventory-print-split-col';
      right.innerHTML = `<span class="inventory-print-label">${rightLabel}</span><div class="inventory-print-input-line">${escapeHtml(rightValue || '')}</div>`;

      row.append(left, right);
      return row;
    };

    body.append(
      addField('Article', record.itemDescription || ''),
      fieldPair('Property No.', record.propertyNo, 'Serial No.', record.serialNo),
      fieldPair('Serviceable', record.serviceable, 'Unserviceable', record.unserviceable),
      fieldPair('Unit/Quantity', record.unitQuantity || `${text(record.quantity)} ${text(record.unit)}`.trim(), 'Acquisition Cost', record.acquisitionCost)
    );

    const footer = document.createElement('div');
    footer.className = 'inventory-print-footer-section';
    footer.innerHTML = `
      <div class="inventory-print-footer-row">
        <div class="inventory-print-sig-block">
          <div class="inventory-print-sig-val">${escapeHtml(record.dateAcquired || '')}</div>
          <div class="inventory-print-sig-line"></div>
          <div class="inventory-print-sig-label">Date (Acquired)</div>
        </div>
        <div class="inventory-print-sig-block">
          <div class="inventory-print-sig-val">${escapeHtml(record.dateCounted || '')}</div>
          <div class="inventory-print-sig-line"></div>
          <div class="inventory-print-sig-label">Date (Counted)</div>
        </div>
      </div>
      <div class="inventory-print-footer-row">
        <div class="inventory-print-sig-block">
          <div class="inventory-print-sig-val">${escapeHtml(record.coaRepresentative || '')}</div>
          <div class="inventory-print-sig-line"></div>
          <div class="inventory-print-sig-label">COA Representative</div>
        </div>
        <div class="inventory-print-sig-block">
          <div class="inventory-print-sig-val">${escapeHtml(record.propertyCustodian || DEFAULT_PROPERTY_CUSTODIAN)}</div>
          <div class="inventory-print-sig-line"></div>
          <div class="inventory-print-sig-label">Property Custodian</div>
        </div>
      </div>
    `;

    card.append(header, body, footer);
    scaler.appendChild(card);
    container.appendChild(scaler);
    page.appendChild(container);

    const qrBox = card.querySelector('.inventory-print-qr-box');
    if (qrBox) {
      const liveTag = document.querySelector(`.inventory-tag-wrap[data-record-index="${inventoryRecords.findIndex(item => item.cardId === record.cardId)}"]`);
      const liveQr = liveTag?.querySelector('.inventory-qr img, .inventory-qr canvas');

      if (liveQr) {
        const image = document.createElement('img');
        image.alt = 'QR code';

        if (liveQr.tagName === 'CANVAS') {
          image.src = liveQr.toDataURL('image/png');
        } else {
          image.src = liveQr.src;
        }

        qrBox.appendChild(image);
      } else {
        const qrUrl = getInventoryQrUrl(record);
        const qrImage = document.createElement('img');
        qrImage.alt = 'QR code';
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`;
        qrBox.appendChild(qrImage);
      }
    }
  });

  return page;
}

function getVisibleInventoryCards() {
  return [...document.querySelectorAll('.inventory-tag-wrap')]
    .map((wrap) => inventoryRecords[Number(wrap.dataset.recordIndex)])
    .filter(Boolean);
}

function printVisibleInventory() {
  const visible = getVisibleInventoryCards();
  if (!visible.length) {
    const showAlert = window.showAlert || (() => alert('No inventory tags are visible to print.'));
    showAlert('No inventory tags are visible to print.');
    return;
  }

  const sheet = document.createElement('div');
  sheet.className = 'inventory-print-sheet';

  const pageSize = 10;
  for (let index = 0; index < visible.length; index += pageSize) {
    const page = buildInventoryPrintPage(visible.slice(index, index + pageSize));
    sheet.appendChild(page);
  }

  document.body.appendChild(sheet);
  window.setTimeout(() => {
    window.print();
    window.setTimeout(() => sheet.remove(), 400);
  }, 100);
}

function printSelectedInventory() {
  const selected = getSelectedInventoryCards();
  if (!selected.length) {
    const showAlert = window.showAlert || (() => alert('No inventory tags selected to print.'));
    showAlert('No inventory tags selected to print.');
    return;
  }

  const sheet = document.createElement('div');
  sheet.className = 'inventory-print-sheet';

  const pageSize = 10;
  for (let index = 0; index < selected.length; index += pageSize) {
    const page = buildInventoryPrintPage(selected.slice(index, index + pageSize));
    sheet.appendChild(page);
  }

  document.body.appendChild(sheet);
  window.setTimeout(() => {
    window.print();
    window.setTimeout(() => sheet.remove(), 400);
  }, 100);
}

function setupInventoryEditing() {
  document.querySelectorAll('[contenteditable="true"][data-field]').forEach(element => {
    element.addEventListener('input', () => {
      if (element.closest('.tag-signatures')) fitSignatureNames();
    });
    element.addEventListener('blur', () => {
      const wrap = element.closest('.inventory-tag-wrap');
      const record = inventoryRecords[Number(wrap.dataset.recordIndex)];
      const fieldName = element.dataset.field;
      if (!record || !fieldName) return;

      const value = element.textContent.trim();
      if (fieldName === 'unitQuantity') {
        record.unitQuantity = value;
      } else {
        record[fieldName] = value;
      }

      firebase.firestore().collection('propertyTags').doc(record.cardId).update({ [fieldName]: value })
        .catch(error => console.error('Inventory tag save error:', error));
    });
  });
}

function fitSignatureNames() {
  document.querySelectorAll('.tag-signatures [contenteditable="true"]').forEach(element => {
    element.style.fontSize = '';
    while (element.scrollWidth > element.clientWidth && parseFloat(getComputedStyle(element).fontSize) > 7) {
      element.style.fontSize = `${parseFloat(getComputedStyle(element).fontSize) - 0.5}px`;
    }
  });
}

function populateDepartments() {
  const select = document.getElementById('inventory-department');
  [...new Set(inventoryRecords.map(record => record.dept).filter(Boolean))].sort().forEach(dept => {
    const option = document.createElement('option');
    option.value = dept;
    option.textContent = dept;
    select.appendChild(option);
  });
}

function startInventory() {
  firebase.initializeApp(firebaseConfig);
  firebase.firestore().collection('propertyTags').onSnapshot(async snapshot => {
    inventoryRecords = snapshot.docs.map(doc => ({ cardId: doc.id, ...doc.data() }));
    const select = document.getElementById('inventory-department');
    select.innerHTML = '<option value="ALL">All Departments</option>';
    populateDepartments();
    renderTags();

    // The UI should not wait for automatic tag-number persistence.
    await ensureInventoryTags(inventoryRecords, firebase.firestore());
  }, error => {
    console.error(error);
    const grid = document.getElementById('inventory-grid');
    grid.classList.remove('is-loading');
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = '<div class="empty-inventory">Unable to load inventory tags.</div>';
  });

  document.getElementById('inventory-search').addEventListener('input', renderTags);
  document.getElementById('inventory-department').addEventListener('change', renderTags);
  document.getElementById('select-all').addEventListener('click', () => {
    const checks = document.querySelectorAll('.tag-checkbox');
    const shouldSelect = [...checks].some(check => !check.checked);
    checks.forEach(check => { check.checked = shouldSelect; });
  });

  const sidebarPrintButton = document.getElementById('inventory-print-sidebar');
  if (sidebarPrintButton) sidebarPrintButton.addEventListener('click', printVisibleInventory);
  document.getElementById('print-selected').addEventListener('click', printSelectedInventory);
}

document.addEventListener('DOMContentLoaded', startInventory);
