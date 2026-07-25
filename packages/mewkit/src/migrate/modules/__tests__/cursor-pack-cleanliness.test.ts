// Per-pack cleanliness gate for the Cursor bundle's authored skills. Additive twin of
// codex-pack-cleanliness.test.ts: same denied-token + description-budget contract, applied
// to every pack in the Cursor catalog instead of a COMPLETED_PACKS allowlist — Cursor ships
// only `core` today (extended packs are intentionally empty per catalog/skill-packs.json),
// so there is no phased-authoring window to gate; every listed pack is expected clean.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCursorModuleDir } from "../cursor-authored-bundle.js";
import { loadSkillPackCatalog, resolvePackSelection } from "../codex-skill-packs.js";
import { scanCursorDenied } from "../cursor-extra-denied-tokens.js";

const DESCRIPTION_CAP = 200;

// `scanCursorDenied` (cursor-extra-denied-tokens.ts) is the single source of truth for the
// full Cursor denylist (shared set + Cursor-only additions, agent `model:` field exempted) —
// shared with cursor-bundle-lint + cursor-output-brand-free so the suites can never drift. See
// that module's header comment for the full token list and the Grep/Glob + Stop scoping rationale.

const moduleDir = resolveCursorModuleDir();
const skillsRoot = join(moduleDir, "root", ".agents", "skills");
const catalog = loadSkillPackCatalog(moduleDir);

function walkFiles(dir: string, acc: string[]): string[] {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) walkFiles(p, acc);
		else acc.push(p);
	}
	return acc;
}

function descriptionOf(skillDir: string): string {
	const md = join(skillDir, "SKILL.md");
	if (!existsSync(md)) return "";
	const t = readFileSync(md, "utf-8");
	return (t.match(/^description:\s*"([\s\S]*?)"\s*$/m)?.[1] ?? t.match(/^description:\s*([^\n]+)$/m)?.[1] ?? "").trim();
}

function nameOf(skillDir: string): string {
	const md = join(skillDir, "SKILL.md");
	if (!existsSync(md)) return "";
	const t = readFileSync(md, "utf-8");
	const m = t.match(/^name:\s*"?([^"\n]+?)"?\s*$/m);
	return (m?.[1] ?? "").trim();
}

describe("cursor pack cleanliness", () => {
	it("the Cursor skill-pack catalog is present", () => {
		expect(catalog, "skill-packs.json missing").not.toBeNull();
	});

	const packNames = catalog ? Object.keys(catalog.packs) : [];
	it("ships at least the core pack", () => {
		expect(packNames).toContain("core");
	});

	for (const pack of packNames) {
		const skills = catalog ? resolvePackSelection(catalog, [pack]).skills : [];

		it(`${pack}: every skill dir carries the mk- prefix and a matching frontmatter name`, () => {
			const bad: string[] = [];
			for (const s of skills) {
				if (!s.startsWith("mk-")) bad.push(`${s} (missing mk- prefix)`);
				const dir = join(skillsRoot, s);
				if (!existsSync(dir) || !statSync(dir).isDirectory()) {
					bad.push(`${s} (dir missing)`);
					continue;
				}
				const name = nameOf(dir);
				if (name !== s) bad.push(`${s} (frontmatter name "${name}" != dir)`);
			}
			expect(bad, bad.join("; ")).toEqual([]);
		});

		it(`${pack}: every skill file is denied-token clean`, () => {
			const leaks: string[] = [];
			for (const s of skills) {
				const dir = join(skillsRoot, s);
				if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
				for (const f of walkFiles(dir, [])) {
					const hits = scanCursorDenied(readFileSync(f, "utf-8"));
					if (hits.length > 0) leaks.push(`${s}/${f.slice(dir.length + 1)} [${hits.join(", ")}]`);
				}
			}
			expect(leaks, `denied tokens in ${pack}: ${leaks.join("; ")}`).toEqual([]);
		});

		it(`${pack}: every skill description is <= ${DESCRIPTION_CAP} chars`, () => {
			const over: string[] = [];
			for (const s of skills) {
				const len = descriptionOf(join(skillsRoot, s)).length;
				if (len > DESCRIPTION_CAP) over.push(`${s} (${len})`);
			}
			expect(over, `over-cap descriptions in ${pack}: ${over.join(", ")}`).toEqual([]);
		});
	}

	it("no shipped skill dir is orphaned (unpackaged) — every dir under .agents/skills belongs to a pack", () => {
		if (!catalog) return;
		const onDisk = existsSync(skillsRoot)
			? readdirSync(skillsRoot, { withFileTypes: true })
					.filter((d) => d.isDirectory())
					.map((d) => d.name)
			: [];
		const packaged = new Set(Object.values(catalog.packs).flatMap((p) => p.skills));
		const orphans = onDisk.filter((n) => !packaged.has(n));
		expect(orphans, `unpackaged skill dir(s): ${orphans.join(", ")}`).toEqual([]);
	});
});
