import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { wikiCommand } from "../cli.js";

// Drives the new wiki handoff/context/propose-flag CLI surfaces against a temp project.

const tempDirs: string[] = [];
let cwd0: string | undefined;
afterEach(async () => {
	if (cwd0) process.chdir(cwd0);
	cwd0 = undefined;
	vi.restoreAllMocks();
	await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function project(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "wiki-handoff-cli-"));
	tempDirs.push(root);
	await mkdir(join(root, ".claude", "memory"), { recursive: true });
	cwd0 = cwd0 ?? process.cwd();
	process.chdir(root);
	return root;
}

function captureLogs(): string[] {
	const logs: string[] = [];
	vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));
	vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));
	return logs;
}

describe("wiki handoff profiles", () => {
	it("lists registered skills with class + profile (json)", async () => {
		await project();
		const logs = captureLogs();
		await wikiCommand({ subcommand: "handoff", rest: ["profiles"], flags: { json: true } });
		const list = JSON.parse(logs.join(""));
		expect(Array.isArray(list)).toBe(true);
		const cook = list.find((p: { skillName: string }) => p.skillName === "mk:cook");
		expect(cook.handoffClass).toBe("required");
		expect(cook.profile).toBe("lifecycle-run");
		const classes = new Set(list.map((p: { handoffClass: string }) => p.handoffClass));
		expect(classes.has("required")).toBe(true);
		expect(classes.has("conditional")).toBe(true);
	});
});

describe("wiki handoff suggest / propose", () => {
	it("suggest writes nothing and returns a packet + decision", async () => {
		const root = await project();
		await mkdir(join(root, "tasks", "reports"), { recursive: true });
		await writeFile(
			join(root, "tasks", "reports", "run.md"),
			"A reusable lifecycle decision verified by passing tests.",
		);
		const logs = captureLogs();
		await wikiCommand({
			subcommand: "handoff",
			rest: ["suggest"],
			flags: { skill: "mk:cook", from: "tasks/reports/run.md", slug: "demo", "verified-outcome": true, json: true },
		});
		const out = JSON.parse(logs.join(""));
		expect(out.packet.handoffClass).toBe("required");
		expect(out.decision.kind).toBe("propose-candidate");
		expect(existsSync(join(root, "tasks", "wikis", "demo", "handoffs.jsonl"))).toBe(false);
	});

	it("propose creates a candidate and appends a handoff record for a clean class-A artifact", async () => {
		const root = await project();
		await mkdir(join(root, "tasks", "reports"), { recursive: true });
		await writeFile(
			join(root, "tasks", "reports", "run.md"),
			"A reusable lifecycle decision verified by passing tests.",
		);
		const logs = captureLogs();
		await wikiCommand({
			subcommand: "handoff",
			rest: ["propose"],
			flags: { skill: "mk:cook", from: "tasks/reports/run.md", slug: "demo", "verified-outcome": true },
		});
		expect(logs.join("")).toContain("handoff propose → proposed");

		const handoffs = await readFile(join(root, "tasks", "wikis", "demo", "handoffs.jsonl"), "utf-8");
		const record = JSON.parse(handoffs.trim().split("\n")[0]);
		expect(record.skillName).toBe("mk:cook");
		expect(record.status).toBe("proposed");
		expect(record.candidateId).toMatch(/^demo\/cand-/);

		const candidates = await readFile(join(root, "tasks", "wikis", "demo", "candidates.jsonl"), "utf-8");
		expect(candidates.trim().split("\n").length).toBe(1);
	});

	it("rejects a --from path outside the project root (SEC2)", async () => {
		await project();
		const logs = captureLogs();
		await wikiCommand({
			subcommand: "handoff",
			rest: ["propose"],
			flags: { skill: "mk:cook", from: "../../etc/passwd", slug: "demo" },
		});
		expect(logs.join("")).toMatch(/escapes the project root/);
	});
});

