// json-io.cjs — JSON and JSONL helpers shared by the trace analysis scripts.
//
// Node builtins only: the analysis path must work on a machine with no
// interpreter other than node and no `jq` installed.

const fs = require("node:fs");
const path = require("node:path");

function die(message) {
	process.stderr.write(`${message}\n`);
	process.exit(1);
}

/** Read a JSONL file, skipping blank and unparseable lines. */
function readJsonl(file) {
	let text;
	try {
		text = fs.readFileSync(file, "utf8");
	} catch {
		return die(`ERROR: cannot read ${file}`);
	}
	const records = [];
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			records.push(JSON.parse(trimmed));
		} catch {
			// The log is append-only, so a torn final write must not hide every
			// record written before it.
		}
	}
	return records;
}

function readJson(file) {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return die(`ERROR: cannot read JSON from ${file}`);
	}
}

function writeJsonl(file, records) {
	const body = records.map((r) => JSON.stringify(r)).join("\n");
	fs.writeFileSync(file, records.length > 0 ? `${body}\n` : "");
}

function writeJson(file, value) {
	fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Every `batch-*-findings.json` in an analysis directory, in stable order. */
function findingsFiles(dir) {
	return fs
		.readdirSync(dir)
		.filter((name) => /^batch-.*-findings\.json$/.test(name))
		.sort()
		.map((name) => path.join(dir, name));
}

module.exports = { die, readJsonl, readJson, writeJsonl, writeJson, findingsFiles };
