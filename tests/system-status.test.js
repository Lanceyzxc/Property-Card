const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

function usage(status = 'available', count = 40000) {
  return { status, periodStart: '2026-10-21T07:00:00.000Z', fetchedAt: '2026-10-21T09:00:00.000Z', sampledAt: '2026-10-21T08:56:00.000Z',
    metrics: { reads: { used: count, limit: 50000 }, writes: { used: 12, limit: 20000 }, deletes: { used: null, limit: 20000 } } };
}
async function load(t, data = usage(), fetchImpl, html = '<aside><section data-system-status></section></aside>', openUsage = true) {
  const dom = new JSDOM(html, {
    url:'https://example.com/index.html', runScripts:'outside-only', pretendToBeVisual:true
  });
  t.after(() => dom.window.close());
  // Fix the clock only; formatting and DOM manipulation remain real.
  dom.window.Date.now = () => Date.parse('2026-10-21T09:00:10Z');
  dom.window.fetch = fetchImpl || (async () => ({ status:200, json:async () => data }));
  dom.window.eval(fs.readFileSync('public/assets/js/system-status.js', 'utf8'));
  if (openUsage) dom.window.document.querySelector('[data-usage-toggle]')?.click();
  await new Promise(resolve => setImmediate(resolve));
  return dom.window;
}

