import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildInventory, checkOwnership, enumerateArtifacts } from "../build-inventory.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const SCHEMA = JSON.stringify({
	properties: {
		owner: { enum: ["lifecycle", "security", "utility"] },
		criticality: { enum: ["critical", "high", "medium", "low"] },
		status: { enum: ["active", "deprecated", "experimental"] },
		runtime: { enum: ["claude-code", "portable", "experimental"] },
	},
});

const FM = (over: Record<string, string> = {}): string => {
	const base = { owner: "utility", criticality: "medium", status: "active", runtime: "claude-code", model: "inherit", tools: "Read", ...over };
	const lines = Object.entries(base).map(([k, v]) => `${k}: ${v}`);
	return `---\nname: mk:foo\n${lines.join("\n")}\n---\n# Body\n`;
};

const REGISTRY_ENTRY = { owner: "lifecycle", criticality: "high", status: "active", runtime: "claude-code" };

async function makeHarness(opts: { skillFm?: string; registry?: Record<string, unknown>; extraSkillDir?: boolean } = {}): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-inv-"));
	tempDirs.push(root);
	const c = join(root, ".claude");
	await mkdir(join(c, "schemas"), { recursive: true });
	await writeFile(join(c, "schemas", "harness-metadata-schema.json"), SCHEMA);

	await mkdir(join(c, "skills", "mk-foo"), { recursive: true });
	await writeFile(join(c, "skills", "mk-foo", "SKILL.md"), opts.skillFm ?? FM());
	if (opts.extraSkillDir) {
		await mkdir(join(c, "skills", "broken"), { recursive: true });
		await writeFile(join(c, "skills", "broken", "notes.txt"), "no SKILL.md here");
	}

	await mkdir(join(c, "agents"), { recursive: true });
	await writeFile(join(c, "agents", "dev.md"), FM().replace("mk:foo", "dev"));
	await writeFile(join(c, "agents", "AGENTS_INDEX.md"), "# index (excluded)");

	await mkdir(join(c, "rules"), { recursive: true });
	await writeFile(join(c, "rules", "r1.md"), "# rule body, no frontmatter");
	await mkdir(join(c, "commands", "mk"), { recursive: true });
	await writeFile(join(c, "commands", "mk", "c1.md"), "# command body");
	await mkdir(join(c, "hooks"), { recursive: true });
	await writeFile(join(c, "hooks", "h1.sh"), "#!/bin/sh\necho hi\n");

	const registry = opts.registry ?? {
		"rules/r1.md": REGISTRY_ENTRY,
		"commands/mk/c1.md": REGISTRY_ENTRY,
		"hooks/h1.sh": { ...REGISTRY_ENTRY, owner: "security", criticality: "critical" },
	};
	await writeFile(join(c, "harness-inventory.json"), JSON.stringify({ schema_version: 1, artifacts: registry }));
	return c;
}

describe("enumerateArtifacts", () => {
	it("counts by presence and excludes index files; flags a non-runtime dir with no SKILL.md", async () => {
		const c = await makeHarness({ extraSkillDir: true });
		const { refs, issues } = enumerateArtifacts(c);
		expect(refs.filter((r) => r.type === "skill")).toHaveLength(1);
		expect(refs.filter((r) => r.type === "agent")).toHaveLength(1); // AGENTS_INDEX excluded
		expect(refs.filter((r) => r.type === "rule")).toHaveLength(1);
		expect(refs.filter((r) => r.type === "command")).toHaveLength(1);
		expect(refs.filter((r) => r.type === "hook")).toHaveLength(1);
		expect(issues.some((i) => i.path === "skills/broken")).toBe(true);
	});
});

