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
 * The kit versions that have been released: every `v<version>` tag. `null` when the tags
 * cannot be read (a shallow clone, no git), in which case every version heading counts as
 * released, which is the strict reading.
 */
function releasedKitVersions(): Set<string> | null {
	try {
		const tags = execFileSync("git", ["tag", "--list", "v*"], {
			cwd: REPO_ROOT,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		})
			.split("\n")
			.map((tag) => tag.trim().replace(/^v/, ""))
			.filter(Boolean);
		return tags.length > 0 ? new Set(tags) : null;
	} catch {
		return null;
	}
}

/**
 * The released part of a changelog page: from the first version heading that names a released
 * version (`## 2.15.0 …`, `## CLI 2.1.0 …`) to the end, CRLF folded. A version written up
 * before its tag exists is still a draft and stays editable, like `## Unreleased`. A page with
 * no such heading (the archive's intro aside) is released in full from its first `## ` heading.
 */
const releasedRegion = (text: string, released: Set<string> | null = RELEASED): string => {
	const body = text.replace(/\r\n/g, "\n");
	const anyHeading = body.search(/^## /m);
	for (const heading of body.matchAll(/^## (CLI )?(\d+\.\d+\.\d+[\w.-]*)/gm)) {
		// The retired npm CLI had tags of its own; its headings are always history.
		const isReleased = Boolean(heading[1]) || released === null || released.has(heading[2]);
		if (isReleased) return body.slice(heading.index);
	}
	// No released version on the page: only a page with no version heading at all is history.
	const hasVersion = /^## (CLI )?\d/m.test(body);
	return hasVersion ? "" : body.slice(anyHeading >= 0 ? anyHeading : 0);
};

const RELEASED = releasedKitVersions();
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
			// released sections are frozen: the page header (the live upgrade command),
			// `## Unreleased` and a version not yet tagged describe the present and may be edited. Releasing retitles
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
		const page =
			"# Changelog\n\nnpx mewkit upgrade\n\n## Unreleased\n\n- draft\n\n## 2.1.0 (2026-01-01)\n\n- shipped\n";
		const tagged = new Set(["2.1.0"]);
		expect(releasedRegion(page, tagged)).toBe("## 2.1.0 (2026-01-01)\n\n- shipped\n");
		const edited = page.replace("npx mewkit", "mewkit").replace("- draft", "- reworded");
		expect(releasedRegion(edited, tagged)).toBe(releasedRegion(page, tagged));
		expect(
			releasedRegion(page.replace("- shipped", "- rewritten"), tagged).endsWith(releasedRegion(page, tagged)),
		).toBe(false);
	});

	it("leaves a version editable until its tag exists, and freezes every version when tags cannot be read", () => {
		const page = "# Changelog\n\n## 3.0.0 (2026-11-20)\n\n- written up\n\n## 2.1.0 (2026-01-01)\n\n- shipped\n";
		expect(releasedRegion(page, new Set(["2.1.0"]))).toBe("## 2.1.0 (2026-01-01)\n\n- shipped\n");
		expect(releasedRegion(page, new Set(["2.1.0", "3.0.0"]))).toBe(page.slice(page.indexOf("## 3.0.0")));
		expect(releasedRegion(page, null)).toBe(page.slice(page.indexOf("## 3.0.0")));
	});
});