test('usage is hidden behind a button and fetched only after the user opens it', async t => {
  let requests = 0;
  const win = await load(t, undefined, async () => {
    requests++; return {status:200, json:async () => usage()};
  }, undefined, false);
  const button = win.document.querySelector('button[data-usage-toggle]');
  assert.ok(button, 'usage needs a real button');
  const panel = win.document.getElementById(button.getAttribute('aria-controls'));
  assert.ok(panel.hidden);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(requests, 0);
  button.click(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(panel.hidden, false);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(requests, 1);
  assert.match(panel.textContent, /40,000/);
  button.click();
  assert.ok(panel.hidden);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  const token = win.SystemStatus.beginSave('test');
  win.SystemStatus.saveFailed(token, {code:'unavailable'});
  assert.match(win.document.querySelector('[data-save-status]').textContent, /not saved/i);
  assert.equal(win.document.querySelector('[data-save-status]').hidden, false);
});

test('renders reported usage, unknown counts and the 80 percent warning', async t => {
  const win = await load(t);
  assert.match(win.document.body.textContent, /40,000/);
  assert.match(win.document.body.textContent, /80%/);
  assert.match(win.document.body.textContent, /Unknown/);
  assert.match(win.document.body.textContent, /Near reference limit/);
  assert.match(win.document.body.textContent, /Last checked/);
  assert.match(win.document.body.textContent, /delayed/i);
  assert.equal(win.document.querySelector('[data-metric="reads"] progress').value, 80);
});

test('percentages can exceed 100 without overflowing progress bars', async t => {
  const win = await load(t, usage('available', 60000));
  assert.match(win.document.body.textContent, /120%/);
  assert.equal(win.document.querySelector('[data-metric="reads"] progress').value, 100);
  assert.match(win.document.body.textContent, /At or above reference limit/);
});

test('unconfigured, stale and unavailable states are explicit', async t => {
  for (const status of ['unconfigured','stale','unavailable']) {
    const win = await load(t, usage(status));
    assert.match(win.document.body.textContent, status === 'unconfigured' ? /not connected/i : status === 'stale' ? /stale/i : /unavailable/i);
    if (status === 'unconfigured' || status === 'unavailable') assert.doesNotMatch(win.document.body.textContent, /40,000/);
  }
});

test('one failed operation survives unrelated saves and older completions', async t => {
  const win = await load(t);
  const status = win.SystemStatus;
  const a = status.beginSave('card:a');
  const b = status.beginSave('card:b');
  status.saveFailed(a, {code:'resource-exhausted'});
  status.saveSucceeded(b);
  assert.match(win.document.querySelector('[data-save-status]').textContent, /not saved/i);
  assert.match(win.document.querySelector('[data-save-status]').textContent, /resource limit/i);
  const newer = status.beginSave('card:a');
  status.saveFailed(newer, {code:'permission-denied'});
  status.saveSucceeded(a);
  assert.match(win.document.querySelector('[data-save-status]').textContent, /permission/i);
  const retry = status.beginSave('card:a'); status.saveSucceeded(retry);
  assert.match(win.document.querySelector('[data-save-status]').textContent, /^Saved/);
});

test('pending edits are not Saved and failures explain connection or unknown errors', async t => {
  const win = await load(t);
  for (const [code, expected] of [['unavailable', /connection/i], ['unknown', /could not save/i]]) {
    const token = win.SystemStatus.beginSave('field:a');
    assert.doesNotMatch(win.document.querySelector('[data-save-status]').textContent, /^Saved/);
    win.SystemStatus.saveFailed(token, {code});
    assert.match(win.document.querySelector('[data-save-status]').textContent, expected);
    assert.match(win.document.querySelector('[data-save-status]').textContent, /reload/i);
  }
});

test('an API network failure never renders a successful zero', async t => {
  const win = await load(t, undefined, async () => { throw Error('offline'); });
  assert.match(win.document.body.textContent, /unavailable/i);
  assert.doesNotMatch(win.document.body.textContent, /0%/);
});

test('Property Cards marks an edit pending before debounce and reports a rejected write', async t => {
  const win = await load(t);
  let writes = 0;
  win.firebase = { initializeApp() {}, firestore: () => ({ collection: () => ({ doc: () => ({
    set: async () => { writes++; throw {code:'resource-exhausted'}; }
  }) }) }) };
  win.console.error = () => {};
  win.eval(fs.readFileSync('public/assets/js/main.js', 'utf8'));
  win.onload = null;
  win.initializeFirebase();
  const card = win.document.createElement('div'); card.dataset.cardId = 'card-test';
  card.innerHTML = '<input class="underline-input" value="Test item">';
  win.document.body.append(card);
  win.setupFirebaseAutoSave(card);
  card.querySelector('input').dispatchEvent(new win.Event('input'));
  assert.match(win.document.querySelector('[data-save-status]').textContent, /awaiting confirmation/i);
  assert.equal(writes, 0);
  await new Promise(resolve => setTimeout(resolve, 370));
  assert.equal(writes, 1);
  assert.match(win.document.querySelector('[data-save-status]').textContent, /not saved/i);
  assert.equal(card.querySelector('input').value, 'Test item');
});

test('Inventory Tags reports pending input then a confirmed field save', async t => {
  const win = await load(t);
  const writes = [];
  win.firebase = { firestore: () => ({ collection: () => ({doc: id => ({
    update: async data => { writes.push({id,data}); }
  })})}) };
  win.eval(fs.readFileSync('public/assets/js/inventory.js', 'utf8') + '\nwindow.__setRecords = records => { inventoryRecords = records; };');
  win.__setRecords([{cardId:'card-test', article:'old'}]);
  const wrap = win.document.createElement('div'); wrap.className = 'inventory-tag-wrap'; wrap.dataset.recordIndex = '0';
  wrap.innerHTML = '<strong contenteditable="true" data-field="article">New article</strong>';
  win.document.body.append(wrap); win.setupInventoryEditing(wrap);
  const input = wrap.querySelector('strong');
  input.dispatchEvent(new win.Event('input'));
  assert.match(win.document.querySelector('[data-save-status]').textContent, /awaiting confirmation/i);
  input.dispatchEvent(new win.Event('blur'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 1); assert.equal(writes[0].data.article, 'New article');
  assert.match(win.document.querySelector('[data-save-status]').textContent, /^Saved/);
});

async function liveInventory(t, update) {
  const win = await load(t, undefined, undefined, fs.readFileSync('public/inventory.html','utf8'));
  let notify;
  const record = {dept:'MAIN', propertyNo:'old', inventoryTag:'26-001', itemDescription:'Test item'};
  const snapshot = {docs:[{id:'card-test',data:() => ({...record})}]};
  win.sessionStorage.setItem('propertyCardDepartment','MAIN');
  win.console.error = () => {};
  const firestore = {collection: () => ({doc: () => ({update}), onSnapshot: callback => {
    notify = callback; callback(snapshot); return () => {};
  }}), runTransaction: async callback => callback({
    get:async () => ({exists:true,data:() => ({lastNumber:1})}), set() {}
  })};
  win.firebase = {initializeApp() {}, firestore:() => firestore};
  win.eval(fs.readFileSync('public/assets/js/inventory.js','utf8'));
  await win.startInventory();
  await new Promise(resolve => setImmediate(resolve));
  return {win, snapshot: async () => {notify(snapshot); await new Promise(resolve => setImmediate(resolve));}};
}

test('failed inventory draft survives rollback and unrelated snapshots until confirmed retry', async t => {
  let rejectWrite = true;
  const {win, snapshot} = await liveInventory(t, async () => { if (rejectWrite) throw {code:'resource-exhausted'}; });
  const field = () => win.document.querySelector('[data-field="propertyNo"]');
  field().textContent = 'unsaved'; field().dispatchEvent(new win.Event('input'));
  field().dispatchEvent(new win.Event('blur'));
  await new Promise(resolve => setImmediate(resolve));
  await snapshot(); await snapshot();
  assert.equal(field().textContent, 'unsaved');
  assert.match(win.document.querySelector('[data-save-status]').textContent, /not saved/i);
  rejectWrite = false; field().dispatchEvent(new win.Event('blur'));
  await new Promise(resolve => setImmediate(resolve));
  await snapshot();
  assert.equal(field().textContent, 'old'); // Confirmed revision no longer overlays incoming server data.
});

test('older successful inventory write cannot discard a newer pending field draft', async t => {
  const resolvers = [];
  const {win, snapshot} = await liveInventory(t, () => new Promise(resolve => resolvers.push(resolve)));
  const field = () => win.document.querySelector('[data-field="propertyNo"]');
  field().textContent = 'first'; field().dispatchEvent(new win.Event('input')); field().dispatchEvent(new win.Event('blur'));
  await new Promise(resolve => setImmediate(resolve));
  field().textContent = 'second'; field().dispatchEvent(new win.Event('input'));
  resolvers[0](); await new Promise(resolve => setImmediate(resolve));
  await snapshot();
  assert.equal(field().textContent, 'second');
  assert.match(win.document.querySelector('[data-save-status]').textContent, /awaiting confirmation/i);
});
