const ARCHIVE_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA1q2b0fyIidVRspGg31_xF_vpOu8dYRug',
  authDomain: 'ucn-property-tag-b7e0a.firebaseapp.com',
  projectId: 'ucn-property-tag-b7e0a',
  storageBucket: 'ucn-property-tag-b7e0a.firebasestorage.app',
  messagingSenderId: '252936858515',
  appId: '1:252936858515:web:3026ba3bfdb080949ad666',
  measurementId: 'G-TSRG9YCCHN'
};

let archiveRecords = [];
let selectedArchiveIds = new Set();

function normalizeArchiveDepartment(value) {
  const department = String(value || '').trim().toUpperCase();
  if (department === 'GASS') return 'MAIN';
  return department === 'IABD' ? 'ENTIENZA' : department;
}

function setArchiveMessage(message, type = 'success') {
  const element = document.getElementById('archive-message');
  element.textContent = message;
  element.className = `report-message is-${type}`;
  element.hidden = !message;
}

function formatArchiveDate(value) {
  if (!value) return 'Unknown';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function createArchiveCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value || '—';
  return cell;
}

function confirmArchiveAction({ title, message, confirmLabel, destructive = false }) {
  const dialog = document.getElementById('archive-confirm-dialog');
  const confirmButton = document.getElementById('archive-dialog-confirm');
  document.getElementById('archive-dialog-title').textContent = title;
  document.getElementById('archive-dialog-message').textContent = message;
  confirmButton.textContent = confirmLabel;
  confirmButton.classList.toggle('is-destructive', destructive);

  return new Promise(resolve => {
    const finish = value => {
      if (dialog.open) dialog.close(value ? 'confirm' : 'cancel');
    };
    const handleClose = () => resolve(dialog.returnValue === 'confirm');
    dialog.addEventListener('close', handleClose, { once: true });
    document.getElementById('archive-dialog-cancel').onclick = () => finish(false);
    confirmButton.onclick = () => finish(true);
    dialog.oncancel = event => {
      event.preventDefault();
      finish(false);
    };
    dialog.onclick = event => {
      if (event.target === dialog) finish(false);
    };
    dialog.showModal();
  });
}

async function restoreArchivedCard(cardId, firestore) {
  const activeRef = firestore.collection('propertyTags').doc(cardId);
  const archiveRef = firestore.collection('archivedPropertyTags').doc(cardId);

  return firestore.runTransaction(async transaction => {
    const archivedSnapshot = await transaction.get(archiveRef);
    const activeSnapshot = await transaction.get(activeRef);
    if (!archivedSnapshot.exists) return false;
    if (activeSnapshot.exists) throw new Error('An active card already uses this ID.');

    const { archivedAt, ...cardData } = archivedSnapshot.data();
    transaction.set(activeRef, cardData);
    transaction.delete(archiveRef);
    return true;
  });
}

async function permanentlyDeleteArchivedCard(cardId, firestore) {
  await firestore.collection('archivedPropertyTags').doc(cardId).delete();
}

function getVisibleArchiveRecords() {
  const search = document.getElementById('archive-search').value.trim().toLowerCase();
  return archiveRecords.filter(record => [
    record.dept,
    record.inventoryTag,
    record.propertyNo,
    record.itemDescription,
    record.icsParNo,
    record.requestedBy,
    record.endUserLocation
  ].some(value => String(value || '').toLowerCase().includes(search)));
}

function updateArchiveSelectionControls(visibleRecords) {
  const visibleSelectedCount = visibleRecords.filter(record => selectedArchiveIds.has(record.cardId)).length;
  const selectedCount = selectedArchiveIds.size;
  const selectAll = document.getElementById('select-all-visible');
  selectAll.checked = visibleRecords.length > 0 && visibleSelectedCount === visibleRecords.length;
  selectAll.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < visibleRecords.length;
  selectAll.disabled = visibleRecords.length === 0;
  document.getElementById('archive-selected-count').textContent = `${selectedCount} selected`;
  document.getElementById('restore-selected').disabled = selectedCount === 0;
  document.getElementById('delete-selected').disabled = selectedCount === 0;
}

