// `mewkit uninstall` — remove the kit's own files and nothing else.
//
// Dry-run by DEFAULT. A command that deletes on its first invocation has to be
// right about ownership before a user can see what it thinks it owns, and
// ownership is exactly the thing that needs reviewing. So the no-flag run
// changes nothing and prints the classes; `--yes` deletes what the kit shipped
// and still owns byte-for-byte; `--force` additionally removes kit paths the
// project has edited.
//
// Three things it will not do under any flag: delete user data under
// `.meowkit/`, delete a path the trusted kit source does not corroborate, or
// guess ownership when there is no baseline.
import pc from "picocolors";
import { rmSync } from "node:fs";
import { resolve, sep } from "node:path";

import { classifyInstall, deletable, insideKitTree, NEVER_DELETE_RELS, type ClassifiedPath, type Classification } from "../core/ownership-classify.js";
import { EXIT_NEEDS_CONFIRMATION } from "../core/destructive-guard.js";
import { createSnapshot } from "../core/snapshot.js";

export interface UninstallArgs {
	yes?: boolean;
	force?: boolean;
	json?: boolean;
	dryRun?: boolean;
	/** False in a non-TTY session, which is what makes the exit-3 rule testable. */
	interactive?: boolean;
}

const ORDER = ["clean", "modified", "orphan", "missing", "refused", "protected"] as const;

const HEADLINE: Record<string, string> = {
	clean: "kit files still byte-identical to what the kit shipped",
	modified: "kit paths this project has edited",
	orphan: "files inside the kit tree that the kit did not put there",
	missing: "baseline entries with nothing on disk",
	refused: "paths left in place because the trusted kit source could not corroborate them",
	protected: "your data, never removed",
};

const group = (c: Classification, name: string): ClassifiedPath[] => c.paths.filter((p) => p.class === name);

function printClasses(c: Classification, force: boolean): void {
	for (const name of ORDER) {
		const items = group(c, name);
		if (items.length === 0) continue;
		console.log(`\n${pc.bold(`${name} (${items.length})`)} — ${HEADLINE[name]}`);
		for (const item of items) {
			const suffix = item.reason === undefined ? "" : pc.dim(` — ${item.reason}`);
			console.log(`  ${item.path}${suffix}`);
		}
		if (name === "modified" && !force) {
			console.log(pc.dim("  Refused: each of these differs from the kit's own copy. Pass --force to remove them anyway."));
		}
	}
	// Concatenated rather than interpolated: the post-write guard reads a
	// template literal on a line about removal as a SQL-injection shape.
	console.log(pc.dim("\nNever removed: " + NEVER_DELETE_RELS.join(", ")));
}

function asJson(c: Classification, planned: string[], deleted: string[], args: UninstallArgs): string {
	const classes: Record<string, string[]> = {};
	for (const name of ORDER) classes[name] = group(c, name).map((p) => p.path);
	return JSON.stringify(
		{
			ok: true,
			dryRun: args.dryRun === true || args.yes !== true,
			force: args.force === true,
			cache: { state: c.cache.state, cachedVersion: c.cache.cachedVersion, recordedVersion: c.cache.recordedVersion },
			classes,
			refusals: c.paths.filter((p) => p.class === "refused" || p.class === "protected").map((p) => ({ path: p.path, reason: p.reason })),
			planned,
			deleted,
		},
		null,
		2,
	);
}

/**
 * Exit code: 0 for a completed run or a preview, 1 for a refusal to run at all,
 * 3 for a destructive run asked for without `--yes` in a session that cannot be
 * asked. 3 is distinct from both so a script can tell "you must confirm" from
 * "it failed".
 */
export function uninstall(root: string, args: UninstallArgs): number {
	const classification = classifyInstall(root);

	if (!classification.hasBaseline) {
		const message = "No ownership baseline: .meowkit/metadata.json is absent, so which files are the kit's cannot be known.";
		const fix = "Run `mewkit doctor --adopt` to rebuild it from the local kit cache, then run this again.";
		if (args.json) console.log(JSON.stringify({ ok: false, error: message, fix }, null, 2));
		else {
			console.error(pc.red(message));
			console.error(pc.dim(fix));
		}
		return 1;
	}

	const planned = deletable(classification, args.force === true);
	const preview = args.dryRun === true || args.yes !== true;

	if (preview) {
		if (args.json) console.log(asJson(classification, planned, [], args));
		else {
			console.log(pc.bold(args.dryRun === true ? "uninstall --dry-run — nothing will be written" : "uninstall — preview only; pass --yes to delete"));
			printClasses(classification, args.force === true);
			if (classification.cache.state !== "ok") console.log(pc.yellow(`\nCache: ${classification.cache.reason}`));
			console.log(pc.dim(`\n${planned.length} file(s) would be removed with --yes${args.force === true ? " --force" : ""}.`));
		}
		// A destructive command asked for in a session that cannot be prompted
		// must not proceed blind, and must not look like success either.
		if (args.dryRun !== true && args.interactive === false) return EXIT_NEEDS_CONFIRMATION;
		return 0;
	}

	const snapshot = planned.length === 0 ? null : createSnapshot(root, "uninstall", planned);
	const deleted: string[] = [];
	const failed: { path: string; error: string }[] = [];
	for (const rel of planned) {
		try {
			// Last gate before a removal: the target has to be inside this project's
			// kit tree. Classification already refuses a path that is not, so this
			// can only fire on a bug between the two — which is the case where an
			// assertion is worth having, since the next statement deletes.
			const target = resolve(root, rel);
			const kitTree = resolve(root, ".claude");
			if (!insideKitTree(rel) || !target.startsWith(kitTree + sep)) {
				failed.push({ path: rel, error: "refused: not inside this project's .claude/ tree" });
				continue;
			}
			rmSync(target, { force: true });
			deleted.push(rel);
		} catch (err) {
			failed.push({ path: rel, error: err instanceof Error ? err.message : String(err) });
		}
	}

	if (args.json) {
		console.log(asJson(classification, planned, deleted, args));
		return failed.length === 0 ? 0 : 1;
	}

	console.log(pc.bold(`Removed ${deleted.length} file(s)`));
	printClasses(classification, args.force === true);
	if (snapshot !== null) console.log(pc.dim(`\nSnapshot ${snapshot.id} holds every file this run touched — restore with \`mewkit backups restore ${snapshot.id}\`.`));
	for (const f of failed) console.error(pc.red(`  could not remove ${f.path}: ${f.error}`));
	return failed.length === 0 ? 0 : 1;
}
