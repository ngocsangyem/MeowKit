// What `uninstall` guarantees beyond its per-invocation matrix: the snapshot, the
// dry run, the JSON/text agreement, the exit-3 rule and the one user-committed
// file the migration owns rather than the uninstaller.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runMewkit } from "./install-harness.js";
import { fresh, manifest, parse, sha } from "./lib/uninstall-fixture.js";

describe("uninstall — snapshot, preview and exit codes", () => {
	it("the cache and every protected subtree are byte-identical after a forced run", () => {
		const fx = fresh();
		const before = { ...manifest(fx.root, join(".meowkit", "cache")), ...manifest(fx.root, join(".meowkit", "memory")), ...manifest(fx.root, join(".meowkit", "state")) };
		expect(Object.keys(before).length).toBeGreaterThan(10);
		runMewkit(fx, ["uninstall", "--yes", "--force"]);
		const after = { ...manifest(fx.root, join(".meowkit", "cache")), ...manifest(fx.root, join(".meowkit", "memory")), ...manifest(fx.root, join(".meowkit", "state")) };
		expect(after).toEqual(before);
	});

	it("snapshots every file it is about to delete, before the first delete", () => {
		const fx = fresh();
		const done = parse(runMewkit(fx, ["uninstall", "--yes", "--json"]).stdout);
		const ids = (JSON.parse(runMewkit(fx, ["backups", "list", "--json"]).stdout) as { snapshots: { id: string; command: string; fileCount: number }[] })
			.snapshots.filter((s) => s.command === "uninstall");
		expect(ids).toHaveLength(1);
		const snapshotManifest = JSON.parse(readFileSync(join(fx.root, ".meowkit", "backups", ids[0].id, "manifest.json"), "utf8")) as {
			files: { path: string; checksum: string }[];
		};
		const inSnapshot = snapshotManifest.files.map((f) => f.path).sort();
		expect(inSnapshot).toEqual(done.deleted.sort());
		// Pre-deletion content, so the restore can put the file back.
		for (const entry of snapshotManifest.files.slice(0, 5)) {
			expect(existsSync(join(fx.root, ".meowkit", "backups", ids[0].id, "files", entry.path))).toBe(true);
		}
		expect(inSnapshot.some((p) => p.startsWith(".meowkit/cache/"))).toBe(false);
		// And the restore puts them all back, byte for byte.
		const restore = runMewkit(fx, ["backups", "restore", ids[0].id, "--yes"]);
		expect(restore.status).toBe(0);
		for (const entry of snapshotManifest.files) {
			expect(sha(join(fx.root, entry.path))).toBe(entry.checksum);
		}
	});

	it("--dry-run writes nothing at all, including no snapshot", () => {
		const fx = fresh();
		const before = manifest(fx.root, ".");
		const run = runMewkit(fx, ["uninstall", "--dry-run", "--yes"]);
		expect(run.status).toBe(0);
		expect(manifest(fx.root, ".")).toEqual(before);
	});

	it("--json class lists match the human output exactly", () => {
		const fx = fresh();
		const text = runMewkit(fx, ["uninstall", "--force"]).all;
		const json = parse(runMewkit(fx, ["uninstall", "--force", "--json"]).stdout);
		for (const [name, items] of Object.entries(json.classes)) {
			if (items.length === 0) continue;
			expect(text).toContain(`${name} (${items.length})`);
			for (const rel of items.slice(0, 5)) expect(text).toContain(rel);
		}
	});

	it("a destructive run in a non-TTY without --yes previews and exits 3", () => {
		const fx = fresh();
		const before = manifest(fx.root, ".claude");
		const run = runMewkit(fx, ["uninstall"]);
		// The harness spawns without a TTY, which is the condition itself.
		expect(run.status).toBe(3);
		expect(run.all).toContain("clean (");
		expect(manifest(fx.root, ".claude")).toEqual(before);
	});

	it("the user-committed v2 descriptor survives --yes --force", () => {
		const fx = fresh();
		const descriptor = join(fx.root, ".meowkit", "config.json");
		writeFileSync(descriptor, '{"features":{"memory":false}}\n', "utf8");
		execFileSync("git", ["add", "-f", join(".meowkit", "config.json")], { cwd: fx.root });
		runMewkit(fx, ["uninstall", "--yes", "--force"]);
		expect(existsSync(descriptor)).toBe(true);
	});
});
