/**
 * Helper utilities for smart-update: file copying, .meowkitignore parsing, directory walking.
 */
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";

/** Parse .meowkitignore once, return a matcher function */
export function loadIgnorePatterns(targetDir: string): (relPath: string) => boolean {
	const ignorePath = join(targetDir, ".meowkitignore");
	if (!existsSync(ignorePath)) return () => false;

	const patterns = readFileSync(ignorePath, "utf-8")
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith("#"));

	if (patterns.length === 0) return () => false;

	return (relPath: string) => {
		for (const p of patterns) {
			if (relPath === p) return true;
			if (p.endsWith("/") && relPath.startsWith(p)) return true;
			if (relPath.startsWith(p + "/")) return true;
		}
		return false;
	};
}

/** Recursively collect files from a directory */
export function walkDir(dir: string, base: string): Array<{ relPath: string; srcPath: string }> {
	const results: Array<{ relPath: string; srcPath: string }> = [];
	const SKIP = new Set(["__pycache__", "node_modules", ".DS_Store"]);

	for (const entry of readdirSync(dir)) {
		if (SKIP.has(entry) || entry.endsWith(".pyc") || entry.endsWith("_INDEX.md") || entry === "SKILLS_ATTRIBUTION.md")
			continue;
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			results.push(...walkDir(full, base));
		} else {
			results.push({ relPath: relative(base, full), srcPath: full });
		}
	}
	return results;
}

/** Copy a single file, creating parent dirs. Sets executable for hooks/scripts. */
export function copyFile(src: string, dest: string, dryRun: boolean): void {
	if (dryRun) return;

	mkdirSync(dirname(dest), { recursive: true });
	copyFileSync(src, dest);

	// Use path.basename(path.dirname(...)) rather than splitting on "/" because
	// Node's path returns platform separators (\ on Windows, / elsewhere).
	const parent = basename(dirname(dest));
	const ext = basename(dest).includes(".") ? "." + basename(dest).split(".").pop() : "";
	if (ext === ".sh" || ext === ".cjs" || parent === "hooks" || parent === "bin") {
		chmodSync(dest, 0o755);
	}
}
