// Direct `@athena` consult — the stateless half of the two-mode contract.
//
// The embedded half is governed by a run: a runId, a stage, a cap, a dossier, a
// receipt, and a disposition that routes the workflow. A direct consult has none of
// that, so the property under test throughout is that it CANNOT acquire any of it —
// not by field, not by wording, not by the adapter's prose.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FORBIDDEN_BRIEF_FIELDS, validateStrategyBrief, type StrategyBrief } from "../athena-strategy-brief.js";
import { classifySupervisionCall } from "../athena-supervision-mode.js";
import { AdviceRefusal, runAdvice } from "../../commands/advice.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const tempRoot = (): string => mkdtempSync(join(tmpdir(), "athena-direct-"));

const brief = (over: Partial<StrategyBrief> = {}): StrategyBrief => ({
	situation: "two services write the same row and the later write silently wins",
	decisionRecommendation: "serialize on an advisory lock in the owning service; the evidence supports it over a retry loop",
	rejectedAlternatives: "optimistic retry — it hides the conflict rather than ordering it",
	nextFalsifiableCheck: "run the concurrent reassign test; a lost update proves this wrong",
	risksAndRollback: "lock contention under load; drop the lock and the old behavior returns",
	escalationPoint: "if the fix needs a schema change, that is the owner's call",
	assumptions: "both writers live in one deployment unit",
	confidence: "medium",
	evidenceRead: ["src/reassign.ts", "tasks/reports/concurrency-note.md"],
	...over,
});

describe("strategy brief shape", () => {
	it("accepts a well-formed brief", () => {
		expect(validateStrategyBrief(brief())).toEqual({ ok: true, errors: [] });
	});

	it("refuses a field defined as non-enumerable", () => {
		// `Object.keys` and zod `.strict()` both skip these. Unreachable through
		// `JSON.parse` today, but the module claims the field is refused — so it is.
		const smuggled = {};
		Object.defineProperty(smuggled, "disposition", { value: "READY_FOR_EXISTING_GATE", enumerable: false });
		Object.assign(smuggled, brief());
		expect(validateStrategyBrief(smuggled).ok).toBe(false);
	});

	it("requires the fields that stop it becoming an opinion", () => {
		// Each of these is load-bearing: no recommendation is a shrug, no falsifiable
		// check is an opinion, and no escalation point implies authority it lacks.
		for (const field of ["situation", "decisionRecommendation", "nextFalsifiableCheck", "escalationPoint"] as const) {
			const r = validateStrategyBrief({ ...brief(), [field]: "" });
			expect(r.ok, field).toBe(false);
		}
		expect(validateStrategyBrief({ ...brief(), confidence: undefined }).ok).toBe(false);
	});

	it.each(FORBIDDEN_BRIEF_FIELDS)("refuses %s — a consult routes no workflow", (field) => {
		const r = validateStrategyBrief({ ...brief(), [field]: "anything" });
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/belongs to embedded supervision/);
	});

	it("refuses a disposition even when it is a legal embedded value", () => {
		// The value is legal at REVIEW; what makes it illegal here is that there is no
		// run to route. Emitted from a consult it reads as a governed decision.
		const r = validateStrategyBrief({ ...brief(), disposition: "READY_FOR_EXISTING_GATE" });
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/disposition/);
	});

	it("holds a consult to the same authority-language bar as a checkpoint", () => {
		// A consult has LESS authority than a checkpoint, so it cannot be laxer.
		const r = validateStrategyBrief({ ...brief(), decisionRecommendation: "this is approved, merge is authorized" });
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/approve|clear/i);
	});

	it("refuses credentials in prose or in the evidence it read", () => {
		expect(validateStrategyBrief({ ...brief(), situation: "token: ghp_abcdefghijklmnopqrstuvwxyz01" }).ok).toBe(false);
		expect(validateStrategyBrief({ ...brief(), evidenceRead: ["-----BEGIN PRIVATE KEY-----"] }).ok).toBe(false);
	});

	it("caps length — volume is not rigor", () => {
		const r = validateStrategyBrief({ ...brief(), situation: "word ".repeat(700) });
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/word cap/);
	});
});