describe("buildInventory", () => {
	it("merges frontmatter + registry into the frozen InventoryEntry shape", async () => {
		const c = await makeHarness();
		const { entries } = buildInventory(c);
		expect(entries).toHaveLength(5);
		const skill = entries.find((e) => e.type === "skill")!;
		expect(Object.keys(skill).sort()).toEqual(["criticality", "id", "owner", "path", "runtime", "source", "status", "type"].sort());
		expect(skill.id).toBe("mk:foo");
		expect(skill.source).toBe("frontmatter");
		const hook = entries.find((e) => e.type === "hook")!;
		expect(hook.source).toBe("registry");
		expect(hook.criticality).toBe("critical");
		const agent = entries.find((e) => e.type === "agent")!;
		expect(agent).toMatchObject({ model: "inherit", tools: ["Read"], agentClass: "core-support", routing: "direct-only", public: true });
	});

	it("normalizes typed dependency edges while preserving the flat compatibility projection", async () => {
		const c = await makeHarness({
			skillFm: FM({ dependency_edges: "" }).replace(
			"dependency_edges: \n",
			"dependency_edges:\n  - id: mk:peer\n    type: peer\n  - id: mk:required\n    type: requires\ndepends_on: [mk:required]\n",
		),
		});
		const skill = buildInventory(c).entries.find((entry) => entry.type === "skill")!;
		expect(skill.dependencyEdges).toEqual([
			{ id: "mk:peer", type: "peer" },
			{ id: "mk:required", type: "requires" },
		]);
		expect(skill.dependsOn).toEqual(["mk:required"]);
	});

	it("reports conflicting legacy and typed dependency aliases", async () => {
		const c = await makeHarness({
			skillFm: FM({ dependency_edges: "" }).replace(
				"dependency_edges: \n",
				"dependency_edges:\n  - id: mk:peer\n    type: peer\ndepends_on: [mk:peer]\n",
			),
		});
		expect(buildInventory(c).issues.some((issue) => issue.problem.includes("depends_on must match"))).toBe(true);
	});

	it("reports an id declared with opposing edge types", async () => {
		const c = await makeHarness({
			skillFm: FM({ dependency_edges: "" }).replace(
				"dependency_edges: \n",
				"dependency_edges:\n  - id: mk:other\n    type: peer\n  - id: mk:other\n    type: requires\n",
			),
		});
		expect(buildInventory(c).issues.some((issue) => issue.problem.includes("conflicting dependency_edges types"))).toBe(true);
	});
});

describe("checkOwnership", () => {
	it("PASSES when every artifact has complete, valid metadata", async () => {
		const c = await makeHarness();
		const results = checkOwnership(c);
		expect(results.some((r) => r.status === "fail")).toBe(false);
	});

	it("FAILS when a registry record is missing", async () => {
		const c = await makeHarness({ registry: { "commands/mk/c1.md": REGISTRY_ENTRY, "hooks/h1.sh": REGISTRY_ENTRY } });
		const results = checkOwnership(c);
		expect(results.some((r) => r.status === "fail" && r.name.includes("rules/r1.md"))).toBe(true);
	});

	it("FAILS when a required field is missing from frontmatter", async () => {
		const fm = "---\nname: mk:foo\nowner: utility\ncriticality: medium\nstatus: active\n---\n"; // no runtime
		const c = await makeHarness({ skillFm: fm });
		const results = checkOwnership(c);
		expect(results.some((r) => r.status === "fail" && r.detail.includes("missing runtime"))).toBe(true);
	});

	it("FAILS when an agent omits model or tools", async () => {
		const c = await makeHarness();
		await writeFile(join(c, "agents", "dev.md"), FM().replace("model: inherit\ntools: Read\n", ""));
		const results = checkOwnership(c);
		expect(results.some((r) => r.status === "fail" && r.detail.includes("missing model") && r.detail.includes("missing tools"))).toBe(true);
	});

	it("FAILS on an out-of-enum value", async () => {
		const c = await makeHarness({ skillFm: FM({ criticality: "supercritical" }) });
		const results = checkOwnership(c);
		expect(results.some((r) => r.status === "fail" && r.detail.includes("not in enum"))).toBe(true);
	});

	it("FAILS on a skill dir with no SKILL.md (unknown dir surfaced, not skipped)", async () => {
		const c = await makeHarness({ extraSkillDir: true });
		const results = checkOwnership(c);
		expect(results.some((r) => r.status === "fail" && r.name.includes("skills/broken"))).toBe(true);
	});

	it("FAILS when the schema is absent by default (strict / scoped CI)", async () => {
		const c = await makeHarness();
		await rm(join(c, "schemas", "harness-metadata-schema.json"));
		const results = checkOwnership(c);
		expect(results.some((r) => r.status === "fail")).toBe(true);
	});

	it("WARNs (not FAILs) when the schema is absent and missingInfraSeverity=warn (un-synced install)", async () => {
		const c = await makeHarness();
		await rm(join(c, "schemas", "harness-metadata-schema.json"));
		const results = checkOwnership(c, { missingInfraSeverity: "warn" });
		expect(results.some((r) => r.status === "fail")).toBe(false);
		expect(results.some((r) => r.status === "warn")).toBe(true);
	});
});
