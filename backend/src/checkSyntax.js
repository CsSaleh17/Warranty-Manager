const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function findJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return findJavaScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
  });
}

const sourceFiles = findJavaScriptFiles(path.resolve(__dirname));

for (const sourceFile of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', sourceFile], {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Syntax check failed for ${sourceFile}\n`);
    process.exit(result.status || 1);
  }
}

process.stdout.write(`Syntax check passed for ${sourceFiles.length} source files.\n`);
