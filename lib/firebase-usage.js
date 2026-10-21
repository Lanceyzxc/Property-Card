const { GoogleAuth } = require('google-auth-library');

const LIMITS = { reads: 50000, writes: 20000, deletes: 20000 };
const METRICS = { reads: 'read_ops_count', writes: 'write_ops_count', deletes: 'delete_ops_count' };
const pacific = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

function getQuotaPeriod(now = new Date()) {
  const parts = date => Object.fromEntries(pacific.formatToParts(date).map(p => [p.type, p.value]));
  const p = parts(now);
  const midnight = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
  // Iterate the timezone offset at the target midnight, not the current time:
  // the offset can change during the quota day on a DST transition.
  let start = midnight;
  for (let i = 0; i < 3; i++) {
    const at = parts(new Date(start));
    const local = Date.UTC(+at.year, +at.month - 1, +at.day, +at.hour, +at.minute, +at.second);
    start = midnight - (local - start);
  }
  return { start: new Date(start).toISOString(), end: now.toISOString() };
}

function environmentConfig(env = process.env) {
  return {
    projectId: env.FIREBASE_USAGE_PROJECT_ID || 'ucn-property-tag-b7e0a',
    databaseId: env.FIREBASE_USAGE_DATABASE_ID || '(default)',
    credentialsJson: env.GOOGLE_SERVICE_ACCOUNT_JSON,
    useAdc: env.FIREBASE_USAGE_AUTH === 'adc'
  };
}

function createUsageService({ fetchImpl = globalThis.fetch, getAccessToken,
  now = () => new Date(), config = environmentConfig() } = {}) {
  const projectId = config.projectId || 'ucn-property-tag-b7e0a';
  const databaseId = config.databaseId || '(default)';
  let cache, pending, retryAfter = 0, auth;
  const configured = Boolean(getAccessToken || config.credentialsJson || config.useAdc);
  const empty = (status, at) => ({ status, projectId, databaseId,
    plan: 'Spark reference limits', periodStart: getQuotaPeriod(at).start,
    fetchedAt: null, sampledAt: null,
    metrics: Object.fromEntries(Object.entries(LIMITS).map(([key, limit]) =>
      [key, { used: null, limit, sampledAt: null }])) });

  async function token() {
    if (getAccessToken) return getAccessToken();
    if (!auth) {
      const credentials = config.credentialsJson ? JSON.parse(config.credentialsJson) : undefined;
      if (credentials && (credentials.type !== 'service_account' || credentials.project_id !== projectId)) {
        throw Error('Invalid monitoring credential configuration');
      }
      auth = new GoogleAuth({ credentials, projectId, scopes: ['https://www.googleapis.com/auth/monitoring.read'] });
    }
    const value = await auth.getAccessToken();
    if (!value) throw Error('Monitoring access unavailable');
    return value;
  }

  async function refresh(at) {
    const result = empty('available', at);
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(Error('Monitoring timeout')); }, config.timeoutMs || 10000);
    });
    const work = async () => {
      if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId) || !/^[a-zA-Z0-9()_-]+$/.test(databaseId)) {
        throw Error('Invalid monitoring configuration');
      }
      const accessToken = await token();
      const period = getQuotaPeriod(at);
      await Promise.all(Object.entries(METRICS).map(async ([key, metric]) => {
        let pageToken, count = 0, sampledAt = null, hasSamples = false;
        for (let page = 0; page < 20; page++) {
          if (controller.signal.aborted) throw Error('Monitoring timeout');
          const url = new URL(`https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries`);
          url.searchParams.set('filter', `metric.type = "firestore.googleapis.com/document/${metric}" AND resource.type = "firestore.googleapis.com/Database" AND resource.labels.database_id = "${databaseId}"`);
          url.searchParams.set('interval.startTime', period.start);
          url.searchParams.set('interval.endTime', period.end);
          url.searchParams.set('view', 'FULL');
          url.searchParams.set('pageSize', '1000');
          if (pageToken) url.searchParams.set('pageToken', pageToken);
          const response = await fetchImpl(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal
          });
          if (!response.ok) throw Error('Monitoring request failed');
          const data = await response.json();
          if (data.timeSeries !== undefined && !Array.isArray(data.timeSeries)) throw Error('Invalid monitoring response');
          for (const series of data.timeSeries || []) {
            for (const point of series.points || []) {
              const endTime = point.interval?.endTime;
              const stamp = Date.parse(endTime);
              if (!Number.isFinite(stamp)) throw Error('Invalid metric timestamp');
              if (stamp <= Date.parse(period.start) || stamp > at.getTime()) continue;
              const value = Number(point.value?.int64Value);
              if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(count + value)) {
                throw Error('Invalid metric value');
              }
              count += value; hasSamples = true;
              if (!sampledAt || stamp > Date.parse(sampledAt)) sampledAt = new Date(stamp).toISOString();
            }
          }
          pageToken = data.nextPageToken;
          if (!pageToken) break;
          if (page === 19) throw Error('Monitoring pagination exceeded');
        }
        result.metrics[key] = { used: hasSamples ? count : null, limit: LIMITS[key], sampledAt };
      }));
      result.fetchedAt = now().toISOString();
      const stamps = Object.values(result.metrics).map(m => m.sampledAt).filter(Boolean).sort();
      result.sampledAt = stamps[0] || null; // Oldest metric's latest sample is conservative.
      if (!stamps.length) result.status = 'unavailable';
      return result;
    };
    try { return await Promise.race([work(), timeout]); }
    finally { clearTimeout(timer); }
  }

  async function getUsage() {
    const at = now();
    if (!configured) return empty('unconfigured', at);
    const periodStart = getQuotaPeriod(at).start;
    if (cache && cache.periodStart !== periodStart) { cache = undefined; retryAfter = 0; }
    if (cache && at - Date.parse(cache.fetchedAt) < 300000) return cache;
    if (at.getTime() < retryAfter) return cache ? { ...cache, status: 'stale' } : empty('unavailable', at);
    if (!pending) {
      pending = refresh(at).then(result => {
        if (result.status === 'available') cache = result;
        else retryAfter = now().getTime() + 60000;
        return result;
      }).catch(() => {
        retryAfter = now().getTime() + 60000;
        return cache && cache.periodStart === getQuotaPeriod(now()).start
          ? { ...cache, status: 'stale' } : empty('unavailable', now());
      }).finally(() => { pending = undefined; });
    }
    const result = await pending;
    // Never deliver yesterday's result if a slow request crossed midnight.
    return result.periodStart === getQuotaPeriod(now()).start ? result : empty('unavailable', now());
  }
  return { getUsage };
}

module.exports = { getQuotaPeriod, createUsageService, environmentConfig };
