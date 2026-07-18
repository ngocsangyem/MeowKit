import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hasPackManifest, loadPackManifest, resolvePacks } from "../../core/index.js";
import { readInstallMetadata } from "../../core/install-metadata.js";
import { smartUpdate } from "../../core/smart-update.js";
import type { UserConfig } from "../../core/substitute-placeholders.js";
import {
	computeRemovablePaths,
	readInstalledState,
	rebuildMetadata,
	settingsReferencedPaths,
} from "../pack-helpers.js";

const config: UserConfig = { description: "", enableCostTracking: false, enableMemory: false, geminiApiKey: null };
const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const SCHEMA = JSON.stringify({
	properties: {
		owner: { enum: ["lifecycle", "jira", "security", "utility"] },
		criticality: { enum: ["critical", "medium"] },
		status: { enum: ["active"] },
		runtime: { enum: ["claude-code"] },
	},
});
const fm = (name: string, owner: string) =>
	`---\nname: ${name}\nowner: ${owner}\ncriticality: medium\nstatus: active\nruntime: claude-code\n---\n# ${name}\n`;

const MANIFEST = {
	schemaVersion: "1.0",
	base: {
		files: ["CLAUDE.md", "settings.json", "pack-manifest.json", "harness-inventory.json", "rules/gate-rules.md"],
		globs: ["hooks/**"],
		commands: ["plan"],
	},
	packs: {
		"lifecycle-core": { owners: ["lifecycle"] },
		atlassian: { owners: ["jira"] },
		extra: { artifactsAdd: ["mk:jira-b"] },
	},
	profiles: { core: ["base", "lifecycle-core"], full: ["*"] },
};

/** Full-install a synthetic harness, then return its target `.claude` dir. */
async function makeInstall(): Promise<string> {
	const sRoot = await mkdtemp(join(tmpdir(), "mewkit-pk-src-"));
	const tRoot = await mkdtemp(join(tmpdir(), "mewkit-pk-tgt-"));
	tempDirs.push(sRoot, tRoot);
	const c = join(sRoot, ".claude");
	const w = async (rel: string, body: string) => {
		await mkdir(join(c, rel, ".."), { recursive: true });
		await writeFile(join(c, rel), body, "utf-8");
	};
	await w("schemas/harness-metadata-schema.json", SCHEMA);
	await w("pack-manifest.json", JSON.stringify(MANIFEST));
	await writeFile(join(sRoot, "CLAUDE.md"), "# p\n", "utf-8");
	await w("settings.json", JSON.stringify({ permissions: { allow: [] } }));
	await w("rules/gate-rules.md", "# gate\n");
	await w("commands/mk/plan.md", "# plan\n");
	await w("hooks/gate-enforcement.sh", "#!/bin/sh\n");
	await w("hooks/jira-env-loader.sh", "#!/bin/sh\n"); // owner jira, base-covered
	await w("skills/cooker/SKILL.md", fm("mk:cooker", "lifecycle"));
	for (const id of ["a", "b", "c", "d"]) await w(`skills/jira-${id}/SKILL.md`, fm(`mk:jira-${id}`, "jira"));
	const registry = {
		schema_version: 1,
		artifacts: {
			"rules/gate-rules.md": { owner: "lifecycle", criticality: "critical", status: "active", runtime: "claude-code" },
			"commands/mk/plan.md": { owner: "utility", criticality: "medium", status: "active", runtime: "claude-code" },
			"hooks/gate-enforcement.sh": {
				owner: "security",
				criticality: "critical",
				status: "active",
				runtime: "claude-code",
			},
			"hooks/jira-env-loader.sh": { owner: "jira", criticality: "medium", status: "active", runtime: "claude-code" },
		},
	};
	await w("harness-inventory.json", JSON.stringify(registry));

	await smartUpdate(config, sRoot, tRoot, false, false, { assumeYes: true });
	return join(tRoot, ".claude");
}

