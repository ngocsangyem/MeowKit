// `.meowkit/` is governed by one deny-all file, and git agrees with it.
//
// The assertions are made through real `git` rather than against the file's
// text, because the property wanted is what git TRACKS, and an ignore file is
// only evidence of that. The untracked status of the local kit copy under
// `cache/` is asserted on a directory that actually has content in it: an empty
// directory is ignored by git whatever the rules say, so asserting it empty
// would prove nothing.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { KIT_DIR_GITIGNORE, STEPS, stripSupersededMeowkitIgnores } from "../setup-steps.js";

const git = (root: string, ...args: string[]): string => execFileSync("git", args, { cwd: root, encoding: "utf8" });

/** A scratch git repository with a populated `.meowkit/`. */
function repo(rootGitignore?: string): string {
	const root = mkdtempSync(join(tmpdir(), "mk-denyall-"));
	git(root, "init", "--quiet");
	git(root, "config", "user.email", "t@example.test");
	git(root, "config", "user.name", "t");
	mkdirSync(join(root, ".meowkit/cache/.claude/hooks"), { recursive: true });
	mkdirSync(join(root, ".meowkit/memory"), { recursive: true });
	mkdirSync(join(root, ".meowkit/telemetry"), { recursive: true });
	mkdirSync(join(root, ".meowkit/state"), { recursive: true });
	mkdirSync(join(root, ".meowkit/envs"), { recursive: true });
	mkdirSync(join(root, ".meowkit/backups"), { recursive: true });
	mkdirSync(join(root, ".claude/logs"), { recursive: true });
	const files: Record<string, string> = {
		".meowkit/cache/.claude/hooks/dispatch.cjs": "// kit copy\n",
		".meowkit/cache/version": "3.0.0\n",
		".meowkit/memory/decisions.md": "# decisions\n",
		".meowkit/telemetry/cost-log.json": "{}\n",
		".meowkit/state/workflow-state.json": "{}\n",
		".meowkit/envs/marker": "x\n",
		".meowkit/backups/marker": "x\n",
		".meowkit/config.yaml": "tdd: true\n",
		".meowkit/.env": "SECRET=1\n",
		".meowkit/.env.example": "# example\n",
		".meowkit/mcp.json.example": "{}\n",
		".meowkit/metadata.json": "{}\n",
		".meowkit/pack-manifest.json": "{}\n",
		".meowkit/harness-inventory.json": "{}\n",
		".meowkit/release-manifest.json": "{}\n",
		".claude/logs/run.log": "x\n",
		".claude/settings.json": "{}\n",
	};
	for (const [rel, body] of Object.entries(files)) writeFileSync(join(root, rel), body);
	if (rootGitignore !== undefined) writeFileSync(join(root, ".gitignore"), rootGitignore);
	return root;
}

describe("the deny-all file for .meowkit/", () => {
	it("is exactly the nine lines, with no committed ownership baseline among them", () => {
		expect(KIT_DIR_GITIGNORE.trimEnd().split("\n")).toEqual([
			"*",
			"!.gitignore",
			"!config.yaml",
			"!.env.example",
			"!mcp.json.example",
			"!bin/",
			"!bin/mewkit",
			"!memory/",
			"!memory/*.md",
		]);
		// Asserted by name: a committed manifest would be an unauthenticated,
		// pull-request-editable record of which files may be deleted.
		expect(KIT_DIR_GITIGNORE).not.toContain("release-manifest.json");
	});

	it("is what setup writes, byte for byte", () => {
		const root = repo();
		STEPS.gitignore(root);
		expect(readFileSync(join(root, ".meowkit/.gitignore"), "utf8")).toBe(KIT_DIR_GITIGNORE);
	});

	it("leaves git tracking exactly the shared allowlist", () => {
		const root = repo();
		STEPS.gitignore(root);
		git(root, "add", "-A");
		const tracked = git(root, "ls-files")
			.trim()
			.split("\n")
			.filter((f) => f.startsWith(".meowkit/"))
			.sort();
		expect(tracked).toEqual([
			".meowkit/.env.example",
			".meowkit/.gitignore",
			".meowkit/config.yaml",
			".meowkit/mcp.json.example",
			".meowkit/memory/decisions.md",
		]);
	});

	it("keeps the local kit copy untracked, on a cache that has content in it", () => {
		const root = repo();
		STEPS.gitignore(root);
		git(root, "add", "-A");
		expect(git(root, "ls-files", ".meowkit/cache").trim()).toBe("");
		expect(git(root, "check-ignore", "-v", ".meowkit/cache/version")).toContain(".meowkit/.gitignore:1:*");
	});

	it("tracks .claude/ but not .claude/logs/", () => {
		const root = repo();
		STEPS.gitignore(root);
		git(root, "add", "-A");
		const tracked = git(root, "ls-files").trim().split("\n");
		expect(tracked).toContain(".claude/settings.json");
		expect(tracked).not.toContain(".claude/logs/run.log");
	});

	it("gives the root ignore only its non-.meowkit entries", () => {
		const root = repo();
		STEPS.gitignore(root);
		const body = readFileSync(join(root, ".gitignore"), "utf8");
		for (const line of [".env", ".env.local", "session-state/", "tasks/reports/", ".claude/logs/"]) {
			expect(body, line).toContain(line);
		}
		expect(body).not.toContain(".meowkit/telemetry/");
		expect(body).not.toContain(".meowkit/state/");
		expect(body).not.toContain(".meowkit/cache/");
	});
});

describe("an existing project's root ignore", () => {
	const BASE_SHAPE = [
		"# MeowKit",
		".env",
		".env.local",
		".meowkit/.env",
		".meowkit/telemetry/",
		".meowkit/state/",
		".meowkit/cache/",
		".meowkit/envs/",
		"!.meowkit/state/keep-me.json",
		"session-state/",
		"tasks/reports/",
		".claude/logs/",
		"",
	].join("\n");

	it("loses the superseded .meowkit lines and keeps the user's negation", () => {
		const root = repo(BASE_SHAPE);
		const result = STEPS.gitignore(root);
		expect(result.status).toBe("pass");
		const body = readFileSync(join(root, ".gitignore"), "utf8");
		for (const line of [
			".meowkit/.env",
			".meowkit/telemetry/",
			".meowkit/state/",
			".meowkit/cache/",
			".meowkit/envs/",
		]) {
			expect(body.split("\n"), line).not.toContain(line);
		}
		expect(body).toContain("!.meowkit/state/keep-me.json");
		for (const line of [".env", ".env.local", "session-state/", "tasks/reports/", ".claude/logs/"]) {
			expect(body.split("\n"), line).toContain(line);
		}
	});

	it("is a no-op the second time", () => {
		const root = repo(BASE_SHAPE);
		STEPS.gitignore(root);
		const once = readFileSync(join(root, ".gitignore"), "utf8");
		STEPS.gitignore(root);
		expect(readFileSync(join(root, ".gitignore"), "utf8")).toBe(once);
	});

	it("reports nothing to strip for a gitignore that never had the lines", () => {
		const content = "node_modules/\n.env\n";
		expect(stripSupersededMeowkitIgnores(content)).toEqual({ content, stripped: [] });
	});

	it("leaves an unrelated .meowkit path alone", () => {
		const content = "a\n.meowkit/notes/\nb\n";
		expect(stripSupersededMeowkitIgnores(content).stripped).toEqual([]);
	});
});
