// The four destructive commands refuse to act blind, and the two scriptable
// ones keep working.
//
// Exit 3 is the whole point: a script must be able to tell "this needs your
// confirmation" from "this failed" (non-zero, non-3) and from success (0). The
// narrowing — only the destructive subset, so `init` and `setup` stay usable in
// CI — is deliberate, so both halves are asserted here rather than only the half
// that blocks.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { installFixture, runMewkit, type Fixture } from "./install-harness.js";

/** A release newer than the installed fixture, so `upgrade` does real work. */
const NEWER = "9.9.10-fixture";

const sha = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");

function manifest(root: string, dir = ".", out: Record<string, string> = {}): Record<string, string> {
	const abs = join(root, dir);
	if (!existsSync(abs)) return out;
	for (const name of readdirSync(abs)) {
		if (name === ".git") continue;
		const rel = join(dir, name);
		const st = statSync(join(root, rel));
		if (st.isDirectory()) manifest(root, rel, out);
		else out[rel] = sha(join(root, rel));
	}
	return out;
}

function installed(): Fixture {
	const { fx, run } = installFixture();
	expect(run.status, run.all.slice(-1500)).toBe(0);
	return fx;
}

describe("destructive commands in a non-TTY without --yes", () => {
	it("uninstall previews and exits 3, writing nothing", () => {
		const fx = installed();
		const before = manifest(fx.root);
		const run = runMewkit(fx, ["uninstall"]);
		expect(run.status).toBe(3);
		expect(run.all).toContain("clean (");
		expect(manifest(fx.root)).toEqual(before);
	});

	it("backups restore previews and exits 3, leaving the file as it is", () => {
		const fx = installed();
		// Upgrading to a newer release is what takes a snapshot; an upgrade to
		// the installed version short-circuits before any write.
		expect(runMewkit(fx, ["upgrade", "--yes"], {}, NEWER).status).toBe(0);
		const ids = (JSON.parse(runMewkit(fx, ["backups", "list", "--json"]).stdout) as { snapshots: { id: string }[] }).snapshots;
		expect(ids.length).toBeGreaterThan(0);

		const dispatch = join(fx.root, ".claude", "hooks", "dispatch.cjs");
		writeFileSync(dispatch, "// local edit\n", "utf8");
		const edited = sha(dispatch);

		const run = runMewkit(fx, ["backups", "restore", ids[0].id]);
		expect(run.status).toBe(3);
		expect(run.all).toContain("Would restore");
		expect(sha(dispatch)).toBe(edited);

		// With --yes the same invocation acts.
		expect(runMewkit(fx, ["backups", "restore", ids[0].id, "--yes"]).status).toBe(0);
		expect(sha(dispatch)).not.toBe(edited);
	});

	it("upgrade --force previews and exits 3, writing nothing", () => {
		const fx = installed();
		const before = manifest(fx.root);
		const run = runMewkit(fx, ["upgrade", "--force"], {}, NEWER);
		expect(run.status).toBe(3);
		expect(run.all).toContain("nothing was written");
		expect(manifest(fx.root)).toEqual(before);
	});

	it("init --force previews and exits 3, writing nothing", () => {
		const fx = installed();
		const before = manifest(fx.root);
		const run = runMewkit(fx, ["init", "--force"]);
		expect(run.status).toBe(3);
		expect(run.all).toContain("no files will be written");
		expect(manifest(fx.root)).toEqual(before);
	});

	it("init and setup without --yes still succeed, because they destroy nothing", () => {
		const { fx, run } = installFixture();
		expect(run.status).toBe(0);
		expect(runMewkit(fx, ["setup"]).status).toBe(0);
	});
});

describe("upgrade --dry-run", () => {
	it("writes nothing: no file, no snapshot, no cache rewrite", () => {
		const fx = installed();
		const before = manifest(fx.root);
		const run = runMewkit(fx, ["upgrade", "--dry-run", "--yes"], {}, NEWER);
		expect(run.status).toBe(0);
		expect(run.all).toContain("nothing was written");
		expect(manifest(fx.root)).toEqual(before);
	});
});
