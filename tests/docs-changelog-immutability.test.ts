// The changelog pages are a record of what past releases did, so this change must leave them
// byte-identical — and the test has to establish that rather than assert the files exist.
//
// Separate from the CLI-resolution suite because it answers a different question: not "is
// every documented command runnable" but "did this change rewrite history it should not have".
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(REPO_ROOT, "packages", "docs", "content", "docs");

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

const COMPARISON_BASE = resolveComparisonBase();

describe("the changelog pages", () => {
	it("would notice a rewritten changelog page, so the comparison has teeth", () => {
		const page = CHANGELOG_PAGES[0] as string;
		const rel = path.posix.join("packages/docs/content/docs", page);
		const committed = execFileSync("git", ["show", `${COMPARISON_BASE.ref}:${rel}`], {
			cwd: REPO_ROOT,
			encoding: "utf-8",
			maxBuffer: 32 * 1024 * 1024,
		});
		expect(committed, `${page} is empty at ${COMPARISON_BASE.describedAs}`).not.toBe("");
		expect(`${committed}a stray edit\n`).not.toBe(committed);
	});

	it("compares the changelog against a revision that survives a rewritten history", () => {
		// The comparison must still resolve after a squash or rebase; a pinned SHA would not.
		expect(COMPARISON_BASE.ref).toMatch(/^[0-9a-f]{40}$/);
		expect(COMPARISON_BASE.describedAs).toMatch(/merge-base with |HEAD \(/);
	});

	it("leaves the changelog pages byte-identical, because they record what past releases did", () => {
		for (const page of CHANGELOG_PAGES) {
			// Historical entries legitimately name verbs that no longer exist and the `npx`
			// form that was current then; rewriting them would falsify the record. Compared
			// against the reviewed revision rather than merely checked for existence — the
			// earlier version of this case would have passed on a rewritten changelog.
			const rel = path.posix.join("packages/docs/content/docs", page);
			const committed = execFileSync("git", ["show", `${COMPARISON_BASE.ref}:${rel}`], {
				cwd: REPO_ROOT,
				encoding: "utf-8",
				maxBuffer: 32 * 1024 * 1024,
			});
			expect(fs.readFileSync(path.join(DOCS, page), "utf-8"), `${page} vs ${COMPARISON_BASE.describedAs}`).toBe(
				committed,
			);
		}
	});
});
