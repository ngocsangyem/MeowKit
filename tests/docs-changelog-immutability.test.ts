// The changelog pages are a record of what past releases did, so a change may add an entry
// but never edit or remove a released line — established against git, not by checking files exist.
//
// Separate from the CLI-resolution suite because it answers a different question: not "is
// every documented command runnable" but "did this change rewrite history it should not have".
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

/**
 * The released part of a changelog page: from its first version heading (`## 2.15.0 …`,
 * `## CLI 2.1.0 …`) to the end, CRLF folded. A page with no such heading (the archive's
 * intro aside) is released in full from its first `## ` heading.
 */
const releasedRegion = (text: string): string => {
	const body = text.replace(/\r\n/g, "\n");
	const version = body.search(/^## (CLI )?\d/m);
	const anyHeading = body.search(/^## /m);
	const start = version >= 0 ? version : anyHeading >= 0 ? anyHeading : 0;
	return body.slice(start);
};

const COMPARISON_BASE = resolveComparisonBase();

describe("the changelog pages", () => {
	it("compares the changelog against a revision that survives a rewritten history", () => {
		// The comparison must still resolve after a squash or rebase; a pinned SHA would not.
		expect(COMPARISON_BASE.ref).toMatch(/^[0-9a-f]{40}$/);
		expect(COMPARISON_BASE.describedAs).toMatch(/merge-base with |HEAD \(/);
	});

	it("never edits or removes a released changelog line, because they record what past releases did", () => {
		for (const page of CHANGELOG_PAGES) {
			// Historical entries legitimately name verbs that no longer exist and the `npx`
			// form that was current then; rewriting them would falsify the record. Only the
			// released sections are frozen: the page header (the live upgrade command) and
			// `## Unreleased` describe the present and may be edited. Releasing retitles
			// `## Unreleased` as a version, so the released region may grow at its top but its
			// existing text must survive unchanged as the region's tail.
			const rel = path.posix.join("packages/docs/content/docs", page);
			const before = releasedRegion(
				execFileSync("git", ["show", `${COMPARISON_BASE.ref}:${rel}`], {
					cwd: REPO_ROOT,
					encoding: "utf-8",
					maxBuffer: 32 * 1024 * 1024,
				}),
			);
			const after = releasedRegion(readFileSync(path.join(REPO_ROOT, rel), "utf-8"));
			expect(after.endsWith(before), `${page}: a released line changed vs ${COMPARISON_BASE.describedAs}`).toBe(true);
		}
	});

	it("freezes the released sections but leaves the header and Unreleased editable", () => {
		const page = "# Changelog\n\nnpx mewkit upgrade\n\n## Unreleased\n\n- draft\n\n## 2.1.0 (2026-01-01)\n\n- shipped\n";
		expect(releasedRegion(page)).toBe("## 2.1.0 (2026-01-01)\n\n- shipped\n");
		const edited = page.replace("npx mewkit", "mewkit").replace("- draft", "- reworded");
		expect(releasedRegion(edited)).toBe(releasedRegion(page));
		expect(releasedRegion(page.replace("- shipped", "- rewritten")).endsWith(releasedRegion(page))).toBe(false);
	});
});
