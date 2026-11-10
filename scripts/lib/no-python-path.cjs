// no-python-path.cjs — build a PATH with no Python interpreter on it.
//
// Mirroring the real PATH minus the interpreters, rather than allowlisting a
// handful of tools, is deliberate: an allowlist turns "this check does not need
// Python" into "this check could not find some unrelated tool either", and the
// failure reads the same.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

/** Interpreter basenames the sandbox must not expose, including versioned forms. */
const BANNED = /^(python|python[23](\.\d+)?|py|pypy\d?)(\.exe)?$/i;

function isExecutable(file) {
	try {
		const stat = fs.statSync(file);
		return stat.isFile() && (stat.mode & 0o111) !== 0;
	} catch {
		return false;
	}
}

/**
 * Create a directory of symlinks to every executable on `sourcePath` except the
 * interpreters, and return it. PATH precedence is preserved: the first
 * occurrence of a basename wins, exactly as a lookup would resolve it.
 */
function buildNoPythonBin(sourcePath = process.env.PATH ?? "") {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "no-python-bin-"));
	const seen = new Set();
	for (const entry of sourcePath.split(path.delimiter)) {
		if (!entry) continue;
		let names;
		try {
			names = fs.readdirSync(entry);
		} catch {
			continue;
		}
		for (const name of names) {
			if (seen.has(name) || BANNED.test(name)) continue;
			const source = path.join(entry, name);
			if (!isExecutable(source)) continue;
			seen.add(name);
			try {
				fs.symlinkSync(source, path.join(dir, name));
			} catch {
				// A name that cannot be linked is simply not exposed.
			}
		}
	}
	return dir;
}

/** Every interpreter name that still resolves on `binDir` — must be empty. */
function leakedInterpreters(binDir) {
	return ["python3", "python", "py"].filter((name) => fs.existsSync(path.join(binDir, name)));
}

module.exports = { buildNoPythonBin, leakedInterpreters, BANNED };
