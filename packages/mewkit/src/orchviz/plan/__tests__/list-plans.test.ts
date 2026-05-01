/**
 * Unit tests for list-plans.ts — listPlans().
 *
 * Coverage:
 *   - 3-plan fixture: returns all non-archived plans
 *   - Archived plan is filtered out
 *   - Sorted by plan.md mtimeMs descending
 *   - limit cap respected
 *   - Boundary rejection (symlink outside plansDir)
 *   - Missing tasks/plans/ returns []
 *   - Invalid slug name rejected (not returned)
 */

import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { listPlans } from "../list-plans.js";

let tmpDir: string | null = null;

afterEach(() => {
	if (tmpDir) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		tmpDir = null;
	}
});

function makeProjectRoot(): { root: string; plansDir: string } {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "list-plans-test-"));
	const root = tmpDir;
	const plansDir = path.join(root, "tasks", "plans");
	fs.mkdirSync(plansDir, { recursive: true });
	return { root, plansDir };
}

function writePlanDir(
	plansDir: string,
	slug: string,
	opts: {
		title?: string;
		status?: string;
		created?: string;
		effort?: string;
		phaseCount?: number;
	} = {},
): string {
	const dir = path.join(plansDir, slug);
	fs.mkdirSync(dir, { recursive: true });
	const status = opts.status ?? "draft";
	const title = opts.title ?? `Plan ${slug}`;
	const frontmatter = [
		"---",
		`title: "${title}"`,
		`status: ${status}`,
		`created: "${opts.created ?? "260501"}"`,
		`effort: "${opts.effort ?? "m"}"`,
		"---",
		"",
		`# ${title}`,
	].join("\n");
	fs.writeFileSync(path.join(dir, "plan.md"), frontmatter, "utf-8");
	for (let i = 1; i <= (opts.phaseCount ?? 0); i++) {
		fs.writeFileSync(
			path.join(dir, `phase-0${i}-step.md`),
			`# Phase ${i}\n\n## Todo List\n\n- [ ] Do something\n`,
			"utf-8",
		);
	}
	return dir;
}

describe("listPlans", () => {
	it("returns [] when tasks/plans/ does not exist", () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "list-plans-no-dir-"));
		const result = listPlans(tmpDir);
		expect(result).toEqual([]);
	});

	it("returns all non-archived plans", () => {
		const { root, plansDir } = makeProjectRoot();
		writePlanDir(plansDir, "260501-alpha", { status: "draft" });
		writePlanDir(plansDir, "260501-beta", { status: "in_progress" });
		writePlanDir(plansDir, "260501-gamma", { status: "active" });

		const result = listPlans(root);
		expect(result).toHaveLength(3);
		const slugs = result.map((p) => p.slug);
		expect(slugs).toContain("260501-alpha");
		expect(slugs).toContain("260501-beta");
		expect(slugs).toContain("260501-gamma");
	});

	it("filters out archived plans", () => {
		const { root, plansDir } = makeProjectRoot();
		writePlanDir(plansDir, "260501-active", { status: "draft" });
		writePlanDir(plansDir, "260501-archived", { status: "archived" });

		const result = listPlans(root);
		expect(result).toHaveLength(1);
		expect(result[0].slug).toBe("260501-active");
	});

	it("sorts by plan.md mtimeMs descending", () => {
		const { root, plansDir } = makeProjectRoot();
		const dirA = writePlanDir(plansDir, "260501-first", { status: "draft" });
		// Small delay or touch to ensure different mtime
		const dirB = writePlanDir(plansDir, "260501-second", { status: "draft" });

		// Touch the first plan so it becomes most recent
		const now = new Date();
		fs.utimesSync(path.join(dirA, "plan.md"), now, new Date(Date.now() + 2000));

		// We need the second plan to have an older mtime — set it explicitly in the past
		const past = new Date(Date.now() - 10000);
		fs.utimesSync(path.join(dirB, "plan.md"), past, past);

		const result = listPlans(root);
		expect(result).toHaveLength(2);
		expect(result[0].slug).toBe("260501-first");
		expect(result[1].slug).toBe("260501-second");
		// Confirm descending order
		expect(result[0].mtimeMs).toBeGreaterThan(result[1].mtimeMs);
	});

	it("respects the limit option", () => {
		const { root, plansDir } = makeProjectRoot();
		writePlanDir(plansDir, "260501-plan-a", { status: "draft" });
		writePlanDir(plansDir, "260501-plan-b", { status: "draft" });
		writePlanDir(plansDir, "260501-plan-c", { status: "active" });

		const result = listPlans(root, { limit: 2 });
		expect(result).toHaveLength(2);
	});

	it("includes phaseCount from phase-NN-*.md files", () => {
		const { root, plansDir } = makeProjectRoot();
		writePlanDir(plansDir, "260501-three-phases", { status: "draft", phaseCount: 3 });

		const result = listPlans(root);
		expect(result).toHaveLength(1);
		expect(result[0].phaseCount).toBe(3);
	});

	it("returns slug, title, status, created, effort fields", () => {
		const { root, plansDir } = makeProjectRoot();
		writePlanDir(plansDir, "260501-full-fields", {
			title: "My Test Plan",
			status: "active",
			created: "260501",
			effort: "l",
		});

		const result = listPlans(root);
		expect(result).toHaveLength(1);
		const plan = result[0];
		expect(plan.slug).toBe("260501-full-fields");
		expect(plan.title).toBe("My Test Plan");
		expect(plan.status).toBe("active");
		expect(plan.created).toBe("260501");
		expect(plan.effort).toBe("l");
		expect(typeof plan.mtimeMs).toBe("number");
	});

	it("rejects symlinks pointing outside the boundary", () => {
		const { root, plansDir } = makeProjectRoot();
		// Create a valid plan for baseline
		writePlanDir(plansDir, "260501-legit", { status: "draft" });
		// Create a symlink that points to a temp dir outside the boundary
		const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "outside-boundary-"));
		// Write a valid plan.md in outside dir so it would pass other checks
		fs.writeFileSync(
			path.join(outsideDir, "plan.md"),
			"---\ntitle: Sneaky\nstatus: active\n---\n",
		);
		const symlinkPath = path.join(plansDir, "evil-symlink");
		try {
			fs.symlinkSync(outsideDir, symlinkPath);
		} catch {
			// If symlink creation fails (e.g., Windows restrictions), skip boundary test
			return;
		}

		const result = listPlans(root);
		const slugs = result.map((p) => p.slug);
		// The symlink plan should be rejected by realpath boundary check
		expect(slugs).not.toContain("evil-symlink");
		// The legit plan should still be present
		expect(slugs).toContain("260501-legit");
	});
});
