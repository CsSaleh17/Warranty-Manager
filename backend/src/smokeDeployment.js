const { readDeploymentContext } = require('./deploymentSafety');

async function request(baseUrl, pathname) {
  const response = await fetch(new URL(pathname, baseUrl), { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  return { response, text: await response.text() };
}

function hasExpectedStatus(text, expected) {
  try {
    const body = JSON.parse(text);
    return body && typeof body === 'object' && body.status === expected;
  } catch {
    return false;
  }
}

async function main() {
  const context = readDeploymentContext({ ...process.env, DB_NAME: process.env.DB_NAME || 'not-used-by-smoke-test' });
  const rawUrl = process.env.STAGING_BASE_URL?.trim();
  if (!rawUrl) throw new Error('STAGING_BASE_URL is required.');
  const baseUrl = new URL(rawUrl);
  if (baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash || (context.environment === 'staging' && baseUrl.protocol !== 'https:')) throw new Error('STAGING_BASE_URL must be an exact HTTPS origin for staging.');
  const health = await request(baseUrl, '/api/health');
  const readiness = await request(baseUrl, '/api/ready');
  const failures = [];
  if (health.response.status !== 200 || !hasExpectedStatus(health.text, 'ok')) failures.push('health');
  if (readiness.response.status !== 200 || !hasExpectedStatus(readiness.text, 'ready')) failures.push('readiness');
  for (const [name, expected] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'SAMEORIGIN']]) {
    if (health.response.headers.get(name) !== expected) failures.push(name);
  }
  if (context.environment === 'staging' && !health.response.headers.get('strict-transport-security')) failures.push('strict-transport-security');
  if (failures.length) throw new Error(`Smoke checks failed: ${failures.join(', ')}.`);
  console.log(JSON.stringify({ type: 'deployment_smoke', status: 'ok', environment: context.environment, checks: 5 }));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ type: 'deployment_smoke', status: 'failed', code: error.code || error.name, message: error.message }));
    process.exitCode = 1;
  });
}

module.exports = { hasExpectedStatus, main };
