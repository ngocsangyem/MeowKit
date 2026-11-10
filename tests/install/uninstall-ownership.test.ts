// `uninstall` over every invocation it supports — no flags, `--yes`, `--force`,
// a missing baseline, a tampered one, a baseline naming its way out of the kit
// tree, and the three cache states that cannot corroborate — on trees a real
// `mewkit init` built.
//
// The property under test is not "it deletes the right files" but "no baseline
// can make it delete the wrong ones". The baseline is a file in the project, so
// it is assumed hostile: invocation 5 hand-edits it to claim a user's file as
// kit content with matching checksums — precisely the shape a metadata-only
// deletion gate accepts — and the file has to survive `--yes --force`.
//
// Every run is offline: the harness refuses DNS and socket connect in-process,
// so a deletion path reaching the network fails rather than passing quietly.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { installFixture, runMewkit, type Fixture } from "./install-harness.js";
import { MODIFIED_REL, PROTECTED_SAMPLES, USER_SKILL, fresh, manifest, parse, seed, sha } from "./lib/uninstall-fixture.js";

describe("uninstall — every invocation", () => {
	let base: Fixture;

	beforeAll(() => {
		const { fx, run } = installFixture();
		expect(run.status, run.all.slice(-2000)).toBe(0);
		seed(fx);
		base = fx;
	});

	it("1. no flags — changes nothing and prints the classes", () => {
		const before = manifest(base.root, ".claude");
		const run = runMewkit(base, ["uninstall"]);
		// 3 rather than 0 because the harness has no TTY to confirm in, which is
		// its own case below; what this one asserts is that nothing was written.
		expect(run.status).toBe(3);
		expect(run.all).toContain("preview only");
		expect(run.all).toContain("clean (");
		expect(manifest(base.root, ".claude")).toEqual(before);
	});

	it("2. --yes deletes exactly the clean files, refuses modified, reports orphans", () => {
		const fx = fresh();
		const plan = parse(runMewkit(fx, ["uninstall", "--json"]).stdout);
		expect(plan.cache.state).toBe("ok");
		// The populated cache is what makes a non-empty `clean` class possible.
		expect(plan.classes.clean.length).toBeGreaterThan(100);
		expect(plan.classes.modified).toContain(MODIFIED_REL.split("\\").join("/"));
		expect(plan.classes.orphan).toContain(USER_SKILL.split("\\").join("/"));

		const run = runMewkit(fx, ["uninstall", "--yes", "--json"]);
		expect(run.status).toBe(0);
		const done = parse(run.stdout);
		expect(done.deleted.sort()).toEqual(plan.classes.clean.sort());
		for (const rel of done.deleted) expect(existsSync(join(fx.root, rel))).toBe(false);
		// The modified file and the user's own skill both survive.
		expect(existsSync(join(fx.root, MODIFIED_REL))).toBe(true);
		expect(existsSync(join(fx.root, USER_SKILL))).toBe(true);
		for (const rel of PROTECTED_SAMPLES) expect(existsSync(join(fx.root, rel))).toBe(true);
	});

	it("3. --yes --force additionally removes the modified kit file and nothing more", () => {
		const fx = fresh();
		const plan = parse(runMewkit(fx, ["uninstall", "--json", "--force"]).stdout);
		const run = runMewkit(fx, ["uninstall", "--yes", "--force", "--json"]);
		expect(run.status).toBe(0);
		const done = parse(run.stdout);
		expect(done.deleted.sort()).toEqual(plan.planned.sort());
		expect(existsSync(join(fx.root, MODIFIED_REL))).toBe(false);
		expect(existsSync(join(fx.root, USER_SKILL))).toBe(true);
		for (const rel of PROTECTED_SAMPLES) expect(existsSync(join(fx.root, rel))).toBe(true);
	});

	it("4. no baseline — refuses and names doctor --adopt", () => {
		const fx = fresh();
		// Every baseline the reader can fall back to, not only the canonical one:
		// a legacy manifest left behind would still be a baseline.
		rmSync(join(fx.root, ".meowkit", "metadata.json"), { force: true });
		rmSync(join(fx.root, ".claude", "metadata.json"), { force: true });

		const run = runMewkit(fx, ["uninstall", "--yes", "--force"]);
		expect(run.status).toBe(1);
		expect(run.all).toContain("mewkit doctor --adopt");
		expect(existsSync(join(fx.root, MODIFIED_REL))).toBe(true);
		const json = parse(runMewkit(fx, ["uninstall", "--yes", "--json"]).stdout);
		expect(json.ok).toBe(false);
		expect(json.fix).toContain("doctor --adopt");
	});

	it("5. a hand-edited baseline claiming a user file cannot cause its deletion", () => {
		const fx = fresh();
		const metaFile = join(fx.root, ".meowkit", "metadata.json");
		const meta = JSON.parse(readFileSync(metaFile, "utf8")) as {
			files: { path: string; owner: string; layer: string; checksum: string; baseChecksum: string }[];
		};
		const userAbs = join(fx.root, USER_SKILL);
		const real = sha(userAbs);
		// Both facts a metadata-only gate checks, made true at once.
		meta.files.push({
			path: relative(join(fx.root, ".claude"), userAbs).split("\\").join("/"),
			owner: "meowkit",
			layer: "skill",
			checksum: real,
			baseChecksum: real,
		});
		writeFileSync(metaFile, JSON.stringify(meta, null, 2), "utf8");

		const run = runMewkit(fx, ["uninstall", "--yes", "--force", "--json"]);
		expect(run.status).toBe(0);
		const done = parse(run.stdout);
		const rel = USER_SKILL.split("\\").join("/");
		expect(done.deleted).not.toContain(rel);
		expect(done.classes.refused).toContain(rel);
		expect(readFileSync(userAbs, "utf8")).toContain("a skill the user wrote");
		const named = done.refusals.find((r) => r.path === rel);
		expect(named?.reason).toContain("not corroborated");
	});

	it("a baseline naming a path outside the kit tree is refused by containment, not by luck", () => {
		const fx = fresh();
		const metaFile = join(fx.root, ".meowkit", "metadata.json");
		const meta = JSON.parse(readFileSync(metaFile, "utf8")) as {
			files: { path: string; owner: string; layer: string; checksum: string; baseChecksum: string }[];
		};
		// A file the kit has no business touching, inside the project but outside
		// `.claude/`, plus an absolute path. Both are entered with checksums that
		// match the bytes on disk, so every fact a metadata-only gate reads about
		// them is true.
		const outside = join(fx.root, "project-file.txt");
		writeFileSync(outside, "the project's own file\n", "utf8");
		const real = sha(outside);
		const absolute = join(fx.root, "absolute-entry.txt");
		writeFileSync(absolute, "named by absolute path\n", "utf8");
		for (const path of ["../project-file.txt", absolute.split("\\").join("/")]) {
			meta.files.push({ path, owner: "meowkit", layer: "skill", checksum: real, baseChecksum: real });
		}
		writeFileSync(metaFile, JSON.stringify(meta, null, 2), "utf8");

		const run = runMewkit(fx, ["uninstall", "--yes", "--force", "--json"]);
		expect(run.status).toBe(0);
		const done = parse(run.stdout);
		expect(existsSync(outside), "a path outside .claude/ was deleted").toBe(true);
		expect(existsSync(absolute), "an absolute baseline entry was deleted").toBe(true);
		// Nothing outside the kit tree is even planned, let alone removed.
		expect(done.deleted.some((p) => !p.startsWith(".claude/"))).toBe(false);
		expect(done.planned.some((p) => !p.startsWith(".claude/"))).toBe(false);
		// The `..` entry escapes and is refused by the containment assertion. The
		// absolute one does not escape at all — joining it under `.claude/` re-roots
		// it there — so it lands in `missing`, which is the other way a baseline
		// entry fails to name a file the kit may remove.
		expect(done.refusals.filter((r) => r.reason.includes("outside the kit tree")).map((r) => r.path)).toEqual(["project-file.txt"]);
		expect(done.classes.missing.some((p) => p.endsWith("absolute-entry.txt"))).toBe(true);
	});

	it("6. cache absent — deletes nothing and points at mewkit upgrade", () => {
		const fx = fresh();
		rmSync(join(fx.root, ".meowkit", "cache"), { recursive: true, force: true });
		const before = manifest(fx.root, ".claude");
		const run = runMewkit(fx, ["uninstall", "--yes", "--force", "--json"]);
		const done = parse(run.stdout);
		expect(done.deleted).toEqual([]);
		expect(done.cache.state).toBe("absent");
		expect(done.refusals.some((r) => r.reason.includes("mewkit upgrade"))).toBe(true);
		expect(manifest(fx.root, ".claude")).toEqual(before);
	});

	it("7. cache recording another version — deletes nothing, detected from the version it records", () => {
		const fx = fresh();
		writeFileSync(join(fx.root, ".meowkit", "cache", "version"), "0.0.0-other\n", "utf8");
		const before = manifest(fx.root, ".claude");
		const done = parse(runMewkit(fx, ["uninstall", "--yes", "--force", "--json"]).stdout);
		expect(done.deleted).toEqual([]);
		expect(done.cache.state).toBe("version-mismatch");
		expect(done.cache.cachedVersion).toBe("0.0.0-other");
		expect(done.refusals.some((r) => r.reason.includes("mewkit upgrade"))).toBe(true);
		expect(manifest(fx.root, ".claude")).toEqual(before);
	});

	it("8. a cache path forced into git tracking is distrusted, per run", () => {
		const fx = fresh();
		execFileSync("git", ["add", "-f", join(".meowkit", "cache", "version")], { cwd: fx.root });
		const before = manifest(fx.root, ".claude");
		const done = parse(runMewkit(fx, ["uninstall", "--yes", "--force", "--json"]).stdout);
		expect(done.deleted).toEqual([]);
		expect(done.cache.state).toBe("tracked");
		expect(done.refusals.some((r) => r.reason.includes("mewkit upgrade"))).toBe(true);
		expect(manifest(fx.root, ".claude")).toEqual(before);
	});
});
