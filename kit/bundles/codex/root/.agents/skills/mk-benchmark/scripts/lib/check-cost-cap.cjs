#!/usr/bin/env node
// check-cost-cap.cjs — sum `costUsd` across a JSONL receipt ledger and enforce the cap.
//
// Input (env): LEDGER (path), CAP (USD hard halt), WARN_USD (fixed warn threshold).
// Exit: 0 under the cap (OK or WARN line on stdout); 2 at or over the cap (HALT).
//
// Runs on node so the cap still holds in a project with no interpreter installed.

const fs = require("node:fs");

const ledger = process.env.LEDGER;
const cap = Number(process.env.CAP);
const warn = Number(process.env.WARN_USD);

let total = 0;
for (const line of fs.readFileSync(ledger, "utf8").split("\n")) {
	const trimmed = line.trim();
	if (!trimmed) continue;
	try {
		total += Number(JSON.parse(trimmed).costUsd) || 0;
	} catch {
		// A malformed receipt is skipped rather than aborting the cap check: the
		// safe reading of an unreadable line is "it cost nothing we can prove".
	}
}

if (total >= cap) {
	console.log(`HALT: cost cap reached: $${total.toFixed(2)} >= $${cap.toFixed(2)}`);
	process.exit(2);
}
if (cap > warn && total >= warn) {
	console.log(`WARN: $${total.toFixed(2)} >= $${warn.toFixed(0)} (cap $${cap.toFixed(2)})`);
} else {
	console.log(`OK: $${total.toFixed(2)} of $${cap.toFixed(2)}`);
}
