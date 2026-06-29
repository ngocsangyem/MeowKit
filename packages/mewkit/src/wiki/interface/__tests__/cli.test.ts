import { mkdtemp, mkdir, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { wikiCommand } from "../cli.js";

// CLI smoke test: drives wikiCommand through the full lifecycle against a temp project
// (chdir so findClaudeDir resolves it). Closes the "cli.ts has no automated test" gap.

const tempDirs: string[] = [];
let cwd0: string | undefined;
afterEach(async () => {
	if (cwd0) process.chdir(cwd0);
	cwd0 = undefined;
	vi.restoreAllMocks();
	await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe("mewkit wiki CLI", () => {
	it("runs init → reindex → propose → approve → search → render", async () => {
		const root = await mkdtemp(join(tmpdir(), "wiki-cli-"));
		tempDirs.push(root);
		await mkdir(join(root, ".claude", "memory"), { recursive: true });
		cwd0 = process.cwd();
		process.chdir(root);

		const logs: string[] = [];
		vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));

		await wikiCommand({ subcommand: "init", rest: ["demo"], flags: { title: "Demo Wiki" } });
		await wikiCommand({ subcommand: "reindex", rest: [], flags: {} });
		await wikiCommand({
			subcommand: "propose",
			rest: ["demo", "Salience", "Rubric"],
			flags: { content: "The salience rubric scores candidates before any write." },
		});

		const proposeLine = logs.find((l) => l.includes("propose →"));
		expect(proposeLine).toBeDefined();
		const candidateId = proposeLine!.match(/\((demo\/cand-[a-z0-9]+)\)/)?.[1];
		expect(candidateId).toBeDefined();

		await wikiCommand({ subcommand: "approve", rest: ["demo", candidateId!], flags: { by: "alice" } });
		expect(existsSync(join(root, "tasks", "wikis", "demo", "pages", "salience-rubric.md"))).toBe(true);

		logs.length = 0;
		await wikiCommand({ subcommand: "search", rest: ["salience"], flags: { json: true } });
		const hits = JSON.parse(logs.join(""));
		expect(Array.isArray(hits)).toBe(true);
		expect(hits.length).toBe(1);
		expect(hits[0].slug).toBe("demo");

		const out = join(root, "wiki.html");
		await wikiCommand({ subcommand: "render", rest: ["demo"], flags: { out } });
		expect(existsSync(out)).toBe(true);
		expect(await readFile(out, "utf-8")).toContain("Salience Rubric");
	});

	it("hint emits title/score/path only — never page content", async () => {
		const root = await mkdtemp(join(tmpdir(), "wiki-cli-"));
		tempDirs.push(root);
		await mkdir(join(root, ".claude", "memory"), { recursive: true });
		cwd0 = process.cwd();
		process.chdir(root);

		const logs: string[] = [];
		vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));

		await wikiCommand({ subcommand: "init", rest: ["demo"], flags: { title: "Demo" } });
		await wikiCommand({ subcommand: "reindex", rest: [], flags: {} });
		await wikiCommand({
			subcommand: "propose",
			rest: ["demo", "Intro"],
			flags: { content: "Secret-free body text about salience for the hint test." },
		});
		const cid = logs.find((l) => l.includes("propose →"))!.match(/\((demo\/cand-[a-z0-9]+)\)/)![1];
		await wikiCommand({ subcommand: "approve", rest: ["demo", cid], flags: { by: "alice" } });

		logs.length = 0;
		await wikiCommand({ subcommand: "hint", rest: ["salience"], flags: {} });
		const hints = JSON.parse(logs.join(""));
		expect(hints.length).toBe(1);
		expect(Object.keys(hints[0]).sort()).toEqual(["pageId", "pagePath", "path", "score", "title"]);
		// `path` is now the project-root-readable file target, not the internal pageId.
		expect(hints[0].path).toMatch(/^tasks\/wikis\/demo\/pages\//);
		// the page body must NOT appear in a hint
		expect(logs.join("")).not.toContain("body text");
	});
});
