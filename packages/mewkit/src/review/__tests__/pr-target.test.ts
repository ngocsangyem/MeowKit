import { describe, expect, it } from "vitest";
import { matchRemote, parseGitRemotes, parsePrTarget, type Remote } from "../pr-target.js";

describe("parsePrTarget", () => {
	it("parses a full PR URL", () => {
		const r = parsePrTarget("https://github.com/acme/widget/pull/42");
		expect(r).toEqual({ ok: true, value: { host: "github", owner: "acme", repo: "widget", pr: 42 } });
	});

	it("parses a .git-suffixed URL", () => {
		const r = parsePrTarget("https://github.com/acme/widget.git/pull/7");
		expect(r.ok && r.value.repo).toBe("widget");
	});

	it("parses owner/repo#123", () => {
		expect(parsePrTarget("acme/widget#123")).toEqual({
			ok: true,
			value: { host: "github", owner: "acme", repo: "widget", pr: 123 },
		});
	});

	it("parses a bare number and a #-prefixed number without owner/repo", () => {
		expect(parsePrTarget("55")).toEqual({ ok: true, value: { host: "github", pr: 55 } });
		expect(parsePrTarget("#56")).toEqual({ ok: true, value: { host: "github", pr: 56 } });
	});

	it("rejects empty and unrecognized input", () => {
		expect(parsePrTarget("").ok).toBe(false);
		expect(parsePrTarget("not a pr").ok).toBe(false);
		expect(parsePrTarget("https://gitlab.com/a/b/pull/1").ok).toBe(false);
	});
});

describe("parseGitRemotes", () => {
	const sample = [
		"origin\tgit@github.com:me/fork.git (fetch)",
		"origin\tgit@github.com:me/fork.git (push)",
		"upstream\thttps://github.com/acme/widget.git (fetch)",
		"upstream\thttps://github.com/acme/widget.git (push)",
		"weird\thttps://gitlab.com/x/y.git (fetch)",
	].join("\n");

	it("parses fetch lines only, dedupes, and drops non-github", () => {
		const r = parseGitRemotes(sample);
		expect(r.map((x) => x.name)).toEqual(["origin", "upstream"]);
		expect(r.find((x) => x.name === "upstream")).toMatchObject({ owner: "acme", repo: "widget" });
	});
});

describe("matchRemote (fork/upstream selection)", () => {
	const remotes: Remote[] = [
		{ name: "origin", url: "git@github.com:me/fork.git", host: "github", owner: "me", repo: "fork" },
		{ name: "upstream", url: "https://github.com/acme/widget.git", host: "github", owner: "acme", repo: "widget" },
	];

	it("selects the base-repo remote for a fork PR (never the fork remote)", () => {
		const r = matchRemote(remotes, { host: "github", owner: "acme", repo: "widget", pr: 9 });
		expect(r).toEqual({ ok: true, value: { remote: "upstream", host: "github", owner: "acme", repo: "widget" } });
	});

	it("rejects a bare number when multiple remotes exist", () => {
		const r = matchRemote(remotes, { host: "github", pr: 9 });
		expect(r.ok).toBe(false);
	});

	it("uses the single remote for a bare number when only one exists", () => {
		const one = [remotes[1]];
		const r = matchRemote(one, { host: "github", pr: 9 });
		expect(r.ok && r.value.remote).toBe("upstream");
	});

	it("errors when no remote hosts the PR base repo", () => {
		const r = matchRemote(remotes, { host: "github", owner: "ghost", repo: "nope", pr: 9 });
		expect(r.ok).toBe(false);
	});

	it("honors an explicit --remote override that matches the base repo", () => {
		const r = matchRemote(remotes, { host: "github", owner: "acme", repo: "widget", pr: 9 }, "upstream");
		expect(r.ok && r.value.remote).toBe("upstream");
	});

	it("rejects an explicit override that points at the wrong repo (no silent trust)", () => {
		const r = matchRemote(remotes, { host: "github", owner: "acme", repo: "widget", pr: 9 }, "origin");
		expect(r.ok).toBe(false);
	});

	it("rejects an explicit override that does not exist", () => {
		const r = matchRemote(remotes, { host: "github", pr: 9 }, "nope");
		expect(r.ok).toBe(false);
	});
});
