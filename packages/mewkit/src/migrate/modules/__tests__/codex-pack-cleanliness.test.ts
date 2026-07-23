// Per-pack cleanliness gate. As each skill pack is authored (native descriptions,
// denied-token-clean bodies), its name is added to COMPLETED_PACKS and this test
// enforces the contract for exactly that pack's skills — WITHOUT waiting for every
// pack to be done. This is deliberately separate from the aggregate codex-target skill
// checks (one row across all skills, filtered by check name), which provide no
// per-batch protection during the phased authoring.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCodexModuleDir } from "../codex-authored-bundle.js";
import { loadSkillPackCatalog, resolvePackSelection } from "../codex-skill-packs.js";
import { scanDeniedTokens } from "../../denied-token-scan.js";

// Packs whose skills have completed the native authoring pass (descriptions shrunk to
// the discovery-budget cap, bodies denied-token clean). Grow this as packs are authored.
const COMPLETED_PACKS = ["core"];

const DESCRIPTION_CAP = 200;

const moduleDir = resolveCodexModuleDir();
const skillsRoot = join(moduleDir, "root", ".agents", "skills");
const catalog = loadSkillPackCatalog(moduleDir);

function walkFiles(dir: string, acc: string[]): string[] {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) walkFiles(p, acc);
		else if (/\.(md|mdx)$/.test(e.name)) acc.push(p);
	}
	return acc;
}

function descriptionOf(skillDir: string): string {
	const md = join(skillDir, "SKILL.md");
	if (!existsSync(md)) return "";
	const t = readFileSync(md, "utf-8");
	return (t.match(/^description:\s*"([\s\S]*?)"\s*$/m)?.[1] ?? t.match(/^description:\s*([^\n]+)$/m)?.[1] ?? "").trim();
}

describe("completed-pack cleanliness", () => {
	it("catalog is present (packs are the install unit)", () => {
		expect(catalog, "skill-packs.json missing").not.toBeNull();
	});

	for (const pack of COMPLETED_PACKS) {
		const skills = catalog ? resolvePackSelection(catalog, [pack]).skills : [];

		it(`${pack}: every skill body is denied-token clean`, () => {
			const leaks: string[] = [];
			for (const s of skills) {
				const dir = join(skillsRoot, s);
				if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
				for (const f of walkFiles(dir, [])) {
					const hits = scanDeniedTokens(readFileSync(f, "utf-8"));
					if (hits.length > 0) leaks.push(`${s}/${f.slice(dir.length + 1)} [${hits.map((h) => h.label).join(", ")}]`);
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
});
