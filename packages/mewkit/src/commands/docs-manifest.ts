// `mewkit docs-manifest` — generate or drift-check the docs reference manifest.
//
// `--check` is what CI runs: rebuild from the live `.claude/` tree and compare against the
// committed file. A difference means a runtime fact moved and the docs were not regenerated,
// which is the failure the whole manifest exists to catch. Anything cheaper (timestamps, file
// existence) cannot tell a stale doc from a fresh one.
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { buildDocsReferenceManifest, serializeDocsReferenceManifest } from "../core/docs-reference-manifest.js";
import { spliceReferencePages, spliceReferenceIndexes } from "../core/splice-reference-pages.js";

export interface DocsManifestArgs {
	/** Compare against the committed file and exit non-zero on any difference. */
	check?: boolean;
	/** Write the regenerated manifest. */
	write?: boolean;
	json?: boolean;
}

/** Where the committed manifest lives, relative to the project root. */
export const DOCS_MANIFEST_REL = path.join("packages", "docs", "docs-reference-manifest.json");
const DOCS_REFERENCE_REL = path.join("packages", "docs", "content", "docs", "reference");

export function docsManifest(args: DocsManifestArgs = {}): void {
	const root = process.cwd();
	const claudeDir = path.join(root, ".claude");
	if (!fs.existsSync(claudeDir)) {
		console.error(pc.red("No .claude/ in the current directory — run this from a MeowKit project root."));
		process.exit(1);
	}

	const referenceDir = path.join(root, DOCS_REFERENCE_REL);
	const manifest = buildDocsReferenceManifest(claudeDir, fs.existsSync(referenceDir) ? referenceDir : null);
	const serialized = serializeDocsReferenceManifest(manifest);
	const target = path.join(root, DOCS_MANIFEST_REL);

	if (args.json) {
		console.log(serialized.trimEnd());
		return;
	}

	if (args.write) {
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, serialized, "utf-8");
		console.log(`${pc.green("✓")} wrote ${DOCS_MANIFEST_REL} — ${manifest.entries.length} artifact(s)`);
		if (fs.existsSync(referenceDir)) {
			const splice = spliceReferencePages(referenceDir, manifest.entries, { write: true });
			console.log(`${pc.green("✓")} spliced ${splice.written.length} of ${splice.checked} reference page(s)`);
			for (const rel of splice.missing) console.log(pc.yellow(`  no page for ${rel}`));
			const indexes = spliceReferenceIndexes(referenceDir, claudeDir, manifest.entries, { write: true });
			console.log(`${pc.green("✓")} spliced ${indexes.written.length} of ${indexes.checked} index page(s)`);
		}
		return;
	}

	if (args.check) {
		if (!fs.existsSync(target)) {
			console.error(pc.red(`Missing ${DOCS_MANIFEST_REL} — run \`mewkit docs-manifest --write\`.`));
			process.exit(1);
		}
		const committed = fs.readFileSync(target, "utf-8");
		let failed = false;
		if (committed !== serialized) {
			reportDrift(JSON.parse(committed) as ReturnType<typeof buildDocsReferenceManifest>, manifest);
			failed = true;
		}

		// The pages are half the contract: a manifest can be current while the pages restating it
		// are not, which is the exact state this phase exists to make impossible.
		if (fs.existsSync(referenceDir)) {
			const indexes = spliceReferenceIndexes(referenceDir, claudeDir, manifest.entries, { write: false });
			if (indexes.stale.length > 0) {
				console.error(pc.red(`${indexes.stale.length} index page(s) carry a stale generated section:`));
				for (const rel of indexes.stale) console.error(`  ${rel}`);
				failed = true;
			}
			const splice = spliceReferencePages(referenceDir, manifest.entries, { write: false });
			if (splice.stale.length > 0) {
				console.error(pc.red(`${splice.stale.length} reference page(s) carry a stale generated block:`));
				for (const rel of splice.stale.slice(0, 10)) console.error(`  ${rel}`);
				if (splice.stale.length > 10) console.error(`  … and ${splice.stale.length - 10} more`);
				failed = true;
			}
			if (splice.missing.length > 0) {
				console.error(pc.red(`${splice.missing.length} artifact(s) have no reference page:`));
				for (const rel of splice.missing) console.error(`  ${rel}`);
				failed = true;
			}
		}

		if (failed) {
			console.error(`\nRegenerate with \`mewkit docs-manifest --write\` and commit the result.`);
			process.exit(1);
		}
		console.log(
			`${pc.green("✓")} manifest and ${manifest.entries.length} reference page(s) match the live .claude/ tree`,
		);
		return;
	}

	// No flag: summarize, so running it bare is informative rather than a no-op.
	const unclassified = manifest.entries.filter((e) => e.visibility === "unclassified");
	console.log(`${manifest.entries.length} artifact(s) in the docs reference manifest`);
	console.log(`  public: ${manifest.entries.filter((e) => e.visibility === "public").length}`);
	console.log(`  internal: ${manifest.entries.filter((e) => e.visibility === "internal").length}`);
	if (unclassified.length > 0) {
		console.log(pc.yellow(`  unclassified: ${unclassified.length} — ${unclassified.map((e) => e.id).join(", ")}`));
	}
}

/** Name what moved, per artifact and per field, so the fix is obvious from the failure. */
function reportDrift(
	committed: ReturnType<typeof buildDocsReferenceManifest>,
	live: ReturnType<typeof buildDocsReferenceManifest>,
): void {
	const key = (e: { kind: string; id: string }): string => `${e.kind}/${e.id}`;
	const before = new Map(committed.entries.map((e) => [key(e), e]));
	const after = new Map(live.entries.map((e) => [key(e), e]));

	console.error(pc.red(`${DOCS_MANIFEST_REL} is stale.`));
	for (const [k, entry] of after) {
		const prior = before.get(k);
		if (!prior) {
			console.error(`  ${pc.green("added")}   ${k}`);
			continue;
		}
		const changed = (Object.keys(entry) as (keyof typeof entry)[]).filter(
			(field) => JSON.stringify(prior[field]) !== JSON.stringify(entry[field]),
		);
		if (changed.length > 0) console.error(`  ${pc.yellow("changed")} ${k} — ${changed.join(", ")}`);
	}
	for (const k of before.keys()) {
		if (!after.has(k)) console.error(`  ${pc.red("removed")} ${k}`);
	}
	console.error(`\nRegenerate with \`mewkit docs-manifest --write\` and commit the result.`);
}
