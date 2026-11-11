#!/usr/bin/env node
// Render `install.sh` and `install.ps1` from their templates and the pins in
// `installer-pins.json`.
//
// The release job runs this with `--manifest`: the new release's manifest
// replaces its channel's pin (the other channel's pin is kept), and both
// installers are re-rendered for a pull request. Pins reach users only when
// that pull request is reviewed and merged. `--check` fails when the committed
// installers differ from what the committed pins render.
//
// Usage: node scripts/release/render-installers.mjs [--manifest FILE]
//          [--pins FILE] [--out-dir DIR] [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { TARGETS, assetUrl, channelOf, checkVersion } from "./binary-targets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const CHANNELS = ["stable", "beta"];
// Pins are pasted into shell and PowerShell source; nothing that could quote or expand.
const SAFE_URL = /^https?:\/\/[A-Za-z0-9._~:/%+-]+$/;
const SHA256 = /^[0-9a-f]{64}$/;

function checkPin(channel, pin) {
	if (pin === null) return;
	const where = `pin ${channel}`;
	if (checkVersion(pin.version) !== pin.version)
		throw new Error(`${where}: version ${pin.version} must have no leading v`);
	if (channelOf(pin.version) !== channel)
		throw new Error(`${where}: ${pin.version} belongs to the ${channelOf(pin.version)} channel`);
	for (const target of TARGETS) {
		const t = pin.targets?.[target];
		if (!t) throw new Error(`${where}: no ${target}`);
		if (!SAFE_URL.test(t.url)) throw new Error(`${where} ${target}: unsafe or malformed url ${JSON.stringify(t.url)}`);
		if (!SHA256.test(t.sha256)) throw new Error(`${where} ${target}: sha256 must be 64 lowercase hex`);
		if (!Number.isSafeInteger(t.size) || t.size <= 0)
			throw new Error(`${where} ${target}: size must be a positive integer`);
	}
}

/** The pin a published manifest makes: its URLs must be exactly this release's assets. */
export function pinFromManifest(manifest) {
	const version = checkVersion(manifest.version);
	if (manifest.channel !== channelOf(version))
		throw new Error(`manifest channel ${manifest.channel} does not fit ${version}`);
	const targets = {};
	for (const target of TARGETS) {
		const t = manifest.targets?.[target];
		if (!t) throw new Error(`manifest has no ${target}`);
		if (t.url !== assetUrl(version, target))
			throw new Error(`manifest url for ${target} is not this release's asset: ${t.url}`);
		targets[target] = { url: t.url, sha256: t.sha256, size: t.size };
	}
	const pin = { version, targets };
	checkPin(manifest.channel, pin);
	return { channel: manifest.channel, pin };
}

function shPins(pins) {
	const lines = [];
	for (const channel of CHANNELS) {
		const pin = pins[channel];
		if (!pin) continue;
		for (const target of TARGETS.filter((t) => !t.includes("windows"))) {
			const t = pin.targets[target];
			lines.push(`\t\t${channel}:${target}) echo "${pin.version} ${t.url} ${t.sha256} ${t.size}" ;;`);
		}
	}
	return lines.join("\n");
}

function ps1Pins(pins) {
	const lines = [];
	for (const channel of CHANNELS) {
		const pin = pins[channel];
		if (!pin) continue;
		for (const target of TARGETS.filter((t) => t.includes("windows"))) {
			const t = pin.targets[target];
			lines.push(
				`\t'${channel}:${target}' = @{ Version = '${pin.version}'; Url = '${t.url}'; Sha256 = '${t.sha256}'; Size = ${t.size} }`,
			);
		}
	}
	return lines.join("\n");
}

/** Both installers' text for `pins`. */
export function render(pins) {
	for (const channel of CHANNELS) checkPin(channel, pins[channel] ?? null);
	const fill = (name, marker, block) => {
		const tmpl = readFileSync(join(HERE, name), "utf8");
		if (!tmpl.includes(marker)) throw new Error(`${name} has no ${marker}`);
		// An empty block leaves no blank line behind.
		return block ? tmpl.replace(marker, () => block) : tmpl.replace(`${marker}\n`, "");
	};
	return {
		"install.sh": fill("install.sh.tmpl", "@@SH_PINS@@", shPins(pins)),
		"install.ps1": fill("install.ps1.tmpl", "@@PS1_PINS@@", ps1Pins(pins)),
	};
}

function main() {
	const { values } = parseArgs({
		options: {
			manifest: { type: "string" },
			pins: { type: "string", default: join(HERE, "installer-pins.json") },
			"out-dir": { type: "string", default: REPO },
			check: { type: "boolean", default: false },
		},
	});
	try {
		const pins = JSON.parse(readFileSync(values.pins, "utf8"));
		for (const key of Object.keys(pins)) if (!CHANNELS.includes(key)) throw new Error(`unknown channel ${key} in pins`);
		if (values.manifest) {
			const { channel, pin } = pinFromManifest(JSON.parse(readFileSync(values.manifest, "utf8")));
			pins[channel] = pin;
			if (!values.check) writeFileSync(values.pins, `${JSON.stringify(pins, null, 2)}\n`);
		}
		const out = render(pins);
		let stale = 0;
		for (const [name, text] of Object.entries(out)) {
			const file = join(values["out-dir"], name);
			if (values.check) {
				let have = "";
				try {
					have = readFileSync(file, "utf8");
				} catch {}
				if (have.replace(/\r\n/g, "\n") !== text) {
					console.error(`${name} is not what ${values.pins} renders; run node scripts/release/render-installers.mjs`);
					stale++;
				}
			} else {
				writeFileSync(file, text, { mode: name.endsWith(".sh") ? 0o755 : 0o644 });
			}
		}
		process.exit(stale ? 1 : 0);
	} catch (error) {
		console.error(`render-installers: ${error.message}`);
		process.exit(1);
	}
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
