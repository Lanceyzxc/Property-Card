const departments = [
  { name: "MAIN", color: "#9a0603" },
  { name: "COTT", color: "#8c52ff" },
  { name: "CFAST", color: "#38b6ff" },
  { name: "CCMS", color: "#737373" },
  { name: "COED", color: "#004aad" },
  { name: "ENTIENZA", color: "#ff751f" },
  { name: "CBPA", color: "#faf901" },
  { name: "CANR", color: "#499632" },
  { name: "COENG", color: "#ffde59" },
  { name: "CAS", color: "#ff3131" }
];

const defaultLayout = [
  "#9a0603", "#8c52ff",
  "#38b6ff", "#737373",
  "#004aad", "#ff751f",
  "#faf901", "#499632",
  "#ffde59", "#ff3131"
];

let totalCardCount = 0;
let uniqueCardId = 0;
let allCards = [];
let knownCardCount = 0;
let cardsStillRendering = false;
let pendingCardData = [];
let loadedCardData = [];
let firebaseFirestore = null;
let firebaseInitialized = false;
let deferCardQrRendering = false;
let cardQrObserver = null;
const appSplashStartedAt = Date.now();

function normalizeDepartmentName(value) {
  const department = String(value || '').trim().toUpperCase();
  if (department === 'GASS') return 'MAIN';
  return department === 'IABD' ? 'ENTIENZA' : department;
}

function isMainDepartment() {
  return normalizeDepartmentName(window.currentDepartment) === 'MAIN';
}

function getCurrentDepartmentColor() {
  const currentDepartment = normalizeDepartmentName(window.currentDepartment);
  return departments.find(department => department.name === currentDepartment)?.color || departments[0].color;
}

function setDepartmentScopedControls() {
  const filterGroup = document.getElementById('filter-dept')?.closest('.control-group');
  const addDepartmentSelect = document.getElementById('add-dept-select');
  const addDepartmentLabel = addDepartmentSelect?.previousElementSibling;
  const scopedToMain = isMainDepartment();

  if (filterGroup) filterGroup.hidden = !scopedToMain;
  if (addDepartmentSelect) addDepartmentSelect.hidden = !scopedToMain;
  if (addDepartmentLabel) addDepartmentLabel.hidden = !scopedToMain;
}

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
}

function updateMainRenderStatus(message = '', visible = true) {
  const status = document.getElementById('main-load-status');
  const container = document.getElementById('pages-container');
  if (!status || !container) return;
  status.textContent = message;
  status.hidden = !visible;
  container.classList.toggle('is-rendering', visible);
  container.setAttribute('aria-busy', visible ? 'true' : 'false');
}

function finishAppSplash() {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  const minimumDisplayTime = 900;
  const remainingTime = Math.max(0, minimumDisplayTime - (Date.now() - appSplashStartedAt));
  window.setTimeout(() => splash.classList.add('is-hidden'), remainingTime);
}

function renderLoadedCardQRCodes() {
  allCards.forEach(observeCardQRCode);
}

function observeCardQRCode(cardWrapper) {
  if (!cardWrapper || !window.QRCode) return;
  const qrContainer = cardWrapper.querySelector('.qr-box');
  if (!qrContainer || qrContainer.querySelector('img, canvas')) return;

  if (!window.IntersectionObserver) {
    renderCardQRCode(cardWrapper);
    return;
  }

  if (!cardQrObserver) {
    cardQrObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        renderCardQRCode(entry.target.closest('.card-ui-wrapper'));
      });
    }, { root: document.querySelector('.main-content'), rootMargin: '700px 0px' });
  }

  cardQrObserver.observe(qrContainer);
}

function yieldToBrowser() {
  return new Promise(resolve => window.setTimeout(resolve, 0));
}

