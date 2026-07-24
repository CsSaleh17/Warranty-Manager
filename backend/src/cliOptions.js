function cliOption(name, args = process.argv.slice(2)) {
  const prefix = `--${name}=`;
  const match = args.find((argument) => argument.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

module.exports = { cliOption };