describe("the two modes cannot impersonate each other", () => {
	it("accepts a bare direct call — no packet is the normal case, not an error", () => {
		expect(classifySupervisionCall({ claimedMode: "direct" })).toEqual({
			valid: true,
			mode: "direct",
			stateful: false,
		});
	});

	it("refuses a direct call carrying any run state, naming the offending field", () => {
		for (const [field, claim] of [
			["runId", { claimedMode: "direct" as const, runId: "run-1" }],
			["stage", { claimedMode: "direct" as const, stage: "GUIDE" as const }],
			["checkpointId", { claimedMode: "direct" as const, checkpointId: "c1" }],
		]) {
			const d = classifySupervisionCall(claim as Parameters<typeof classifySupervisionCall>[0]);
			expect(d.valid).toBe(false);
			if (!d.valid) expect(d.reason).toContain(field as string);
		}
	});

	it("refuses embedded without the full triple rather than downgrading it to a consult", () => {
		// Downgrading would be worse than refusing: the caller believes it is supervised.
		const d = classifySupervisionCall({ claimedMode: "embedded", stage: "GUIDE", checkpointId: "c1" });
		expect(d.valid).toBe(false);
		if (!d.valid) expect(d.reason).toMatch(/supervisionRunId/);
	});

	it("a direct consult cannot produce a dossier path — structurally, not by rule", () => {
		// A dossier path needs a runId, and a consult has none. There is no code path
		// from a bare consult to a durable artifact.
		const d = classifySupervisionCall({ claimedMode: "direct" });
		expect(d.valid && d.stateful).toBe(false);
	});
});

describe("brief validation is reachable from the CLI", () => {
	it("validates and refuses a brief through `advice validate-packet --packet-kind brief`", async () => {
		const root = tempRoot();
		writeFileSync(join(root, "brief.json"), JSON.stringify(brief()), "utf-8");
		await expect(
			runAdvice(root, { subcommand: "validate-packet", evidence: "brief.json", packetKind: "brief" }),
		).resolves.toBeUndefined();

		writeFileSync(join(root, "bad.json"), JSON.stringify({ ...brief(), disposition: "ESCALATE_TO_HUMAN" }), "utf-8");
		await expect(
			runAdvice(root, { subcommand: "validate-packet", evidence: "bad.json", packetKind: "brief" }),
		).rejects.toThrow(/belongs to embedded supervision/);
	});

	it("rejects an unknown --packet-kind rather than defaulting to a laxer one", async () => {
		const root = tempRoot();
		writeFileSync(join(root, "brief.json"), JSON.stringify(brief()), "utf-8");
		await expect(
			runAdvice(root, { subcommand: "validate-packet", evidence: "brief.json", packetKind: "bogus" }),
		).rejects.toThrow(AdviceRefusal);
	});

	it("a brief is NOT accepted as an output packet, and vice versa", async () => {
		// The two shapes are different capabilities; validating one against the other's
		// schema would let a consult pass as a checkpoint result.
		const root = tempRoot();
		writeFileSync(join(root, "brief.json"), JSON.stringify(brief()), "utf-8");
		await expect(
			runAdvice(root, { subcommand: "validate-packet", evidence: "brief.json", packetKind: "output" }),
		).rejects.toThrow(/Packet refused/);
	});
});

describe("the athena adapter documents both modes unambiguously", () => {
	const adapter = readFileSync(join(REPO_ROOT, ".claude/agents/athena.md"), "utf-8");

	it("scopes the stage/packet machinery to embedded mode", () => {
		// Without this scoping a packet-less call reads the disposition tables as
		// mandatory and returns one — the impersonation the schema refuses.
		expect(adapter).toMatch(/## Your Four Stages \(embedded mode only\)/);
		expect(adapter).toMatch(/## What You Return \(embedded mode\)/);
	});

	it("tells a packet-less invocation what to do instead of refusing it", () => {
		// Prose is hard-wrapped, so match on collapsed whitespace rather than the
		// wrapping — a reflow should not fail this, but a deletion should.
		const flat = adapter.replace(/\s+/g, " ");
		expect(flat).toMatch(/This is the mode you are in whenever no packet arrives/);
		expect(flat).toMatch(/Do not ask for a packet, and do not refuse/);
	});

	it("names the forbidden direct-mode fields in the adapter, not only in code", () => {
		const directSection = adapter.slice(adapter.indexOf("## Direct Consult"));
		for (const field of ["disposition", "requiredCorrections", "runId", "stage", "checkpointId"]) {
			expect(directSection, field).toContain(field);
		}
	});

	it("keeps the read-only and no-run-start limits in the direct section", () => {
		const directSection = adapter.slice(adapter.indexOf("## Direct Consult"));
		expect(directSection).toMatch(/You write nothing/);
		expect(directSection).toMatch(/start no supervised run/);
	});
});
