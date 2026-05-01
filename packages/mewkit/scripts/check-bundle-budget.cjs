#!/usr/bin/env node
/**
 * Bundle budget gate (red-team M1).
 * Reads dist/orchviz-web/{index.js,index.css}, gzips in-memory, compares total
 * to MAX_BYTES. Exits non-zero if budget breached so build:web fails the build.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const MAX_BYTES = 160 * 1024;
const dist = path.resolve(__dirname, "..", "dist", "orchviz-web");

function gzipSize(filePath) {
	if (!fs.existsSync(filePath)) return 0;
	return zlib.gzipSync(fs.readFileSync(filePath), { level: 9 }).byteLength;
}

const js = gzipSize(path.join(dist, "index.js"));
const css = gzipSize(path.join(dist, "index.css"));
const total = js + css;
const pct = ((total / MAX_BYTES) * 100).toFixed(1);

const fmt = (b) => `${(b / 1024).toFixed(2)}KB`;
const line = `[bundle-budget] index.js ${fmt(js)} + index.css ${fmt(css)} = ${fmt(total)} (${pct}% of ${fmt(MAX_BYTES)})`;

if (total > MAX_BYTES) {
	console.error(line);
	console.error(`[bundle-budget] FAIL — exceeds ${fmt(MAX_BYTES)} budget by ${fmt(total - MAX_BYTES)}`);
	process.exit(1);
}
console.log(line);
