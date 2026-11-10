import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The repo root, four levels up from `src/core/__tests__/helpers/`. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../..");

/**
 * A throwaway project root holding the given SKILL.md bodies and nothing else.
 *
 * No schema is planted: the validator reads the REAL schema from its own
 * package, so these tests run against the schema that ships, and a schema edit
 * that breaks a frontmatter contract fails here instead of passing against a
 * fixture copy nobody updated.
 */
export function makeSkillTree(skills: Record<string, string>, extraFiles: Record<string, string> = {}): string {
	const root = mkdtempSync(path.join(tmpdir(), "skill-tree-"));
	for (const [name, body] of Object.entries(skills)) {
		const dir = path.join(root, ".claude", "skills", name);
		mkdirSync(dir, { recursive: true });
		writeFileSync(path.join(dir, "SKILL.md"), body);
	}
	for (const [rel, body] of Object.entries(extraFiles)) {
		const full = path.join(root, ".claude", "skills", rel);
		mkdirSync(path.dirname(full), { recursive: true });
		writeFileSync(full, body);
	}
	return root;
}
