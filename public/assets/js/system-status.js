(function () {
  'use strict';
  const mounts = [...document.querySelectorAll('[data-system-status]')];
  const panels = [];
  const operations = new Map();
  let revision = 0, hasSaved = false, lastUsage = null, loading = false;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
  const currentDay = data => data?.periodStart && day.format(new Date(data.periodStart)) === day.format(new Date(Date.now()));

  for (const [index, mount] of mounts.entries()) {
    mount.classList.add('system-status', 'control-group');
    mount.innerHTML = '<p class="system-status-label">System status</p>' +
      '<p class="save-status" data-save-status role="status" aria-live="polite">Changes save automatically.</p>' +
      `<button class="neu-btn usage-toggle" data-usage-toggle type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="firebase-usage-panel-${index}">` +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19h16M7 15v-4m5 4V5m5 10V8" stroke-linecap="round"/></svg>System usage</button>';
    const button = mount.querySelector('[data-usage-toggle]');
    const panel = document.createElement('div');
    panel.id = `firebase-usage-panel-${index}`;
    panel.className = 'usage-panel usage-dialog-overlay';
    panel.setAttribute('data-usage-panel', ''); panel.hidden = true;
    panel.innerHTML = `<section class="usage-dialog" role="dialog" aria-modal="true" aria-labelledby="usage-title-${index}" aria-describedby="usage-description-${index}">` +
      '<header class="usage-dialog-header"><div><p class="usage-eyebrow">UCN ProCard</p>' +
      `<h2 id="usage-title-${index}">System usage</h2><p id="usage-description-${index}">Shared across all departments. No Google sign-in needed.</p></div>` +
      '<button class="neu-btn usage-close" data-usage-close type="button" aria-label="Close system usage">&times;</button></header>' +
      '<div class="usage-summary"><span class="usage-plan">Spark · Daily activity</span><span class="usage-state" data-usage-state role="status" aria-live="polite">Checking…</span></div>' +
      '<div class="usage-metrics" data-usage-metrics></div><p class="usage-time" data-usage-time></p>' +
      '<p class="usage-note">Usage reports may take a few minutes to update. Daily reference limits reset around midnight Pacific Time. Check the save status to confirm each change was stored.</p>' +
      '<footer class="usage-dialog-footer"><span>Same project-wide usage for every user</span><button class="neu-btn usage-refresh" data-usage-refresh type="button">Refresh usage</button></footer></section>';
    document.body.append(panel); panels.push(panel);
    const close = () => {
      panel.hidden = true; button.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('system-usage-open'); button.focus();
    };
    panel.querySelector('[data-usage-close]').addEventListener('click', close);
    panel.querySelector('[data-usage-refresh]').addEventListener('click', refreshUsage);
    panel.addEventListener('click', event => { if (event.target === panel) close(); });
    button.addEventListener('click', () => {
      if (!panel.hidden) { close(); return; }
      panel.hidden = false; button.setAttribute('aria-expanded', 'true');
      document.body.classList.add('system-usage-open');
      panel.querySelector('[data-usage-close]').focus(); refreshUsage();
    });
    document.addEventListener('keydown', event => {
      if (panel.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'Tab') {
        const items = [...panel.querySelectorAll('button:not([disabled])')];
        const first = items[0], last = items[items.length - 1];
        if (!items.includes(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }, true);
  }

  function errorMessage(error) {
    const code = String(error?.code || '').replace(/^firestore\//, '');
    if (code === 'resource-exhausted') return 'Firebase reported a resource limit. Try again later or contact the administrator.';
    if (code === 'permission-denied' || code === 'unauthenticated') return 'Firebase denied permission to save. Contact the administrator.';
    if (['unavailable', 'deadline-exceeded'].includes(code) || navigator.onLine === false) return 'Check your connection and try saving again.';
    return 'Could not save the change. Try editing the field again or contact the administrator.';
  }

  function renderSaves() {
    const entries = [...operations.values()];
    const failures = entries.filter(entry => entry.error);
    const pending = entries.filter(entry => entry.state === 'pending');
    let message = hasSaved ? 'Saved. All tracked changes are confirmed.' : 'Changes save automatically.';
    if (failures.length) message = `Not saved: ${failures.length} operation(s). ${errorMessage(failures[0].error)} Unsaved edits may be lost if you reload or leave.`;
    else if (pending.length) message = `Saving / awaiting confirmation: ${pending.length} operation(s). Keep this page open.`;
    for (const mount of mounts) {
      const node = mount.querySelector('[data-save-status]');
      node.textContent = message;
      node.dataset.state = failures.length ? 'error' : pending.length ? 'pending' : hasSaved ? 'saved' : 'idle';
    }
  }

  window.SystemStatus = {
    beginSave(key) {
      const token = { key, revision: ++revision };
      operations.set(key, { ...token, state: 'pending', error: operations.get(key)?.error });
      renderSaves(); return token;
    },
    saveSucceeded(token) {
      if (!token || operations.get(token.key)?.revision !== token.revision) return;
      operations.delete(token.key); hasSaved = true; renderSaves();
    },
    saveFailed(token, error) {
      if (!token || operations.get(token.key)?.revision !== token.revision) return;
      operations.set(token.key, { ...token, state: 'failed', error: error || {} }); renderSaves();
    }
  };

  function renderUsage(data) {
    const usable = ['available', 'stale'].includes(data?.status) && currentDay(data);
    for (const panel of panels) {
      const state = panel.querySelector('[data-usage-state]');
      const metrics = panel.querySelector('[data-usage-metrics]');
      const time = panel.querySelector('[data-usage-time]');
      metrics.replaceChildren(); time.textContent = '';
      state.textContent = data?.status === 'unconfigured' ? 'Not connected' : !usable ? 'Unavailable' : data.status === 'stale' ? 'Stale data' : 'Reported usage';
      state.dataset.state = usable && data.status !== 'stale' ? 'available' : 'warning';
      if (!usable) {
        time.textContent = data?.status === 'unconfigured' ? 'Usage monitoring has not been connected by the administrator.' : 'Usage could not be checked. Saving status is shown separately.';
        continue;
      }
      for (const [key, label] of [['reads', 'Reads'], ['writes', 'Writes'], ['deletes', 'Deletes']]) {
        const metric = data.metrics?.[key];
        const known = Number.isFinite(metric?.used) && metric.used >= 0 && Number.isFinite(metric?.limit) && metric.limit > 0;
        const percent = known ? metric.used / metric.limit * 100 : null;
        const row = document.createElement('div'); row.className = 'usage-metric'; row.dataset.metric = key;
        const text = document.createElement('p');
        const heading = document.createElement('h3'); heading.textContent = label; row.append(heading);
        text.textContent = known ? `${metric.used.toLocaleString('en-US')} / ${metric.limit.toLocaleString('en-US')} (${Number(percent.toFixed(1))}%)` : 'Unknown';
        row.append(text);
        if (known) {
          const bar = document.createElement('progress'); bar.max = 100; bar.value = Math.min(100, percent);
          bar.setAttribute('aria-label', `${label}: ${Number(percent.toFixed(1))}% of reference limit`); row.append(bar);
          if (percent >= 80) {
            row.dataset.level = percent >= 100 ? 'limit' : 'warning';
            const warning = document.createElement('small');
            warning.textContent = percent >= 100 ? 'At or above reference limit' : 'Near reference limit'; row.append(warning);
          }
        }
        metrics.append(row);
      }
      const format = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'unknown';
      time.textContent = `Last checked: ${format(data.fetchedAt)}. Metric sample: ${format(data.sampledAt)}.${data.status === 'stale' ? ' Stale: latest refresh failed.' : ''}`;
    }
  }

  async function refreshUsage() {
    if (loading || document.hidden || !panels.some(panel => !panel.hidden)) return;
    loading = true;
    panels.forEach(panel => { panel.querySelector('[data-usage-refresh]').disabled = true; });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/usage', { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
      const data = await response.json();
      if (!['available', 'stale', 'unconfigured', 'unavailable'].includes(data.status)) throw Error('Invalid usage response');
      if (['available', 'stale'].includes(data.status) && currentDay(data)) lastUsage = data;
      else lastUsage = null;
      renderUsage(data);
    } catch {
      renderUsage(lastUsage && currentDay(lastUsage) ? { ...lastUsage, status: 'stale' } : { status: 'unavailable' });
    } finally {
      clearTimeout(timer); loading = false;
      panels.forEach(panel => { panel.querySelector('[data-usage-refresh]').disabled = false; });
    }
  }

  window.addEventListener('beforeunload', event => {
    if (operations.size) { event.preventDefault(); event.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshUsage(); });
  setInterval(refreshUsage, 300000);
})();
