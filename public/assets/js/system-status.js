(function () {
  'use strict';
  const mounts = [...document.querySelectorAll('[data-system-status]')];
  const operations = new Map();
  let revision = 0, hasSaved = false, lastUsage = null, loading = false;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
  const currentDay = data => data?.periodStart && day.format(new Date(data.periodStart)) === day.format(new Date(Date.now()));

  for (const mount of mounts) {
    mount.classList.add('system-status');
    mount.innerHTML = '<p class="save-status" data-save-status role="status" aria-live="polite">Changes save automatically.</p>' +
      '<details open><summary>Firebase usage <span class="usage-state" data-usage-state>Checking…</span></summary>' +
      '<div data-usage-metrics></div><p class="usage-note" data-usage-time></p>' +
      '<p class="usage-note">Reported activity is delayed and may differ from quota accounting. Spark daily reference limits; resets around midnight Pacific.</p>' +
      '<a href="https://console.firebase.google.com/project/ucn-property-tag-b7e0a/usage" target="_blank" rel="noopener noreferrer">View Firebase Console</a></details>';
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
    for (const mount of mounts) {
      const state = mount.querySelector('[data-usage-state]');
      const metrics = mount.querySelector('[data-usage-metrics]');
      const time = mount.querySelector('[data-usage-time]');
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
        text.textContent = known ? `${label}: ${metric.used.toLocaleString('en-US')} / ${metric.limit.toLocaleString('en-US')} (${Number(percent.toFixed(1))}%)` : `${label}: Unknown`;
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
    if (loading || document.hidden || !mounts.length) return;
    loading = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/usage', { signal: controller.signal, cache: 'no-store' });
      const data = await response.json();
      if (!['available', 'stale', 'unconfigured', 'unavailable'].includes(data.status)) throw Error('Invalid usage response');
      if (['available', 'stale'].includes(data.status) && currentDay(data)) lastUsage = data;
      else lastUsage = null;
      renderUsage(data);
    } catch {
      renderUsage(lastUsage && currentDay(lastUsage) ? { ...lastUsage, status: 'stale' } : { status: 'unavailable' });
    } finally { clearTimeout(timer); loading = false; }
  }

  window.addEventListener('beforeunload', event => {
    if (operations.size) { event.preventDefault(); event.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshUsage(); });
  setInterval(refreshUsage, 300000);
  refreshUsage();
})();
