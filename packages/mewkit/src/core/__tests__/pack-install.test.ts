import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectFiles } from "../compute-checksums.js";
import { loadPackManifest } from "../pack-manifest.js";
import { resolveProfile, resolveProfileDetailed } from "../pack-resolver.js";
import { readInstallMetadata } from "../install-metadata.js";
import { smartUpdate } from "../smart-update.js";
import type { UserConfig } from "../substitute-placeholders.js";

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

const skillFm = (name: string, owner: string) =>
	`---\nname: ${name}\nowner: ${owner}\ncriticality: medium\nstatus: active\nruntime: claude-code\n---\n# ${name}\n`;

const MANIFEST = {
	schemaVersion: "1.0",
	base: {
		files: [
			"CLAUDE.md",
			"settings.json",
			"statusline.cjs",
			"pack-manifest.json",
			"harness-inventory.json",
			"rules/security-rules.md",
			"rules/injection-rules.md",
			"rules/gate-rules.md",
		],
		globs: ["hooks/**"],
		commands: ["plan", "validate"],
	},
	packs: {
		"lifecycle-core": { owners: ["lifecycle"] },
		atlassian: { owners: ["jira"] },
	},
	profiles: {
		core: ["base", "lifecycle-core"],
		developer: ["core"],
		atlassian: ["core", "atlassian"],
		full: ["*"],
	},
};

const SAFETY = [
	"settings.json",
	"statusline.cjs",
	"hooks/gate-enforcement.sh",
	"hooks/lib/read-hook-input.sh",
	"hooks/dispatch.cjs",
	"rules/security-rules.md",
	"rules/injection-rules.md",
	"rules/gate-rules.md",
	"commands/mk/plan.md",
	"commands/mk/validate.md",
];

/** Build a realistic source release tree with a pack-manifest. */
async function makeSource(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-pack-src-"));
	tempDirs.push(root);
	const c = join(root, ".claude");
	const w = async (rel: string, body: string) => {
		await mkdir(join(c, rel, ".."), { recursive: true });
		await writeFile(join(c, rel), body, "utf-8");
	};
	await w("schemas/harness-metadata-schema.json", SCHEMA);
	await w("pack-manifest.json", JSON.stringify(MANIFEST));
	await writeFile(join(root, "CLAUDE.md"), "# project\n", "utf-8");
	await w("settings.json", JSON.stringify({ permissions: { allow: [] } }));
	await w("statusline.cjs", "// statusline\n");
	// safety rules + hooks (hooks/** rides base)
	await w("rules/security-rules.md", "# security\n");
	await w("rules/injection-rules.md", "# injection\n");
	await w("rules/gate-rules.md", "# gate\n");
	await w("hooks/gate-enforcement.sh", "#!/bin/sh\n");
	await w("hooks/lib/read-hook-input.sh", "#!/bin/sh\n");
	await w("hooks/dispatch.cjs", "// dispatch\n");
	// essential commands
	await w("commands/mk/plan.md", "# plan\n");
	await w("commands/mk/validate.md", "# validate\n");
	// lifecycle skill (in core) + two jira skills (atlassian only)
	await w("skills/cooker/SKILL.md", skillFm("mk:cooker", "lifecycle"));
	await w("skills/cooker/references/r.md", "# ref\n");
	await w("skills/jira-a/SKILL.md", skillFm("mk:jira-a", "jira"));
	await w("skills/jira-b/SKILL.md", skillFm("mk:jira-b", "jira"));
	// registry for non-frontmatter artifacts
	const registry = {
		schema_version: 1,
		artifacts: {
			"rules/security-rules.md": {
				owner: "security",
				criticality: "critical",
				status: "active",
				runtime: "claude-code",
			},
			"rules/injection-rules.md": {
				owner: "security",
				criticality: "critical",
				status: "active",
				runtime: "claude-code",
			},
			"rules/gate-rules.md": { owner: "lifecycle", criticality: "critical", status: "active", runtime: "claude-code" },
			"commands/mk/plan.md": { owner: "utility", criticality: "medium", status: "active", runtime: "claude-code" },
			"commands/mk/validate.md": { owner: "utility", criticality: "medium", status: "active", runtime: "claude-code" },
			"hooks/gate-enforcement.sh": {
				owner: "security",
				criticality: "critical",
				status: "active",
				runtime: "claude-code",
			},
		},
	};
	await w("harness-inventory.json", JSON.stringify(registry));
	return root;
}

async function makeTarget(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-pack-tgt-"));
	tempDirs.push(root);
	return root;
}

