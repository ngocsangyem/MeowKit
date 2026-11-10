// What a real install leaves behind besides the kit: the snapshot that makes it
// reversible, and the local kit copy every later deletion is checked against.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { createProject, installFixture, runMewkit, type Fixture } from "./install-harness.js";

/** Every file under one directory of the fixture, with its checksum. */
function manifest(root: string, dir: string): string {
	return execFileSync("sh", ["-c", `find ${dir} -type f -print0 2>/dev/null | sort -z | xargs -0 shasum -a 256 2>/dev/null`], {
		cwd: root,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
}

describe("the local kit copy", () => {
	let fx: Fixture;

	beforeAll(() => {
		fx = installFixture("9.9.9-fixture").fx;
	});

	it("records the version install actually laid down", () => {
		expect(readFileSync(join(fx.root, ".meowkit", "cache", "version"), "utf8").trim()).toBe("9.9.9-fixture");
	});

	it("holds the kit's own bytes, byte-for-byte", () => {
		const cached = join(fx.root, ".meowkit", "cache", ".claude", "hooks", "dispatch.cjs");
		const installed = join(fx.root, ".claude", "hooks", "dispatch.cjs");
		expect(existsSync(cached)).toBe(true);
		expect(readFileSync(cached)).toEqual(readFileSync(installed));
	});

	it("is untracked, which is the whole basis of trusting it", () => {
		execFileSync("git", ["add", "-A"], { cwd: fx.root });
		const tracked = execFileSync("git", ["ls-files", ".meowkit/cache"], { cwd: fx.root, encoding: "utf8" });
		expect(tracked.trim()).toBe("");
		const why = execFileSync("git", ["check-ignore", "-v", ".meowkit/cache/version"], {
			cwd: fx.root,
			encoding: "utf8",
		});
		expect(why).toContain(".meowkit/.gitignore:1:*");
	});
});

describe("snapshots", () => {
	it("a fresh install snapshots nothing, because it overwrites nothing", () => {
		const { fx } = installFixture();
		// `backups list` is the reader; an empty project has no snapshot to list.
		const listed = runMewkit(fx, ["backups", "list", "--json"]);
		expect(listed.status).toBe(0);
		expect(JSON.parse(listed.stdout) as { snapshots: unknown[] }).toEqual({ snapshots: [] });
	});

	it("an upgrade snapshots what it is about to overwrite, and the restore is checksum-equal", () => {
		const fx = createProject("1.0.0-fixture");
		expect(runMewkit(fx, ["init", "--yes"], {}, "1.0.0-fixture").status).toBe(0);

		// A kit file the user has not touched, so the upgrade will rewrite it.
		const victim = join(fx.root, ".claude", "hooks", "dispatch.cjs");
		const before = readFileSync(victim, "utf8");
		writeFileSync(victim, `${before}\n// changed by the next release\n`, "utf8");
		const afterEdit = readFileSync(victim, "utf8");

		const upgraded = runMewkit(fx, ["upgrade", "--yes"], {}, "2.0.0-fixture");
		expect(upgraded.all).toMatch(/Snapshot \d{8}T\d{6}Z-upgrade/);
		expect(upgraded.status).toBe(0);

		const listed = JSON.parse(runMewkit(fx, ["backups", "list", "--json"]).stdout) as {
			snapshots: { id: string; command: string; fileCount: number }[];
		};
		expect(listed.snapshots.length).toBeGreaterThan(0);
		const snapshot = listed.snapshots.find((s) => s.command === "upgrade");
		expect(snapshot?.fileCount).toBeGreaterThan(0);

		// The file the upgrade reverted to kit content comes back byte-identical.
		// `--yes` because a restore overwrites what is on disk now, so it is one
		// of the four destructive invocations and will not act blind in a
		// session with no terminal to confirm in.
		const restored = runMewkit(fx, ["backups", "restore", snapshot?.id ?? "", "--yes"]);
		expect(restored.status).toBe(0);
		expect(readFileSync(victim, "utf8")).toBe(afterEdit);
		expect(restored.all).toContain("itself undoable");
	});

	it("never snapshots the local kit copy, and a restore leaves it untouched", () => {
		const fx = createProject("1.0.0-fixture");
		runMewkit(fx, ["init", "--yes"], {}, "1.0.0-fixture");
		const cacheBefore = manifest(fx.root, ".meowkit/cache");
		runMewkit(fx, ["upgrade", "--yes"], {}, "2.0.0-fixture");

		const listed = JSON.parse(runMewkit(fx, ["backups", "list", "--json"]).stdout) as {
			snapshots: { id: string }[];
		};
		for (const s of listed.snapshots) {
			const body = JSON.parse(
				readFileSync(join(fx.root, ".meowkit", "backups", s.id, "manifest.json"), "utf8"),
			) as { files: { path: string }[] };
			expect(body.files.filter((f) => f.path.startsWith(join(".meowkit", "cache")))).toEqual([]);
		}
		// The upgrade legitimately rewrote the cache for the new version, so the
		// comparison that matters is across the RESTORE, not across the upgrade.
		const beforeRestore = manifest(fx.root, ".meowkit/cache");
		expect(beforeRestore).not.toBe("");
		expect(beforeRestore).not.toBe(cacheBefore);
		runMewkit(fx, ["backups", "restore", listed.snapshots[0].id, "--yes"]);
		expect(manifest(fx.root, ".meowkit/cache")).toBe(beforeRestore);
	});

	it("refuses an id it does not have, naming the ones it does", () => {
		const fx = createProject("1.0.0-fixture");
		runMewkit(fx, ["init", "--yes"], {}, "1.0.0-fixture");
		const bad = runMewkit(fx, ["backups", "restore", "20200101T000000Z-upgrade"]);
		expect(bad.status).not.toBe(0);
		expect(bad.all).toContain("20200101T000000Z-upgrade");
		expect(bad.all).toContain("backups list");
	});

	it("a dry-run install writes no snapshot at all", () => {
		const fx = createProject();
		const run = runMewkit(fx, ["init", "--yes", "--dry-run"]);
		expect(run.status).toBe(0);
		expect(existsSync(join(fx.root, ".meowkit", "backups"))).toBe(false);
		expect(existsSync(join(fx.root, ".meowkit", "cache"))).toBe(false);
	});
});
