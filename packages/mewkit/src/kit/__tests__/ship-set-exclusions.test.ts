// What the published kit carries, checked against the repository.
//
// Two separate claims. The artifact must not carry maintainer artifacts, and the
// REPOSITORY must still have every one of them, because the exclusions are from
// the published archive and CI runs those files from the checkout.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..", "..");
const require = createRequire(import.meta.url);

interface ShipSet {
	excludeMatcher: (patterns: string[]) => (rel: string) => boolean;
	shipSetExclusions: (root: string) => string[];
}

const shipSet = require(join(REPO, "scripts", "kit-ship-set.cjs")) as ShipSet;

/** Every path the repository tracks, as the archive would see it. */
function trackedPaths(): string[] {
	return execFileSync("git", ["ls-files"], { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
		.split("\n")
		.filter((line) => line !== "");
}

describe("ship set", () => {
	const patterns = shipSet.shipSetExclusions(REPO);
	const isExcluded = shipSet.excludeMatcher(patterns);
	const tracked = trackedPaths();
	/** What the archive would carry: tracked, under an archive root, not excluded. */
	const shipped = tracked.filter(
		(path) =>
			(path.startsWith(".claude/") || path.startsWith("tasks/") || path === "release-manifest.json" || path === ".meowkit/pack-manifest.json") &&
			!isExcluded(path),
	);

	it("carries no maintainer artifact", () => {
		for (const pattern of [
			/^\.claude\/settings\.json\.bak$/,
			/^\.claude\/\.brand-allowlist\.txt$/,
			/^\.claude\/scripts\/lint-brand-prose\.sh$/,
			/^\.claude\/scripts\/check-anthropic-context\.py$/,
			/^\.claude\/benchmarks\/results\//,
			/^\.claude\/eval\//,
			/^\.claude\/skills\/[^/]+\/eval\//,
			/\/__tests__\//,
			/\/tests\//,
			/\.test\./,
		]) {
			expect(shipped.filter((path) => pattern.test(path))).toEqual([]);
		}
	});

	it("carries workflow.yaml, because shipped files read it", () => {
		expect(shipped).toContain(".claude/workflow.yaml");
		const readers = execFileSync("git", ["grep", "-l", "workflow.yaml", "--", ".claude"], {
			cwd: REPO,
			encoding: "utf8",
		})
			.split("\n")
			.filter((line) => line !== "" && !line.startsWith(".claude/worktrees/"));
		expect(readers.length).toBeGreaterThan(1);
	});

	it("narrows the three exclusions whose readers ship, by name", () => {
		// The benchmark corpus is a USER-INVOCABLE skill's input, not run output.
		expect(shipped.some((path) => path.startsWith(".claude/benchmarks/canary/"))).toBe(true);
		expect(shipped).toContain(".claude/benchmarks/README.md");
		// The shared eval adapter and the two skill eval scripts that `require` it
		// go together: excluding either side alone leaves a broken `require`.
		expect(patterns).toContain(".claude/eval/*");
		expect(patterns).toContain(".claude/skills/*/eval/*");
		// The brand allowlist and both scripts that read it go together: excluding
		// the data alone would ship a script that fails on a missing file.
		for (const pattern of [
			".claude/.brand-allowlist.txt",
			".claude/scripts/lint-brand-prose.sh",
			".claude/scripts/check-anthropic-context.py",
		]) {
			expect(patterns).toContain(pattern);
		}
	});

	it("ships no run output from tasks/, only its templates and the homes they live in", () => {
		// The converse of the exclusion assertions above. Excluding a pattern proves
		// that pattern is handled; it does not prove the directory is clean, and
		// `tasks/` is archived WHOLE for its templates — so anything new dropped
		// under it ships by default. This project's own contracts and phase plans
		// were reaching every installed project that way.
		const shippedTasks = shipped.filter((path) => path.startsWith("tasks/"));
		for (const runOutput of [
			/^tasks\/reports\//,
			/^tasks\/reviews\/[^/]+\.md$/,
			/^tasks\/reviews\/evidence\//,
			/^tasks\/contracts\/[^/]+\.md$/,
			/^tasks\/plans\/.+\//,
		]) {
			expect(shippedTasks.filter((path) => runOutput.test(path))).toEqual([]);
		}
		// The directories still ship, so run output written later has a home that
		// is already in place rather than created by whatever writes first.
		for (const home of ["tasks/contracts/.gitkeep", "tasks/plans/.gitkeep", "tasks/reviews/.gitkeep"]) {
			expect(shippedTasks).toContain(home);
		}
		// And the templates — the reason `tasks/` is archived at all — are still there.
		expect(shippedTasks.some((path) => path.startsWith("tasks/templates/"))).toBe(true);
	});

	it("removes nothing from the repository", () => {
		// The exclusions are from the ARTIFACT. CI runs these from the checkout, so
		// excluding them from the archive must not have deleted any of them.
		for (const path of [
			".claude/eval/track-m-adapter-core.cjs",
			".claude/.brand-allowlist.txt",
			".claude/scripts/lint-brand-prose.sh",
			".claude/skills/prompt-enhancer/eval/run-canaries.cjs",
		]) {
			expect(tracked).toContain(path);
		}
		expect(tracked.filter((path) => path.includes("/__tests__/")).length).toBeGreaterThan(0);
	});

	it("leaves no shipped file referring to an excluded one", () => {
		// The two shipped skills that `require` the shared eval adapter are the case
		// that forced the unit exclusion. Both are excluded with it, so nothing
		// shipped can reach it.
		for (const referrer of [
			".claude/skills/brainstorming/eval/run-scenarios.cjs",
			".claude/skills/prompt-enhancer/eval/run-canaries.cjs",
		]) {
			expect(isExcluded(referrer)).toBe(true);
		}
		// And no shipped EXECUTABLE still resolves the allowlist. Prose that mentions
		// the filename is not a live reference — it cannot fail on a missing file —
		// and the exclusion source names its own patterns by definition.
		const liveReaders = shipped.filter((path) => {
			if (!/\.(sh|py|cjs|mjs|js|ts)$/.test(path)) return false;
			try {
				return readFileSync(join(REPO, path), "utf8").includes("brand-allowlist");
			} catch {
				return false;
			}
		});
		expect(liveReaders).toEqual([]);
	});
});
