// Flags: --out <file> writes the result to a file (renamed from --output).
const args = process.argv.slice(2);
const i = args.indexOf('--out');
console.log(i >= 0 ? args[i + 1] : 'stdout');
