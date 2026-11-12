// The changelog pages are a record of what past releases did, so a change may add an entry
// but never edit or remove a released line — established against git, not by checking files exist.
//
// Separate from the CLI-resolution suite because it answers a different question: not "is
// every documented command runnable" but "did this change rewrite history it should not have".
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Immutable records of what past releases shipped. */
const CHANGELOG_PAGES = ["changelog/index.mdx", "changelog/archive.mdx"];

/**
 * The revision the changelog pages are compared against: where this branch left the default
 * branch, falling back to the default branch tip and finally to `HEAD`.
 *
 * Resolved rather than pinned. A literal SHA is correct only until history is rewritten — a
 * squash, a rebase or an amend makes it unreachable, and the test then errors about a missing
 * object instead of reporting what it was actually checking. Every fallback here still
 * asserts something true: the merge-base means "unchanged since this work began", and `HEAD`
 * means "unchanged by the working tree".
 */
function resolveComparisonBase(): { ref: string; describedAs: string } {
	const git = (args: string[]): string | null => {
		try {
			return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
		} catch {
			return null;
		}
	};
	for (const branch of ["origin/main", "main"]) {
		const base = git(["merge-base", "HEAD", branch]);
		if (base) return { ref: base, describedAs: `merge-base with ${branch} (${base.slice(0, 8)})` };
	}
	const head = git(["rev-parse", "HEAD"]);
	if (head) return { ref: head, describedAs: `HEAD (${head.slice(0, 8)}) — no default branch to compare against` };
	throw new Error("no git revision to compare the changelog pages against");
}

/** Lines a unified diff removes, excluding the `---` file header. */
const removedLines = (diff: string): string[] =>
	diff.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---"));

const COMPARISON_BASE = resolveComparisonBase();

describe("the changelog pages", () => {
	it("would notice a rewritten changelog line but accept an added entry, so the check has teeth", () => {
		const rewritten = "--- a/x.mdx\n+++ b/x.mdx\n@@ -1,2 +1,2 @@\n ## 2.3.0\n-- removed `mewkit migrate`\n+- removed the export verb\n";
		expect(removedLines(rewritten)).toEqual(["-- removed `mewkit migrate`"]);
		const appended = "--- a/x.mdx\n+++ b/x.mdx\n@@ -1,1 +1,3 @@\n+## Unreleased\n+- new entry\n ## 2.3.0\n";
		expect(removedLines(appended)).toEqual([]);
	});

	it("compares the changelog against a revision that survives a rewritten history", () => {
		// The comparison must still resolve after a squash or rebase; a pinned SHA would not.
		expect(COMPARISON_BASE.ref).toMatch(/^[0-9a-f]{40}$/);
		expect(COMPARISON_BASE.describedAs).toMatch(/merge-base with |HEAD \(/);
	});

	it("never edits or removes a released changelog line, because they record what past releases did", () => {
		for (const page of CHANGELOG_PAGES) {
			// Historical entries legitimately name verbs that no longer exist and the `npx`
			// form that was current then; rewriting them would falsify the record. A new
			// entry may be added above the released ones, so the diff against the reviewed
			// revision may add lines but never remove one.
			const rel = path.posix.join("packages/docs/content/docs", page);
			const diff = execFileSync("git", ["diff", COMPARISON_BASE.ref, "--", rel], {
				cwd: REPO_ROOT,
				encoding: "utf-8",
				maxBuffer: 32 * 1024 * 1024,
			});
			expect(removedLines(diff), `${page} vs ${COMPARISON_BASE.describedAs}`).toEqual([]);
		}
	});
});
