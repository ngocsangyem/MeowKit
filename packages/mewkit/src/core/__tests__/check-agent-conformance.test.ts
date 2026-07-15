import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { artifactPatternsOverlap, checkAgentConformance } from "../check-agent-conformance.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const agent = (name: string, tools: string, body: string, model = "inherit") =>
	`---\nname: ${name}\ndescription: Use this agent when routed. Never use it for another role.\ntools: ${tools}\nmodel: ${model}\nowner: lifecycle\ncriticality: medium\nstatus: active\nruntime: claude-code\n---\n${body}`;

async function harness(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-agent-contract-"));
	tempDirs.push(root);
	const claude = join(root, ".claude");
	await mkdir(join(claude, "agents"), { recursive: true });
	await mkdir(join(claude, "rules"), { recursive: true });
	await writeFile(join(claude, "agents", "AGENTS_INDEX.md"), "# index\n[0]{agent_file}\n");
	await writeFile(join(claude, "rules", "agent-routing.md"), "# routes\n");
	for (const [name, body] of Object.entries(files)) await writeFile(join(claude, "agents", name), body);
	return root;
}

describe("agent conformance", () => {
	it("treats verdict suffixes as disjoint while catching a true suffix overlap", () => {
		expect(artifactPatternsOverlap("tasks/reviews/*-verdict.md", "tasks/reviews/*-evalverdict.md")).toBe(false);
		expect(artifactPatternsOverlap("tasks/reviews/*-verdict.md", "tasks/reviews/*-security-verdict.md")).toBe(false);
		expect(artifactPatternsOverlap("tasks/reviews/*-verdict.md", "tasks/reviews/*-verdict.md")).toBe(true);
		expect(artifactPatternsOverlap("tasks/reports/*.md", "tasks/reports/research-*.md")).toBe(true);
	});

	it("fails a backticked tool instruction that frontmatter does not grant", async () => {
		const root = await harness({
			"reader.md": agent("reader", "Read", "Use the `Write` tool to persist the output."),
			"writer.md": agent("writer", "Read, Write", "## Exclusive Ownership\n\nYou own `tasks/reports/writer-*.md`.\n"),
		});
		const results = checkAgentConformance(root);
		expect(results.some((result) => result.name.includes("Agent tools") && result.detail.includes("Write"))).toBe(true);
	});

	it("fails a writer with no declared artifact and an unknown model", async () => {
		const root = await harness({ "bad.md": agent("bad", "Read, Write", "# No ownership", "unknown-model") });
		const results = checkAgentConformance(root);
		expect(results.some((result) => result.name.includes("Agent ownership"))).toBe(true);
		expect(results.some((result) => result.name.includes("Agent model"))).toBe(true);
	});
});
