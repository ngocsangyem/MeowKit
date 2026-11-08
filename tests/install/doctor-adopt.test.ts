// `doctor` over five projects, and `--adopt` where it can and cannot answer.
//
// The claim worth proving is negative: no in-project file a pull request could
// write — a `release-manifest.json`, a `metadata.json`, a cache path forced into
// tracking — can seed a baseline that later authorizes a deletion. So each is
// planted in turn and the follow-on `uninstall --yes --force` still has to leave
// the file it falsely claims in place.
//
// Every run here is offline: the harness points the proxy at a closed port, so
// adoption reaching the network would fail rather than pass quietly.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { installFixture, runMewkit, type Fixture } from "./install-harness.js";

const USER_SKILL = join(".claude", "skills", "fixture-user-skill", "SKILL.md");
const META = join(".meowkit", "metadata.json");

const sha = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");

interface Meta {
	version: string;
	files: { path: string; owner: string; layer: string; checksum: string; baseChecksum: string }[];
}

function withUserSkill(fx: Fixture): string {
	const abs = join(fx.root, USER_SKILL);
	mkdirSync(join(fx.root, ".claude", "skills", "fixture-user-skill"), { recursive: true });
	writeFileSync(abs, "# a skill the user wrote\n", "utf8");
	return abs;
}

function dropBaseline(fx: Fixture): void {
	rmSync(join(fx.root, META), { force: true });
	rmSync(join(fx.root, ".claude", "metadata.json"), { force: true });
	rmSync(join(fx.root, ".claude", "meowkit.manifest.json"), { force: true });
}

