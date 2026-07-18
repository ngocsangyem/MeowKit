import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listPhaseFiles, parsePhaseFile, parsePlan, REQUIRED_PHASE_SECTIONS } from "../plan-parser.js";

const tempDirs: string[] = [];

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const PHASE = [
	"---",
	'title: "Phase 1: Do The Thing"',
	"status: todo",
	"phase: 1",
	"dependencies: [2, 3]",
	"---",
	"",
	"## Overview",
	"Some overview.",
	"",
	"## Requirements",
	"- [x] done item",
	"- [ ] open item",
	"- [ ] another open item",
	"",
	"## Implementation Steps",
	"1. Step.",
	"",
	"## Success Criteria",
	"- [x] criterion met",
	"",
	"## Risk Assessment",
	"Risky.",
].join("\n");

const PLAN_MD = ["---", 'title: "A Plan"', "status: pending", "---", "", "# A Plan", "", "Overview."].join("\n");

async function planDir(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "plan-parser-"));
	tempDirs.push(root);
	for (const [rel, body] of Object.entries(files)) {
		const abs = join(root, rel);
		await mkdir(join(abs, ".."), { recursive: true });
		await writeFile(abs, body, "utf-8");
	}
	return root;
}

describe("parsePhaseFile", () => {
	it("reads frontmatter, sections, and the checklist", async () => {
		const dir = await planDir({ "phase-01-thing.md": PHASE });
		const phase = parsePhaseFile(join(dir, "phase-01-thing.md"));

		expect(phase.title).toBe("Phase 1: Do The Thing");
		expect(phase.status).toBe("todo");
		expect(phase.phase).toBe("1");
		expect(phase.dependencies).toEqual(["2", "3"]);
		expect(phase.checklist).toEqual({ total: 4, checked: 2 });
		expect(phase.missingSections).toEqual([]);
	});

	it("names every missing required section", async () => {
		const dir = await planDir({ "phase-01-x.md": "---\ntitle: x\n---\n\n## Overview\nOnly this.\n" });
		const phase = parsePhaseFile(join(dir, "phase-01-x.md"));
		expect(phase.missingSections).toEqual([
			"Requirements",
			"Implementation Steps",
			"Success Criteria",
			"Risk Assessment",
		]);
	});

	it("matches a required section inside a longer heading", async () => {
		// Real plans write "## Success Criteria (Phase 2)". An exact-match rule
		// would report a false gap and train authors to distrust the check.
		const body = REQUIRED_PHASE_SECTIONS.map((s) => `## ${s} (annotated)`).join("\n\n");
		const dir = await planDir({ "phase-01-x.md": `---\ntitle: x\n---\n\n${body}\n` });
		expect(parsePhaseFile(join(dir, "phase-01-x.md")).missingSections).toEqual([]);
	});

	it("handles a phase with no frontmatter and no boxes", async () => {
		const dir = await planDir({ "phase-01-x.md": "# Bare\n\nProse only.\n" });
		const phase = parsePhaseFile(join(dir, "phase-01-x.md"));
		expect(phase.title).toBeNull();
		expect(phase.checklist).toEqual({ total: 0, checked: 0 });
	});

	it("counts both - and * bullets, and an uppercase [X]", async () => {
		const dir = await planDir({ "phase-01-x.md": "## Overview\n- [X] upper\n* [ ] star\n" });
		expect(parsePhaseFile(join(dir, "phase-01-x.md")).checklist).toEqual({ total: 2, checked: 1 });
	});
});

describe("listPhaseFiles", () => {
	it("finds phase files in filename order and ignores everything else", async () => {
		const dir = await planDir({
			"phase-02-b.md": PHASE,
			"phase-01-a.md": PHASE,
			"plan.md": PLAN_MD,
			"reports/notes.md": "not a phase",
			"README.md": "no",
		});
		expect(listPhaseFiles(dir).map((f) => f.split("/").pop())).toEqual(["phase-01-a.md", "phase-02-b.md"]);
	});

	it("returns [] for a missing dir rather than throwing", () => {
		expect(listPhaseFiles("/definitely/not/here")).toEqual([]);
	});
});

describe("parsePlan", () => {
	it("aggregates the checklist across phases", async () => {
		const dir = await planDir({ "plan.md": PLAN_MD, "phase-01-a.md": PHASE, "phase-02-b.md": PHASE });
		const summary = parsePlan(dir);

		expect(summary.title).toBe("A Plan");
		expect(summary.status).toBe("pending");
		expect(summary.phases).toHaveLength(2);
		expect(summary.checklist).toEqual({ total: 8, checked: 4 });
		expect(summary.issues).toEqual([]);
	});

	it("reports a missing plan.md as an observation", async () => {
		const dir = await planDir({ "phase-01-a.md": PHASE });
		expect(parsePlan(dir).issues).toContain("no plan.md — Gate 1 expects one at the plan root");
	});

	it("reports an over-length overview without failing", async () => {
		// gate-rules.md: plan.md stays under 80 lines. Reported, never enforced —
		// this is an inspector; Gate 1 is the human's.
		const dir = await planDir({ "plan.md": `---\ntitle: x\n---\n${"\nline".repeat(120)}`, "phase-01-a.md": PHASE });
		expect(parsePlan(dir).issues.some((i) => i.includes("under 80"))).toBe(true);
	});

	it("reports phases with missing sections", async () => {
		const dir = await planDir({ "plan.md": PLAN_MD, "phase-01-x.md": "---\ntitle: x\n---\n\n## Overview\nx\n" });
		expect(parsePlan(dir).issues.some((i) => i.includes("phase-01-x.md is missing"))).toBe(true);
	});

	it("reports an empty plan dir rather than throwing", async () => {
		const dir = await planDir({});
		const summary = parsePlan(dir);
		expect(summary.phases).toEqual([]);
		expect(summary.issues).toContain("no phase-XX-*.md files found");
	});
});

// The phase's core criterion: ZERO file writes. Read-only is enforced by
// construction — plan-parser.ts imports no write API — and this proves it at
// runtime, so a future edit that reaches for writeFileSync fails here.
describe("read-only by construction", () => {
	it("parsePlan writes nothing", async () => {
		const dir = await planDir({ "plan.md": PLAN_MD, "phase-01-a.md": PHASE });

		const spies = [
			vi.spyOn(fs, "writeFileSync"),
			vi.spyOn(fs, "appendFileSync"),
			vi.spyOn(fs, "mkdirSync"),
			vi.spyOn(fs, "rmSync"),
			vi.spyOn(fs, "unlinkSync"),
			vi.spyOn(fs, "renameSync"),
		];

		parsePlan(dir);
		parsePhaseFile(join(dir, "phase-01-a.md"));
		listPhaseFiles(dir);

		for (const spy of spies) expect(spy, `${spy.getMockName()} must never be called`).not.toHaveBeenCalled();
	});

	it("the parser module imports no write API", async () => {
		// Belt-and-braces on the spy: the source itself must not name a writer, so
		// the property holds even on a path the spy test does not exercise.
		const src = await import("node:fs/promises").then(({ readFile }) =>
			readFile(new URL("../plan-parser.ts", import.meta.url), "utf-8"),
		);
		const importLine = src.split("\n").find((l) => l.includes('from "node:fs"')) ?? "";
		for (const writer of ["writeFileSync", "appendFileSync", "mkdirSync", "rmSync", "unlinkSync", "renameSync"]) {
			expect(importLine, `plan-parser must not import ${writer}`).not.toContain(writer);
		}
	});
});
