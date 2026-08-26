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

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function inventoryTagSortKey(record) {
  return text(record.savedAt) || text(record.cardId);
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

function field(label, value, className = '') {
  return `<div class="tag-field ${className}"><span>${label}</span><strong>${text(value) || '\u00a0'}</strong></div>`;
}

function getInventoryQrUrl(record) {
  if (record.qrUrl) return record.qrUrl;
  const formName = /SPLV|SPHV/i.test(text(record.propertyNo)) ? 'ics.html' : 'par.html';
  return `${window.location.origin}/${formName}?id=${encodeURIComponent(record.cardId)}`;
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
  if (!records.length) {
    grid.innerHTML = '<div class="empty-inventory">No inventory tags found.</div>';
    return;
  }

  grid.innerHTML = records.map((record, index) => `
    <article class="inventory-tag-wrap" data-record-index="${inventoryRecords.indexOf(record)}">
      <label class="tag-select"><input type="checkbox" class="tag-checkbox"><span>Select</span></label>
      <div class="inventory-card">
        <div class="inventory-header">
          <div class="inventory-logo"><img src="ucn.png" alt="UCN logo"></div>
          <div class="inventory-qr" aria-label="QR code for property record"></div>
          <div class="inventory-title">
            <h3>GOVERNMENT PROPERTY</h3>
            <div class="office-line">${text(record.dept) || '&nbsp;'}</div>
            <small>Office/Location</small>
          </div>
          <div class="inventory-number">
            <div class="inventory-no-value"><span>No.</span><strong>${text(record.inventoryTag)}</strong></div>
            <small>Inventory Tag</small>
          </div>
        </div>
        <div class="tag-fields">
          ${field('Article', record.itemDescription, 'full')}
          ${field('Property No.', record.propertyNo)}
          ${field('Serial No.', record.serialNo)}
          ${field('Serviceable', record.serviceable)}
          ${field('Unserviceable', record.unserviceable)}
          ${field('Unit/Quantity', `${text(record.quantity)} ${text(record.unit)}`)}
          ${field('Acquisition Cost', record.acquisitionCost)}
        </div>
        <div class="tag-dates">
          ${field('Date (Acquired)', record.dateAcquired)}
          ${field('Date (Counted)', record.dateCounted)}
        </div>
        <div class="tag-signatures">
          ${field('COA Representative', '')}
          ${field('Property Custodian', '')}
        </div>
      </div>
    </article>
  `).join('');
  renderInventoryQRCodes();
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

async function printInventory(selectedOnly) {
  await renderInventoryQRCodes();
  const wraps = [...document.querySelectorAll('.inventory-tag-wrap')].filter(wrap => {
    return !selectedOnly || wrap.querySelector('.tag-checkbox').checked;
  });
  if (!wraps.length) {
    window.alert(selectedOnly ? 'Select at least one inventory tag to print.' : 'No inventory tags available to print.');
    return;
  }
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`<!DOCTYPE html><html><head><title>Inventory Tags</title><link rel="stylesheet" href="inventory.css?v=20260826.1"><style>body{background:#fff!important}.inventory-sidebar,.inventory-toolbar,.tag-select{display:none!important}.inventory-main{padding:0!important}.inventory-grid{display:grid!important;gap:0.08in!important}.inventory-card{box-shadow:none!important}</style></head><body><main class="inventory-main"><section class="inventory-grid">${wraps.map(wrap => wrap.querySelector('.inventory-card').outerHTML).join('')}</section></main></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => { printWindow.print(); printWindow.close(); };
}

function startInventory() {
  firebase.initializeApp(firebaseConfig);
  firebase.firestore().collection('propertyTags').onSnapshot(async snapshot => {
    inventoryRecords = snapshot.docs.map(doc => ({ cardId: doc.id, ...doc.data() }));
    const select = document.getElementById('inventory-department');
    select.innerHTML = '<option value="ALL">All Departments</option>';
    populateDepartments();
    renderTags();
    document.getElementById('inventory-status').textContent = `${inventoryRecords.length} saved tag${inventoryRecords.length === 1 ? '' : 's'}`;

    // The UI should not wait for automatic tag-number persistence.
    await ensureInventoryTags(inventoryRecords, firebase.firestore());
  }, error => {
    console.error(error);
    const grid = document.getElementById('inventory-grid');
    grid.classList.remove('is-loading');
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = '<div class="empty-inventory">Unable to load inventory tags.</div>';
    document.getElementById('inventory-status').textContent = 'Unable to load inventory tags.';
  });

  document.getElementById('inventory-search').addEventListener('input', renderTags);
  document.getElementById('inventory-department').addEventListener('change', renderTags);
  document.getElementById('print-inventory').addEventListener('click', () => printInventory(false));
  document.getElementById('print-selected').addEventListener('click', () => printInventory(true));
  document.getElementById('select-all').addEventListener('click', () => {
    const checks = document.querySelectorAll('.tag-checkbox');
    const shouldSelect = [...checks].some(check => !check.checked);
    checks.forEach(check => { check.checked = shouldSelect; });
  });
}

document.addEventListener('DOMContentLoaded', startInventory);
