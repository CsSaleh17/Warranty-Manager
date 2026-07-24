const {
  readDeploymentContext,
  assertDatabaseMutationAllowed,
  assertIsolatedRestoreTarget
} = require('../src/deploymentSafety');

describe('deployment target safety', () => {
  const staging = {
    DEPLOYMENT_ENV: 'staging',
    DB_HOST: '127.0.0.1',
    DB_NAME: 'warranty_manager_staging',
    STAGING_DATABASE_CONFIRMED: 'true'
  };

  it('requires an explicit deployment environment', () => {
    expect(() => readDeploymentContext({ DB_NAME: 'test' })).toThrow('DEPLOYMENT_ENV');
  });

  it('allows a confirmed staging database mutation', () => {
    const context = readDeploymentContext(staging);
    expect(() => assertDatabaseMutationAllowed(context, 'migrate')).not.toThrow();
  });

  it('supports one-operation staging confirmation without persisting the flag', () => {
    const context = readDeploymentContext({ ...staging, STAGING_DATABASE_CONFIRMED: 'false' }, ['--confirm-staging']);
    expect(() => assertDatabaseMutationAllowed(context, 'migrate')).not.toThrow();
  });

  it('rejects an unconfirmed staging database and all development targets', () => {
    expect(() => assertDatabaseMutationAllowed(readDeploymentContext({ ...staging, STAGING_DATABASE_CONFIRMED: 'false' }), 'migrate')).toThrow('confirmed');
    expect(() => assertDatabaseMutationAllowed(readDeploymentContext({ ...staging, DEPLOYMENT_ENV: 'development' }), 'migrate')).toThrow('staging or production');
  });

  it('requires an operation-specific production approval value', () => {
    const context = readDeploymentContext({ ...staging, DEPLOYMENT_ENV: 'production', PRODUCTION_CHANGE_APPROVED: 'backup' });
    expect(() => assertDatabaseMutationAllowed(context, 'migrate')).toThrow('PRODUCTION_CHANGE_APPROVED=migrate');
    expect(() => assertDatabaseMutationAllowed(context, 'backup')).not.toThrow();
  });

  it('requires restore targets to be distinct and explicitly isolated', () => {
    const context = readDeploymentContext(staging);
    expect(() => assertIsolatedRestoreTarget(context, { RESTORE_DB_NAME: staging.DB_NAME, RESTORE_DATABASE_CONFIRMED: 'true' })).toThrow('different');
    expect(() => assertIsolatedRestoreTarget(context, { RESTORE_DB_NAME: 'warranty_restore' })).toThrow('RESTORE_DATABASE_CONFIRMED');
    expect(assertIsolatedRestoreTarget(context, { RESTORE_DB_NAME: 'warranty_restore', RESTORE_DATABASE_CONFIRMED: 'true' })).toBe('warranty_restore');
  });
});
