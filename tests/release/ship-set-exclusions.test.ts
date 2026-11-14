// What the published kit WITHHOLDS, checked against the repository.
//
// The converse claims — that the artifact still carries everything a shipped file
// reads, and that nothing was deleted from the checkout — live in
// `ship-set-completeness.test.ts`. Both halves read the same two views from
// `helpers/ship-set-view.ts`, because an exclusion is only correct when both hold.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO, shipSetView } from "./helpers/ship-set-view.js";

describe("ship set withholding", () => {
	const { patterns, isExcluded, tracked, shipped } = shipSetView();

	it("carries no maintainer artifact", () => {
		for (const pattern of [
			/^\.claude\/settings\.json\.bak$/,
			/^\.claude\/\.brand-allowlist\.txt$/,
			/^\.claude\/scripts\//,
			// Measurement of the harness itself, and the skill that reads it. Both
			// run from this repository; neither has a job in a user's project.
			/^\.claude\/benchmarks\//,
			/^\.claude\/skills\/benchmark\//,
			// The substrate map is maintainer input to this repository's own
			// inventory tooling.
			/^\.claude\/harness-substrate\.md$/,
			/^\.claude\/schemas\//,
			// This repository's own evaluator memory. It was reaching every install.
			/^\.claude\/agent-memory\//,
			/^\.claude\/eval\//,
			/^\.claude\/skills\/[^/]+\/eval\//,
			// Run output written by a hook and by pytest. Both appear only because
			// something ran here, and neither is authored content.
			/^\.claude\/hooks\/\.logs\//,
			/\/\.pytest_cache\//,
			/\/__tests__\//,
			/\/tests\//,
			/\.test\./,
		]) {
			expect(shipped.filter((path) => pattern.test(path))).toEqual([]);
		}
	});

	it("ships every schema from the CLI, not from the project", () => {
		// A schema describes what the validator accepts, so it travels with the
		// validator. A project copy is a second answer the code reading it can
		// disagree with, and a project that never received one made the check
		// report a fatal, or advise an upgrade that could not deliver it, instead
		// of validating anything.
		for (const name of ["skill-schema.json", "harness-metadata-schema.json"]) {
			expect(shipped).not.toContain(`.claude/schemas/${name}`);
			expect(tracked.filter((path) => path.endsWith(`/${name}`))).toEqual([`crates/mewkit-core/schemas/${name}`]);
		}
	});

	it("narrows the exclusions whose readers ship, by name", () => {
		// The shared eval adapter and the two skill eval scripts that `require` it
		// go together: excluding either side alone leaves a broken `require`.
		expect(patterns).toContain(".claude/eval/*");
		expect(patterns).toContain(".claude/skills/*/eval/*");
		// The brand allowlist is excluded by pattern; both scripts that read it live
		// outside every archive root, so no exclusion can leave one of them shipping
		// against data the artifact does not carry.
		expect(patterns).toContain(".claude/.brand-allowlist.txt");
		for (const script of ["scripts/lint-brand-prose.sh", "scripts/check-anthropic-context.py"]) {
			expect(tracked).toContain(script);
			expect(shipped).not.toContain(script);
		}
	});

	it("withholds the local state the archive walk reaches but git does not track", () => {
		// The archive is built by walking the filesystem, so a path git never
		// tracked still ships. Three classes reached every install that way: this
		// repository's evaluator memory, the hook log, and a pytest cache. None is
		// visible to the tracked-paths view above, so they are asserted against the
		// matcher directly — the only view that sees them.
		for (const local of [
			".claude/agent-memory/evaluator/MEMORY.md",
			".claude/hooks/.logs/hook-log.jsonl",
			".claude/skills/web-to-markdown/.pytest_cache/CACHEDIR.TAG",
		]) {
			expect(isExcluded(local)).toBe(true);
		}
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
