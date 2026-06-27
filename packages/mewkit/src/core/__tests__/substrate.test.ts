import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { aggregateSubstrate, checkSubstrate, emitSubstrateView, renderSubstrateView, TAXONOMY } from "../substrate.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

// Schema mirrors the real one: owner/criticality/status/runtime enums + the responsibility enum.
const SCHEMA = JSON.stringify({
	properties: {
		owner: { enum: ["lifecycle", "utility", "security"] },
		criticality: { enum: ["critical", "high", "medium", "low"] },
		status: { enum: ["active", "deprecated", "experimental"] },
		runtime: { enum: ["claude-code", "portable", "experimental"] },
		responsibility: { enum: TAXONOMY.map((t) => t.value) },
	},
});

const REG = (over: Record<string, unknown> = {}) => ({
	owner: "lifecycle",
	criticality: "medium",
	status: "active",
	runtime: "claude-code",
	...over,
});

/** Build a minimal harness: one rule (registry-sourced) + one skill (frontmatter). The
 *  `ruleMeta` controls the rule's registry record; the skill is intentionally untagged. */
async function makeHarness(ruleMeta: Record<string, unknown>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-sub-"));
	tempDirs.push(root);
	const c = join(root, ".claude");
	await mkdir(join(c, "schemas"), { recursive: true });
	await writeFile(join(c, "schemas", "harness-metadata-schema.json"), SCHEMA);

	await mkdir(join(c, "skills", "mk-foo"), { recursive: true });
	await writeFile(
		join(c, "skills", "mk-foo", "SKILL.md"),
		"---\nname: mk:foo\nowner: utility\ncriticality: medium\nstatus: active\nruntime: claude-code\n---\n# Body\n",
	);
	await mkdir(join(c, "rules"), { recursive: true });
	await writeFile(join(c, "rules", "r1.md"), "# rule body");
	await writeFile(join(c, "harness-inventory.json"), JSON.stringify({ schema_version: 1.1, artifacts: { "rules/r1.md": ruleMeta } }));
	return c;
}

describe("aggregateSubstrate", () => {
	it("marks a tagged responsibility covered, untagged frontmatter reported, unused missing", async () => {
		const c = await makeHarness(REG({ responsibility: "verification" }));
		const agg = aggregateSubstrate(c);
		expect(agg.rows).toHaveLength(TAXONOMY.length);
		expect(agg.rows.find((r) => r.value === "verification")!.coverage).toBe("covered");
		expect(agg.rows.find((r) => r.value === "intervention-recording")!.coverage).toBe("missing");
		expect(agg.untaggedRegistry).toHaveLength(0);
		expect(agg.untaggedFrontmatter).toContain("skills/mk-foo/SKILL.md");
	});

	it("flags a deprecated-only responsibility as partial", async () => {
		const c = await makeHarness(REG({ responsibility: "verification", status: "deprecated" }));
		const row = aggregateSubstrate(c).rows.find((r) => r.value === "verification")!;
		expect(row.count).toBe(1);
		expect(row.active).toBe(0);
		expect(row.coverage).toBe("partial");
	});
});

describe("checkSubstrate", () => {
	it("FAILS on an untagged registry artifact (registry is the seeded set)", async () => {
		const c = await makeHarness(REG()); // no responsibility
		emitSubstrateView(c); // fresh view so only the untagged check can fail
		const results = checkSubstrate(c);
		expect(results.some((r) => r.status === "fail" && r.name.includes("rules/r1.md"))).toBe(true);
	});

	it("FAILS on an out-of-enum responsibility value", async () => {
		const c = await makeHarness(REG({ responsibility: "not-a-real-value" }));
		emitSubstrateView(c);
		const results = checkSubstrate(c);
		expect(results.some((r) => r.status === "fail" && r.detail.includes("not in taxonomy enum"))).toBe(true);
	});

	it("WARNs (not FAILs) on untagged frontmatter skills/agents", async () => {
		const c = await makeHarness(REG({ responsibility: "verification" }));
		emitSubstrateView(c);
		const results = checkSubstrate(c);
		expect(results.some((r) => r.status === "warn" && r.name.includes("untagged frontmatter"))).toBe(true);
		expect(results.some((r) => r.status === "fail")).toBe(false);
	});

	it("FAILS on a stale committed view, PASSES once regenerated", async () => {
		const c = await makeHarness(REG({ responsibility: "verification" }));
		emitSubstrateView(c);
		const viewPath = join(c, "harness-substrate.md");
		await writeFile(viewPath, (await readFile(viewPath, "utf-8")) + "\nstale drift\n");
		expect(checkSubstrate(c).some((r) => r.status === "fail" && r.name.includes("in sync"))).toBe(true);
		emitSubstrateView(c); // regenerate
		expect(checkSubstrate(c).some((r) => r.status === "fail")).toBe(false);
	});

	it("WARNs (not FAILs) when the view is absent and missingViewSeverity=warn", async () => {
		const c = await makeHarness(REG({ responsibility: "verification" }));
		const results = checkSubstrate(c, { missingViewSeverity: "warn" });
		expect(results.some((r) => r.status === "warn" && r.name.includes("view present"))).toBe(true);
	});
});

describe("renderSubstrateView", () => {
	it("is deterministic and lists every responsibility", async () => {
		const c = await makeHarness(REG({ responsibility: "verification" }));
		const agg = aggregateSubstrate(c);
		const a = renderSubstrateView(agg);
		const b = renderSubstrateView(agg);
		expect(a).toBe(b);
		for (const t of TAXONOMY) expect(a).toContain(t.label);
		expect(a).toContain("DO NOT EDIT");
	});

	it("caps the taxonomy at 13 (hard cap per the plan)", () => {
		expect(TAXONOMY.length).toBeLessThanOrEqual(13);
	});
});
