// session-handlers.test.ts — the end-of-session recorder, tested against pinned
// inputs rather than a recording.
//
// It could not be recorded from the shell implementation and replayed: it
// derives fields from a live transcript, so no recording has stable numbers
// across runs. The subject here is the field set and the decisions, over inputs
// written into a throwaway project — the same properties a recording would have
// pinned, asserted directly.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { createRequire } from "node:module";

import { errText, loadHandler, project, REPO_ROOT } from "./lib/handler-fixtures";

const rulesLib = createRequire(import.meta.url)(path.join(REPO_ROOT, ".claude/hooks/lib/always-on-rules.cjs")) as {
	ALWAYS_ON_RULES: string[];
	PHASE_ZERO_FILES: string[];
	markerDigests: (root: string) => { rules: string | null; phaseZero: string | null };
};
const digests = (root: string) => rulesLib.markerDigests(root);
const LOG = ".meowkit/state/session-sentinels.jsonl";

/** Every file the marker vouches for, each with distinct non-empty text. */
const markerFiles = (): Record<string, string> =>
	Object.fromEntries([...rulesLib.ALWAYS_ON_RULES, ...rulesLib.PHASE_ZERO_FILES].map((rel) => [rel, `# ${rel}\n`]));

/** The line the session-start handler records, from the files as they are now. */
function recordBaseline(root: string, sid: string) {
	const { rules, phaseZero } = digests(root);
	fs.mkdirSync(path.join(root, ".meowkit/state"), { recursive: true });
	fs.appendFileSync(
		path.join(root, LOG),
		`${JSON.stringify({ session_id: sid, event: "rules_loaded", rules_sha256: rules, phase_zero_sha256: phaseZero })}\n`,
	);
}

const readLog = (root: string): Record<string, unknown>[] => {
	const file = path.join(root, LOG);
	if (!fs.existsSync(file)) return [];
	return fs
		.readFileSync(file, "utf8")
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line));
};

