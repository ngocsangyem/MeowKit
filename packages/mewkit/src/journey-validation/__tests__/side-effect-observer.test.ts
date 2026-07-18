// Phase 7 (MK-P1-02): behavioral coverage for the durable-write observer's DETECTION path. The
// j10 integration test runs against a non-git temp dir (every surface reads the "none" sentinel,
// so the diff is empty by construction) — that proves wiring, not guard strength. Here we git-init
// a real repo and mutate durable surfaces, asserting each change is caught.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { diffDurableSurfaces, snapshotDurableSurfaces } from "../side-effect-observer.js";

let dir: string | null = null;
afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
	dir = null;
});

function git(cwd: string, args: string[]): void {
	execFileSync("git", args, { cwd, stdio: "ignore" });
}

/** A committed, clean git repo with a memory store already tracked. */
function makeRepo(): string {
	dir = mkdtempSync(join(tmpdir(), "sideeffect-"));
	git(dir, ["init", "-q"]);
	git(dir, ["config", "user.email", "t@t.dev"]);
	git(dir, ["config", "user.name", "t"]);
	mkdirSync(join(dir, ".claude", "memory"), { recursive: true });
	writeFileSync(join(dir, ".claude", "memory", "fixes.json"), '{"patterns":[]}');
	writeFileSync(join(dir, "f.txt"), "1");
	git(dir, ["add", "-A"]);
	git(dir, ["commit", "-qm", "init"]);
	return dir;
}

describe("durable-write observer detection", () => {
	it("empty diff when nothing durable changed", () => {
		const d = makeRepo();
		const before = snapshotDurableSurfaces(d);
		const after = snapshotDurableSurfaces(d);
		expect(diffDurableSurfaces(before, after)).toEqual([]);
		expect(before.worktreeDirty).toBe(false); // clean repo → not dirty (sentinel distinct)
	});

	it("catches an unrequested commit (HEAD moved)", () => {
		const d = makeRepo();
		const before = snapshotDurableSurfaces(d);
		writeFileSync(join(d, "g.txt"), "2");
		git(d, ["add", "-A"]);
		git(d, ["commit", "-qm", "sneaky"]);
		const violations = diffDurableSurfaces(before, snapshotDurableSurfaces(d));
		expect(violations.map((v) => v.surface)).toContain("HEAD (unrequested commit)");
	});

	it("catches an unrequested tag", () => {
		const d = makeRepo();
		const before = snapshotDurableSurfaces(d);
		git(d, ["tag", "v9.9.9"]);
		const violations = diffDurableSurfaces(before, snapshotDurableSurfaces(d));
		expect(violations.map((v) => v.surface)).toContain("tags (unrequested tag)");
	});

	it("catches an unrequested curated-memory write", () => {
		const d = makeRepo();
		const before = snapshotDurableSurfaces(d);
		writeFileSync(join(d, ".claude", "memory", "fixes.json"), '{"patterns":[{"id":"x"}]}');
		const violations = diffDurableSurfaces(before, snapshotDurableSurfaces(d));
		expect(violations.map((v) => v.surface)).toContain("curated memory (unrequested memory write)");
	});

	it("catches a dirty worktree (uncommitted change)", () => {
		const d = makeRepo();
		const before = snapshotDurableSurfaces(d);
		writeFileSync(join(d, "f.txt"), "changed");
		const after = snapshotDurableSurfaces(d);
		expect(after.worktreeDirty).toBe(true);
		expect(diffDurableSurfaces(before, after).map((v) => v.surface)).toContain("worktree-clean");
	});
});
