// Lint harness for the hand-authored Cursor bundle (Phase 3, part A). Unlike the codex
// per-pack cleanliness test (which filters by an explicit COMPLETED_PACKS allowlist), this
// suite globs the WHOLE authored bundle — agents, rules, and (once landed) skills — so it
// auto-covers the core skill pack when a follow-up task adds it, with no test edit required.
//
// Four responsibilities, matching the phase spec:
//   1. Legacy-token denylist: nothing Claude-Code-bound (tool names, model tiers, CLAUDE_*
//      env vars, .claude/ paths) may appear in Cursor-authored content.
//   2. Frontmatter schema per surface: agents (5 keys), rules (3 keys), skills (name ==
//      dir name, mk- prefix).
//   3. Rule-classification completeness: every .mdc declares an explicit activation mode.
//   4. Description budget: core agent (+ core skill, once present) name+description chars
//      stay under the catalog's budgetChars; each individual description stays under a
//      200-char soft cap mirroring the codex pack-cleanliness test.
//
// A final integration check reconcile-installs the real authored bundle into a throwaway
// target directory and asserts the new agents/rules/AGENTS.md land, and that a second run
// is a no-op — the "does this actually install" proof the phase's VERIFY step asks for.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanDeniedTokens } from "../../denied-token-scan.js";
import { loadSkillPackCatalog, packBudgetChars, resolvePackSelection } from "../codex-skill-packs.js";
import { resolveCursorModuleDir } from "../cursor-authored-bundle.js";
import { scanCursorExtraDenied } from "../cursor-extra-denied-tokens.js";
import { reconcileApplyCursorBundle } from "../cursor-reconcile-apply.js";

const moduleDir = resolveCursorModuleDir();
const rootDir = join(moduleDir, "root");
const agentsDir = join(rootDir, ".cursor", "agents");
const rulesDir = join(rootDir, ".cursor", "rules");
const skillsDir = join(rootDir, ".agents", "skills");

const DESCRIPTION_CAP = 200;

// Legacy-token denylist: the shared denied-token-scan set (which already covers .claude/
// paths, CLAUDE.md, AskUserQuestion, Task(, CLAUDE_*/ANTHROPIC_* env vars, mk/meow slash
// commands — invalid for any non-Claude-Code provider) PLUS the Cursor-only additions in
// cursor-extra-denied-tokens.ts (single source of truth shared with cursor-pack-cleanliness
// so the two suites can never drift): search-tool names + call-form, model tiers, `.codex/`
// paths, the Task-management tool family, the Read tool's offset=/limit= signature, hook
// lifecycle event names, settings.json hook registration, and the Anthropic no-reply email.
function scanAllDenied(content: string): string[] {
	return [...scanDeniedTokens(content).map((m) => m.label), ...scanCursorExtraDenied(content)];
}

function walkFiles(dir: string, acc: string[] = []): string[] {
	if (!existsSync(dir)) return acc;
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) walkFiles(p, acc);
		else acc.push(p);
	}
	return acc;
}

/** Minimal frontmatter reader: exact key set + raw (unparsed) values, good enough for a
 *  lint pass over hand-authored `.md`/`.mdc` files (not a full YAML parser). */
function parseFrontmatter(content: string): { keys: string[]; raw: Record<string, string> } {
	const m = content.match(/^---\n([\s\S]*?)\n---\n?/);
	if (!m) return { keys: [], raw: {} };
	const raw: Record<string, string> = {};
	for (const line of m[1].split("\n")) {
		const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (kv) raw[kv[1]] = kv[2].trim();
	}
	return { keys: Object.keys(raw), raw };
}

function unquote(v: string): string {
	const m = v.match(/^"([\s\S]*)"$/) ?? v.match(/^'([\s\S]*)'$/);
	return (m ? m[1] : v).trim();
}

const agentFiles = walkFiles(agentsDir).filter((f) => f.endsWith(".md"));
const ruleFiles = walkFiles(rulesDir).filter((f) => f.endsWith(".mdc"));

// The DEFAULT-install agent set is the `core` pack (agent-packs.json); extended packs are
// opt-in and may ship write-capable agents (readonly:false). Core-only invariants
// (advisory-readonly, default-install budget) scope to this set — mirroring how the skill
// checks scope via resolvePackSelection — while schema/name/model/denylist checks apply to
// every authored agent.
const coreAgentNames: string[] = (() => {
	const p = join(moduleDir, "catalog", "agent-packs.json");
	if (!existsSync(p)) return [];
	return JSON.parse(readFileSync(p, "utf-8")).packs?.core?.agents ?? [];
})();
const isCoreAgent = (file: string): boolean =>
	coreAgentNames.includes(file.slice(agentsDir.length + 1).replace(/\.md$/, ""));

