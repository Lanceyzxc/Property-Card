const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getQuotaPeriod, createUsageService } = require('../lib/firebase-usage');

test('quota day follows Pacific midnight across seasons and DST transitions', () => {
  for (const [input, start] of [
    ['2026-01-01T07:59:00Z', '2025-12-31T08:00:00.000Z'],
    ['2026-01-01T08:00:00Z', '2026-01-01T08:00:00.000Z'],
    ['2026-07-01T08:00:00Z', '2026-07-01T07:00:00.000Z'],
    ['2026-03-08T20:00:00Z', '2026-03-08T08:00:00.000Z'],
    ['2026-11-01T20:00:00Z', '2026-11-01T07:00:00.000Z']
  ]) assert.equal(getQuotaPeriod(new Date(input)).start, start);
});

const sample = (count, endTime = '2026-10-21T08:55:00Z') => ({
  interval: { startTime: '2026-10-21T08:54:00Z', endTime }, value: { int64Value: String(count) }
});
function setup(fetchImpl, options = {}) {
  let instant = new Date('2026-10-21T09:00:00Z');
  const service = createUsageService({ fetchImpl, getAccessToken: async () => 'test-token',
    now: () => instant, config: { projectId: 'ucn-property-tag-b7e0a', databaseId: '(default)', ...options } });
  return { service, setTime: value => { instant = new Date(value); } };
}

test('sums paginated operation labels and scopes each query to the configured database', async () => {
  const requests = [];
  const { service } = setup(async url => {
    const u = new URL(url); requests.push(u);
    return { ok: true, json: async () => u.searchParams.has('pageToken')
      ? { timeSeries: [{ points: [sample(7)] }] }
      : { timeSeries: [{ points: [sample(2), sample(3)] }, { points: [sample(5)] }], nextPageToken: 'next' } };
  });
  const data = await service.getUsage();
  assert.equal(data.status, 'available');
  assert.equal(data.metrics.reads.used, 17);
  assert.equal(data.metrics.writes.used, 17);
  assert.equal(data.metrics.deletes.used, 17);
  assert.equal(data.metrics.reads.limit, 50000);
  assert.equal(requests.length, 6);
  for (const url of requests) {
    assert.equal(url.pathname, '/v3/projects/ucn-property-tag-b7e0a/timeSeries');
    assert.match(url.searchParams.get('filter'), /resource.type = "firestore.googleapis.com\/Database"/);
    assert.match(url.searchParams.get('filter'), /resource.labels.database_id = "\(default\)"/);
    assert.match(url.searchParams.get('filter'), /_ops_count/);
    assert.match(url.searchParams.get('filter'), /project = "ucn-property-tag-b7e0a"/);
    assert.equal(url.searchParams.get('interval.startTime'), '2026-10-21T07:00:00.000Z');
  }
});

test('missing samples stay unknown while an explicit zero is shown as zero', async () => {
  const { service } = setup(async url => ({ ok: true, json: async () =>
    new URL(url).searchParams.get('filter').includes('read_ops_count')
      ? { timeSeries: [{ points: [sample(0)] }] } : {} }));
  const data = await service.getUsage();
  assert.equal(data.metrics.reads.used, 0);
  assert.equal(data.metrics.writes.used, null);
  assert.equal(data.metrics.deletes.used, null);
});

test('coalesces concurrent requests, expires after five minutes, and labels failed refresh stale', async () => {
  let calls = 0, fail = false;
  const { service, setTime } = setup(async () => {
    calls++; if (fail) throw Error('secret-upstream-message');
    return { ok: true, json: async () => ({ timeSeries: [{ points: [sample(12)] }] }) };
  });
  const results = await Promise.all([service.getUsage(), service.getUsage()]);
  assert.equal(calls, 3); assert.equal(results[0].metrics.writes.used, 12);
  await service.getUsage(); assert.equal(calls, 3);
  setTime('2026-10-21T09:05:01Z'); fail = true;
  const stale = await service.getUsage();
  assert.equal(stale.status, 'stale'); assert.equal(stale.metrics.writes.used, 12);
  assert.doesNotMatch(JSON.stringify(stale), /secret-upstream/);
  setTime('2026-10-22T07:00:01Z');
  const nextDay = await service.getUsage();
  assert.equal(nextDay.status, 'unavailable'); assert.equal(nextDay.metrics.writes.used, null);
});

test('unconfigured access never calls Google or returns fabricated counts', async () => {
  const service = createUsageService({ config: {}, fetchImpl: () => { throw Error('must not call'); } });
  const data = await service.getUsage();
  assert.equal(data.status, 'unconfigured'); assert.equal(data.metrics.reads.used, null);
});

test('forbidden API and pagination overflow fail safely', async () => {
  for (const fetchImpl of [
    async () => ({ ok: false, status: 403, text: async () => 'private_key SECRET' }),
    async () => ({ ok: true, json: async () => ({ nextPageToken: 'loop', timeSeries: [{ points: [sample(1)] }] }) })
  ]) {
    const { service } = setup(fetchImpl);
    const data = await service.getUsage();
    assert.equal(data.status, 'unavailable');
    assert.equal(data.metrics.reads.used, null);
    assert.doesNotMatch(JSON.stringify(data), /SECRET|private_key|test-token/);
  }
});

test('refresh timeout includes token acquisition and stalled fetch', async () => {
  for (const authStalls of [true, false]) {
    const service = createUsageService({ config: { projectId: 'ucn-property-tag-b7e0a', timeoutMs: 15 },
      getAccessToken: () => authStalls ? new Promise(() => {}) : Promise.resolve('token'),
      fetchImpl: () => new Promise(() => {}) });
    const result = await service.getUsage();
    assert.equal(result.status, 'unavailable');
  }
});

test('partial monitoring pages never become trusted totals, including a later page', async () => {
  for (const field of ['executionErrors', 'unreachable']) {
    for (const partialPage of [1, 2]) {
      const { service } = setup(async url => {
        const page = new URL(url).searchParams.has('pageToken') ? 2 : 1;
        return { ok:true, json:async () => ({timeSeries:[{points:[sample(7)]}],
          ...(page === partialPage ? {[field]: field === 'unreachable' ? ['region'] : [{code:13,message:'SECRET'}]} : {}),
          ...(page === 1 ? {nextPageToken:'next'} : {})}) };
      });
      const data = await service.getUsage();
      assert.equal(data.status, 'unavailable'); assert.equal(data.metrics.reads.used, null);
      assert.doesNotMatch(JSON.stringify(data), /SECRET/);
    }
  }
});

test('partial monitoring refresh preserves previous same-day samples as stale', async () => {
  let partial = false;
  const {service, setTime} = setup(async () => ({ok:true, json:async () => ({
    timeSeries:[{points:[sample(17)]}], ...(partial ? {executionErrors:[{code:13}]} : {})
  })}));
  await service.getUsage(); partial = true; setTime('2026-10-21T09:06:00Z');
  const result = await service.getUsage();
  assert.equal(result.status, 'stale'); assert.equal(result.metrics.reads.used, 17);
});