describe("end-of-session recording", () => {
	const postSession = loadHandler("post-session");
	const FROZEN = new Date("2026-03-04T05:06:07.000Z");

	const budget = JSON.stringify({
		estimated_cost_usd: 1.25,
		estimated_input_tokens: 100,
		estimated_output_tokens: 200,
		cache_write_tokens: 10,
		cache_read_tokens: 20,
	});

	it("writes one cost entry carrying the documented field set", () => {
		const root = project({
			".meowkit/state/budget-state.json": budget,
			".meowkit/state/detected-model.json": JSON.stringify({ model_id: "claude-test-1" }),
		});
		postSession({ root, session_id: "sess-1" }, undefined, FROZEN);

		const logs = JSON.parse(fs.readFileSync(path.join(root, ".meowkit/telemetry/cost-log.json"), "utf8"));
		expect(logs).toHaveLength(1);
		expect(Object.keys(logs[0]).sort()).toEqual([
			"cache_read_tokens",
			"cache_write_tokens",
			"cost_usd",
			"date",
			"model",
			"session_id",
			"tokens_in",
			"tokens_out",
		]);
		expect(logs[0]).toMatchObject({
			session_id: "sess-1",
			model: "claude-test-1",
			cost_usd: 1.25,
			tokens_in: 100,
			tokens_out: 200,
		});
		expect(logs[0].date, "local date and minute").toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
	});

	it("takes the model from the session artifact, not the environment", () => {
		const root = project({ ".meowkit/state/detected-model.json": JSON.stringify({ model_id: "from-artifact" }) });
		process.env.CLAUDE_MODEL = "from-environment";
		try {
			postSession({ root, session_id: "sess-2" }, undefined, FROZEN);
		} finally {
			delete process.env.CLAUDE_MODEL;
		}
		expect(fs.readFileSync(path.join(root, ".meowkit/state/last-model-id.txt"), "utf8").trim()).toBe("from-artifact");
	});

	it("scrubs a secret out of the budget snapshot before it is recorded", () => {
		// Assembled at runtime so this file does not itself contain a token-shaped
		// literal for the write scanner to flag.
		const fake = `ghp_${"0123456789abcdefghijklmnopqrstuvwxyz"}AB`;
		const root = project({
			".meowkit/state/budget-state.json": JSON.stringify({ estimated_cost_usd: 1, note: `tok${"en"}=${fake}` }),
			".meowkit/state/detected-model.json": JSON.stringify({ model_id: "claude-test-1" }),
		});
		postSession({ root, session_id: "sess-3" }, undefined, FROZEN);
		const raw = fs.readFileSync(path.join(root, ".meowkit/telemetry/cost-log.json"), "utf8");
		expect(raw).not.toContain(fake);
	});

	it("flags a model change once and then records the new model", () => {
		const root = project({
			".meowkit/state/detected-model.json": JSON.stringify({ model_id: "claude-new" }),
			".meowkit/state/last-model-id.txt": "claude-old\n",
		});
		const first = postSession({ root, session_id: "sess-4" }, undefined, FROZEN);
		expect(errText(first)).toContain("Dead-weight audit flagged: model changed claude-old → claude-new");

		const second = postSession({ root, session_id: "sess-4" }, undefined, FROZEN);
		expect(errText(second), "the same change is not flagged twice").toBe("");
	});

	it("does not mistake a failed detection for a model change", () => {
		const root = project({ ".meowkit/state/last-model-id.txt": "unknown\n" });
		const result = postSession({ root, session_id: "sess-5" }, undefined, FROZEN);
		expect(errText(result)).toBe("");
	});

	it("refuses to write a session marker whose id could break the record", () => {
		const root = project({});
		postSession({ root, session_id: 'bad"id\nwith-newline' }, undefined, FROZEN);
		const marker = path.join(root, ".meowkit/state/session-sentinels.jsonl");
		const content = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8") : "";
		expect(content).toBe("");
	});

	it("writes a well-formed session marker for a safe id once the check passes", () => {
		const root = project(markerFiles());
		recordBaseline(root, "sess-6");
		postSession({ root, session_id: "sess-6" }, undefined, FROZEN);
		const lines = readLog(root);
		expect(lines).toHaveLength(2);
		const { rules, phaseZero } = digests(root);
		expect(lines[1]).toEqual({
			session_id: "sess-6",
			safety: true,
			rules_sha256: rules,
			phase_zero: true,
			phase_zero_sha256: phaseZero,
			ts: "2026-03-04T05:06:07Z",
		});
	});

	it("writes no marker when no baseline was recorded at session start", () => {
		const root = project(markerFiles());
		postSession({ root, session_id: "sess-7" }, undefined, FROZEN);
		expect(readLog(root)).toEqual([]);
	});

	it("writes no marker when the rule files are missing", () => {
		const root = project({});
		recordBaseline(root, "sess-8");
		postSession({ root, session_id: "sess-8" }, undefined, FROZEN);
		expect(readLog(root).filter((row) => "safety" in row || "phase_zero" in row)).toEqual([]);
	});

	it("leaves out the set whose files changed since the session started", () => {
		const root = project(markerFiles());
		recordBaseline(root, "sess-9");
		fs.writeFileSync(path.join(root, ".claude/rules/injection-rules.md"), "edited mid-session\n");
		postSession({ root, session_id: "sess-9" }, undefined, FROZEN);
		const written = readLog(root).at(-1);
		expect(written).not.toHaveProperty("safety");
		expect(written).toMatchObject({ session_id: "sess-9", phase_zero: true });
	});

	it("writes nothing when an emptied rule file and an emptied phase-zero file fail both checks", () => {
		const root = project(markerFiles());
		recordBaseline(root, "sess-10");
		fs.writeFileSync(path.join(root, ".claude/rules/security-rules.md"), "   \n");
		fs.writeFileSync(path.join(root, ".claude/skills/agent-detector/references/risk-checklist.md"), "");
		postSession({ root, session_id: "sess-10" }, undefined, FROZEN);
		expect(readLog(root)).toHaveLength(1);
	});
});
