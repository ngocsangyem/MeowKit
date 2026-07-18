import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BUILTIN_AGENT_TYPES, collectAgentNames, rewriteAgentRefs } from "../plugin-agent-refs.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const AGENTS = new Set(["developer", "evaluator", "researcher", "jira-evaluator", "shipper"]);

describe("rewriteAgentRefs", () => {
	it("rewrites a double-quoted bare ref to the namespaced form", () => {
		const { content, count } = rewriteAgentRefs('subagent_type="developer"', AGENTS);
		expect(content).toBe('subagent_type="mk:developer"');
		expect(count).toBe(1);
	});

	it("rewrites the colon + space yaml form", () => {
		const { content } = rewriteAgentRefs('subagent_type: "researcher"', AGENTS);
		expect(content).toBe('subagent_type: "mk:researcher"');
	});

	it("rewrites an unquoted ref bounded by a comma", () => {
		const { content } = rewriteAgentRefs("subagent_type=evaluator,", AGENTS);
		expect(content).toBe("subagent_type=mk:evaluator,");
	});

	it("does NOT double-prefix an already-namespaced ref", () => {
		const { content, count } = rewriteAgentRefs('subagent_type="mk:developer"', AGENTS);
		expect(content).toBe('subagent_type="mk:developer"');
		expect(count).toBe(0);
	});

	it("leaves built-in agent types bare", () => {
		for (const builtin of BUILTIN_AGENT_TYPES) {
			const src = `subagent_type="${builtin}"`;
			expect(rewriteAgentRefs(src, AGENTS).content).toBe(src);
		}
	});

	it("does not touch a name that is not a known kit agent", () => {
		const src = 'subagent_type="totally-unknown"';
		expect(rewriteAgentRefs(src, AGENTS).count).toBe(0);
	});

	it("prefers the longest matching name (no partial match)", () => {
		const { content } = rewriteAgentRefs('subagent_type="jira-evaluator"', AGENTS);
		expect(content).toBe('subagent_type="mk:jira-evaluator"');
	});

	it("rewrites every occurrence across a multi-line block", () => {
		const src = [
			'Task(subagent_type="developer", prompt="x")',
			'Task(subagent_type="evaluator", prompt="y")',
			'Agent(subagent_type="Explore", prompt="z")',
		].join("\n");
		const { content, count } = rewriteAgentRefs(src, AGENTS);
		expect(count).toBe(2);
		expect(content).toContain('subagent_type="mk:developer"');
		expect(content).toContain('subagent_type="mk:evaluator"');
		expect(content).toContain('subagent_type="Explore"');
	});

	it("uses a custom plugin name when provided", () => {
		const { content } = rewriteAgentRefs('subagent_type="developer"', AGENTS, "kit");
		expect(content).toBe('subagent_type="kit:developer"');
	});
});

describe("collectAgentNames", () => {
	it("reads the bare name frontmatter from each agent file", async () => {
		const dir = await mkdtemp(join(tmpdir(), "mk-agents-"));
		tempDirs.push(dir);
		const agentsDir = join(dir, "agents");
		await mkdir(agentsDir, { recursive: true });
		await writeFile(join(agentsDir, "developer.md"), "---\nname: developer\ntools: Read\n---\nbody");
		await writeFile(join(agentsDir, "planner.md"), '---\nname: "planner"\n---\nbody');
		await writeFile(join(agentsDir, "notes.txt"), "name: ignored");
		const names = collectAgentNames(agentsDir);
		expect(names.has("developer")).toBe(true);
		expect(names.has("planner")).toBe(true);
		expect(names.has("ignored")).toBe(false);
		expect(names.size).toBe(2);
	});

	it("returns an empty set for a missing directory", () => {
		expect(collectAgentNames(join(tmpdir(), "does-not-exist-xyz")).size).toBe(0);
	});
});