// Denylist scope: the agent-facing / model-read surfaces (AGENTS.md router, agents, rules,
// and skills once landed) — i.e. exactly "agents/skills/rules" plus the root router, which is
// what Phase 3 authors and what a future skill-authoring pass will add under `.agents/skills/`.
// Deliberately EXCLUDES `.meowkit/README.md`: that file is Phase-2-owned (not part of this
// phase's File Ownership) and legitimately documents the real `.claude/memory/` ->
// `.meowkit/memory/` cross-provider import source path (plan.md goal 7) — a factual interop
// reference, not a leaked Claude-Code-bound instruction, so it is not subject to this denylist.
const denylistScope = [join(rootDir, "AGENTS.md"), ...walkFiles(agentsDir), ...walkFiles(rulesDir), ...walkFiles(skillsDir)];

describe("cursor bundle: authored content exists (Phase 3 part A)", () => {
	it("ships the core agent pack (explorer, planner, reviewer); extended agents may coexist", () => {
		expect(coreAgentNames.slice().sort()).toEqual(["explorer", "planner", "reviewer"]);
		for (const name of coreAgentNames) {
			expect(
				agentFiles.some((f) => f.slice(agentsDir.length + 1) === `${name}.md`),
				`core agent ${name}.md is present`,
			).toBe(true);
		}
	});

	it("ships at least the runtime-invariants rule plus domain rules", () => {
		const names = ruleFiles.map((f) => f.slice(rulesDir.length + 1));
		expect(names).toContain("runtime-invariants.mdc");
		expect(names.length).toBeGreaterThanOrEqual(2);
	});
});

describe("cursor bundle: legacy-token denylist (agents/skills/rules + AGENTS.md, auto-covers future skills)", () => {
	it("no authored agent, rule, skill, or AGENTS.md file contains a Claude-Code-bound token", () => {
		const leaks: string[] = [];
		for (const f of denylistScope) {
			const content = readFileSync(f, "utf-8");
			const hits = scanAllDenied(content);
			if (hits.length > 0) leaks.push(`${f.slice(rootDir.length + 1)} [${hits.join(", ")}]`);
		}
		expect(leaks, `denied tokens found: ${leaks.join("; ")}`).toEqual([]);
	});
});

describe("cursor bundle: agent frontmatter schema (exactly the 5 verified fields)", () => {
	const ALLOWED = ["name", "description", "model", "readonly", "is_background"].sort();

	for (const file of agentFiles) {
		const rel = file.slice(agentsDir.length + 1);
		const { keys, raw } = parseFrontmatter(readFileSync(file, "utf-8"));

		it(`${rel}: frontmatter keys are exactly {name, description, model, readonly, is_background}`, () => {
			expect([...keys].sort()).toEqual(ALLOWED);
		});

		it(`${rel}: name matches filename`, () => {
			expect(unquote(raw.name ?? "")).toBe(rel.replace(/\.md$/, ""));
		});

		it(`${rel}: model is "inherit" (locked decision — current model IDs only in explicit opt-in profiles)`, () => {
			expect(unquote(raw.model ?? "")).toBe("inherit");
		});

		it(`${rel}: readonly is a boolean; core-pack agents are advisory-only (readonly:true)`, () => {
			expect(["true", "false"]).toContain(raw.readonly);
			if (isCoreAgent(file)) expect(raw.readonly, `core agent ${rel} must be readonly`).toBe("true");
		});

		it(`${rel}: description reads as a routing trigger (states "Use when" / "use proactively")`, () => {
			const desc = unquote(raw.description ?? "").toLowerCase();
			expect(desc.includes("use when") || desc.includes("use proactively") || desc.includes("use for")).toBe(true);
		});
	}
});

describe("cursor bundle: rule frontmatter schema (exactly the 3 verified fields, no more)", () => {
	const ALLOWED = new Set(["description", "globs", "alwaysApply"]);

	for (const file of ruleFiles) {
		const rel = file.slice(rulesDir.length + 1);
		const { keys } = parseFrontmatter(readFileSync(file, "utf-8"));

		it(`${rel}: every frontmatter key is one of {description, globs, alwaysApply}`, () => {
			const bad = keys.filter((k) => !ALLOWED.has(k));
			expect(bad, `unexpected key(s): ${bad.join(", ")}`).toEqual([]);
		});
	}
});

