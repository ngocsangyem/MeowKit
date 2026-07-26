// Characterization test for the one behavior the metadata move must not change: a file the
// user edited after install is still recognized as theirs on the next upgrade.
//
// This is written to pass against the pre-move code and to keep passing after it, which is the
// point — it is the evidence that the move preserved behavior rather than an assertion written
// to match whatever the new code happens to do. The failure it guards against is silent: if a
// reader cannot find the baseline, every file compares equal to nothing, `smart-update` labels
// it toolkit-owned, and the next upgrade overwrites the edit without a prompt.
//
// The three shapes are the three ways a real project can arrive at an upgrade: installed fresh
// after the move, installed before it, and installed before it but written once since.
import { mkdtemp, mkdir, rm, writeFile, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildInstallMetadata, readInstallMetadata, indexByPath } from "../install-metadata.js";
import { writeInstallMetadata } from "../install-metadata-writer.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const SKILL_REL = join("skills", "demo", "SKILL.md");

async function exists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

/** A project with one installed kit file and a metadata baseline recorded for it. */
async function installFixture(): Promise<{ root: string; claudeDir: string }> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-baseline-"));
	tempDirs.push(root);
	const claudeDir = join(root, ".claude");
	await mkdir(join(claudeDir, "skills", "demo"), { recursive: true });
	await writeFile(join(claudeDir, SKILL_REL), "as shipped\n", "utf-8");
	const meta = buildInstallMetadata(claudeDir, { version: "2.14.7" });
	await writeInstallMetadata(root, meta);
	return { root, claudeDir };
}

/** What the next upgrade would conclude about each installed file. */
function ownersAfterRescan(root: string, claudeDir: string): Record<string, string> {
	const prior = readInstallMetadata(claudeDir);
	const rebuilt = buildInstallMetadata(claudeDir, {
		version: "2.14.8",
		priorEntriesByPath: prior.meta ? indexByPath(prior.meta.files) : undefined,
	});
	const out: Record<string, string> = {};
	for (const f of rebuilt.files) out[f.path] = f.owner;
	return out;
}

describe("user edits survive an upgrade", () => {
	it("recognizes an edited kit file as the user's, on a fresh install", async () => {
		const { root, claudeDir } = await installFixture();
		await writeFile(join(claudeDir, SKILL_REL), "as shipped\nplus my line\n", "utf-8");
		expect(ownersAfterRescan(root, claudeDir)[SKILL_REL]).toBe("meowkit-modified");
	});

	it("leaves an untouched kit file toolkit-owned, so upgrades still reach it", async () => {
		const { root, claudeDir } = await installFixture();
		expect(ownersAfterRescan(root, claudeDir)[SKILL_REL]).toBe("meowkit");
	});

	it("recognizes an edited kit file on an install created before the metadata move", async () => {
		const { root, claudeDir } = await installFixture();
		// Recreate the pre-move shape: the baseline sits inside `.claude/` and nowhere else.
		const canonical = join(root, ".meowkit", "metadata.json");
		const legacy = join(claudeDir, "metadata.json");
		if (await exists(canonical)) {
			await writeFile(legacy, await readFile(canonical, "utf-8"), "utf-8");
			await rm(canonical);
		}
		expect(await exists(legacy)).toBe(true);

		await writeFile(join(claudeDir, SKILL_REL), "as shipped\nplus my line\n", "utf-8");
		expect(ownersAfterRescan(root, claudeDir)[SKILL_REL]).toBe("meowkit-modified");
	});

	it("leaves exactly one baseline behind after a pre-move install is written again", async () => {
		const { root, claudeDir } = await installFixture();
		const canonical = join(root, ".meowkit", "metadata.json");
		const legacy = join(claudeDir, "metadata.json");
		if (await exists(canonical)) {
			await writeFile(legacy, await readFile(canonical, "utf-8"), "utf-8");
			await rm(canonical);
		}

		// The next upgrade writes the baseline again. Two baselines would make upgrade behavior
		// depend on read order, so the write must migrate rather than fork.
		const prior = readInstallMetadata(claudeDir);
		const rebuilt = buildInstallMetadata(claudeDir, {
			version: "2.14.8",
			priorEntriesByPath: prior.meta ? indexByPath(prior.meta.files) : undefined,
		});
		await writeInstallMetadata(root, rebuilt);

		const live = [canonical, legacy].filter(async (p) => await exists(p));
		expect(live.length).toBeGreaterThan(0);
		const both = (await exists(canonical)) && (await exists(legacy));
		expect(both).toBe(false);

		// And the edit recognition still holds afterwards.
		await writeFile(join(claudeDir, SKILL_REL), "as shipped\nplus my line\n", "utf-8");
		expect(ownersAfterRescan(root, claudeDir)[SKILL_REL]).toBe("meowkit-modified");
	});
});
