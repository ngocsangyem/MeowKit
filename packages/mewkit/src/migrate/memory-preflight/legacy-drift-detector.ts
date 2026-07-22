// Post-migration drift detection: once a project has a COMPLETED memory migration,
// any regular file (or empty dir) reappearing under `.claude/memory/` is drift — a
// writer still targeting the legacy path. Drift is REPORTED, never silently
// re-migrated or dual-written. Attribution distinguishes managed-code drift (empty
// markers/dirs a managed path like self-update recreates) from user drift (real
// content a user or unported hook wrote), so the fix can target the right cause.
// Sync (readFileSync) so `doctor` can call it without going async.
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { meowkitStatePaths } from "../../state/meowkit-state-paths.js";
import { MigrationManifestSchema } from "./migration-manifest.js";

export interface DriftEntry {
	relPath: string;
	kind: "user" | "managed";
	note: string;
}

export interface DriftResult {
	migrated: boolean;
	hasDrift: boolean;
	drifted: DriftEntry[];
}

/** True when at least one run manifest under `.meowkit/migrations/` is complete. */
export function hasCompletedMigration(meowkitRoot: string): boolean {
	const migrations = meowkitStatePaths(meowkitRoot).migrations;
	if (!existsSync(migrations)) return false;
	for (const name of readdirSync(migrations)) {
		const manifestPath = join(migrations, name, "manifest.json");
		if (!existsSync(manifestPath)) continue;
		try {
			const parsed = MigrationManifestSchema.safeParse(JSON.parse(readFileSync(manifestPath, "utf-8")));
			if (parsed.success && parsed.data.status === "complete") return true;
		} catch {
			// unreadable manifest — ignore for this signal
		}
	}
	return false;
}

function toPosix(p: string): string {
	return sep === "/" ? p : p.split(sep).join("/");
}

/** Detect legacy-path drift for a migrated project. Pre-migration projects report
 *  no drift (their memory legitimately lives in `.claude/memory/`). */
export function detectLegacyDrift(projectRoot: string, opts: { meowkitRoot?: string } = {}): DriftResult {
	const meowkitRoot = opts.meowkitRoot ?? join(projectRoot, ".meowkit");
	const legacyRoot = join(projectRoot, ".claude", "memory");

	if (!hasCompletedMigration(meowkitRoot)) return { migrated: false, hasDrift: false, drifted: [] };
	if (!existsSync(legacyRoot)) return { migrated: true, hasDrift: false, drifted: [] };

	const drifted: DriftEntry[] = [];
	const walk = (dir: string): void => {
		let names: string[];
		try {
			names = readdirSync(dir);
		} catch {
			return;
		}
		if (names.length === 0 && dir !== legacyRoot) {
			// An empty directory is a managed-code artifact (e.g. self-update recreating
			// the legacy tree), never user content.
			drifted.push({ relPath: toPosix(relative(legacyRoot, dir)), kind: "managed", note: "empty directory recreated at legacy path" });
			return;
		}
		for (const name of names) {
			if (name === ".gitkeep") continue; // tracked marker legitimately stays
			const abs = join(dir, name);
			let st: ReturnType<typeof lstatSync>;
			try {
				st = lstatSync(abs);
			} catch {
				continue;
			}
			const relPath = toPosix(relative(legacyRoot, abs));
			if (st.isSymbolicLink()) {
				drifted.push({ relPath, kind: "user", note: "symlink at legacy path" });
			} else if (st.isDirectory()) {
				walk(abs);
			} else if (st.isFile()) {
				drifted.push(
					st.size === 0
						? { relPath, kind: "managed", note: "empty file recreated at legacy path" }
						: { relPath, kind: "user", note: "content written to legacy path after migration" },
				);
			}
		}
	};
	walk(legacyRoot);

	return { migrated: true, hasDrift: drifted.length > 0, drifted };
}