describe("cursor bundle: rule-classification completeness (no unclassified .mdc)", () => {
	for (const file of ruleFiles) {
		const rel = file.slice(rulesDir.length + 1);
		const { raw } = parseFrontmatter(readFileSync(file, "utf-8"));

		it(`${rel}: has an explicit activation mode (alwaysApply: true, OR a description, OR globs)`, () => {
			const alwaysApply = raw.alwaysApply === "true";
			const hasDescription = typeof raw.description === "string" && raw.description.length > 0;
			const hasGlobs = typeof raw.globs === "string" && raw.globs.length > 0;
			expect(
				alwaysApply || hasDescription || hasGlobs,
				`${rel} declares no activation mode — every .mdc must be a deliberate Always Apply, Agent Requested, or Auto Attached choice`,
			).toBe(true);
		});
	}

	it("exactly one rule is Always Apply (runtime-invariants.mdc) — everything else is situational", () => {
		const alwaysApplyRules = ruleFiles.filter((f) => parseFrontmatter(readFileSync(f, "utf-8")).raw.alwaysApply === "true");
		expect(alwaysApplyRules.map((f) => f.slice(rulesDir.length + 1))).toEqual(["runtime-invariants.mdc"]);
	});
});

describe("cursor bundle: skill frontmatter schema (when skills are present)", () => {
	const skillDirs = existsSync(skillsDir)
		? readdirSync(skillsDir, { withFileTypes: true })
				.filter((d) => d.isDirectory())
				.map((d) => d.name)
		: [];

	it("records how many skill dirs exist today (informational — 0 is expected before the follow-up skill-authoring task)", () => {
		expect(skillDirs.length).toBeGreaterThanOrEqual(0);
	});

	for (const name of skillDirs) {
		const skillMd = join(skillsDir, name, "SKILL.md");

		it(`${name}: name matches its directory and carries the mk- prefix`, () => {
			expect(existsSync(skillMd), `${name} has no SKILL.md`).toBe(true);
			const { raw } = parseFrontmatter(readFileSync(skillMd, "utf-8"));
			expect(unquote(raw.name ?? "")).toBe(name);
			expect(name.startsWith("mk-"), `skill dir "${name}" must carry the mk- namespace prefix`).toBe(true);
		});
	}
});

describe("cursor bundle: description budget", () => {
	function agentNameDescChars(file: string): number {
		const { raw } = parseFrontmatter(readFileSync(file, "utf-8"));
		return unquote(raw.name ?? "").length + unquote(raw.description ?? "").length;
	}

	it("every individual agent description stays under the 200-char soft cap", () => {
		const over: string[] = [];
		for (const file of agentFiles) {
			const { raw } = parseFrontmatter(readFileSync(file, "utf-8"));
			const len = unquote(raw.description ?? "").length;
			if (len > DESCRIPTION_CAP) over.push(`${file.slice(agentsDir.length + 1)} (${len})`);
		}
		expect(over, `over-cap agent description(s): ${over.join(", ")}`).toEqual([]);
	});

	it("core install (core agent pack + core skill pack, if any) stays under the catalog's budgetChars", () => {
		const catalog = loadSkillPackCatalog(moduleDir); // catalog/skill-packs.json — shared schema, cursor moduleDir
		const budgetChars = catalog?.budgetChars ?? 8000;

		const coreAgentChars = agentFiles.filter(isCoreAgent).reduce((sum, f) => sum + agentNameDescChars(f), 0);

		let coreSkillChars = 0;
		if (catalog && Object.keys(catalog.packs).length > 0) {
			const { skills } = resolvePackSelection(catalog, []);
			coreSkillChars = packBudgetChars(skillsDir, skills);
		}

		const total = coreAgentChars + coreSkillChars;
		expect(total, `core install is ${total} name+description chars, over budget ${budgetChars}`).toBeLessThanOrEqual(
			budgetChars,
		);
	});
});

describe("cursor bundle: reconcile-install smoke (real authored bundle -> throwaway target)", () => {
	it("installs AGENTS.md, the 3 agents, and the rules; a second run is a no-op", async () => {
		const target = mkdtempSync(join(tmpdir(), "cursor-bundle-lint-"));
		try {
			const first = await reconcileApplyCursorBundle(moduleDir, target, {
				adoptHomeRegistry: false,
				projectRoot: target,
			});
			expect(first.conflicts).toEqual([]);
			expect(existsSync(join(target, "AGENTS.md"))).toBe(true);
			expect(existsSync(join(target, ".cursor", "agents", "explorer.md"))).toBe(true);
			expect(existsSync(join(target, ".cursor", "agents", "planner.md"))).toBe(true);
			expect(existsSync(join(target, ".cursor", "agents", "reviewer.md"))).toBe(true);
			expect(existsSync(join(target, ".cursor", "rules", "runtime-invariants.mdc"))).toBe(true);
			expect(statSync(join(target, ".cursor", "agents")).isDirectory()).toBe(true);

			const second = await reconcileApplyCursorBundle(moduleDir, target, {
				adoptHomeRegistry: false,
				projectRoot: target,
			});
			expect(second.writes).toBe(0);
			expect(second.conflicts).toEqual([]);
		} finally {
			rmSync(target, { recursive: true, force: true });
		}
	});
});
