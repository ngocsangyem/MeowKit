#!/usr/bin/env node
// Write `binary-manifest.json` and `checksums.txt` for one binary release from
// the six archives the release job built.
//
// The manifest is derived from the archive bytes on disk, never from the build
// matrix: a digest nobody computed from the uploaded file cannot be trusted to
// match it. All six archives must be present, so a release never ships with a
// target that `self-update` would then report as missing.
//
// Usage: node scripts/release/build-binary-manifest.mjs --version X.Y.Z --dir DIR
//          [--min-supported X.Y.Z] [--published-at ISO-8601]
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { TARGETS, assetName, assetUrl, channelOf, checkVersion } from "./binary-targets.mjs";

/**
 * Whether `floor` ≤ `version`. Cores compare numerically; with equal cores a
 * prerelease floor sits below the release, and two different prereleases are
 * refused rather than ordered here (the binary's parser is the authority).
 */
function atMost(floor, version) {
	const core = (v) => v.split("-")[0].split(".").map(Number);
	const [x, y] = [core(floor), core(version)];
	for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
	return floor === version || (floor.includes("-") && !version.includes("-"));
}

export function buildManifest({ version, dir, minSupported = "0.0.0", publishedAt = new Date().toISOString() }) {
	const v = checkVersion(version);
	const floor = checkVersion(minSupported);
	if (!atMost(floor, v)) throw new Error(`--min-supported ${floor} is above the release version ${v}`);
	if (Number.isNaN(Date.parse(publishedAt))) throw new Error(`--published-at ${publishedAt} is not a date`);
	const targets = {};
	const lines = [];
	for (const target of TARGETS) {
		const name = assetName(v, target);
		const file = join(dir, name);
		let bytes;
		try {
			bytes = readFileSync(file);
		} catch {
			throw new Error(`missing archive ${name} in ${dir}; every target must be built before publishing`);
		}
		if (bytes.length === 0 || statSync(file).size !== bytes.length) throw new Error(`${name} is empty or changing`);
		const sha256 = createHash("sha256").update(bytes).digest("hex");
		targets[target] = { url: assetUrl(v, target), sha256, size: bytes.length };
		lines.push(`${sha256}  ${name}`);
	}
	const manifest = {
		version: v,
		channel: channelOf(v),
		published_at: publishedAt,
		min_supported: floor,
		targets,
	};
	return { manifest, checksums: `${lines.join("\n")}\n` };
}

function main() {
	const { values } = parseArgs({
		options: {
			version: { type: "string" },
			dir: { type: "string" },
			"min-supported": { type: "string" },
			"published-at": { type: "string" },
		},
	});
	if (!values.version || !values.dir) {
		console.error(
			"usage: build-binary-manifest.mjs --version X.Y.Z --dir DIR [--min-supported X.Y.Z] [--published-at ISO]",
		);
		process.exit(2);
	}
	try {
		const { manifest, checksums } = buildManifest({
			version: values.version,
			dir: values.dir,
			minSupported: values["min-supported"] || undefined,
			publishedAt: values["published-at"] || undefined,
		});
		writeFileSync(join(values.dir, "binary-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
		writeFileSync(join(values.dir, "checksums.txt"), checksums);
		for (const [target, t] of Object.entries(manifest.targets)) console.log(`${target}  ${t.size} bytes  ${t.sha256}`);
	} catch (error) {
		console.error(`build-binary-manifest: ${error.message}`);
		process.exit(1);
	}
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
