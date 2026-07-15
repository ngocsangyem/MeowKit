import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CheckResult } from "../commands/validate.js";
import { generatePluginPayload } from "./plugin-payload.js";
// The SAME identity `build-plugin` uses. Imported, never re-declared: a second
// copy of the version/description would make the manifests differ and this check
// would fail on its own drift — which is the defect it exists to catch.
import { AUTHOR, DESCRIPTION, PAYLOAD_DIRNAME } from "../commands/build-plugin.js";

// Canonical↔plugin parity.
//
// `plugin/` is GENERATED from `.claude/` by generatePluginPayload. Two ways that
// silently breaks:
//   1. someone edits `.claude/` and forgets to regenerate — the plugin ships the
//      OLD behavior while the repo shows the new prose, and every reviewer reads
//      the version that isn't shipping;
//   2. someone hand-edits `plugin/` — the fix survives exactly until the next
//      regenerate, then vanishes with no diff to explain it.
//
// Both produce a repo that looks correct. This check regenerates into a scratch
// dir and diffs, so divergence is a build failure instead of a discovery.
//
// It is NOT covered elsewhere: `validate --plugin` checks the manifests, and
// check-workflow-drift.ts is a token-level prose check. Neither compares trees.

/** Files whose bytes legitimately differ per-run and must not fail parity. */
const VOLATILE = new Set(["hooks.json"]);

/** Every file under `dir`, relative to it. */
function collectFiles(dir: string, base = dir, acc: string[] = []): string[] {
	if (!fs.existsSync(dir)) return acc;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const abs = path.join(dir, entry.name);
		if (entry.isDirectory()) collectFiles(abs, base, acc);
		else if (entry.isFile()) acc.push(path.relative(base, abs));
	}
	return acc;
}

export interface ParityDivergence {
	file: string;
	kind: "missing-in-plugin" | "stale-in-plugin" | "extra-in-plugin";
}

/**
 * Regenerate the payload into a temp dir and diff it against `plugin/`.
 *
 * Returns every divergence. The caller decides severity — `validate` fails, so
 * that a stale plugin cannot reach a release.
 */
export function diffPluginParity(projectRoot: string): ParityDivergence[] {
	const sourceDir = path.join(projectRoot, ".claude");
	const committed = path.join(projectRoot, PAYLOAD_DIRNAME);
	if (!fs.existsSync(sourceDir) || !fs.existsSync(committed)) return [];

	const pkgPath = path.join(projectRoot, "package.json");
	const version = fs.existsSync(pkgPath)
		? ((JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version?: string }).version ?? "0.0.0")
		: "0.0.0";

	const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mewkit-parity-"));
	try {
		generatePluginPayload({ sourceDir, outDir: scratch, version, description: DESCRIPTION, author: AUTHOR });

		const expected = new Set(collectFiles(scratch));
		const actual = new Set(collectFiles(committed));
		const out: ParityDivergence[] = [];

		for (const rel of expected) {
			if (VOLATILE.has(path.basename(rel))) continue;
			if (!actual.has(rel)) {
				out.push({ file: rel, kind: "missing-in-plugin" });
				continue;
			}
			const a = fs.readFileSync(path.join(scratch, rel));
			const b = fs.readFileSync(path.join(committed, rel));
			if (!a.equals(b)) out.push({ file: rel, kind: "stale-in-plugin" });
		}
		// A file in plugin/ that regeneration does not produce is orphaned — it
		// survives only until the next build wipes it.
		for (const rel of actual) {
			if (VOLATILE.has(path.basename(rel))) continue;
			if (!expected.has(rel)) out.push({ file: rel, kind: "extra-in-plugin" });
		}

		return out;
	} finally {
		fs.rmSync(scratch, { recursive: true, force: true });
	}
}

/** Parity as a validate CheckResult. */
export function checkPluginParity(projectRoot: string): CheckResult[] {
	if (!fs.existsSync(path.join(projectRoot, "plugin"))) {
		return [
			{
				name: "Plugin parity",
				status: "warn",
				detail: "no plugin/ tree — run `mewkit build-plugin`",
				section: "Plugin",
			},
		];
	}

	let divergences: ParityDivergence[];
	try {
		divergences = diffPluginParity(projectRoot);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		return [{ name: "Plugin parity", status: "fail", detail: `regeneration failed: ${msg}`, section: "Plugin" }];
	}

	if (divergences.length === 0) {
		return [
			{
				name: "Plugin matches canonical .claude",
				status: "pass",
				detail: "regenerated payload is byte-identical to the committed plugin/",
				section: "Plugin",
			},
		];
	}

	const detail = divergences
		.slice(0, 12)
		.map((d) => `plugin/${d.file} — ${d.kind}`)
		.join("\n         ");
	const more = divergences.length > 12 ? `\n         …and ${divergences.length - 12} more` : "";

	return [
		{
			name: `Plugin diverges from canonical (${divergences.length})`,
			status: "fail",
			detail: `${detail}${more}\n         Run \`mewkit build-plugin\`. Never hand-edit plugin/ — the next build discards it.`,
			section: "Plugin",
		},
	];
}
