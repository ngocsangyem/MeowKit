#!/usr/bin/env node
/**
 * Visual Plan studio bundle budget. Gzips dist/visual-plan-web {index.js,index.css}
 * in-memory and fails the build if the total exceeds the cap.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const MAX_BYTES = 200 * 1024;
const dist = path.resolve(__dirname, "..", "dist", "visual-plan-web");

function gzipSize(filePath) {
	if (!fs.existsSync(filePath)) return 0;
	return zlib.gzipSync(fs.readFileSync(filePath), { level: 9 }).byteLength;
}

const js = gzipSize(path.join(dist, "index.js"));
const css = gzipSize(path.join(dist, "index.css"));
const total = js + css;
const pct = ((total / MAX_BYTES) * 100).toFixed(1);
const fmt = (b) => `${(b / 1024).toFixed(2)}KB`;
const line = `[visual-plan-budget] index.js ${fmt(js)} + index.css ${fmt(css)} = ${fmt(total)} (${pct}% of ${fmt(MAX_BYTES)})`;

if (total === 0) {
	console.error("[visual-plan-budget] FAIL — no bundle found at dist/visual-plan-web");
	process.exit(1);
}
if (total > MAX_BYTES) {
	console.error(line);
	console.error(`[visual-plan-budget] FAIL — exceeds ${fmt(MAX_BYTES)} budget by ${fmt(total - MAX_BYTES)}`);
	process.exit(1);
}
console.log(line);
