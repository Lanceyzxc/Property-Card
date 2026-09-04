const departments = [
  { name: "GASS", color: "#9a0603" },
  { name: "COTT", color: "#8c52ff" },
  { name: "CFAST", color: "#38b6ff" },
  { name: "CCMS", color: "#737373" },
  { name: "COED", color: "#004aad" },
  { name: "IABD", color: "#ff751f" },
  { name: "CBPA", color: "#faf901" },
  { name: "CANR", color: "#499632" },
  { name: "COENG", color: "#ffde59" },
  { name: "CAS", color: "#ff3131" }
];

// Map to your default layout (1st row left GASS, right COTT, etc.)
const defaultLayout = [
  "#9a0603", "#8c52ff", // Row 1
  "#38b6ff", "#737373", // Row 2
  "#004aad", "#ff751f", // Row 3
  "#faf901", "#499632", // Row 4
  "#ffde59", "#ff3131"  // Row 5
];

let totalCardCount = 0;
let uniqueCardId = 0;
let allCards = [];
let firebaseFirestore = null;
let firebaseInitialized = false;
let deferCardQrRendering = false;
let cardQrObserver = null;

function getPublicBaseUrl() {
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://ucnprocards.vercel.app';
  const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';

  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return 'https://ucnprocards.vercel.app';
  }

  return origin.replace(/\/$/, '');
}

function finishMainLoading() {
  const container = document.getElementById('pages-container');
  if (!container) return;
  container.querySelectorAll('.main-loading-card').forEach((loadingCard) => loadingCard.remove());
  container.classList.remove('is-loading');
  container.setAttribute('aria-busy', 'false');
}

function renderLoadedCardQRCodes() {
  if (!('IntersectionObserver' in window)) {
    allCards.slice(0, 20).forEach(renderCardQRCode);
    return;
  }

  if (!cardQrObserver) {
    cardQrObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        renderCardQRCode(entry.target);
        observer.unobserve(entry.target);
      });
    }, { root: document.getElementById('pages-container'), rootMargin: '800px 0px' });
  }

  allCards.forEach((card) => {
    if (!card.querySelector('.qr-box img, .qr-box canvas')) cardQrObserver.observe(card);
  });
}

const firebaseConfig = {
  apiKey: "AIzaSyA1q2b0fyIidVRspGg31_xF_vpOu8dYRug",
  authDomain: "ucn-property-tag-b7e0a.firebaseapp.com",
  projectId: "ucn-property-tag-b7e0a",
  storageBucket: "ucn-property-tag-b7e0a.firebasestorage.app",
  messagingSenderId: "252936858515",
  appId: "1:252936858515:web:3026ba3bfdb080949ad666",
  measurementId: "G-TSRG9YCCHN"
};

function updateFirebaseStatus(message, color = "#004aad") {
  const statusEl = document.getElementById('firebase-status');
  if (!statusEl) return;
  statusEl.style.color = color;
  statusEl.innerText = message;
}