function resolve(source: string, profile: string): { allowedPaths: Set<string>; packs: string[] } {
	const srcClaude = join(source, ".claude");
	const manifest = loadPackManifest(srcClaude);
	const d = resolveProfileDetailed(srcClaude, manifest, profile);
	return { allowedPaths: d.paths, packs: d.packs };
}

describe("profile install filter", () => {
	it("(a) core install writes the base + lifecycle subset and omits jira skills", async () => {
		const source = await makeSource();
		const target = await makeTarget();
		const { allowedPaths, packs } = resolve(source, "core");

		await smartUpdate(config, source, target, false, false, { allowedPaths, profile: "core", packs, assumeYes: true });

		const tc = join(target, ".claude");
		expect(existsSync(join(tc, "skills/cooker/SKILL.md"))).toBe(true);
		expect(existsSync(join(tc, "skills/cooker/references/r.md"))).toBe(true);
		expect(existsSync(join(tc, "skills/jira-a/SKILL.md"))).toBe(false);
		expect(existsSync(join(tc, "skills/jira-b/SKILL.md"))).toBe(false);
	});

	it("(b) full/no-profile === collectFiles(source) byte parity", async () => {
		const source = await makeSource();
		const target = await makeTarget();
		await smartUpdate(config, source, target, false, false, { profile: "full", assumeYes: true });

		const installed = new Set(
			collectFiles(join(target, ".claude"), join(target, ".claude")).map((p) => p.replace(/\\/g, "/")),
		);
		const sourceTree = new Set(
			collectFiles(join(source, ".claude"), join(source, ".claude")).map((p) => p.replace(/\\/g, "/")),
		);
		// every source file is installed (meowkit.config.json is generated extra on target)
		for (const p of sourceTree) expect(installed.has(p), `missing ${p}`).toBe(true);
		expect(installed.has("skills/jira-a/SKILL.md")).toBe(true);
	});

	it("(c) metadata records profile + packs (NOT undefined for core)", async () => {
		const source = await makeSource();
		const target = await makeTarget();
		const { allowedPaths, packs } = resolve(source, "core");
		await smartUpdate(config, source, target, false, false, { allowedPaths, profile: "core", packs, assumeYes: true });

		const { meta } = readInstallMetadata(join(target, ".claude"));
		expect(meta?.profile).toBe("core");
		expect(meta?.packs).toBeDefined();
		expect(meta?.packs).toEqual(expect.arrayContaining(["base", "lifecycle-core"]));
	});

	it("(c2) full install records profile=full and undefined packs (auto-adopt sentinel)", async () => {
		const source = await makeSource();
		const target = await makeTarget();
		await smartUpdate(config, source, target, false, false, { profile: "full", assumeYes: true });
		const { meta } = readInstallMetadata(join(target, ".claude"));
		expect(meta?.profile).toBe("full");
		expect(meta?.packs).toBeUndefined();
	});

	it("(d) profile-trim: full→core deletes excluded pristine files, preserves user-modified (warns)", async () => {
		const source = await makeSource();
		const target = await makeTarget();
		// 1. full install
		await smartUpdate(config, source, target, false, false, { profile: "full", assumeYes: true });
		const tc = join(target, ".claude");
		expect(existsSync(join(tc, "skills/jira-a/SKILL.md"))).toBe(true);
		// 2. user edits one out-of-core file → must be preserved on trim
		await writeFile(join(tc, "skills/jira-b/SKILL.md"), "USER EDIT\n", "utf-8");

		// 3. trim to core
		const { allowedPaths, packs } = resolve(source, "core");
		const stats = await smartUpdate(config, source, target, false, false, {
			allowedPaths,
			profile: "core",
			packs,
			assumeYes: true,
			trimToProfile: true,
		});

		expect(existsSync(join(tc, "skills/jira-a/SKILL.md"))).toBe(false); // pristine → trimmed
		expect(existsSync(join(tc, "skills/jira-b/SKILL.md"))).toBe(true); // user-modified → preserved
		expect(stats.profileTrimmed).toContain("skills/jira-a/SKILL.md");
		expect(stats.profileTrimSkipped).toContain("skills/jira-b/SKILL.md");
		expect(existsSync(join(tc, "skills/cooker/SKILL.md"))).toBe(true); // in core → kept
	});

	it("(e) every profile incl. core installs all safety files", async () => {
		const source = await makeSource();
		for (const profile of ["core", "developer", "atlassian"]) {
			const allowed = resolveProfile(join(source, ".claude"), loadPackManifest(join(source, ".claude")), profile);
			for (const path of SAFETY) expect(allowed.has(path), `${profile} missing ${path}`).toBe(true);
		}
	});
});
