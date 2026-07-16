import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findGenericCoreTokens, summarizeGenericCoreTokens } from "../check-generic-core-tokens.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tree(body: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "generic-core-token-"));
	tempDirs.push(root);
	const file = join(root, "skills", "demo", "references", "nested.md");
	await mkdir(join(file, ".."), { recursive: true });
	await writeFile(file, body, "utf-8");
	return root;
}

describe("findGenericCoreTokens", () => {
	it("reports every category with stable file and line evidence", async () => {
		const root = await tree(["AskUserQuestion", "Claude-3-Opus", "150K context", "MeowKit"].join("\n"));
		expect(findGenericCoreTokens(root)).toEqual([
			{ file: "skills/demo/references/nested.md", line: 1, token: "AskUserQuestion", category: "provider-tool" },
			{ file: "skills/demo/references/nested.md", line: 2, token: "Claude-3-Opus", category: "model-or-tier" },
			{ file: "skills/demo/references/nested.md", line: 3, token: "150K", category: "context-window" },
			{ file: "skills/demo/references/nested.md", line: 4, token: "MeowKit", category: "brand" },
		]);
	});

	it("excludes YAML frontmatter and leaves the mk namespace alone", async () => {
		const root = await tree("---\nruntime: claude-code\nmodel: haiku\n---\nUse mk:plan and a semantic capability.\n");
		expect(findGenericCoreTokens(root)).toEqual([]);
	});

	it("excludes CRLF YAML frontmatter", async () => {
		const root = await tree("---\r\nmodel: haiku\r\n---\r\nUse mk:plan.\r\n");
		expect(findGenericCoreTokens(root)).toEqual([]);
	});

	it("does not mistake generic prose or top-level skill metadata for a provider tool", async () => {
		const root = await tree("An agent (not a host tool) may summarize mk:plan.\n");
		await writeFile(join(root, "skills", "SKILLS_ATTRIBUTION.md"), "Claude-3-Opus attribution\n", "utf-8");
		expect(findGenericCoreTokens(root)).toEqual([]);
	});

	it("exempts documented mk and mewkit CLI command syntax but not brand prose", async () => {
		const root = await tree(["Run `mewkit validate`, `mk:plan`, or npx mewkit doctor. MeowKit installs skills.", "```sh", "mewkit wiki render", "```"].join("\n"));
		expect(findGenericCoreTokens(root)).toEqual([
			{ file: "skills/demo/references/nested.md", line: 1, token: "MeowKit", category: "brand" },
		]);
	});

	it("does not exempt arbitrary brand strings in fenced code", async () => {
		const root = await tree(["```ts", 'const title = "MeowKit";', "```"].join("\n"));
		expect(findGenericCoreTokens(root)).toEqual([
			{ file: "skills/demo/references/nested.md", line: 2, token: "MeowKit", category: "brand" },
		]);
	});

	it("does not exempt non-command inline brand mentions", async () => {
		const root = await tree("The constant `MeowKit` is deprecated.\n");
		expect(findGenericCoreTokens(root)).toEqual([
			{ file: "skills/demo/references/nested.md", line: 1, token: "MeowKit", category: "brand" },
		]);
	});

	it("renders a complete deterministic category baseline", () => {
		expect(
			summarizeGenericCoreTokens([
				{ file: "x", line: 1, token: "haiku", category: "model-or-tier" },
				{ file: "x", line: 2, token: "Agent(", category: "provider-tool" },
			]),
		).toBe("provider-tool=1, model-or-tier=1, context-window=0, brand=0");
	});

	it("keeps scale-routing provider-neutral", () => {
		expect(findGenericCoreTokens(join(process.cwd(), ".claude"), "skills/scale-routing")).toEqual([]);
	});
});
