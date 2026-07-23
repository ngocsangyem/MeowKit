// Codex skill-pack catalog: the ONE mechanism that decides which authored skills a
// given install ships. `catalog/skill-packs.json` maps every shipped skill dir to
// exactly one pack; `core` installs by default, other packs are explicit (`--packs`)
// or `--all`. At apply time the single `.agents/skills` manifest entry is EXPANDED
// into one per-skill sub-entry for the resolved skill set, so the reconciler handles
// each skill dir independently (idempotent, per-dir conflict detection, upgrade-adds-a-pack).
//
// Backward compatible: when no catalog file exists, callers keep copying the whole
// skills tree (the pre-pack behavior), so nothing breaks before the catalog lands.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ArtifactManifestEntry } from "./artifact-manifest-schema.js";

export const SkillPackSchema = z.object({
	description: z.string().default(""),
	/** Packs this pack pulls in transitively (e.g. every pack depends on `core`). */
	dependsOn: z.array(z.string()).default([]),
	/** Exact skill dir names under `.agents/skills/` that belong to this pack. */
	skills: z.array(z.string().min(1)),
});
export type SkillPack = z.infer<typeof SkillPackSchema>;

export const SkillPackCatalogSchema = z.object({
	budgetChars: z.number().int().positive().default(8000),
	defaultPack: z.string().default("core"),
	packs: z.record(z.string(), SkillPackSchema),
	/** Optional pre-computed name+description char totals (advisory; the validator recomputes). */
	budgetReport: z.record(z.string(), z.number()).optional(),
});
export type SkillPackCatalog = z.infer<typeof SkillPackCatalogSchema>;

/** Selection intent: `"all"` = every pack; otherwise the named packs (defaults applied by resolve). */
export type PackSelection = "all" | string[];

export function skillPackCatalogPath(moduleDir: string): string {
	return join(moduleDir, "catalog", "skill-packs.json");
}

