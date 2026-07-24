const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function replaceValue(template, name, value) {
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (!pattern.test(template)) throw new Error(`Staging environment template is missing ${name}.`);
  return template.replace(pattern, `${name}=${value}`);
}

function buildStagingEnvironment(template, values) {
  let output = template;
  output = replaceValue(output, 'STAGING_DATABASE_CONFIRMED', 'false');
  output = replaceValue(output, 'SESSION_SECRET', values.sessionSecret);
  output = replaceValue(output, 'DB_PASSWORD', values.databasePassword);
  output = replaceValue(output, 'MYSQL_ROOT_PASSWORD', values.rootPassword);
  output = replaceValue(output, 'UPLOAD_DIRECTORY', values.uploadDirectory);
  return output;
}

function createStagingEnvironment(root = path.resolve(__dirname, '../..')) {
  const destination = path.join(root, '.env.staging.local');
  if (fs.existsSync(destination)) throw new Error('.env.staging.local already exists; refusing to overwrite it.');
  const uploadDirectory = path.join(root, '.staging-data', 'uploads');
  fs.mkdirSync(uploadDirectory, { recursive: true });
  const template = fs.readFileSync(path.join(root, '.env.staging.example'), 'utf8');
  const output = buildStagingEnvironment(template, {
    sessionSecret: crypto.randomBytes(48).toString('base64url'),
    databasePassword: crypto.randomBytes(32).toString('base64url'),
    rootPassword: crypto.randomBytes(32).toString('base64url'),
    uploadDirectory
  });
  fs.writeFileSync(destination, output, { flag: 'wx', mode: 0o600 });
  return { created: true, uploadDirectory };
}

if (require.main === module) {
  try {
    const result = createStagingEnvironment();
    console.log(JSON.stringify({ type: 'staging_environment', status: 'created', uploadDirectoryCreated: fs.existsSync(result.uploadDirectory) }));
  } catch (error) {
    console.error(JSON.stringify({ type: 'staging_environment', status: 'failed', code: error.name, message: error.message }));
    process.exitCode = 1;
  }
}

module.exports = { buildStagingEnvironment, createStagingEnvironment };
