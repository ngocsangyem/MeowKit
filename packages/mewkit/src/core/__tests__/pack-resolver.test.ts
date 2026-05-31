import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectFiles } from "../compute-checksums.js";
import {
	availablePacks,
	availableProfiles,
	flattenProfile,
	loadPackManifest,
	PackManifestError,
	type PackManifest,
} from "../pack-manifest.js";
import { resolvePacks, resolveProfile, resolveProfileDetailed } from "../pack-resolver.js";
// Single canonical safety list — also asserted by `validate --packs` (check-packs).
import { SAFETY_PATHS } from "../check-packs.js";

// Resolve against the LIVE harness tree (vitest cwd = repo root).
const LIVE = join(process.cwd(), ".claude");
const manifest = loadPackManifest(LIVE);

describe("pack manifest (live)", () => {
	it("loads the 7 report profiles and the documented packs", () => {
		expect(availableProfiles(manifest).sort()).toEqual(
			["atlassian", "core", "developer", "full", "product", "research", "security"].sort(),
		);
		expect(availablePacks(manifest)).toContain("lifecycle-core");
		expect(availablePacks(manifest)).toContain("atlassian");
	});

	it("flattens profiles transitively (developer extends core) and flags the full wildcard", () => {
		const dev = flattenProfile(manifest, "developer");
		expect(dev.wildcard).toBe(false);
		expect(dev.packs).toEqual(expect.arrayContaining(["base", "lifecycle-core", "utility", "testing", "git", "docs"]));
		expect(flattenProfile(manifest, "full").wildcard).toBe(true);
	});
});

describe("resolveProfile (live)", () => {
	it("resolves each profile to a non-empty, deterministic set", () => {
		for (const profile of ["core", "developer", "product", "atlassian", "security", "research"]) {
			const a = resolveProfile(LIVE, manifest, profile);
			const b = resolveProfile(LIVE, manifest, profile);
			expect(a.size, profile).toBeGreaterThan(0);
			expect([...a].sort()).toEqual([...b].sort());
		}
	});

	it("nests core ⊆ developer ⊆ product", () => {
		const core = resolveProfile(LIVE, manifest, "core");
		const dev = resolveProfile(LIVE, manifest, "developer");
		const product = resolveProfile(LIVE, manifest, "product");
		for (const p of core) expect(dev.has(p), `dev missing ${p}`).toBe(true);
		for (const p of dev) expect(product.has(p), `product missing ${p}`).toBe(true);
		expect(dev.size).toBeGreaterThan(core.size);
	});

	it("includes every safety file in EVERY profile incl. core", () => {
		for (const profile of ["core", "developer", "product", "atlassian", "security", "research"]) {
			const set = resolveProfile(LIVE, manifest, profile);
			for (const path of SAFETY_PATHS) {
				expect(set.has(path), `${profile} missing safety file ${path}`).toBe(true);
			}
		}
	});

	it("expands a skill to its whole directory, not just SKILL.md", () => {
		const core = resolveProfile(LIVE, manifest, "core");
		const cookFiles = [...core].filter((p) => p.startsWith("skills/cook/"));
		expect(cookFiles).toContain("skills/cook/SKILL.md");
		expect(cookFiles.length).toBeGreaterThan(1); // references/, scripts/ rode along
	});

	it("omits other-domain skills from core (no Atlassian)", () => {
		const core = resolveProfile(LIVE, manifest, "core");
		expect([...core].some((p) => p.startsWith("skills/jira/"))).toBe(false);
		expect([...core].some((p) => p.startsWith("skills/confluence/"))).toBe(false);
		const atlassian = resolveProfile(LIVE, manifest, "atlassian");
		expect([...atlassian].some((p) => p.startsWith("skills/jira/"))).toBe(true);
	});

	it("full === collectFiles(source) (byte parity with today's install)", () => {
		const full = resolveProfile(LIVE, manifest, "full");
		const tree = new Set(collectFiles(LIVE, LIVE).map((p) => p.replace(/\\/g, "/")));
		expect([...full].sort()).toEqual([...tree].sort());
	});

	it("exposes per-pack membership for pack-remove math", () => {
		const detailed = resolveProfileDetailed(LIVE, manifest, "core");
		expect(detailed.packMembership.has("base")).toBe(true);
		expect(detailed.packMembership.has("lifecycle-core")).toBe(true);
		expect(detailed.packs).toEqual(expect.arrayContaining(["base", "lifecycle-core", "memory", "utility"]));
	});

	it("resolvePacks(atlassian) layers base + the named pack", () => {
		const set = resolvePacks(LIVE, manifest, ["atlassian"]);
		expect(set.has("rules/security-rules.md")).toBe(true); // base always
		expect([...set].some((p) => p.startsWith("skills/jira/"))).toBe(true);
	});

	it("throws on an unknown profile, listing valid names", () => {
		expect(() => resolveProfile(LIVE, manifest, "nope")).toThrow(/unknown profile "nope"/);
	});
});

