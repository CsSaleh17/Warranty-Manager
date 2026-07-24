const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const npmCommand = process.platform === 'win32' ? process.execPath : 'npm';
const npmPrefix = process.platform === 'win32' ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')] : [];
const checks = [
  { name: 'backend tests', cwd: path.join(root, 'backend'), args: ['test'] },
  { name: 'backend syntax', cwd: path.join(root, 'backend'), args: ['run', 'syntax:check'] },
  { name: 'schema source', cwd: path.join(root, 'backend'), args: ['run', 'db:validate'] },
  { name: 'frontend tests', cwd: path.join(root, 'frontend'), args: ['test'] },
  { name: 'frontend build', cwd: path.join(root, 'frontend'), args: ['run', 'build'] }
];

for (const check of checks) {
  const result = spawnSync(npmCommand, [...npmPrefix, ...check.args], { cwd: check.cwd, env: process.env, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({ type: 'release_validation', status: 'failed', check: check.name, code: result.error?.code || result.status }));
    process.exit(result.status || 1);
  }
}

console.log(JSON.stringify({ type: 'release_validation', status: 'ok', checks: checks.length }));