describe("pack-helpers: installed state + settings refs", () => {
	it("readInstalledState reports full when packs are undefined, partial when set", async () => {
		const claudeDir = await makeInstall();
		const manifest = loadPackManifest(claudeDir);

		// Full install: smartUpdate recorded no packs ⇒ isFull, every pack implied.
		const full = readInstalledState(claudeDir, manifest);
		expect(full.isFull).toBe(true);
		expect(full.installedPacks).toEqual(expect.arrayContaining(["base", "atlassian", "lifecycle-core", "extra"]));

		// Partial: stamp packs into metadata ⇒ not full, exactly those + base.
		await rebuildMetadata(claudeDir, full.meta, ["base", "lifecycle-core"]);
		const partial = readInstalledState(claudeDir, manifest);
		expect(partial.isFull).toBe(false);
		expect(partial.installedPacks.sort()).toEqual(["base", "lifecycle-core"]);
	});

	it("settingsReferencedPaths extracts .claude-relative hook paths", async () => {
		const claudeDir = await makeInstall();
		await writeFile(
			join(claudeDir, "settings.json"),
			JSON.stringify({ hooks: { S: `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/jira-env-loader.sh"` } }),
			"utf-8",
		);
		const refs = settingsReferencedPaths(claudeDir);
		expect(refs.has("hooks/jira-env-loader.sh")).toBe(true);
	});

	it("rebuildMetadata persists the next pack list (full round-trip, not surgical)", async () => {
		const claudeDir = await makeInstall();
		const { meta } = readInstallMetadata(claudeDir);
		await rebuildMetadata(claudeDir, meta, ["base", "lifecycle-core"]);
		const after = readInstallMetadata(claudeDir);
		expect(after.meta?.packs).toEqual(["base", "lifecycle-core"]);
		expect(after.meta?.files.length).toBeGreaterThan(0);
	});

	it("rebuildMetadata preserves kit ownership — no false meowkit-modified on unchanged files", async () => {
		const claudeDir = await makeInstall();
		const { meta } = readInstallMetadata(claudeDir);
		// A pack rebuild has no incoming release payload; unchanged kit files on disk
		// must stay meowkit (disk == advanced baseChecksum), never flip to modified.
		await rebuildMetadata(claudeDir, meta, ["base", "lifecycle-core"]);
		const after = readInstallMetadata(claudeDir);
		const gate = after.meta?.files.find((f) => f.path === "rules/gate-rules.md");
		expect(gate?.owner).toBe("meowkit");
		expect(after.meta?.files.some((f) => f.layer !== "user" && f.owner === "meowkit-modified")).toBe(false);
	});
});

describe("computeRemovablePaths exclusivity (the safety property)", () => {
	it("deletes pack-exclusive pristine files; preserves base/dual-homed/settings-ref/user-modified", async () => {
		const claudeDir = await makeInstall();
		const manifest = loadPackManifest(claudeDir);
		const { meta } = readInstallMetadata(claudeDir);

		// jira-c is user-modified (keep frontmatter so it stays an atlassian member);
		// jira-d is settings-referenced.
		await writeFile(join(claudeDir, "skills/jira-c/SKILL.md"), `${fm("mk:jira-c", "jira")}user edit line\n`, "utf-8");
		await writeFile(
			join(claudeDir, "settings.json"),
			JSON.stringify({ hooks: { X: `node ".claude/skills/jira-d/SKILL.md"` } }),
			"utf-8",
		);

		const installedNonBase = ["lifecycle-core", "atlassian", "extra"];
		const plan = computeRemovablePaths(claudeDir, manifest, installedNonBase, ["atlassian"], meta?.files ?? []);

		expect(plan.deletable).toContain("skills/jira-a/SKILL.md"); // exclusive + pristine
		expect(plan.preserved).toContain("hooks/jira-env-loader.sh"); // base-covered
		expect(plan.preserved).toContain("skills/jira-b/SKILL.md"); // dual-homed (extra)
		expect(plan.preserved).toContain("skills/jira-c/SKILL.md"); // user-modified
		expect(plan.preserved).toContain("skills/jira-d/SKILL.md"); // settings-referenced
		expect(plan.deletable).not.toContain("skills/cooker/SKILL.md"); // not a target pack
	});
});

describe("upgrade allow-set + infra guards", () => {
	it("resolvePacks(core packs) excludes jira files — a core install upgrades only core", async () => {
		const claudeDir = await makeInstall();
		const manifest = loadPackManifest(claudeDir);
		const allowed = resolvePacks(claudeDir, manifest, ["lifecycle-core"]);
		expect(allowed.has("skills/cooker/SKILL.md")).toBe(true);
		expect([...allowed].some((p) => p.startsWith("skills/jira-"))).toBe(false);
		// base safety always rides along
		expect(allowed.has("hooks/gate-enforcement.sh")).toBe(true);
	});

	it("hasPackManifest is the infra-absent guard predicate", async () => {
		const empty = await mkdtemp(join(tmpdir(), "mewkit-noman-"));
		tempDirs.push(empty);
		expect(hasPackManifest(empty)).toBe(false);
		const claudeDir = await makeInstall();
		expect(hasPackManifest(claudeDir)).toBe(true);
	});
});