// --- Synthetic harnesses for edge cases owner-derivation can't express ---

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const SCHEMA = JSON.stringify({
	properties: {
		owner: { enum: ["lifecycle", "utility"] },
		criticality: { enum: ["critical", "medium"] },
		status: { enum: ["active"] },
		runtime: { enum: ["claude-code"] },
	},
});

async function makeHarness(manifestObj: unknown, dependsOn?: string[]): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-pack-"));
	tempDirs.push(root);
	const c = join(root, ".claude");
	await mkdir(join(c, "schemas"), { recursive: true });
	await writeFile(join(c, "schemas", "harness-metadata-schema.json"), SCHEMA);
	const fm = (name: string, deps?: string[]) =>
		`---\nname: ${name}\nowner: lifecycle\ncriticality: medium\nstatus: active\nruntime: claude-code\n${deps ? `depends_on: [${deps.join(", ")}]\n` : ""}---\n# body\n`;
	for (const id of ["mk:a", "mk:b"]) {
		await mkdir(join(c, "skills", id.replace("mk:", "")), { recursive: true });
		await writeFile(join(c, "skills", id.replace("mk:", ""), "SKILL.md"), fm(id, id === "mk:a" ? dependsOn : undefined));
	}
	await writeFile(join(c, "harness-inventory.json"), JSON.stringify({ schema_version: 1, artifacts: {} }));
	await writeFile(join(c, "pack-manifest.json"), JSON.stringify(manifestObj));
	return c;
}

const SYNTH_MANIFEST = (packs: PackManifest["packs"], profiles: PackManifest["profiles"]): PackManifest => ({
	schemaVersion: "1.0",
	base: { files: [], globs: [], commands: [] },
	packs,
	profiles,
});

describe("resolver edge cases (synthetic)", () => {
	it("rejects a profile cycle", async () => {
		const c = await makeHarness(SYNTH_MANIFEST({ p: { owners: ["lifecycle"] } }, { x: ["y"], y: ["x"] }));
		const m = loadPackManifest(c);
		expect(() => resolveProfile(c, m, "x")).toThrow(/cycle/);
	});

	it("throws on an unknown artifactsAdd id", async () => {
		const c = await makeHarness(SYNTH_MANIFEST({ p: { artifactsAdd: ["mk:ghost"] } }, { only: ["p"] }));
		const m = loadPackManifest(c);
		expect(() => resolveProfile(c, m, "only")).toThrow(/unknown artifact id "mk:ghost"/);
	});

	it("runs the depends_on closure: a→b pulls b in (and never drops a)", async () => {
		// Pack selects only mk:a (via add); closure must pull mk:b through the edge.
		const c = await makeHarness(SYNTH_MANIFEST({ p: { artifactsAdd: ["mk:a"] } }, { only: ["p"] }), ["mk:b"]);
		const m = loadPackManifest(c);
		const set = resolveProfile(c, m, "only");
		expect(set.has("skills/a/SKILL.md")).toBe(true);
		expect(set.has("skills/b/SKILL.md")).toBe(true);
	});

	it("closure is a no-op when there are no edges (does not drop the selected artifact)", async () => {
		const c = await makeHarness(SYNTH_MANIFEST({ p: { artifactsAdd: ["mk:a"] } }, { only: ["p"] }));
		const m = loadPackManifest(c);
		const set = resolveProfile(c, m, "only");
		expect(set.has("skills/a/SKILL.md")).toBe(true);
		expect(set.has("skills/b/SKILL.md")).toBe(false);
	});

	it("loadPackManifest throws PackManifestError on malformed JSON shape", async () => {
		const c = await makeHarness({ schemaVersion: "1.0", base: {}, packs: {}, profiles: {} });
		expect(() => loadPackManifest(c)).toThrow(PackManifestError);
	});
});
