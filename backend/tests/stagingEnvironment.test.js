const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildStagingEnvironment, createStagingEnvironment } = require('../src/createStagingEnvironment');

describe('staging environment generator', () => {
  it('fills generated secrets without confirming the database target', () => {
    const output = buildStagingEnvironment('STAGING_DATABASE_CONFIRMED=true\nSESSION_SECRET=\nDB_PASSWORD=\nMYSQL_ROOT_PASSWORD=\nUPLOAD_DIRECTORY=\n', {
      sessionSecret: 'session-value', databasePassword: 'database-value', rootPassword: 'root-value', uploadDirectory: 'C:\\private\\uploads'
    });
    expect(output).toContain('STAGING_DATABASE_CONFIRMED=false');
    expect(output).toContain('SESSION_SECRET=session-value');
    expect(output).toContain('DB_PASSWORD=database-value');
    expect(output).toContain('MYSQL_ROOT_PASSWORD=root-value');
    expect(output).toContain('UPLOAD_DIRECTORY=C:\\private\\uploads');
  });

  it('creates an ignored local file once and refuses overwrite', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'staging-env-test-'));
    try {
      fs.writeFileSync(path.join(root, '.env.staging.example'), 'STAGING_DATABASE_CONFIRMED=false\nSESSION_SECRET=\nDB_PASSWORD=\nMYSQL_ROOT_PASSWORD=\nUPLOAD_DIRECTORY=\n');
      const result = createStagingEnvironment(root);
      expect(result.created).toBe(true);
      expect(fs.existsSync(path.join(root, '.staging-data', 'uploads'))).toBe(true);
      expect(() => createStagingEnvironment(root)).toThrow('already exists');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