function hasActiveCardFilter() {
  const filterEl = document.getElementById('filter-dept');
  const searchEl = document.getElementById('search-query');
  return !isMainDepartment() || (filterEl && filterEl.value !== 'ALL') || (searchEl && searchEl.value.trim());
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
  const selectedDept = deptSelect ? deptSelect.options[deptSelect.selectedIndex]?.text.trim() : '';
  const dept = isMainDepartment() ? normalizeDepartmentName(selectedDept) : normalizeDepartmentName(window.currentDepartment);
  const color = isMainDepartment() && deptSelect ? deptSelect.value : getCurrentDepartmentColor();
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

function getCardFormUrl(data) {
  const params = new URLSearchParams({ id: data.cardId || '' });
  if (data.dept) params.set('dept', normalizeDepartmentName(data.dept));
  return `${getPublicBaseUrl().replace(/\/$/, '')}/${getFormPath(data.propertyNo)}?${params.toString()}`;
}

function createCardId() {
  const department = normalizeDepartmentName(window.currentDepartment) || 'MAIN';
  const uniquePart = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 12)}`;
  return `card-${department.toLowerCase()}-${uniquePart}`;
}

function saveCardToFirebase(cardWrapper) {
  if (!firebaseInitialized || !firebaseFirestore) return;
  if (!cardWrapper) return;

  const data = getCardData(cardWrapper);
  const hasContent = Object.keys(data).some(key => key !== 'savedAt' && data[key]);
  if (!hasContent) return;

  const cardId = data.cardId || `card-${Math.random().toString(36).substring(2, 10)}`;
  data.cardId = cardId;
  try {
    data.qrUrl = getCardFormUrl(data);
  } catch (e) {
    data.qrUrl = '';
  }
  const cardDoc = firebaseFirestore.collection('propertyTags').doc(cardId);
  cardDoc.set(data)
    .then(() => {
      cardWrapper.dataset.cardId = cardId;
      if (!deferCardQrRendering) renderCardQRCode(cardWrapper);
      updateFirebaseStatus(`Saved card ${cardId}`, "#499632");
    })
    .catch((err) => {
      console.error('Firestore save error', err);
      updateFirebaseStatus(`Save failed for card ${cardId}`, "#9a0603");
    });
}

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

  const shortText = payload.url || (payload.cardId ? `${getPublicBaseUrl()}${window.location.pathname}?id=${encodeURIComponent(payload.cardId)}` : payload.cardId || '');
  if (!shortText) return;

  try {
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
    payload.url = getCardFormUrl(data);
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
  const color = isMainDepartment()
    ? document.getElementById('add-dept-select').value
    : getCurrentDepartmentColor();
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
  const container = document.querySelector('.select-card-floating');
  if (container) container.classList.toggle('open', willOpen);
}

function closeSelectPanel() {
  const panel = document.getElementById('select-panel');
  if (!panel) return;
  panel.classList.remove('open');
}

function updateCardsDateTime() {
  const container = document.getElementById('pages-container');
  if (!container) return;

  let dateTime = container.querySelector('.cards-datetime');
  if (!dateTime) {
    dateTime = document.createElement('div');
    dateTime.className = 'cards-datetime';
    dateTime.id = 'cards-datetime';
    dateTime.setAttribute('aria-live', 'polite');
    dateTime.innerHTML = `
      <div class="cards-brand-title">UNIVERSITY OF CAMARINES NORTE</div>
      <div class="cards-section-title">PROPERTY TAG</div>
      <div class="date-primary">
        <span class="date-weekday" data-date-weekday></span>
        <span class="date-day" data-date-day></span>
      </div>
      <div class="date-secondary">
        <span data-date-month-year></span>
        <span class="date-divider" aria-hidden="true">•</span>
        <span data-date-time></span>
      </div>
    `;
    container.prepend(dateTime);
  }

  const now = new Date();
  dateTime.querySelector('[data-date-weekday]').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(now);
  dateTime.querySelector('[data-date-day]').textContent = new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(now);
  dateTime.querySelector('[data-date-month-year]').textContent = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(now);
  dateTime.querySelector('[data-date-time]').textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(now);
}

updateCardsDateTime();
window.setInterval(updateCardsDateTime, 1000);

function addCards(amount) {
  for (let i = 0; i < amount; i++) {
    const defaultColor = isMainDepartment()
      ? ((uniqueCardId < defaultLayout.length) ? defaultLayout[uniqueCardId] : departments[0].color)
      : getCurrentDepartmentColor();
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
  knownCardCount = 0;

  for (let i = 0; i < defaultLayout.length; i++) {
    createSingleCard(defaultLayout[i]);
  }
}

function createSingleCard(initColor, cardData = null) {
  const container = document.getElementById('pages-container');
  updateCardsDateTime();
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
  
  const cardHtml = `
    <div class="card-ui-wrapper" id="card-wrapper-${currentIndex}">
      <div class="card-header-control">
        <label class="card-select-wrapper" title="Select card">
          <input type="checkbox" class="card-select" onchange="onCardCheckboxChange(this)">
        </label>
        <select class="neu-select dept-select" style="flex-grow: 1;" onchange="updateCardColor(this, ${currentIndex})">
          ${generateOptions(initColor)}
        </select>
        <button class="neu-btn danger" style="padding: 8px; width: auto; margin-left: 10px; flex-shrink: 0;" onclick="deleteCard(this)" title="Archive Card" aria-label="Archive card"><i class="fa-solid fa-box-archive" aria-hidden="true"></i></button>
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
          <div class="form-row"><label>Location:</label><input type="text" class="underline-input"></div>
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
  const departmentSelect = newCard.querySelector('.dept-select');
  if (!isMainDepartment() && departmentSelect) departmentSelect.hidden = true;
  newCard.dataset.cardId = cardData && cardData.cardId ? cardData.cardId : createCardId();
  allCards.push(newCard);

  if (!deferCardQrRendering) observeCardQRCode(newCard);

  newCard.addEventListener('click', function(e) {
    if (!document.body.classList.contains('selection-mode')) return;
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
      const optionToSelect = Array.from(deptSelect.options).find(opt => normalizeDepartmentName(opt.text) === normalizeDepartmentName(cardData.dept));
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
    
    if (cardData.quantity) newCard.dataset.quantity = cardData.quantity;
    if (cardData.unit) newCard.dataset.unit = cardData.unit;
  }

  setupFirebaseAutoSave(newCard);
  const textareas = newCard.querySelectorAll('textarea.auto-resize');
  textareas.forEach((ta) => {
    const adjust = (el) => {
      el.style.height = 'auto';
      const cs = window.getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize) || 18;
      const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.2;
      const padding = parseFloat(cs.paddingTop || 0) + parseFloat(cs.paddingBottom || 0) + 4;
      const maxH = (lineHeight * 2) + padding;

      let desired = Math.min(el.scrollHeight, maxH);
      el.style.height = desired + 'px';
      el.style.overflowY = 'hidden';

      el.style.height = Math.min(el.scrollHeight, maxH) + 'px';

      if (el.scrollHeight > lineHeight + padding) {
        el.style.fontSize = Math.max(14, fontSize - 2) + 'px';
      } else {
        el.style.fontSize = fontSize + 'px';
      }
    };

    ta.addEventListener('input', () => adjust(ta));
    ta.addEventListener('paste', () => setTimeout(() => adjust(ta), 40));
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const lines = (ta.value || '').split('\n');
        if (lines.length >= 2) {
          ev.preventDefault();
          setTimeout(() => adjust(ta), 0);
        }
      }
    });

    adjust(ta);
  });
}

