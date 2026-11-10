// Two install-time guarantees: the always-on rule set is
// what install validation asserts (not a rule-file count, and no root CLAUDE.md), and an
// update never creates or refreshes a root CLAUDE.md in the target project.
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALWAYS_ON_RULES, ALWAYS_ON_RULE_PATHS } from "../always-on-rules.js";
import { smartUpdate } from "../smart-update.js";
import { validate } from "../validate-install.js";
import type { UserConfig } from "../substitute-placeholders.js";

const tempDirs: string[] = [];

beforeEach(() => {
	// validate() prints a per-check report; silence it so the suite output stays readable.
	vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const config: UserConfig = {
	description: "",
	enableCostTracking: false,
	enableMemory: false,
	geminiApiKey: null,
};

async function makeTempRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-always-on-"));
	tempDirs.push(root);
	return root;
}

/** A target tree carrying every always-on rule file. */
async function writeAlwaysOnRules(root: string): Promise<void> {
	await mkdir(join(root, ".claude", "rules"), { recursive: true });
	for (const rule of ALWAYS_ON_RULES) {
		await writeFile(join(root, ".claude", "rules", rule), `# ${rule}\n`, "utf-8");
	}
}

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

describe("always-on rule set", () => {
	it("is the 7 files, exposed as both names and .claude-relative paths", () => {
		expect(ALWAYS_ON_RULES).toHaveLength(7);
		expect(ALWAYS_ON_RULE_PATHS).toEqual(ALWAYS_ON_RULES.map((r) => `rules/${r}`));
		expect(ALWAYS_ON_RULES).toContain("meowkit-core.md");
		expect(ALWAYS_ON_RULES).not.toContain("CLAUDE.md");
	});
});

describe("install validation", () => {
	it("never fails for a missing root CLAUDE.md", async () => {
		const root = await makeTempRoot();
		await writeAlwaysOnRules(root);
		expect(await exists(join(root, "CLAUDE.md"))).toBe(false);

		const { issues } = validate(root);
		expect(issues.filter((issue) => issue.includes("CLAUDE.md"))).toEqual([]);
	});

	it("reports a missing always-on rule by name, and reports none when all 7 are present", async () => {
		const complete = await makeTempRoot();
		await writeAlwaysOnRules(complete);
		expect(validate(complete).issues.filter((i) => i.startsWith("rules/"))).toEqual([]);

		const incomplete = await makeTempRoot();
		await writeAlwaysOnRules(incomplete);
		await rm(join(incomplete, ".claude", "rules", "gate-rules.md"));
		expect(validate(incomplete).issues).toContain("rules/gate-rules.md exists");
	});

	it("does not require a rule-file count — the 7 named files are the whole invariant", async () => {
		const root = await makeTempRoot();
		await writeAlwaysOnRules(root);
		// Only 7 rule files on disk; a count-based check would have demanded 10+.
		const ruleIssues = validate(root).issues.filter((issue) => issue.toLowerCase().includes("rule"));
		expect(ruleIssues).toEqual([]);
	});
});

/** A release directory with one rule file and a root CLAUDE.md the update must ignore. */
async function makeReleaseWithRootClaudeMd(claudeMd: string): Promise<string> {
	const source = await makeTempRoot();
	await mkdir(join(source, ".claude", "rules"), { recursive: true });
	await writeFile(join(source, ".claude", "rules", "meowkit-core.md"), "# core\n", "utf-8");
	await writeFile(join(source, "CLAUDE.md"), claudeMd, "utf-8");
	return source;
}

describe("smart update and the target project's root CLAUDE.md", () => {
	it("does not create a root CLAUDE.md even when the release directory holds one", async () => {
		const source = await makeReleaseWithRootClaudeMd("# stray release file\n");
		const target = await makeTempRoot();

		await smartUpdate(config, source, target, false, false, { cleanup: false });

		expect(await exists(join(target, "CLAUDE.md"))).toBe(false);
	});

	it("leaves a user-written root CLAUDE.md byte-identical", async () => {
		const source = await makeReleaseWithRootClaudeMd("# kit copy\n");
		const target = await makeTempRoot();
		const userText = "# my own project notes\n";
		await writeFile(join(target, "CLAUDE.md"), userText, "utf-8");

		await smartUpdate(config, source, target, false, false, { cleanup: false });

		await expect(readFile(join(target, "CLAUDE.md"), "utf-8")).resolves.toBe(userText);
	});
});