/** Load + validate the catalog, or return null when absent (pre-pack, whole-tree install). */
export function loadSkillPackCatalog(moduleDir: string): SkillPackCatalog | null {
	const p = skillPackCatalogPath(moduleDir);
	if (!existsSync(p)) return null;
	const parsed = SkillPackCatalogSchema.safeParse(JSON.parse(readFileSync(p, "utf-8")));
	if (!parsed.success) {
		throw new Error(
			`invalid skill-packs.json: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
		);
	}
	return parsed.data;
}

/**
 * Resolve a selection to the concrete pack list + union of skill dirs, following
 * `dependsOn` transitively. Empty selection → the catalog's `defaultPack`. Throws on
 * an unknown pack name so a typo fails loudly instead of installing nothing.
 */
export function resolvePackSelection(
	catalog: SkillPackCatalog,
	selection: PackSelection = [],
): { packs: string[]; skills: string[] } {
	const known = new Set(Object.keys(catalog.packs));
	const requested = selection === "all" ? [...known] : selection.length > 0 ? selection : [catalog.defaultPack];

	const resolved = new Set<string>();
	const visit = (name: string): void => {
		if (resolved.has(name)) return;
		if (!known.has(name)) throw new Error(`unknown skill pack: "${name}" (known: ${[...known].sort().join(", ")})`);
		resolved.add(name);
		for (const dep of catalog.packs[name].dependsOn) visit(dep);
	};
	for (const name of requested) visit(name);

	const skills = new Set<string>();
	for (const name of resolved) for (const s of catalog.packs[name].skills) skills.add(s);
	return { packs: [...resolved].sort(), skills: [...skills].sort() };
}

/**
 * Expand the single `.agents/skills` directory manifest entry into one entry per
 * install skill dir, preserving ownership/mode/scope/active. The reconciler then
 * treats each skill dir as its own reconciled item (targetPath `.agents/skills/<name>`).
 */
export function expandSkillsEntry(skillsEntry: ArtifactManifestEntry, installSkills: string[]): ArtifactManifestEntry[] {
	return installSkills.map((name) => ({
		...skillsEntry,
		sourcePath: `${skillsEntry.sourcePath}/${name}`,
		targetPath: `${skillsEntry.targetPath}/${name}`,
	}));
}

/** True when a manifest entry is the aggregate skills-tree entry that packs expand. */
export function isSkillsTreeEntry(entry: ArtifactManifestEntry): boolean {
	return entry.targetPath === ".agents/skills";
}

/** name-length + description-length for one skill dir's SKILL.md (the discovery-budget unit). */
export function skillNameDescChars(skillDir: string): number {
	const md = join(skillDir, "SKILL.md");
	if (!existsSync(md)) return 0;
	const t = readFileSync(md, "utf-8");
	const name = (t.match(/^name:\s*["']?([^"'\n]+?)["']?\s*$/m)?.[1] ?? "").trim();
	// description may be quoted and can wrap; capture up to the closing quote or next top-level key.
	const desc = (t.match(/^description:\s*"([\s\S]*?)"\s*$/m)?.[1] ?? t.match(/^description:\s*([^\n]+)$/m)?.[1] ?? "").trim();
	return name.length + desc.length;
}

/** Sum of name+description chars across a set of skill dir names under `skillsRoot`. */
export function packBudgetChars(skillsRoot: string, skillNames: string[]): number {
	return skillNames.reduce((sum, n) => sum + skillNameDescChars(join(skillsRoot, n)), 0);
}

/** All skill dir names physically present under `.agents/skills/` (for orphan detection). */
export function listSkillDirs(skillsRoot: string): string[] {
	if (!existsSync(skillsRoot)) return [];
	return readdirSync(skillsRoot, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);
}

export interface CatalogCheck {
	level: "pass" | "warn" | "fail";
	name: string;
	detail: string;
}

/** Skill dir names that are porter meta-mirrors (excluded from packs; deleted in the
 *  meta-mirror cleanup). Not orphans just because they are unpackaged. */
function isMetaMirror(name: string): boolean {
	return /^(command-|rule-|mode-)/.test(name);
}

/**
 * Coherence + discovery-budget validation for the skill-pack catalog, run against the
 * authored MODULE (the catalog is kit-internal — never installed into a target, so this
 * cannot live in the target-project validator). FAIL = install would break (a listed
 * skill dir is missing, a skill is in two packs, a dependsOn is unknown). WARN =
 * discovery risk that content-shrink resolves (over-budget install, unpackaged skill).
 * The default-pack (`core`) budget is the plan's headline success criterion; it stays a
 * WARN until descriptions are shrunk, then hardens to FAIL at cutover.
 */
export function validateSkillPackCatalog(moduleDir: string): CatalogCheck[] {
	const catalog = loadSkillPackCatalog(moduleDir); // throws on invalid JSON/schema
	if (!catalog) return [{ level: "warn", name: "Codex skill-pack catalog", detail: "no skill-packs.json (whole-tree install)" }];

	const out: CatalogCheck[] = [{ level: "pass", name: "Codex skill-pack catalog parses", detail: `${Object.keys(catalog.packs).length} packs` }];
	const skillsRoot = join(moduleDir, "root", ".agents", "skills");
	const onDisk = new Set(listSkillDirs(skillsRoot));

	// Exactly-one-pack: no skill listed in two packs.
	const packOf = new Map<string, string>();
	const dupes: string[] = [];
	for (const [pk, pv] of Object.entries(catalog.packs)) {
		for (const s of pv.skills) {
			if (packOf.has(s)) dupes.push(`"${s}" in ${packOf.get(s)} + ${pk}`);
			else packOf.set(s, pk);
		}
	}
	out.push(
		dupes.length === 0
			? { level: "pass", name: "Codex pack membership unique", detail: `${packOf.size} skills, one pack each` }
			: { level: "fail", name: "Codex pack membership unique", detail: `skill in >1 pack: ${dupes.join("; ")}` },
	);

	// Every listed skill dir exists (else install throws "artifact missing").
	const missing = [...packOf.keys()].filter((s) => !onDisk.has(s));
	out.push(
		missing.length === 0
			? { level: "pass", name: "Codex pack skills exist", detail: "every listed skill dir is present" }
			: { level: "fail", name: "Codex pack skills exist", detail: `catalog lists absent dir(s): ${missing.join(", ")}` },
	);

	// dependsOn references a known pack.
	const known = new Set(Object.keys(catalog.packs));
	const badDeps: string[] = [];
	for (const [pk, pv] of Object.entries(catalog.packs)) for (const d of pv.dependsOn) if (!known.has(d)) badDeps.push(`${pk} → ${d}`);
	out.push(
		badDeps.length === 0
			? { level: "pass", name: "Codex pack dependsOn resolve", detail: "all dependencies known" }
			: { level: "fail", name: "Codex pack dependsOn resolve", detail: `unknown dependency: ${badDeps.join(", ")}` },
	);

	// Orphans: a real (non-meta-mirror) skill dir in no pack would never install.
	const orphans = [...onDisk].filter((n) => !isMetaMirror(n) && !packOf.has(n));
	out.push(
		orphans.length === 0
			? { level: "pass", name: "Codex pack coverage", detail: "every shipped skill maps to a pack" }
			: { level: "warn", name: "Codex pack coverage", detail: `unpackaged skill(s) (won't install): ${orphans.join(", ")}` },
	);

	// Discovery budget: the resolved install for each pack (pack + its dependsOn) must fit
	// Codex's name+description budget. Default `core` is the headline figure.
	for (const pk of Object.keys(catalog.packs)) {
		const { skills } = resolvePackSelection(catalog, [pk]);
		const chars = packBudgetChars(skillsRoot, skills);
		const isDefault = pk === catalog.defaultPack;
		if (chars > catalog.budgetChars) {
			out.push({
				level: "warn",
				name: `Codex pack budget: ${pk}${isDefault ? " (default)" : ""}`,
				detail: `${chars} > ${catalog.budgetChars} name+desc chars — shrink descriptions before cutover`,
			});
		} else if (isDefault) {
			out.push({ level: "pass", name: `Codex pack budget: ${pk} (default)`, detail: `${chars} ≤ ${catalog.budgetChars}` });
		}
	}
	return out;
}