async function deleteCard(btnElement) {
  const cardWrapper = btnElement.closest('.card-ui-wrapper');
  if (!cardWrapper) return;

  setDeleteLoadingState(true);
  updateFirebaseStatus('Archiving card... Please wait.', '#004aad');

  try {
    await archiveCardRecord(cardWrapper);

    allCards = allCards.filter(card => card !== cardWrapper);
    cardWrapper.remove();
    totalCardCount--;
    reorganizePages();
    refreshDashboardSummary();
    updateSelectionCount();

    if (allCards.length === 0) {
      restoreDefaultCards();
      refreshDashboardSummary();
      showAlert('Card archived successfully. No active cards remained, so blank entry cards have been restored.');
    } else {
      showAlert('Card archived successfully.');
    }

    updateFirebaseStatus('Archive completed.', '#499632');
  } catch (err) {
    console.error('Single card archive failed', err);
    updateFirebaseStatus('Card archive failed on the server.', '#9a0603');
    showAlert('The card could not be archived. It remains in the active list. Please try again.');
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

async function archiveCardRecord(cardWrapper) {
  if (!firebaseInitialized || !firebaseFirestore) return;
  const cardId = cardWrapper.dataset.cardId;
  if (!cardId) return;

  const activeRef = firebaseFirestore.collection('propertyTags').doc(cardId);
  const archiveRef = firebaseFirestore.collection('archivedPropertyTags').doc(cardId);
  const cardData = getCardData(cardWrapper);
  cardData.cardId = cardId;
  cardData.qrUrl = getCardFormUrl(cardData);
  await firebaseFirestore.runTransaction(async transaction => {
    const activeSnapshot = await transaction.get(activeRef);
    const archiveSnapshot = await transaction.get(archiveRef);
    if (archiveSnapshot.exists) throw new Error(`An archived record already exists for ${cardId}`);

    transaction.set(archiveRef, {
      ...(activeSnapshot.exists ? activeSnapshot.data() : {}),
      ...cardData,
      archivedAt: new Date().toISOString()
    });
    if (activeSnapshot.exists) transaction.delete(activeRef);
  });
}

async function deleteSelectedCards() {
  const selectedCards = getSelectedCards();
  if (selectedCards.length === 0) {
    showAlert('No cards selected for deletion.');
    return;
  }

  const confirmDelete = await showConfirm(`Archive ${selectedCards.length} selected card(s)? Their printed QR codes will continue to work. You can restore or permanently delete them from Archived Cards.`);
  if (!confirmDelete) return;

  const filterEl = document.getElementById('filter-dept');
  const activeDepartmentFilter = filterEl ? filterEl.value : 'ALL';
  const shouldResetFilterAfterDelete = activeDepartmentFilter !== 'ALL' &&
    selectedCards.every(card => getCardDepartmentName(card) === activeDepartmentFilter);

  setDeleteLoadingState(true);
  updateFirebaseStatus('Archiving selected cards... Please wait.', '#004aad');

  try {
    const results = await Promise.allSettled(selectedCards.map(cardWrapper => archiveCardRecord(cardWrapper)));
    const archivedCards = [];
    let failedCount = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        archivedCards.push(selectedCards[index]);
      } else {
        failedCount += 1;
        console.error('Selected card archive failed', result.reason);
      }
    });

    archivedCards.forEach((cardWrapper) => {
      allCards = allCards.filter(card => card !== cardWrapper);
      cardWrapper.remove();
      totalCardCount--;
    });

    if (archivedCards.length > 0) {
      if (allCards.length === 0) {
        restoreDefaultCards();
        if (filterEl) filterEl.value = 'ALL';
      } else if (shouldResetFilterAfterDelete) {
        resetFilterToAllDepartments();
      } else {
        reorganizePages();
      }
      refreshDashboardSummary();
      clearSelection();
    }

    if (failedCount > 0) {
      updateFirebaseStatus(`${failedCount} card(s) could not be archived.`, '#9a0603');
      showAlert(`${archivedCards.length} card(s) archived; ${failedCount} could not be archived and remain active.`);
    } else {
      updateFirebaseStatus('Archive completed.', '#499632');
      showAlert(allCards.length === 0
        ? 'Selected cards were archived successfully. No active cards remained, so blank entry cards have been restored.'
        : 'Selected cards were archived successfully.');
    }
  } catch (err) {
    console.error('Bulk archive failed', err);
    updateFirebaseStatus('Some cards could not be archived.', '#9a0603');
    showAlert('Some selected cards could not be archived. They remain in the active list. Please try again.');
  } finally {
    setDeleteLoadingState(false);
  }
}

