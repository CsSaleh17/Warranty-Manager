const ALLOWED_ENVIRONMENTS = new Set(['development', 'staging', 'production']);

function readDeploymentContext(source = process.env, args = process.argv.slice(2)) {
  const environment = source.DEPLOYMENT_ENV?.trim();
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error('DEPLOYMENT_ENV must be explicitly set to development, staging, or production.');
  }

  const databaseName = source.DB_NAME?.trim();
  if (!databaseName) throw new Error('DB_NAME is required for database deployment operations.');

  return {
    environment,
    databaseHost: source.DB_HOST?.trim() || 'localhost',
    databaseName,
    stagingConfirmed: source.STAGING_DATABASE_CONFIRMED === 'true' || args.includes('--confirm-staging'),
    productionApproval: source.PRODUCTION_CHANGE_APPROVED?.trim() || ''
  };
}

function assertDatabaseMutationAllowed(context, operation) {
  if (!operation) throw new Error('A deployment operation name is required.');
  if (context.environment === 'staging') {
    if (!context.stagingConfirmed) throw new Error('The staging database must be explicitly confirmed with STAGING_DATABASE_CONFIRMED=true.');
    return;
  }
  if (context.environment === 'production') {
    if (context.productionApproval !== operation) {
      throw new Error(`Production ${operation} requires PRODUCTION_CHANGE_APPROVED=${operation}.`);
    }
    return;
  }
  throw new Error('Database mutations are allowed only for an explicitly confirmed staging or production target.');
}

function assertIsolatedRestoreTarget(context, source = process.env) {
  if (context.environment === 'production') throw new Error('Restore verification must never overwrite or target production.');
  const restoreName = source.RESTORE_DB_NAME?.trim();
  if (!restoreName) throw new Error('RESTORE_DB_NAME is required.');
  if (restoreName === context.databaseName) throw new Error('RESTORE_DB_NAME must be different from DB_NAME.');
  if (source.RESTORE_DATABASE_CONFIRMED !== 'true') throw new Error('RESTORE_DATABASE_CONFIRMED=true is required for the isolated restore target.');
  return restoreName;
}

module.exports = { readDeploymentContext, assertDatabaseMutationAllowed, assertIsolatedRestoreTarget };
