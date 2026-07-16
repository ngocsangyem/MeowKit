import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkPacks } from "../check-packs.js";

const LIVE = join(process.cwd(), ".claude");

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const hasFail = (rs: ReturnType<typeof checkPacks>, frag: string) =>
	rs.some((r) => r.status === "fail" && (r.name.includes(frag) || r.detail.includes(frag)));

describe("checkPacks on the live harness", () => {
	it("PASSES on the shipped manifest (no FAIL); coherence row is pass", () => {
		const results = checkPacks(LIVE);
		expect(results.some((r) => r.status === "fail")).toBe(false);
		expect(results.some((r) => r.name === "Pack coherence" && r.status === "pass")).toBe(true);
	});

	it("does not warn about an inert dependency closure when declared edges exist", () => {
		const results = checkPacks(LIVE);
		expect(results.some((r) => r.status === "warn" && r.detail.includes("no depends_on edges"))).toBe(false);
	});
});

const SCHEMA = JSON.stringify({
	properties: {
		owner: { enum: ["lifecycle", "ghost"] },
		criticality: { enum: ["medium"] },
		status: { enum: ["active"] },
		runtime: { enum: ["claude-code"] },
	},
});

interface SynthOpts {
	packs: Record<string, unknown>;
	profiles: Record<string, string[]>;
	skills: { id: string; owner: string; dependsOn?: string[] }[];
	baseFiles?: string[];
}

async function makeHarness(o: SynthOpts): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-cp-"));
	tempDirs.push(root);
	const c = join(root, ".claude");
	const w = async (rel: string, body: string) => {
		await mkdir(join(c, rel, ".."), { recursive: true });
		await writeFile(join(c, rel), body, "utf-8");
	};
	await w("schemas/harness-metadata-schema.json", SCHEMA);
	await w(
		"pack-manifest.json",
		JSON.stringify({ schemaVersion: "1.0", base: { files: o.baseFiles ?? [], globs: [], commands: [] }, packs: o.packs, profiles: o.profiles }),
	);
	for (const s of o.skills) {
		const deps = s.dependsOn ? `depends_on: [${s.dependsOn.join(", ")}]\n` : "";
		await w(`skills/${s.id.replace("mk:", "")}/SKILL.md`, `---\nname: ${s.id}\nowner: ${s.owner}\ncriticality: medium\nstatus: active\nruntime: claude-code\n${deps}---\n# ${s.id}\n`);
	}
	await w("harness-inventory.json", JSON.stringify({ schema_version: 1, artifacts: {} }));
	return c;
}

describe("checkPacks failure modes (synthetic)", () => {
	it("FAILS when an artifact belongs to no pack or base (stray owner)", async () => {
		const c = await makeHarness({
			packs: { life: { owners: ["lifecycle"] } },
			profiles: { core: ["base", "life"], full: ["*"] },
			skills: [{ id: "mk:ok", owner: "lifecycle" }, { id: "mk:stray", owner: "ghost" }],
		});
		expect(hasFail(checkPacks(c), "Pack completeness")).toBe(true);
	});

	it("FAILS on a phantom artifactsAdd id", async () => {
		const c = await makeHarness({
			packs: { life: { owners: ["lifecycle"] }, extra: { artifactsAdd: ["mk:does-not-exist"] } },
			profiles: { core: ["base", "life"], full: ["*"] },
			skills: [{ id: "mk:ok", owner: "lifecycle" }],
		});
		expect(hasFail(checkPacks(c), "unknown artifact id")).toBe(true);
	});

	it("FAILS on an unresolvable depends_on edge", async () => {
		const c = await makeHarness({
			packs: { life: { owners: ["lifecycle"] } },
			profiles: { core: ["base", "life"], full: ["*"] },
			skills: [{ id: "mk:ok", owner: "lifecycle", dependsOn: ["mk:ghost-dep"] }],
		});
		expect(hasFail(checkPacks(c), "unresolvable dependency")).toBe(true);
	});

	it("FAILS the safety invariant when base lacks the dispatch/gate files", async () => {
		const c = await makeHarness({
			packs: { life: { owners: ["lifecycle"] } },
			profiles: { core: ["base", "life"], full: ["*"] },
			skills: [{ id: "mk:ok", owner: "lifecycle" }],
		});
		expect(hasFail(checkPacks(c), "Base safety invariant")).toBe(true);
	});

	it("WARNs (not FAILs) when the manifest is absent and missingInfraSeverity=warn", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-cp-bare-"));
		tempDirs.push(root);
		const results = checkPacks(root, { missingInfraSeverity: "warn" });
		expect(results.some((r) => r.status === "fail")).toBe(false);
		expect(results.some((r) => r.status === "warn")).toBe(true);
	});
});