function applyBatchAction() {
  const selectedCards = getSelectedCards();
  if (selectedCards.length === 0) {
    showAlert('Select at least one card to perform a batch action.');
    return;
  }
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
  updateCardsDateTime();
}

function reorganizePages(cardsList) {
  const container = document.getElementById('pages-container');
  const cardsToRender = Array.isArray(cardsList) ? cardsList : allCards;

  container.innerHTML = '';
  updateCardsDateTime();

  if (cardsToRender.length === 0) {
    const filterEl = document.getElementById('filter-dept');
    const selectedDepartment = filterEl && filterEl.value && filterEl.value !== 'ALL' ? filterEl.value : 'this department';
    renderEmptyDepartmentState(selectedDepartment);
    return;
  }

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

    currentGrid.appendChild(card);
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
  updateMainRenderStatus('Loading cards...');

  try {
    let cardsQuery = firebaseFirestore.collection('propertyTags');
    if (!isMainDepartment()) {
      const currentDepartment = normalizeDepartmentName(window.currentDepartment);
      cardsQuery = currentDepartment === 'ENTIENZA'
        ? cardsQuery.where('dept', 'in', ['ENTIENZA', 'IABD'])
        : cardsQuery.where('dept', '==', currentDepartment);
    }
    const snapshot = await Promise.race([
      cardsQuery.get(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore load timed out')), 8000))
    ]);
    if (snapshot.empty) {
      finishMainLoading();
      updateMainRenderStatus('', false);
      updateFirebaseStatus("No saved cards found. Starting fresh.", "#004aad");
      return false;
    }

    document.getElementById('pages-container').innerHTML = '';
    totalCardCount = 0;
    uniqueCardId = 0;
    allCards = [];
    knownCardCount = snapshot.size;
    loadedCardData = snapshot.docs.map(doc => ({ cardId: doc.id, ...doc.data() }));
    pendingCardData = [...loadedCardData];
    deferCardQrRendering = true;

    const savedCards = snapshot.docs;
    const renderSavedCard = (doc) => {
      const cardData = doc.data();
      const deptName = cardData.dept || '';
      const matchedDept = departments.find(d => d.name === normalizeDepartmentName(deptName));
      const color = cardData.color || (matchedDept ? matchedDept.color : departments[0].color);
      cardData.cardId = doc.id;
      createSingleCard(color, cardData);
    };

    const initialBatchSize = 20;
    cardsStillRendering = savedCards.length > initialBatchSize;
    savedCards.slice(0, initialBatchSize).forEach(renderSavedCard);

    deferCardQrRendering = false;
    finishMainLoading();
    updateMainRenderStatus(
      savedCards.length > initialBatchSize
        ? `Loading cards... ${Math.min(initialBatchSize, savedCards.length)} of ${savedCards.length}`
        : '',
      savedCards.length > initialBatchSize
    );
    renderLoadedCardQRCodes();

    (async () => {
      for (let start = initialBatchSize; start < savedCards.length; start += 20) {
        savedCards.slice(start, start + 20).forEach(renderSavedCard);
        updateMainRenderStatus(`Loading cards... ${Math.min(start + 20, savedCards.length)} of ${savedCards.length}`);
        await yieldToBrowser();
      }
      cardsStillRendering = false;
      knownCardCount = allCards.length;
      pendingCardData = [];
      applyFilter();
      renderLoadedCardQRCodes();
      refreshDashboardSummary();
      updateMainRenderStatus('', false);
    })().catch(error => console.error('Deferred card rendering error', error));

    updateFirebaseStatus(`Loaded ${snapshot.size} saved cards.`, "#499632");
    return true;
  } catch (err) {
    deferCardQrRendering = false;
    cardsStillRendering = false;
    pendingCardData = [];
    loadedCardData = [];
    finishMainLoading();
    updateMainRenderStatus('', false);
    console.error('Firestore load error', err);
    updateFirebaseStatus("Unable to load saved cards", "#9a0603");
    return false;
  }
}

window.onload = async function() {
  const sessionDepartment = sessionStorage.getItem('propertyCardDepartment');
  const rememberedDepartment = localStorage.getItem('propertyCardDepartment');
  const hasRememberedLogin = localStorage.getItem('propertyCardRememberLogin') === 'true';
  const currentDepartment = normalizeDepartmentName(sessionDepartment || (hasRememberedLogin ? rememberedDepartment : null));
  if (!currentDepartment) {
    const loginDelay = Math.max(0, 900 - (Date.now() - appSplashStartedAt));
    window.setTimeout(() => window.location.replace('login.html'), loginDelay);
    return;
  }

  sessionStorage.setItem('propertyCardDepartment', currentDepartment);
  window.currentDepartment = currentDepartment;
  finishAppSplash();
  initializeFirebase();
  const loaded = await loadCardsFromFirestore();
  if (!loaded) {
    addCards(isMainDepartment() ? departments.length : 2);
    finishMainLoading();
  }
  buildFilterOptions();
  setDepartmentScopedControls();
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
    refreshDashboardSummary();
  });
  filterSelect.addEventListener('change', () => { applyFilter(); refreshDashboardSummary(); });
  searchInput.addEventListener('input', () => { applyFilter(); refreshDashboardSummary(); });

  const selectPanel = document.getElementById('select-panel');
  const selectFab = document.getElementById('select-fab');

  const floatingSearch = document.getElementById('floating-search');
  const searchPanelEl = document.getElementById('search-panel');
  const searchTrigger = document.getElementById('search-trigger');
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

  document.addEventListener('click', (e) => {
    const target = e.target;

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

  setupKeyboardNavigation();
  applyFilter();
  refreshDashboardSummary();
};

function refreshDashboardSummary() {
  const filterEl = document.getElementById('filter-dept');
  const searchEl = document.getElementById('search-query');
  const filterValue = filterEl ? filterEl.value : 'ALL';
  const searchValue = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const sourceCards = cardsStillRendering && pendingCardData.length ? pendingCardData : allCards;
  const departmentCards = sourceCards.filter(card => {
    const department = typeof card === 'HTMLElement' ? getCardDepartmentName(card) : getCardDataDepartmentName(card);
    const matchesDepartment = isMainDepartment()
      ? (filterValue === 'ALL' || department === normalizeDepartmentName(filterValue))
      : department === normalizeDepartmentName(window.currentDepartment);
    return matchesDepartment;
  });

  const scopedCards = departmentCards.filter(card => {
    if (!searchValue) return true;
    const department = typeof card === 'HTMLElement' ? getCardDepartmentName(card) : getCardDataDepartmentName(card);

    const searchableText = typeof card === 'HTMLElement'
      ? `${department} ${Array.from(card.querySelectorAll('.underline-input')).map(field => field.value || '').join(' ')}`.toLowerCase()
      : `${department} ${[
        card.icsParNo, card.propertyNo, card.serialNo, card.dateAcquired,
        card.acquisitionCost, card.fund, card.endUserLocation, card.requestedBy,
        card.supplier, card.reference, card.itemDescription
      ].join(' ')}`.toLowerCase();
    return searchableText.includes(searchValue);
  });

  const totalSourceCards = isMainDepartment() && loadedCardData.length ? loadedCardData : sourceCards;
  const totalCards = isMainDepartment() ? totalSourceCards.length : sourceCards.length;
  const visibleCards = cardsStillRendering
    ? scopedCards.length
    : [...document.querySelectorAll('#pages-container .card-ui-wrapper')].filter(card => {
        const department = getCardDepartmentName(card);
        const matchesDepartment = isMainDepartment()
          ? (filterValue === 'ALL' || department === normalizeDepartmentName(filterValue))
          : department === normalizeDepartmentName(window.currentDepartment);
        if (!matchesDepartment || !searchValue) return matchesDepartment;
        const searchableText = `${department} ${Array.from(card.querySelectorAll('.underline-input'))
          .map(field => field.value || '').join(' ')}`.toLowerCase();
        return searchableText.includes(searchValue);
      }).length;

  document.getElementById('summary-total-cards').innerText = totalCards;
  document.getElementById('summary-visible-cards').innerText = visibleCards;
}

function getCardDataDepartmentName(cardData) {
  const explicitDepartment = cardData?.dept || cardData?.department || cardData?.office;
  if (explicitDepartment) return normalizeDepartmentName(explicitDepartment);

  const color = String(cardData?.color || '').toLowerCase();
  return normalizeDepartmentName(
    departments.find(department => department.color.toLowerCase() === color)?.name || ''
  );
}

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
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {range: 4, defval: "", raw: false});
      
      if(jsonData.length > 0) {
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
        fileInput.value = "";
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

function getExcelValue(row, targetHeader) {
  const target = targetHeader.toLowerCase().replace(/[\s\r\n]+/g, '');
  
  for (let key in row) {
    const currentKey = key.toLowerCase().replace(/[\s\r\n]+/g, '');
    if (currentKey === target) {
      return row[key];
    }
  }
  return '';
}

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
    const rowDepartmentValue = formatValue(getExcelValue(row, 'Department'));
    const normalizedRowDepartment = normalizeDepartmentName(rowDepartmentValue);

    const currentDepartment = normalizeDepartmentName(window.currentDepartment);
    if (!isMainDepartment() && !normalizedRowDepartment.includes(currentDepartment)) {
      continue;
    }

    const classification = formatValue(getExcelValue(row, 'Inventory/Property Classification'));
    const normalizedClassification = classification.toLowerCase().replace(/[\s\u00A0]+/g, ' ').trim();
    const shouldGenerate = normalizedClassification.includes('semi') || normalizedClassification.includes('non');

    if (!classification || !shouldGenerate) {
      continue;
    }

    let matchedColor = departments[0].color;
    let rowDept = isMainDepartment() ? rowDepartmentValue : window.currentDepartment;
    
    if (rowDept) {
       const cleanDept = normalizeDepartmentName(rowDept);
       
       const foundDept = departments.find(d => cleanDept.includes(d.name));
       if (foundDept) {
         matchedColor = foundDept.color;
       }
    }

    createSingleCard(matchedColor);
    
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
    const endUserFromRow = normalizedRowDepartment === 'ENTIENZA'
      ? normalizedRowDepartment
      : rowDepartmentValue;
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
    
    inputs[1].value = propertyNoFromRow;
    
    inputs[2].value = dateFromRow;
    
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
    
    inputs[4].value = fundFromRow;
    
    inputs[5].value = endUserFromRow;
    
    inputs[6].value = requestedByFromRow;
    
    inputs[7].value = supplierFromRow;
    
    inputs[8].value = referenceFromRow;
    
    inputs[9].value = descriptionFromRow;
    
    if (inputs[9] && inputs[9].tagName === 'TEXTAREA') {
      const ev = new Event('input', { bubbles: true });
      inputs[9].dispatchEvent(ev);
    }

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

    if (rowIndex % 20 === 19) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  deferCardQrRendering = false;
  if (container) container.style.display = previousDisplay;
  renderLoadedCardQRCodes();

  buildFilterOptions();
  applyFilter();
  return generatedCount;
}

