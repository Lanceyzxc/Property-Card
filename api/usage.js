const { createUsageService } = require('../lib/firebase-usage');

function createUsageHandler(service) {
  return async function usageHandler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.statusCode = 405;
      res.end(JSON.stringify({ status: 'unavailable', message: 'Method not allowed.' }));
      return;
    }
    try {
      const result = await service.getUsage();
      res.statusCode = ['available', 'stale'].includes(result.status) ? 200 : 503;
      res.end(JSON.stringify(result));
    } catch {
      res.statusCode = 503;
      res.end(JSON.stringify({ status: 'unavailable', message: 'Usage monitoring is unavailable.' }));
    }
  };
}

module.exports = createUsageHandler(createUsageService());
module.exports.createUsageHandler = createUsageHandler;