describe("doctor — validity, drift and adoption", () => {
	it("1. a valid project reports a valid config, no drift and a usable cache", () => {
		const { fx, run } = installFixture();
		expect(run.status).toBe(0);
		const out = runMewkit(fx, ["doctor"]).all;
		expect(out).toContain("Project config");
		expect(out).toContain("Install drift");
		expect(out).toContain("Local kit cache");
		expect(out).toContain("9.9.9-fixture");
	});

	it("2. a malformed config is reported with its file and line", () => {
		const { fx } = installFixture();
		writeFileSync(join(fx.root, ".meowkit", "config.yaml"), "workflow:\n\ttelemetry: off\n", "utf8");
		const run = runMewkit(fx, ["doctor"]);
		expect(run.all).toContain(".meowkit/config.yaml:2");
		expect(run.all).toContain("tab-indentation");
		expect(run.all).not.toContain("YAMLException");
	});

	it("2b. autobuild.mode LEAN is disclosed as density-only", () => {
		const { fx } = installFixture();
		writeFileSync(join(fx.root, ".meowkit", "config.yaml"), "autobuild:\n  mode: LEAN\n", "utf8");
		const out = runMewkit(fx, ["doctor"]).all;
		expect(out).toContain("autobuild.mode in the project config");
		expect(out).toContain("does not bypass it");
	});

	it("3. drifted files are counted per class", () => {
		const { fx } = installFixture();
		const dispatch = join(fx.root, ".claude", "hooks", "dispatch.cjs");
		writeFileSync(dispatch, `${readFileSync(dispatch, "utf8")}\n// edited\n`, "utf8");
		withUserSkill(fx);
		const out = runMewkit(fx, ["doctor"]).all;
		expect(out).toMatch(/modified [1-9]/);
		expect(out).toMatch(/orphan [1-9]/);
	});

	it("4. cache but no baseline — --adopt rebuilds from the cache alone", () => {
		const { fx } = installFixture();
		const userAbs = withUserSkill(fx);
		const twin = installFixture().fx;
		dropBaseline(fx);

		expect(runMewkit(fx, ["doctor"]).all).toContain("mewkit doctor --adopt");

		const adopt = runMewkit(fx, ["doctor", "--adopt", "--json"]);
		expect(adopt.status).toBe(0);
		const result = JSON.parse(adopt.stdout) as { ok: boolean; counts: { meowkit: number; user: number }; version: string };
		expect(result.ok).toBe(true);
		expect(result.version).toBe("9.9.9-fixture");
		expect(result.counts.meowkit).toBeGreaterThan(100);

		// The user's own file is never recorded as the kit's.
		const meta = JSON.parse(readFileSync(join(fx.root, META), "utf8")) as Meta;
		const entry = meta.files.find((f) => f.path === "skills/fixture-user-skill/SKILL.md");
		expect(entry?.owner).toBe("user");

		// And the adopted project classifies like a normally installed twin.
		const mine = JSON.parse(runMewkit(fx, ["uninstall", "--json"]).stdout) as { classes: Record<string, string[]> };
		const theirs = JSON.parse(runMewkit(twin, ["uninstall", "--json"]).stdout) as { classes: Record<string, string[]> };
		expect(mine.classes.clean.sort()).toEqual(theirs.classes.clean.sort());
		expect(mine.classes.orphan).toContain("skills/fixture-user-skill/SKILL.md".replace(/^/, ".claude/"));

		// A forced uninstall still leaves it alone.
		runMewkit(fx, ["uninstall", "--yes", "--force"]);
		expect(existsSync(userAbs)).toBe(true);
	});

	it("5. no baseline and no cache — --adopt refuses, writes nothing, names upgrade", () => {
		const { fx } = installFixture();
		dropBaseline(fx);
		rmSync(join(fx.root, ".meowkit", "cache"), { recursive: true, force: true });
		const run = runMewkit(fx, ["doctor", "--adopt"]);
		expect(run.status).toBe(1);
		expect(run.all).toContain("mewkit upgrade");
		expect(existsSync(join(fx.root, META))).toBe(false);
	});

	it("a tampered release-manifest.json gains nothing", () => {
		const { fx } = installFixture();
		const userAbs = withUserSkill(fx);
		dropBaseline(fx);
		writeFileSync(
			join(fx.root, ".meowkit", "release-manifest.json"),
			JSON.stringify({ version: "9.9.9-fixture", generatedAt: new Date(0).toISOString(), files: [{ path: "skills/fixture-user-skill/SKILL.md", checksum: sha(userAbs) }], deletions: [] }, null, 2),
			"utf8",
		);
		expect(runMewkit(fx, ["doctor", "--adopt"]).status).toBe(0);
		const meta = JSON.parse(readFileSync(join(fx.root, META), "utf8")) as Meta;
		expect(meta.files.find((f) => f.path === "skills/fixture-user-skill/SKILL.md")?.owner).toBe("user");
		runMewkit(fx, ["uninstall", "--yes", "--force"]);
		expect(existsSync(userAbs)).toBe(true);
	});

	it("a hand-edited metadata.json gains nothing from --adopt", () => {
		const { fx } = installFixture();
		const userAbs = withUserSkill(fx);
		const real = sha(userAbs);
		const metaFile = join(fx.root, META);
		const meta = JSON.parse(readFileSync(metaFile, "utf8")) as Meta;
		meta.files.push({ path: "skills/fixture-user-skill/SKILL.md", owner: "meowkit", layer: "skill", checksum: real, baseChecksum: real });
		writeFileSync(metaFile, JSON.stringify(meta, null, 2), "utf8");

		expect(runMewkit(fx, ["doctor", "--adopt"]).status).toBe(0);
		const rebuilt = JSON.parse(readFileSync(metaFile, "utf8")) as Meta;
		expect(rebuilt.files.find((f) => f.path === "skills/fixture-user-skill/SKILL.md")?.owner).toBe("user");
		runMewkit(fx, ["uninstall", "--yes", "--force"]);
		expect(existsSync(userAbs)).toBe(true);
	});

	it("a git-tracked cache path makes --adopt refuse", () => {
		const { fx } = installFixture();
		dropBaseline(fx);
		execFileSync("git", ["add", "-f", join(".meowkit", "cache", "version")], { cwd: fx.root });
		const run = runMewkit(fx, ["doctor", "--adopt"]);
		expect(run.status).toBe(1);
		expect(run.all).toContain("mewkit upgrade");
		expect(existsSync(join(fx.root, META))).toBe(false);
	});
});