function buildFilterOptions() {
  const filter = document.getElementById('filter-dept');
  if (!filter) return;
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

function getCardDepartmentName(card) {
  const deptSelect = card.querySelector('.dept-select');
  if (deptSelect && deptSelect.selectedIndex >= 0) {
    const deptText = deptSelect.options[deptSelect.selectedIndex]?.text.trim();
    if (deptText) return normalizeDepartmentName(deptText);
  }

  const inputs = card.querySelectorAll('.underline-input');
  return inputs[4] ? normalizeDepartmentName(inputs[4].value) : '';
}

function applyFilter() {
  const filterEl = document.getElementById('filter-dept');
  const searchVal = document.getElementById('search-query').value.trim().toLowerCase();
  const filterVal = filterEl ? filterEl.value : 'ALL';

  let cards = [...allCards];

  if (isMainDepartment() && filterVal && filterVal !== 'ALL') {
    cards = cards.filter(card => getCardDepartmentName(card) === normalizeDepartmentName(filterVal));
  } else if (!isMainDepartment()) {
    cards = cards.filter(card => getCardDepartmentName(card) === normalizeDepartmentName(window.currentDepartment));
  }

  if (searchVal) {
    cards = cards.filter(card => {
      const deptSelect = card.querySelector('.dept-select');
      const deptName = deptSelect && deptSelect.selectedIndex >= 0
        ? normalizeDepartmentName(deptSelect.options[deptSelect.selectedIndex].text)
        : '';

      const fields = Array.from(card.querySelectorAll('.underline-input'));
      const joinedFields = fields.map(field => (field.value || '').trim()).join(' ');
      const searchableText = `${deptName} ${joinedFields}`.toLowerCase();

      return searchableText.includes(searchVal);
    });
  }

  if (cards.length === 0) {
    renderEmptyDepartmentState(isMainDepartment() ? filterVal : window.currentDepartment);
    return;
  }

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

  const currentDepartment = isMainDepartment()
    ? (filterEl && filterEl.value && filterEl.value !== 'ALL' ? filterEl.value : addDeptSelect.value)
    : window.currentDepartment;
  addDeptSelect.value = currentDepartment;

  if (addQty) {
    addQty.value = '1';
  }

  addNewCards();
}

function setupKeyboardNavigation() {
  document.addEventListener('keydown', function(e) {
    const active = document.activeElement;
    if (!active || !active.classList) return;
    if (!active.classList.contains('underline-input')) return;
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