describe("wiki propose metadata flags (A1 passthrough)", () => {
	it("passes origin/source-id/reuse-scope/salience-json into ProposeInput and the candidate", async () => {
		const root = await project();
		await writeFile(
			join(root, "sal.json"),
			JSON.stringify({ explicit_user_intent: 3, verified_outcome: 3, source_quality: 2 }),
		);
		const logs = captureLogs();
		await wikiCommand({
			subcommand: "propose",
			rest: ["demo", "Title"],
			flags: {
				content: "A clean reusable note for the passthrough test.",
				origin: "agent",
				"source-id": ["a", "b"],
				"reuse-scope": "arch",
				"salience-json": join(root, "sal.json"),
			},
		});
		expect(logs.join("")).toContain("propose → propose-candidate");
		const candidates = await readFile(join(root, "tasks", "wikis", "demo", "candidates.jsonl"), "utf-8");
		const cand = JSON.parse(candidates.trim().split("\n").at(-1)!);
		expect(cand.origin).toBe("agent");
		expect(cand.sourceIds).toEqual(["a", "b"]);
		expect(cand.reuseScope).toBe("arch");
		expect(cand.salience.total).toBe(8); // 3 + 3 + 2, scored from the passed components
	});

	it("a low-salience file is discarded — the gate scores the passed components", async () => {
		const root = await project();
		await writeFile(
			join(root, "low.json"),
			JSON.stringify({
				explicit_user_intent: 1,
				novelty_vs_existing_wiki: 0,
				future_reuse_likelihood: 0,
				source_quality: 0,
				blast_radius: 0,
			}),
		);
		const logs = captureLogs();
		await wikiCommand({
			subcommand: "propose",
			rest: ["demo", "Title"],
			flags: { content: "clean body", "salience-json": join(root, "low.json") },
		});
		expect(logs.join("")).toContain("propose → discard");
		expect(existsSync(join(root, "tasks", "wikis", "demo", "candidates.jsonl"))).toBe(false);
	});

	it("bare propose preserves prior behavior (human origin, no sourceIds, CLI salience)", async () => {
		const root = await project();
		const logs = captureLogs();
		await wikiCommand({
			subcommand: "propose",
			rest: ["demo", "Bare"],
			flags: { content: "A clean body about salience defaults." },
		});
		expect(logs.join("")).toContain("propose →");
		const candidates = await readFile(join(root, "tasks", "wikis", "demo", "candidates.jsonl"), "utf-8");
		const cand = JSON.parse(candidates.trim().split("\n").at(-1)!);
		expect(cand.origin).toBe("human");
		expect(cand.sourceIds).toEqual([]);
	});
});

describe("wiki context", () => {
	async function seedApprovedPage(root: string): Promise<void> {
		const logs = captureLogs();
		await wikiCommand({ subcommand: "init", rest: ["demo"], flags: { title: "Demo" } });
		await wikiCommand({
			subcommand: "propose",
			rest: ["demo", "Salience"],
			flags: { content: "The salience rubric scores candidates before any write." },
		});
		const cid = logs.find((l) => l.includes("propose →"))!.match(/\((demo\/cand-[a-z0-9]+)\)/)![1];
		await wikiCommand({ subcommand: "approve", rest: ["demo", cid], flags: { by: "alice" } });
		logs.length = 0;
		vi.restoreAllMocks();
	}

	it("returns ranked pages with a project-root-readable path and snippet only by default", async () => {
		const root = await project();
		await seedApprovedPage(root);
		const logs = captureLogs();
		await wikiCommand({ subcommand: "context", rest: ["salience"], flags: { json: true } });
		const out = JSON.parse(logs.join(""));
		expect(out.note).toMatch(/DATA/);
		expect(out.results.length).toBe(1);
		expect(out.results[0].path).toMatch(/^tasks\/wikis\/demo\/pages\//);
		expect(out.results[0].snippet.length).toBeGreaterThan(0);
		expect("content" in out.results[0]).toBe(false);
	});

	it("includes the page body only with --include-content", async () => {
		const root = await project();
		await seedApprovedPage(root);
		const logs = captureLogs();
		await wikiCommand({ subcommand: "context", rest: ["salience"], flags: { json: true, "include-content": true } });
		const out = JSON.parse(logs.join(""));
		expect(out.results[0].content).toContain("rubric");
	});

	it("fails open when no index exists (exit 0, empty)", async () => {
		await project();
		const logs = captureLogs();
		await wikiCommand({ subcommand: "context", rest: ["anything"], flags: {} });
		expect(logs.join("")).toContain("(no wiki context)");
	});
});