function renderArchiveRows() {
  const body = document.getElementById('archive-records');
  const visibleRecords = getVisibleArchiveRecords();

  body.replaceChildren();
  document.getElementById('archive-count').textContent = `${visibleRecords.length} archived card${visibleRecords.length === 1 ? '' : 's'}`;
  updateArchiveSelectionControls(visibleRecords);
  if (visibleRecords.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'table-empty';
    cell.colSpan = 7;
    cell.textContent = archiveRecords.length ? 'No matching archived cards.' : 'No archived cards.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  visibleRecords.forEach(record => {
    const row = document.createElement('tr');
    row.classList.toggle('is-selected', selectedArchiveIds.has(record.cardId));
    const selectCell = document.createElement('td');
    selectCell.className = 'archive-row-select';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedArchiveIds.has(record.cardId);
    checkbox.setAttribute('aria-label', `Select archived card ${record.propertyNo || record.cardId}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedArchiveIds.add(record.cardId);
      else selectedArchiveIds.delete(record.cardId);
      renderArchiveRows();
    });
    selectCell.appendChild(checkbox);
    row.append(
      selectCell,
      createArchiveCell(record.dept),
      createArchiveCell(record.inventoryTag),
      createArchiveCell(record.propertyNo),
      createArchiveCell(record.itemDescription),
      createArchiveCell(formatArchiveDate(record.archivedAt))
    );

    const actionsCell = document.createElement('td');
    actionsCell.className = 'archive-actions-cell';
    const actions = document.createElement('div');
    actions.className = 'archive-actions';

    const restoreButton = document.createElement('button');
    restoreButton.className = 'archive-action archive-restore';
    restoreButton.type = 'button';
    restoreButton.innerHTML = '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i><span>Restore</span>';
    restoreButton.addEventListener('click', async () => {
      const confirmed = await confirmArchiveAction({
        title: 'Restore card?',
        message: 'This card will return to active property cards. Its printed QR code will continue working.',
        confirmLabel: 'Restore card'
      });
      if (!confirmed) return;
      restoreButton.disabled = true;
      try {
        const restored = await restoreArchivedCard(record.cardId, firestore);
        if (restored) selectedArchiveIds.delete(record.cardId);
        setArchiveMessage(restored ? 'Card restored to active property cards.' : 'This archived card is no longer available.');
        renderArchiveRows();
      } catch (error) {
        console.error('Card restore failed', error);
        setArchiveMessage(error.message || 'The card could not be restored.', 'error');
      } finally {
        restoreButton.disabled = false;
      }
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'archive-action archive-permanent-delete';
    deleteButton.type = 'button';
    deleteButton.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i><span>Delete permanently</span>';
    deleteButton.addEventListener('click', async () => {
      const confirmed = await confirmArchiveAction({
        title: 'Delete card permanently?',
        message: 'This removes the archived record permanently. Its printed QR code will no longer show the card details. This cannot be undone.',
        confirmLabel: 'Delete permanently',
        destructive: true
      });
      if (!confirmed) return;
      deleteButton.disabled = true;
      try {
        await permanentlyDeleteArchivedCard(record.cardId, firestore);
        selectedArchiveIds.delete(record.cardId);
        setArchiveMessage('Card permanently deleted. Its QR code will no longer load its details.');
        renderArchiveRows();
      } catch (error) {
        console.error('Permanent card deletion failed', error);
        setArchiveMessage('The card could not be permanently deleted.', 'error');
      } finally {
        deleteButton.disabled = false;
      }
    });

    actions.append(restoreButton, deleteButton);
    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    body.appendChild(row);
  });
  updateArchiveSelectionControls(visibleRecords);
}

async function runBulkArchiveAction(action, firestore) {
  const cardIds = [...selectedArchiveIds];
  if (cardIds.length === 0) return;

  const isDelete = action === 'delete';
  const cardNoun = cardIds.length === 1 ? 'card' : 'cards';
  const confirmed = await confirmArchiveAction({
    title: isDelete ? `Delete ${cardIds.length} ${cardNoun} permanently?` : `Restore ${cardIds.length} ${cardNoun}?`,
    message: isDelete
      ? 'These archived records will be removed permanently. Their printed QR codes will stop showing card details. This cannot be undone.'
      : 'These cards will return to active property cards. Their printed QR codes will continue working.',
    confirmLabel: isDelete ? 'Delete permanently' : 'Restore cards',
    destructive: isDelete
  });
  if (!confirmed) return;

  const actionButtons = [document.getElementById('restore-selected'), document.getElementById('delete-selected')];
  actionButtons.forEach(button => { button.disabled = true; });
  const results = await Promise.allSettled(cardIds.map(cardId =>
    isDelete ? permanentlyDeleteArchivedCard(cardId, firestore) : restoreArchivedCard(cardId, firestore)
  ));
  let successCount = 0;
  let failureCount = 0;
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successCount += 1;
      selectedArchiveIds.delete(cardIds[index]);
    } else {
      failureCount += 1;
      console.error(`Bulk archive ${action} failed for ${cardIds[index]}`, result.reason);
    }
  });

  setArchiveMessage(failureCount
    ? `${successCount} card(s) completed; ${failureCount} failed and remain selected.`
    : isDelete
      ? `${successCount} card(s) permanently deleted. Their QR codes will no longer load.`
      : `${successCount} card(s) restored to active property cards.`, failureCount ? 'error' : 'success');
  renderArchiveRows();
}

function startArchivePage() {
  const storedDepartment = sessionStorage.getItem('propertyCardDepartment') ||
    (localStorage.getItem('propertyCardRememberLogin') === 'true' ? localStorage.getItem('propertyCardDepartment') : '');
  const department = normalizeArchiveDepartment(storedDepartment);
  if (!department) {
    window.location.replace('login.html');
    return;
  }

  try {
    firebase.initializeApp(ARCHIVE_FIREBASE_CONFIG);
  } catch (error) {
    if (!firebase.apps?.length) throw error;
  }

  const firestore = firebase.firestore();
  let query = firestore.collection('archivedPropertyTags');
  if (department !== 'MAIN') {
    query = department === 'ENTIENZA'
      ? query.where('dept', 'in', ['ENTIENZA', 'IABD'])
      : query.where('dept', '==', department);
  }
  document.getElementById('archive-scope').textContent = department === 'MAIN' ? 'All departments' : department;
  document.getElementById('archive-search').addEventListener('input', renderArchiveRows);
  document.getElementById('select-visible').addEventListener('click', () => {
    getVisibleArchiveRecords().forEach(record => selectedArchiveIds.add(record.cardId));
    renderArchiveRows();
  });
  document.getElementById('clear-selection').addEventListener('click', () => {
    selectedArchiveIds.clear();
    renderArchiveRows();
  });
  document.getElementById('select-all-visible').addEventListener('change', event => {
    getVisibleArchiveRecords().forEach(record => {
      if (event.target.checked) selectedArchiveIds.add(record.cardId);
      else selectedArchiveIds.delete(record.cardId);
    });
    renderArchiveRows();
  });
  document.getElementById('restore-selected').addEventListener('click', () => runBulkArchiveAction('restore', firestore));
  document.getElementById('delete-selected').addEventListener('click', () => runBulkArchiveAction('delete', firestore));

  query.onSnapshot(snapshot => {
    archiveRecords = snapshot.docs
      .map(doc => ({ cardId: doc.id, ...doc.data() }))
      .sort((left, right) => String(right.archivedAt || '').localeCompare(String(left.archivedAt || '')));
    const availableIds = new Set(archiveRecords.map(record => record.cardId));
    selectedArchiveIds = new Set([...selectedArchiveIds].filter(cardId => availableIds.has(cardId)));
    renderArchiveRows();
  }, error => {
    console.error('Archive load failed', error);
    document.getElementById('archive-count').textContent = 'Unable to load archived cards';
    setArchiveMessage('Archived cards could not be loaded. Check the connection and Firestore access rules.', 'error');
    const body = document.getElementById('archive-records');
    body.replaceChildren();
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'table-empty';
    cell.colSpan = 7;
    cell.textContent = 'Unable to load archived cards.';
    row.appendChild(cell);
    body.appendChild(row);
  });
}

startArchivePage();