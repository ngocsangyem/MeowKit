import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkPluginNamespace, collectAgentNames } from "../namespace-purity.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function scaffold(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mk-guard-"));
	tempDirs.push(root);
	const claude = join(root, ".claude");
	await mkdir(join(claude, "agents"), { recursive: true });
	await mkdir(join(claude, "skills", "cook"), { recursive: true });
	await writeFile(join(root, "package.json"), JSON.stringify({ version: "2.12.0" }));
	await writeFile(join(claude, "agents", "developer.md"), "---\nname: developer\n---\nd");
	await writeFile(
		join(claude, "skills", "cook", "SKILL.md"),
		'---\nname: mk:cook\n---\nTask(subagent_type="developer")',
	);
	return root;
}

const status = (results: { name: string; status: string }[], name: string) =>
	results.find((r) => r.name === name)?.status;

describe("checkPluginNamespace", () => {
	it("passes a clean source tree", async () => {
		const root = await scaffold();
		const r = checkPluginNamespace(join(root, ".claude"));
		expect(status(r, "Agent names are bare")).toBe("pass");
		expect(status(r, "Skill names are mk:-scoped")).toBe("pass");
		expect(status(r, "subagent_type refs resolve")).toBe("pass");
	});

	it("FAILS when an agent name is already namespaced", async () => {
		const root = await scaffold();
		await writeFile(join(root, ".claude", "agents", "evaluator.md"), "---\nname: mk:evaluator\n---\ne");
		expect(status(checkPluginNamespace(join(root, ".claude")), "Agent names are bare")).toBe("fail");
	});

	it("FAILS on a non-mk: skill namespace leak", async () => {
		const root = await scaffold();
		await mkdir(join(root, ".claude", "skills", "design"), { recursive: true });
		await writeFile(join(root, ".claude", "skills", "design", "SKILL.md"), "---\nname: ckm:design\n---\nx");
		expect(status(checkPluginNamespace(join(root, ".claude")), "Skill names are mk:-scoped")).toBe("fail");
	});

	it("WARNs on a subagent_type ref to an unknown agent", async () => {
		const root = await scaffold();
		await writeFile(join(root, ".claude", "skills", "cook", "extra.md"), 'Task(subagent_type="ghost")');
		expect(status(checkPluginNamespace(join(root, ".claude")), "subagent_type refs resolve")).toBe("warn");
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