function showModal({ title = 'Notice', message = '', confirmText = 'OK', cancelText = 'Cancel', showCancel = false }) {
  const overlay = document.getElementById('app-modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const messageEl = document.getElementById('modal-message');
  const confirmBtn = document.getElementById('modal-confirm');
  const cancelBtn = document.getElementById('modal-cancel');

  if (!overlay || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
    return Promise.resolve(false);
  }

  titleEl.innerText = title;
  messageEl.innerText = message;
  confirmBtn.innerText = confirmText;
  cancelBtn.innerText = cancelText;
  cancelBtn.style.display = showCancel ? 'inline-flex' : 'none';
  overlay.classList.remove('hidden');

  return new Promise((resolve) => {
    function cleanup() {
      overlay.classList.add('hidden');
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    }

    function handleConfirm() {
      cleanup();
      resolve(true);
    }

    function handleCancel() {
      cleanup();
      resolve(false);
    }

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

function showAlert(message, title = 'Notice') {
  showModal({ title, message, confirmText: 'OK', showCancel: false });
}

function showConfirm(message, title = 'Confirm') {
  return showModal({ title, message, confirmText: 'Yes', cancelText: 'No', showCancel: true });
}

function setDeleteLoadingState(isLoading) {
  const overlay = document.getElementById('delete-loading-overlay');
  if (!overlay) return;

  document.body.classList.toggle('delete-loading', isLoading);
  overlay.classList.toggle('hidden', !isLoading);
  overlay.classList.toggle('visible', isLoading);
}

function initializeFirebase() {
  if (!window.firebase || !firebase.initializeApp) {
    updateFirebaseStatus("Firebase SDK not loaded", "#9a0603");
    return;
  }

  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    updateFirebaseStatus("Add Firebase config values in main.js", "#9a0603");
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    firebaseFirestore = firebase.firestore();
    firebaseInitialized = true;
    updateFirebaseStatus("Firestore ready. Edits will auto-save.", "#499632");
  } catch (err) {
    console.error('Firebase init error', err);
    updateFirebaseStatus("Firestore initialization failed", "#9a0603");
  }
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function getCardData(cardWrapper) {
  const cardId = cardWrapper.dataset.cardId || '';
  const deptSelect = cardWrapper.querySelector('.dept-select');
  const dept = deptSelect ? deptSelect.options[deptSelect.selectedIndex]?.text.trim() : '';
  const color = deptSelect ? deptSelect.value : departments[0].color;
  const inputs = cardWrapper.querySelectorAll('.underline-input');
  const quantity = cardWrapper.dataset.quantity || '';
  const unit = cardWrapper.dataset.unit || '';
  const fullItemDescription = cardWrapper.dataset.itemDescriptionRaw || '';
  const fullReference = cardWrapper.dataset.referenceRaw || '';

  return {
    cardId,
    dept,
    color,
    quantity: quantity || '1',
    unit: unit || 'pc',
    icsParNo: inputs[0] ? inputs[0].value.trim() : '',
    propertyNo: inputs[1] ? inputs[1].value.trim() : '',
    serialNo: cardWrapper.dataset.serialNo || '',
    serviceable: cardWrapper.dataset.serviceable || '',
    unserviceable: cardWrapper.dataset.unserviceable || '',
    dateCounted: cardWrapper.dataset.dateCounted || '',
    dateAcquired: inputs[2] ? inputs[2].value.trim() : '',
    acquisitionCost: inputs[3] ? inputs[3].value.trim() : '',
    fund: inputs[4] ? inputs[4].value.trim() : '',
    endUserLocation: inputs[5] ? inputs[5].value.trim() : '',
    requestedBy: inputs[6] ? inputs[6].value.trim() : '',
    supplier: inputs[7] ? inputs[7].value.trim() : '',
    reference: fullReference || (inputs[8] ? inputs[8].value.trim() : ''),
    itemDescription: fullItemDescription || (inputs[9] ? inputs[9].value.trim() : ''),
    quantity: cardWrapper.dataset.quantity || '1',
    unit: cardWrapper.dataset.unit || 'pc',
    savedAt: new Date().toISOString()
  };
}

function getFormPath(propertyNo) {
  const normalizedPropertyNo = String(propertyNo || '').toUpperCase();
  return normalizedPropertyNo.includes('SPLV') || normalizedPropertyNo.includes('SPHV')
    ? 'ics.html'
    : 'par.html';
}

function saveCardToFirebase(cardWrapper) {
  if (!firebaseInitialized || !firebaseFirestore) return;
  if (!cardWrapper) return;

  const data = getCardData(cardWrapper);
  const hasContent = Object.keys(data).some(key => key !== 'savedAt' && data[key]);
  if (!hasContent) return;

  const cardId = data.cardId || `card-${Math.random().toString(36).substring(2, 10)}`;
  data.cardId = cardId;
  // Persist a short QR URL using the public app origin so mobile scans resolve reliably
  try {
    const baseToUse = getPublicBaseUrl();
    data.qrUrl = `${baseToUse.replace(/\/$/, '')}/${getFormPath(data.propertyNo)}?id=${encodeURIComponent(cardId)}`;
  } catch (e) {
    data.qrUrl = '';
  }
  const cardDoc = firebaseFirestore.collection('propertyTags').doc(cardId);
  cardDoc.set(data)
    .then(() => {
      cardWrapper.dataset.cardId = cardId;
      if (!deferCardQrRendering) {
        if (cardQrObserver) cardQrObserver.observe(cardWrapper);
        else renderCardQRCode(cardWrapper);
      }
      updateFirebaseStatus(`Saved card ${cardId}`, "#499632");
    })
    .catch((err) => {
      console.error('Firestore save error', err);
      updateFirebaseStatus(`Save failed for card ${cardId}`, "#9a0603");
    });
}

// Regeneration button and optional public base URL were removed.
// QR URLs are auto-generated from window.location.origin on save and render.

function setupFirebaseAutoSave(cardWrapper) {
  if (!cardWrapper) return;
  const inputs = cardWrapper.querySelectorAll('.underline-input');
  const selects = cardWrapper.querySelectorAll('.dept-select');
  const saveOnChange = debounce(() => saveCardToFirebase(cardWrapper), 300);

  inputs.forEach(input => {
    input.addEventListener('input', () => {
      if (input.classList.contains('auto-resize')) {
        cardWrapper.dataset.itemDescriptionRaw = input.value;
      }
      saveOnChange();
      renderCardQRCode(cardWrapper);
    });
    input.addEventListener('change', () => {
      if (input.classList.contains('auto-resize')) {
        cardWrapper.dataset.itemDescriptionRaw = input.value;
      }
      saveOnChange();
      renderCardQRCode(cardWrapper);
    });
  });

  selects.forEach(select => {
    select.addEventListener('change', () => {
      saveOnChange();
      renderCardQRCode(cardWrapper);
    });
  });
}

function renderCardQRCode(cardWrapper) {
  if (!window.QRCode) {
    return;
  }
  const qrContainer = cardWrapper.querySelector('.qr-box');
  if (!qrContainer) return;
  qrContainer.innerHTML = '';

  const payload = collectCardPayload(cardWrapper);
  if (!payload) return;

  // Use a short payload only (prefer full URL) to avoid QR code "code length overflow" errors
  const shortText = payload.url || (payload.cardId ? `${getPublicBaseUrl()}${window.location.pathname}?id=${encodeURIComponent(payload.cardId)}` : payload.cardId || '');
  if (!shortText) return;

  try {
    // Use medium error correction to fit more data in small symbols when necessary
    new QRCode(qrContainer, {
      text: shortText,
      width: 86,
      height: 86,
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (err) {
    qrContainer.innerHTML = '<span style="font-size:10px; color:#900;">QR failed</span>';
    console.warn('QR render error', err);
  }
}

function collectCardPayload(cardWrapper) {
  if (!cardWrapper) return null;
  const data = getCardData(cardWrapper);
  // include card id and link for QR scanning if saved
  const payload = {
    cardId: data.cardId || '',
    icsParNo: data.icsParNo || '',
    propertyNo: data.propertyNo || '',
    dateAcquired: data.dateAcquired || '',
    acquisitionCost: data.acquisitionCost || '',
    fund: data.fund || '',
    endUserLocation: data.endUserLocation || '',
    requestedBy: data.requestedBy || '',
    supplier: data.supplier || '',
    reference: data.reference || '',
    itemDescription: data.itemDescription || '',
    quantity: data.quantity || '1',
    unit: data.unit || 'pc'
  };
  if (data.cardId) {
    const baseToUse = getPublicBaseUrl();
    payload.url = `${baseToUse.replace(/\/$/, '')}/${getFormPath(data.propertyNo)}?id=${encodeURIComponent(data.cardId)}`;
  }
  return payload;
}

function generateOptions(selectedColor) {
  let optionsHtml = '';
  departments.forEach(dept => {
    const isSelected = dept.color === selectedColor ? 'selected' : '';
    optionsHtml += `<option value="${dept.color}" ${isSelected}>${dept.name}</option>`;
  });
  return optionsHtml;
}

function addNewCards() {
  const qty = parseInt(document.getElementById('add-qty').value) || 1;
  const color = document.getElementById('add-dept-select').value;
  for(let i = 0; i < qty; i++) {
    createSingleCard(color);
  }
  applyFilter();
  refreshDashboardSummary();
  closeAddPanel();
}

function toggleAddPanel() {
  const panel = document.getElementById('add-panel');
  const selectPanel = document.getElementById('select-panel');
  if (!panel) return;
  if (selectPanel) {
    selectPanel.classList.remove('open');
  }
  const willOpen = !panel.classList.contains('open');
  panel.classList.toggle('open');
  // Toggle a class on the floating container so we can animate the FAB
  const container = document.querySelector('.add-card-floating');
  if (container) container.classList.toggle('open', willOpen);
}

function closeAddPanel() {
  const panel = document.getElementById('add-panel');
  if (!panel) return;
  panel.classList.remove('open');
}

function toggleSelectPanel() {
  const panel = document.getElementById('select-panel');
  const addPanel = document.getElementById('add-panel');
  if (!panel) return;
  if (addPanel) {
    addPanel.classList.remove('open');
  }
  const willOpen = !panel.classList.contains('open');
  panel.classList.toggle('open');
  setSelectionMode(willOpen);
  // Toggle a class on the floating container so we can animate the FAB
  const container = document.querySelector('.select-card-floating');
  if (container) container.classList.toggle('open', willOpen);
}

function closeSelectPanel() {
  const panel = document.getElementById('select-panel');
  if (!panel) return;
  panel.classList.remove('open');
}

function addCards(amount) {
  for (let i = 0; i < amount; i++) {
    let defaultColor = (uniqueCardId < 10) ? defaultLayout[uniqueCardId] : departments[0].color;
    createSingleCard(defaultColor);
  }
}

function restoreDefaultCards() {
  const container = document.getElementById('pages-container');
  if (!container) return;
  container.innerHTML = '';
  totalCardCount = 0;
  uniqueCardId = 0;
  allCards = [];

  for (let i = 0; i < defaultLayout.length; i++) {
    createSingleCard(defaultLayout[i]);
  }
}

function createSingleCard(initColor, cardData = null) {
  const container = document.getElementById('pages-container');
  const lastPage = container.lastElementChild;
  let lastPageGrid = lastPage ? lastPage.querySelector('.cards-grid') : null;

  if (!lastPageGrid || lastPageGrid.children.length >= 10) {
    const newPage = document.createElement('div');
    newPage.className = 'page-wrapper';
    const newGrid = document.createElement('div');
    newGrid.className = 'cards-grid';
    newPage.appendChild(newGrid);
    container.appendChild(newPage);
    lastPageGrid = newGrid;
  } else {
    lastPageGrid = lastPage.querySelector('.cards-grid');
  }

  const currentIndex = uniqueCardId++;
  totalCardCount++;
  
  // Using a fallback mechanism for the logo image to prevent broken links in preview
  const cardHtml = `
    <div class="card-ui-wrapper" id="card-wrapper-${currentIndex}">
      <div class="card-header-control">
        <label class="card-select-wrapper" title="Select card">
          <input type="checkbox" class="card-select" onchange="onCardCheckboxChange(this)">
        </label>
        <select class="neu-select dept-select" style="flex-grow: 1;" onchange="updateCardColor(this, ${currentIndex})">
          ${generateOptions(initColor)}
        </select>
        <button class="neu-btn danger" style="padding: 8px; width: auto; margin-left: 10px; flex-shrink: 0;" onclick="deleteCard(this)" title="Delete Card">🗑️</button>
      </div>
      <div class="label-container">
        <div class="top-white-space"></div>
        <div class="color-banner" id="banner-${currentIndex}" style="background-color: ${initColor}">
          <h1>UCN PROPERTY TAG</h1>
        </div>
        <div class="logo-shield"></div>
        <div class="form-section">
          <div class="form-row"><label>ICS/PAR No.:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Property No.:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Date Acquired:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Acquisition Cost:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Fund:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>End-User/Location:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Requested by:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>Supplier:</label><input type="text" class="underline-input"></div>
          <div class="form-row"><label>P.O/J.O/Contract Ref:</label><textarea class="underline-input auto-resize" rows="1"></textarea></div>
          <div class="form-row"><label>Item Description:</label><textarea class="underline-input auto-resize" rows="1"></textarea></div>
        </div>
        <div class="qr-box" aria-label="Card QR code"></div>
      </div>
    </div>
  `;

  lastPageGrid.insertAdjacentHTML('beforeend', cardHtml);
  const newCard = lastPageGrid.lastElementChild;
  newCard.dataset.cardId = cardData && cardData.cardId ? cardData.cardId : `card-${currentIndex}`;
  allCards.push(newCard);

  // Card click toggles selection when selection-mode is active
  newCard.addEventListener('click', function(e) {
    if (!document.body.classList.contains('selection-mode')) return;
    // Don't toggle when interacting with form controls inside the card
    if (e.target.closest('input') || e.target.closest('select') || e.target.closest('textarea') || e.target.closest('button')) return;
    const cb = newCard.querySelector('.card-select');
    if (!cb) return;
    cb.checked = !cb.checked;
    newCard.classList.toggle('selected', cb.checked);
    updateSelectionCount();
  });

  if (cardData) {
    const deptSelect = newCard.querySelector('.dept-select');
    if (deptSelect && cardData.dept) {
      const optionToSelect = Array.from(deptSelect.options).find(opt => opt.text.trim() === cardData.dept);
      if (optionToSelect) {
        optionToSelect.selected = true;
        updateCardColor(deptSelect, currentIndex);
      }
    }

    const inputs = newCard.querySelectorAll('.underline-input');
    if (inputs[0]) inputs[0].value = cardData.icsParNo || '';
    if (inputs[1]) inputs[1].value = cardData.propertyNo || '';
    if (inputs[2]) inputs[2].value = cardData.dateAcquired || '';
    if (inputs[3]) inputs[3].value = cardData.acquisitionCost || '';
    if (inputs[4]) inputs[4].value = cardData.fund || '';
    if (inputs[5]) inputs[5].value = cardData.endUserLocation || '';
    if (inputs[6]) inputs[6].value = cardData.requestedBy || '';
    if (inputs[7]) inputs[7].value = cardData.supplier || '';
    if (inputs[8]) inputs[8].value = cardData.reference || '';
    if (inputs[9]) inputs[9].value = cardData.itemDescription || '';
    
    // ENHANCED: Restore quantity and unit from saved card data (for PAR form)
    if (cardData.quantity) newCard.dataset.quantity = cardData.quantity;
    if (cardData.unit) newCard.dataset.unit = cardData.unit;
  }

  setupFirebaseAutoSave(newCard);
  if (!deferCardQrRendering && cardQrObserver) cardQrObserver.observe(newCard);
  // Attach auto-resize behavior to any textarea inside the new card
  const textareas = newCard.querySelectorAll('textarea.auto-resize');
  textareas.forEach((ta) => {
    // helper to enforce max two visual rows by trimming overflowing content
    const adjust = (el) => {
      el.style.height = 'auto';
      const cs = window.getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize) || 18;
      const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.2;
      const padding = parseFloat(cs.paddingTop || 0) + parseFloat(cs.paddingBottom || 0) + 4;
      const maxH = (lineHeight * 2) + padding;

      // shrink visually to fit within two lines
      let desired = Math.min(el.scrollHeight, maxH);
      el.style.height = desired + 'px';
      el.style.overflowY = 'hidden';

      // Preserve the full value for PAR/QR generation. Only constrain the visible textarea box,
      // not the actual stored description text.
      el.style.height = Math.min(el.scrollHeight, maxH) + 'px';

      // Reduce font slightly when content wraps to second line for better fit
      if (el.scrollHeight > lineHeight + padding) {
        el.style.fontSize = Math.max(14, fontSize - 2) + 'px';
      } else {
        el.style.fontSize = fontSize + 'px';
      }
    };

    ta.addEventListener('input', () => adjust(ta));
    ta.addEventListener('paste', () => setTimeout(() => adjust(ta), 40));
    // Prevent creating more than one explicit newline (limit to 2 lines)
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const lines = (ta.value || '').split('\n');
        if (lines.length >= 2) {
          ev.preventDefault();
          // let adjust handle trimming/ellipsis
          setTimeout(() => adjust(ta), 0);
        }
      }
    });

    // initial adjust
    adjust(ta);
  });
}

async function deleteCard(btnElement) {
  const cardWrapper = btnElement.closest('.card-ui-wrapper');
  if (!cardWrapper) return;

  setDeleteLoadingState(true);
  updateFirebaseStatus('Deleting card... Please wait.', '#004aad');

  try {
    await deleteCardRecord(cardWrapper);

    allCards = allCards.filter(card => card !== cardWrapper);
    cardWrapper.remove();
    totalCardCount--;
    reorganizePages();
    refreshDashboardSummary();
    updateSelectionCount();

    if (allCards.length === 0) {
      restoreDefaultCards();
      refreshDashboardSummary();
      showAlert('Card deleted successfully. No cards remained, so the default cards have been restored.');
    } else {
      showAlert('Card deleted successfully.');
    }

    updateFirebaseStatus('Delete completed.', '#499632');
  } catch (err) {
    console.error('Single card delete failed', err);
    updateFirebaseStatus('Card delete failed on the server.', '#9a0603');
    showAlert('The card could not be deleted. Please try again.');
  } finally {
    setDeleteLoadingState(false);
  }
}

function getSelectedCards() {
  const checkedBoxes = document.querySelectorAll('.card-ui-wrapper .card-select:checked');
  return Array.from(checkedBoxes).map(cb => cb.closest('.card-ui-wrapper')).filter(Boolean);
}

function updateSelectionCount() {
  const count = getSelectedCards().length;
  const countEl = document.getElementById('batch-selection-count');
  if (countEl) {
    countEl.innerText = `Selected: ${count}`;
  }
}

function selectVisibleCards() {
  const allCardWrappers = document.querySelectorAll('.card-ui-wrapper');
  allCardWrappers.forEach(card => {
    if (card.offsetParent !== null) {
      const checkbox = card.querySelector('.card-select');
      if (checkbox) checkbox.checked = true;
      if (card) card.classList.add('selected');
    }
  });
  updateSelectionCount();
}

function selectAllCards() {
  const allCardWrappers = document.querySelectorAll('.card-ui-wrapper');
  allCardWrappers.forEach(card => {
    const checkbox = card.querySelector('.card-select');
    if (checkbox) checkbox.checked = true;
    if (card) card.classList.add('selected');
  });
  updateSelectionCount();
}

function clearSelection() {
  const allCardWrappers = document.querySelectorAll('.card-ui-wrapper');
  allCardWrappers.forEach(card => {
    const checkbox = card.querySelector('.card-select');
    if (checkbox) checkbox.checked = false;
    card.classList.remove('selected');
  });
  updateSelectionCount();
}

function onCardCheckboxChange(el) {
  const card = el.closest('.card-ui-wrapper');
  if (!card) return;
  card.classList.toggle('selected', el.checked);
  updateSelectionCount();
}

function setSelectionMode(enabled) {
  document.body.classList.toggle('selection-mode', enabled);
}

async function deleteCardRecord(cardWrapper) {
  if (!firebaseInitialized || !firebaseFirestore) return;
  const cardId = cardWrapper.dataset.cardId;
  if (!cardId) return;

  try {
    await firebaseFirestore.collection('propertyTags').doc(cardId).delete();
  } catch (err) {
    console.warn('Firestore delete failed', err);
  }
}

async function deleteSelectedCards() {
  const selectedCards = getSelectedCards();
  if (selectedCards.length === 0) {
    showAlert('No cards selected for deletion.');
    return;
  }

  const confirmDelete = await showConfirm(`Delete ${selectedCards.length} selected card(s)? This will also remove saved cards from the database.`);
  if (!confirmDelete) return;

  const filterEl = document.getElementById('filter-dept');
  const activeDepartmentFilter = filterEl ? filterEl.value : 'ALL';
  const shouldResetFilterAfterDelete = activeDepartmentFilter !== 'ALL' &&
    selectedCards.every(card => getCardDepartmentName(card) === activeDepartmentFilter);

  setDeleteLoadingState(true);
  updateFirebaseStatus('Deleting selected cards... Please wait.', '#004aad');

  try {
    await Promise.all(selectedCards.map((cardWrapper) => deleteCardRecord(cardWrapper)));

    selectedCards.forEach((cardWrapper) => {
      allCards = allCards.filter(card => card !== cardWrapper);
      cardWrapper.remove();
      totalCardCount--;
    });

    if (allCards.length === 0) {
      restoreDefaultCards();
      refreshDashboardSummary();
      if (filterEl) filterEl.value = 'ALL';
      showAlert('Selected cards were deleted successfully. No cards remained, so the default cards have been restored.');
    } else {
      if (shouldResetFilterAfterDelete) {
        resetFilterToAllDepartments();
      } else {
        reorganizePages();
      }
      refreshDashboardSummary();
      clearSelection();
      showAlert('Selected cards were deleted successfully.');
    }

    updateFirebaseStatus('Delete completed.', '#499632');
  } catch (err) {
    console.error('Bulk delete failed', err);
    updateFirebaseStatus('Some deletes failed on the server.', '#9a0603');
    showAlert('Some selected cards could not be deleted. Please try again.');
  } finally {
    setDeleteLoadingState(false);
  }
}

function applyBatchAction() {
  // This UI now uses explicit icon buttons; keep function for backward compatibility.
  const selectedCards = getSelectedCards();
  if (selectedCards.length === 0) {
    showAlert('Select at least one card to perform a batch action.');
    return;
  }
  // default no-op
}

function renderEmptyDepartmentState(departmentName = 'this department') {
  const container = document.getElementById('pages-container');
  if (!container) return;

  const safeDeptName = departmentName && departmentName !== 'ALL' ? departmentName : 'this department';

  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-backdrop"></div>
      <div class="empty-state-panel">
        <div class="empty-state-message">No cards found for ${safeDeptName} department.</div>
        <div class="empty-state-actions">
          <button class="neu-btn primary empty-state-btn" type="button" onclick="openAddCardsForCurrentDepartment()">Add Cards</button>
        </div>
      </div>
    </div>
  `;
}

// Reflow cards into pages. If `cardsList` is provided, that list/order is used.
function reorganizePages(cardsList) {
  const container = document.getElementById('pages-container');
  const cardsToRender = Array.isArray(cardsList) ? cardsList : allCards;

  // Clear the container
  container.innerHTML = '';

  if (cardsToRender.length === 0) {
    const filterEl = document.getElementById('filter-dept');
    const selectedDepartment = filterEl && filterEl.value && filterEl.value !== 'ALL' ? filterEl.value : 'this department';
    renderEmptyDepartmentState(selectedDepartment);
    return;
  }

  // Put them back in perfect groups of 10
  let currentGrid = null;
  cardsToRender.forEach((card, index) => {
    if (index % 10 === 0) {
      const newPage = document.createElement('div');
      newPage.className = 'page-wrapper';
      currentGrid = document.createElement('div');
      currentGrid.className = 'cards-grid';
      newPage.appendChild(currentGrid);
      container.appendChild(newPage);
    }
    currentGrid.appendChild(card); // This moves the card without losing typed text
  });
}

function updateCardColor(selectElement, index) {
  const banner = document.getElementById(`banner-${index}`);
  banner.style.backgroundColor = selectElement.value;
}

function applyFieldColorMode(mode) {
  const mainContent = document.getElementById('pages-container');
  if (!mainContent) return;
  mainContent.classList.toggle('field-color-plain', mode === 'plain');
}

function toggleFieldThemePanel() {
  document.querySelector('.field-theme-floating')?.classList.toggle('open');
}

function closeFieldThemePanel() {
  document.querySelector('.field-theme-floating')?.classList.remove('open');
}

async function loadCardsFromFirestore() {
  if (!firebaseInitialized || !firebaseFirestore) return false;
  updateFirebaseStatus("Loading saved cards...", "#004aad");
  const container = document.getElementById('pages-container');
  const previousDisplay = container ? container.style.display : '';

  try {
    const snapshot = await Promise.race([
      firebaseFirestore.collection('propertyTags').get(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore load timed out')), 8000))
    ]);
    if (snapshot.empty) {
      finishMainLoading();
      updateFirebaseStatus("No saved cards found. Starting fresh.", "#004aad");
      return false;
    }

    document.getElementById('pages-container').innerHTML = '';
    totalCardCount = 0;
    uniqueCardId = 0;
    allCards = [];
    deferCardQrRendering = true;
    if (container) container.style.display = 'none';

    snapshot.forEach((doc) => {
      const cardData = doc.data();
      const deptName = cardData.dept || '';
      const matchedDept = departments.find(d => d.name === deptName);
      const color = cardData.color || (matchedDept ? matchedDept.color : departments[0].color);
      cardData.cardId = doc.id;
      createSingleCard(color, cardData);
    });

    deferCardQrRendering = false;
    if (container) container.style.display = previousDisplay;
    finishMainLoading();
    renderLoadedCardQRCodes();

    updateFirebaseStatus(`Loaded ${snapshot.size} saved cards.`, "#499632");
    return true;
  } catch (err) {
    deferCardQrRendering = false;
    if (container) container.style.display = previousDisplay;
    finishMainLoading();
    console.error('Firestore load error', err);
    updateFirebaseStatus("Unable to load saved cards", "#9a0603");
    return false;
  }
}

// Initialize layout on load with saved cards if available
window.onload = async function() {
  initializeFirebase();
  const loaded = await loadCardsFromFirestore();
  if (!loaded) {
    addCards(10);
    finishMainLoading();
    renderLoadedCardQRCodes();
  }
  buildFilterOptions();
  // Wire up filter UI
  const filterSelect = document.getElementById('filter-dept');
  const searchInput = document.getElementById('search-query');
  const addPanel = document.getElementById('add-panel');
  const addFab = document.getElementById('add-fab');
  const fieldColorMode = document.getElementById('field-color-mode');
  const themePanel = document.getElementById('theme-panel');
  const themeFab = document.getElementById('theme-fab');
  if (fieldColorMode) {
    const savedMode = localStorage.getItem('fieldColorMode') || 'enhanced';
    fieldColorMode.value = savedMode;
    applyFieldColorMode(savedMode);
    fieldColorMode.addEventListener('change', () => {
      applyFieldColorMode(fieldColorMode.value);
      localStorage.setItem('fieldColorMode', fieldColorMode.value);
    });
  }
  document.getElementById('reset-filter').addEventListener('click', () => {
    filterSelect.value = 'ALL';
    searchInput.value = '';
    applyFilter();
  });
  filterSelect.addEventListener('change', () => { applyFilter(); refreshDashboardSummary(); });
  searchInput.addEventListener('input', () => { applyFilter(); refreshDashboardSummary(); });

  const selectPanel = document.getElementById('select-panel');
  const selectFab = document.getElementById('select-fab');

  // Floating search elements
  const floatingSearch = document.getElementById('floating-search');
  const searchPanelEl = document.getElementById('search-panel');
  const searchTrigger = document.getElementById('search-trigger');
  // `searchInput` is already retrieved above
  if (floatingSearch && searchPanelEl && searchTrigger && searchInput) {
    const openSearch = () => {
      floatingSearch.classList.add('open');
    };
    const closeSearch = () => {
      if (document.activeElement === searchInput) return;
      floatingSearch.classList.remove('open');
    };

    floatingSearch.addEventListener('mouseenter', openSearch);
    floatingSearch.addEventListener('mouseleave', () => { if (document.activeElement !== searchInput) closeSearch(); });

    searchTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      openSearch();
      searchInput.focus();
    });

    searchInput.addEventListener('focus', openSearch);
    searchInput.addEventListener('blur', () => { setTimeout(() => { if (document.activeElement !== searchInput) closeSearch(); }, 120); });
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { searchInput.blur(); closeSearch(); } });
  }

  // Close panels when user clicks outside of them, but ignore card-area clicks
  document.addEventListener('click', (e) => {
    const target = e.target;

    // If user clicked on a card (or inside it), do nothing — this prevents panels
    // from closing while interacting with many cards.
    if (target.closest && target.closest('.card-ui-wrapper')) return;

    const clickedInsideAdd = addPanel && addPanel.contains(target);
    const clickedAddFab = addFab && addFab.contains(target);
    const clickedInsideSelect = selectPanel && selectPanel.contains(target);
    const clickedSelectFab = selectFab && selectFab.contains(target);
    const clickedInsideTheme = themePanel && themePanel.contains(target);
    const clickedThemeFab = themeFab && themeFab.contains(target);

    if (!clickedInsideAdd && !clickedAddFab) {
      closeAddPanel();
    }
    if (!clickedInsideSelect && !clickedSelectFab) {
      closeSelectPanel();
      setSelectionMode(false);
    }
    if (!clickedInsideTheme && !clickedThemeFab) {
      closeFieldThemePanel();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAddPanel();
      closeSelectPanel();
      closeFieldThemePanel();
      setSelectionMode(false);
    }
  });

  // Keyboard navigation for inputs (Enter / Arrow keys)
  setupKeyboardNavigation();
  // Public base URL feature removed; QR regeneration and saves use current origin.
  refreshDashboardSummary();
};

function refreshDashboardSummary() {
  const totalCards = allCards.length;
  const visibleCards = document.querySelectorAll('.card-ui-wrapper').length;
  const uniqueDepartments = new Set();
  allCards.forEach(card => {
    const select = card.querySelector('.dept-select');
    if (select) uniqueDepartments.add(select.options[select.selectedIndex]?.text.trim() || '');
  });

  document.getElementById('summary-total-cards').innerText = totalCards;
  document.getElementById('summary-visible-cards').innerText = visibleCards;
}

// --- EXCEL PROCESSING LOGIC ---
function processExcel() {
  const fileInput = document.getElementById('excel-file');
  const statusText = document.getElementById('upload-status');
  const file = fileInput.files[0];
  
  if (!file) {
    statusText.style.color = "#9a0603";
    statusText.innerText = "Please select an Excel file first.";
    setTimeout(() => statusText.innerText = "", 3000);
    return;
  }

  statusText.style.color = "#004aad";
  statusText.innerText = "Processing Data...";

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // UPDATE: Nilagyan natin ng {range: 4} para i-skip ang unang 4 rows (Titles/Headings). 
      // Magsisimula siyang magbasa ng exact table headers sa Row 5.
      // ADDED: raw: false para eksaktong text ng Date ang basahin, hindi serial number.
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {range: 4, defval: "", raw: false});
      
      if(jsonData.length > 0) {
        // BAGO: Burahin muna ang mga naka-display na cards at i-reset ang bilang bago ilagay ang Excel data
        document.getElementById('pages-container').innerHTML = '';
        totalCardCount = 0;
        uniqueCardId = 0;
        allCards = [];

        const generatedCount = await populateFromExcel(jsonData);
        refreshDashboardSummary();
        if (generatedCount > 0) {
          statusText.style.color = "#499632";
          statusText.innerText = `Success! Generated ${generatedCount} cards.`;
        } else {
          statusText.style.color = "#9a0603";
          statusText.innerText = "No cards generated: only Expendable items were found.";
        }
        fileInput.value = ""; // Clear input after reading
      } else {
        statusText.style.color = "#9a0603";
        statusText.innerText = "Excel file is empty or headers not found on Row 5.";
      }
    } catch(err) {
      statusText.style.color = "#9a0603";
      statusText.innerText = "Error reading Excel file.";
      console.error(err);
    }
    setTimeout(() => statusText.innerText = "", 6000);
  };
  reader.readAsArrayBuffer(file);
}

// BAGO: Smart function para hanapin ang header kahit may extra spaces o line break sa Excel
function getExcelValue(row, targetHeader) {
  // Tatanggalin natin ang lahat ng spaces at line breaks, tapos gagawing small letters
  const target = targetHeader.toLowerCase().replace(/[\s\r\n]+/g, '');
  
  for (let key in row) {
    const currentKey = key.toLowerCase().replace(/[\s\r\n]+/g, '');
    // Kung nag-match na sila kahit walang spaces, kunin ang value
    if (currentKey === target) {
      return row[key];
    }
  }
  return '';
}

// BAGO: Helper function para i-format ang "n/a" para maging malaking "N/A" imbes na mablangko
function formatValue(val) {
  if (val === undefined || val === null || val === '') return '';
  let str = val.toString().trim();
  if (str.toLowerCase() === 'n/a') return 'N/A';
  return str;
}

function getPreferredExcelValue(row, candidates, fallback = '') {
  for (const label of candidates) {
    const value = formatValue(getExcelValue(row, label));
    if (value && value !== 'N/A') return value;
  }
  return formatValue(fallback || getExcelValue(row, 'Description')) || '';
}

function getExcelPropertyNumber(row) {
  const candidates = ['Property No.', 'Property No./Item No.', 'Item No.', 'Asset No.'];
  for (const label of candidates) {
    const value = formatValue(getExcelValue(row, label));
    if (value) return value;
  }
  return '';
}

function getExcelQuantity(row) {
  const value = getPreferredExcelValue(row, ['Quantity', 'Qty', 'Qty.', 'No. of Units']);
  if (!value) return '1';
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? match[0] : value;
}

function getPropertyNumberSequence(propertyNo) {
  const value = formatValue(propertyNo);
  const rangeMatch = value.match(/^(.*?)(\d+)\s+to\s+(\d+)$/i);
  if (!rangeMatch) return value ? [value] : [''];

  const prefix = rangeMatch[1];
  const start = Number(rangeMatch[2]);
  const end = Number(rangeMatch[3]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    return [value];
  }

  const numberWidth = Math.max(rangeMatch[2].length, rangeMatch[3].length);
  return Array.from({ length: end - start + 1 }, (_, index) =>
    `${prefix}${String(start + index).padStart(numberWidth, '0')}`
  );
}

function getExcelUnit(row) {
  const value = getPreferredExcelValue(row, ['Unit', 'Unit of Measure', 'UOM']);
  if (!value) return 'pc';
  return value;
}

async function populateFromExcel(dataRows) {
  let generatedCount = 0;
  const container = document.getElementById('pages-container');
  const previousDisplay = container ? container.style.display : '';
  deferCardQrRendering = true;
  if (container) container.style.display = 'none';

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
    const row = dataRows[rowIndex];
    const classification = formatValue(getExcelValue(row, 'Inventory/Property Classification'));
    const normalizedClassification = classification.toLowerCase().replace(/[\s\u00A0]+/g, ' ').trim();
    const shouldGenerate = normalizedClassification.includes('semi') || normalizedClassification.includes('non');

    if (!classification || !shouldGenerate) {
      continue; // skip Expendable or undefined classification rows
    }

    // 1. Check if the row has a "Department" header to set the exact color
    let matchedColor = departments[0].color; // Default fallback color (GASS)
    let rowDept = getExcelValue(row, 'Department');
    
    if (rowDept) {
       const cleanDept = rowDept.toString().trim().toUpperCase();
       
       // BAGO: Hahanapin kung 'kasama' o bahagi ng text ang pangalan ng Department 
       // kahit may mga dugtong pa ito (e.g., "CFAST-Extension" -> mababasa ang "CFAST")
       const foundDept = departments.find(d => cleanDept.includes(d.name));
       if (foundDept) {
         matchedColor = foundDept.color;
       }
    }

    // 2. Create a new card
    createSingleCard(matchedColor);
    
    // 3. Target the newly created card
    const newCard = allCards[allCards.length - 1];
    const inputs = newCard.querySelectorAll('.underline-input');

    const qtyFromRow = getExcelQuantity(row);
    const unitFromRow = getExcelUnit(row);
    const descriptionFromRow = getPreferredExcelValue(row, [
      'Item Description',
      'Items Description',
      'Description',
      'Description of Item',
      'Article',
      'Item Name',
      'Property Description'
    ]);
    const referenceFromRow = getPreferredExcelValue(row, [
      'P.O/J.O/Contract Ref',
      'PO/J.O/Contract Ref',
      'Reference',
      'Reference No.',
      'Contract Reference'
    ]);
    const propertyNoRange = getExcelPropertyNumber(row);
    const propertyNumbers = getPropertyNumberSequence(propertyNoRange);
    const propertyNoFromRow = propertyNumbers[0];
    const quantityCount = Number.parseInt(qtyFromRow, 10);
    const cardCount = propertyNumbers.length > 1
      ? propertyNumbers.length
      : (Number.isInteger(quantityCount) && quantityCount > 0 ? quantityCount : 1);
    const serialNoFromRow = getPreferredExcelValue(row, ['Serial No.', 'Serial Number', 'Serial']);
    const serviceableFromRow = getPreferredExcelValue(row, ['Serviceable', 'Condition']);
    const unserviceableFromRow = getPreferredExcelValue(row, ['Unserviceable']);
    const dateCountedFromRow = getPreferredExcelValue(row, ['Date Counted', 'Counted Date']);
    const dateFromRow = getPreferredExcelValue(row, ['Date Acquired', 'Date Delivered', 'Date of Acquisition', 'Acquired Date']);
    const fundFromRow = getPreferredExcelValue(row, ['Fund', 'Fund Cluster']);
    const endUserFromRow = getPreferredExcelValue(row, ['End-User/Location', 'End User', 'End-User', 'Location', 'User/Location']);
    const requestedByFromRow = getPreferredExcelValue(row, ['Requested by', 'Requested By', 'Requestor', 'End User', 'End-User']);
    const supplierFromRow = getPreferredExcelValue(row, ['Supplier', 'Supplier Name', 'Vendor']);
    const acquisitionCostFromRow = getPreferredExcelValue(row, ['Acquisition Cost', 'Unit Cost', 'Cost', 'Amount', 'Total Cost']);

    newCard.dataset.quantity = qtyFromRow;
    newCard.dataset.unit = unitFromRow;
    newCard.dataset.itemDescription = descriptionFromRow;
    newCard.dataset.itemDescriptionRaw = descriptionFromRow;
    newCard.dataset.reference = referenceFromRow;
    newCard.dataset.referenceRaw = referenceFromRow;
    newCard.dataset.propertyNo = propertyNoFromRow;
    newCard.dataset.serialNo = serialNoFromRow;
    newCard.dataset.serviceable = serviceableFromRow;
    newCard.dataset.unserviceable = unserviceableFromRow;
    newCard.dataset.dateCounted = dateCountedFromRow;
    newCard.dataset.dateAcquired = dateFromRow;
    newCard.dataset.fund = fundFromRow;
    newCard.dataset.endUserLocation = endUserFromRow;
    newCard.dataset.requestedBy = requestedByFromRow;
    newCard.dataset.supplier = supplierFromRow;
    newCard.dataset.acquisitionCost = acquisitionCostFromRow;
    
    // 4. Map the EXACT Excel cell data gamit ang bago nating Smart Reader (getExcelValue) at formatValue
    
    // Line 1: ICS/PAR No.
    let ics = formatValue(getExcelValue(row, 'ICS No. (If Applicable)') || getExcelValue(row, 'ICS/PAR No.') || getExcelValue(row, 'ICS No.'));
    let par = formatValue(getExcelValue(row, 'PAR No.(If Applicable)') || getExcelValue(row, 'PAR No.') || getExcelValue(row, 'PAR No'));
    let icsParVal = '';
    
    if (ics && ics !== 'N/A') {
        icsParVal = ics;
    } else if (par && par !== 'N/A') {
        icsParVal = par;
    } else if (ics === 'N/A' || par === 'N/A') {
        icsParVal = 'N/A';
    }
    inputs[0].value = icsParVal;
    
    // Line 2: Property No.
    inputs[1].value = propertyNoFromRow;
    
    // Line 3: Date Acquired
    inputs[2].value = dateFromRow;
    
    // Line 4: Acquisition Cost
    let costStr = formatValue(acquisitionCostFromRow);
    if (costStr.toLowerCase() === 'n/a') {
        inputs[3].value = 'N/A';
    } else {
        let cleanCost = costStr.replace(/[^0-9.-]+/g, ''); 
        if(!isNaN(cleanCost) && cleanCost !== "") {
            inputs[3].value = Number(cleanCost).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
        } else {
            inputs[3].value = costStr;
        }
    }
    
    // Line 5: Fund
    inputs[4].value = fundFromRow;
    
    // Line 6: End-User/Location
    inputs[5].value = endUserFromRow;
    
    // Line 7: Requested by
    inputs[6].value = requestedByFromRow;
    
    // Line 8: Supplier
    inputs[7].value = supplierFromRow;
    
    // Line 9: Reference
    inputs[8].value = referenceFromRow;
    
    // Line 10: Item Description
    inputs[9].value = descriptionFromRow;
    
    // If this is a textarea with auto-resize, trigger its adjust (if attached)
    if (inputs[9] && inputs[9].tagName === 'TEXTAREA') {
      const ev = new Event('input', { bubbles: true });
      inputs[9].dispatchEvent(ev);
    }

    // ENHANCED: Read Quantity and Unit from Excel (stored invisibly for PAR form)
    let quantity = formatValue(getExcelValue(row, 'Quantity') || getExcelValue(row, 'Qty'));
    if (!quantity || quantity === 'N/A') {
      quantity = '1';
    }
    newCard.dataset.quantity = quantity;
    
    let unit = formatValue(getExcelValue(row, 'Unit') || getExcelValue(row, 'Unit of Measurement') || getExcelValue(row, 'UOM'));
    if (!unit || unit === 'N/A') {
      unit = 'pc';
    }
    newCard.dataset.unit = unit;

    // Auto-save the imported card immediately after fields are populated
    saveCardToFirebase(newCard);

    for (let index = 1; index < cardCount; index++) {
      const cardData = getCardData(newCard);
      cardData.cardId = '';
      cardData.propertyNo = propertyNumbers[index] || propertyNumbers[0];
      createSingleCard(matchedColor, cardData);
      const duplicatedCard = allCards[allCards.length - 1];
      saveCardToFirebase(duplicatedCard);
    }

    generatedCount += cardCount;

    // Yield to the browser regularly so large imports keep the page responsive.
    if (rowIndex % 20 === 19) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  deferCardQrRendering = false;
  if (container) container.style.display = previousDisplay;
  renderLoadedCardQRCodes();

  // Refresh department filter options after import
  buildFilterOptions();
  applyFilter();
  return generatedCount;
}

// Build department options for the filter select
function buildFilterOptions() {
  const filter = document.getElementById('filter-dept');
  if (!filter) return;
  // Preserve selected value
  const prev = filter.value || 'ALL';
  filter.innerHTML = '<option value="ALL">All Departments</option>';
  departments.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.name;
    opt.textContent = d.name;
    filter.appendChild(opt);
  });
  if ([...filter.options].some(o => o.value === prev)) filter.value = prev; else filter.value = 'ALL';
}

// Apply department filter based on sidebar control
function getCardDepartmentName(card) {
  const deptSelect = card.querySelector('.dept-select');
  if (deptSelect && deptSelect.selectedIndex >= 0) {
    const deptText = deptSelect.options[deptSelect.selectedIndex]?.text.trim();
    if (deptText) return deptText;
  }

  const inputs = card.querySelectorAll('.underline-input');
  return inputs[4] ? inputs[4].value.trim() : '';
}

function applyFilter() {
  const filterEl = document.getElementById('filter-dept');
  const searchVal = document.getElementById('search-query').value.trim().toLowerCase();
  const filterVal = filterEl ? filterEl.value : 'ALL';

  // Always start from the full collection of cards so repeated filtering works.
  let cards = [...allCards];

  // Filter by department if requested
  if (filterVal && filterVal !== 'ALL') {
    cards = cards.filter(card => getCardDepartmentName(card) === filterVal);
  }

  // Keyword search across department and card input fields
  if (searchVal) {
    cards = cards.filter(card => {
      const deptSelect = card.querySelector('.dept-select');
      const deptName = deptSelect && deptSelect.selectedIndex >= 0
        ? deptSelect.options[deptSelect.selectedIndex].text.trim()
        : '';

      const fields = Array.from(card.querySelectorAll('.underline-input'));
      const joinedFields = fields.map(field => (field.value || '').trim()).join(' ');
      const searchableText = `${deptName} ${joinedFields}`.toLowerCase();

      return searchableText.includes(searchVal);
    });
  }

  if (cards.length === 0) {
    renderEmptyDepartmentState(filterVal);
    return;
  }

  // Reflow only the resulting cards (this preserves their state)
  reorganizePages(cards);
}

function resetFilterToAllDepartments() {
  const filterEl = document.getElementById('filter-dept');
  if (!filterEl) return;

  filterEl.value = 'ALL';
  applyFilter();
  refreshDashboardSummary();
}

function openAddCardsForCurrentDepartment() {
  const filterEl = document.getElementById('filter-dept');
  const addDeptSelect = document.getElementById('add-dept-select');
  const addQty = document.getElementById('add-qty');

  if (!addDeptSelect) return;

  const currentDepartment = filterEl && filterEl.value && filterEl.value !== 'ALL' ? filterEl.value : addDeptSelect.value;
  addDeptSelect.value = currentDepartment;

  if (addQty) {
    addQty.value = '1';
  }

  addNewCards();
}

// Keyboard navigation: move focus between `.underline-input` fields
function setupKeyboardNavigation() {
  document.addEventListener('keydown', function(e) {
    const active = document.activeElement;
    if (!active || !active.classList) return;
    if (!active.classList.contains('underline-input')) return;
    // If the active element is a textarea (Item Description), do not hijack Enter/Arrow keys
    if (active.tagName === 'TEXTAREA') return;

    const inputs = Array.from(document.querySelectorAll('.underline-input'));
    const idx = inputs.indexOf(active);
    if (idx === -1) return;

    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = inputs[idx + 1];
      if (next) next.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = inputs[idx - 1];
      if (prev) prev.focus();
    }
  });
}
