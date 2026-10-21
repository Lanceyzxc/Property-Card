const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createUsageHandler } = require('../api/usage');

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = value; } };
}

test('fixed aggregate GET contract ignores arbitrary query parameters and rejects mutations', async () => {
  let calls = 0;
  const handler = createUsageHandler({ getUsage: async (...args) => {
    assert.equal(args.length, 0); calls++;
    return { status: 'available', metrics: { reads: { used: 7, limit: 50000 } } };
  } });
  const res = response();
  await handler({ method: 'GET', url: '/api/usage?project=other&database=private' }, res);
  assert.equal(res.statusCode, 200); assert.equal(JSON.parse(res.body).metrics.reads.used, 7);
  assert.match(res.headers['Cache-Control'], /no-store/);
  const denied = response();
  await handler({ method: 'POST' }, denied);
  assert.equal(denied.statusCode, 405); assert.equal(denied.headers.Allow, 'GET'); assert.equal(calls, 1);
});

test('unconfigured and unavailable return 503 while stale data remains labelled', async () => {
  for (const [status, expected] of [['unconfigured', 503], ['unavailable', 503], ['stale', 200]]) {
    const res = response();
    await createUsageHandler({ getUsage: async () => ({ status }) })({ method: 'GET' }, res);
    assert.equal(res.statusCode, expected); assert.equal(JSON.parse(res.body).status, status);
  }
});

test('unexpected errors never disclose credentials or upstream error text', async () => {
  const res = response();
  await createUsageHandler({ getUsage: async () => { throw Error('private_key SECRET access_token'); } })({ method: 'GET' }, res);
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(res.body, /SECRET|private_key|access_token/);
});

test('malformed and mismatched service-account credentials fail without disclosure', async () => {
  const { createUsageService } = require('../lib/firebase-usage');
  for (const credentialsJson of ['private_key SECRET', JSON.stringify({type:'service_account',project_id:'other',private_key:'SECRET'})]) {
    const service = createUsageService({ config: {credentialsJson} });
    const res = response();
    await createUsageHandler(service)({method:'GET'}, res);
    assert.equal(res.statusCode, 503); assert.doesNotMatch(res.body, /SECRET|private_key/);
  }
});

test('local server serves pages, CSS, and the same honest unconfigured endpoint', async t => {
  const { createServer } = require('../server');
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const url of ['/', '/inventory.html', '/assets/css/styles.css']) {
    assert.equal((await fetch(base + url)).status, 200);
  }
  const usage = await fetch(base + '/api/usage?project=other');
  assert.equal(usage.status, 503); assert.equal((await usage.json()).status, 'unconfigured');
  assert.equal((await fetch(base + '/api/usage', {method:'POST'})).status, 405);
});
