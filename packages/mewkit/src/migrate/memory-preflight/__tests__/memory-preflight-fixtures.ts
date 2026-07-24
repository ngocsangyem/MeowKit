// Programmatic fixture builder for the memory-preflight scenarios, shared by the
// phase-2 (preflight) and phase-3 (transaction) suites. Building fixtures in code
// (rather than committing them) keeps symlinks portable and content explicit.
import { mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";

export type FixtureName =
	| "empty"
	| "legacy-only"
	| "target-only"
	| "identical"
	| "conflicting"
	| "corrupt-json"
	| "symlink-escape"
	| "unknown-files"
	| "mixed-taxonomy";

/** A schema-valid `fixes` store body (satisfies FixesSchema). */
export function validFixes(pattern = "always await async writes"): string {
	return JSON.stringify(
		{
			version: "2.0.0",
			scope: "fixes",
			consumer: "meowkit",
			patterns: [{ id: "fix-1", pattern }],
			metadata: { created: "2026-01-01T00:00:00Z", last_updated: "2026-01-01T00:00:00Z" },
		},
		null,
		2,
	);
}

function legacyDir(root: string): string {
	const dir = join(root, ".claude", "memory");
	mkdirSync(dir, { recursive: true });
	return dir;
}

function meowkitMemoryDir(root: string): string {
	const dir = join(root, ".meowkit", "memory");
	mkdirSync(dir, { recursive: true });
	return dir;
}

/** Scaffold a scenario under `root`; returns the project root (== root). */
export function buildFixture(name: FixtureName, root: string): string {
	switch (name) {
		case "empty":
			mkdirSync(root, { recursive: true });
			break;

		case "legacy-only": {
			const d = legacyDir(root);
			writeFileSync(join(d, "fixes.json"), validFixes());
			writeFileSync(join(d, "fixes.md"), "# fixes\n");
			writeFileSync(join(d, "cost-log.json"), '{"entries":[]}');
			writeFileSync(join(d, "last-model-id.txt"), "opus-4-8");
			writeFileSync(join(d, "wiki-index.db"), "SQLITE\x00");
			writeFileSync(join(d, "random-note.txt"), "misc human note");
			writeFileSync(join(d, ".gitkeep"), "");
			break;
		}

		case "target-only":
			writeFileSync(join(meowkitMemoryDir(root), "fixes.json"), validFixes());
			break;

		case "identical": {
			const body = validFixes();
			writeFileSync(join(legacyDir(root), "fixes.json"), body);
			writeFileSync(join(meowkitMemoryDir(root), "fixes.json"), body);
			break;
		}

		case "conflicting":
			writeFileSync(join(legacyDir(root), "fixes.json"), validFixes("legacy version"));
			writeFileSync(join(meowkitMemoryDir(root), "fixes.json"), validFixes("already-migrated version"));
			break;

		case "corrupt-json":
			writeFileSync(join(legacyDir(root), "fixes.json"), "{ this is not valid json ");
			break;

		case "symlink-escape": {
			const d = legacyDir(root);
			// A secret file OUTSIDE the legacy root; the link must never be followed.
			const outside = join(root, "outside-secret.txt");
			writeFileSync(outside, "SHOULD NEVER BE STAGED");
			writeFileSync(join(d, "fixes.json"), validFixes());
			symlinkSync(outside, join(d, "escape-link.json"));
			break;
		}

		case "unknown-files": {
			const d = legacyDir(root);
			writeFileSync(join(d, "mystery.dat"), "opaque payload");
			// nested unknown file to exercise legacy/<relPath> preservation
			mkdirSync(join(d, "notes"), { recursive: true });
			writeFileSync(join(d, "notes", "scratch.txt"), "scratch");
			break;
		}

		case "mixed-taxonomy": {
			const d = legacyDir(root);
			writeFileSync(join(d, "fixes.json"), validFixes()); // → memory
			writeFileSync(join(d, "cost-log.json"), '{"entries":[]}'); // → telemetry
			writeFileSync(join(d, "last-model-id.txt"), "opus-4-8"); // → state
			writeFileSync(join(d, "wiki-index.db"), "SQLITE\x00"); // → cache
			writeFileSync(join(d, "weird.dat"), "opaque"); // → legacy
			mkdirSync(join(d, "views"), { recursive: true });
			writeFileSync(join(d, "views", "fixes.md"), "# view\n"); // → memory/views
			break;
		}
	}
	return root;
}
