import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The repo root, four levels up from `src/core/__tests__/helpers/`. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../..");

const SCHEMA = path.join(REPO_ROOT, ".claude", "schemas", "skill-schema.json");

/**
 * A throwaway project root holding the REAL schema plus the given SKILL.md
 * bodies. The real schema is copied rather than stubbed so a schema edit that
 * breaks a frontmatter contract fails these tests instead of passing against a
 * fixture nobody updated.
 */
export function makeSkillTree(skills: Record<string, string>, extraFiles: Record<string, string> = {}): string {
	const root = mkdtempSync(path.join(tmpdir(), "skill-tree-"));
	mkdirSync(path.join(root, ".claude", "schemas"), { recursive: true });
	copyFileSync(SCHEMA, path.join(root, ".claude", "schemas", "skill-schema.json"));
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
