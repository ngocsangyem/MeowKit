// Guards: gate-LOGIC (plan present/absent → allow/block) AND parser-RUNTIME (the hook
// is replayed through the interpreter settings.json configures, with JSON on stdin, so
// a dash here-string regression would surface here too). Asserts the EXACT contract
// {marker on stderr, exit 2} — a `status !== 0` check could not tell a real hard block
// from a shell crash, nor catch a regression back to advisory exit 1.
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runConfiguredHook } from "../../../packages/mewkit/src/core/hook-runner.js";
import { scaffold, SETTINGS, type HarnessProject } from "./_scaffold.js";

let project: HarnessProject | null = null;
afterEach(() => {
	project?.cleanup();
	project = null;
});

function runGate(filePath: string, extraEnv?: Record<string, string>) {
	const results = runConfiguredHook(SETTINGS, {
		projectDir: project!.dir,
		event: "PreToolUse",
		tool: "Write",
		toolName: "Write",
		toolInput: { file_path: filePath },
		only: "gate-enforcement.sh",
		extraEnv,
	});
	const gate = results.find((r) => r.script === "gate-enforcement.sh");
	expect(gate, "gate-enforcement.sh was not configured/run for PreToolUse Write").toBeDefined();
	return gate!;
}

describe("gate-enforcement (configured-hook integration)", () => {
	it("missing plan → source write hard-blocks (@@GATE_BLOCK@@ on stderr, exit 2)", () => {
		project = scaffold(); // empty tasks/plans
		const r = runGate("src/app.ts");
		expect(r.status).toBe(2);
		expect(r.stderr).toContain("@@GATE_BLOCK@@");
		expect(r.stdout).not.toContain("@@GATE_BLOCK@@");
	});

	it("flat plan present → source write allowed (exit 0, no marker)", () => {
		project = scaffold();
		project.addPlan({ nested: false });
		const r = runGate("src/app.ts");
		expect(r.status).toBe(0);
		expect(r.stderr).not.toContain("@@GATE_BLOCK@@");
	});

	it("nested plan present → source write allowed (exit 0)", () => {
		project = scaffold();
		project.addPlan({ nested: true });
		const r = runGate("src/app.ts");
		expect(r.status).toBe(0);
	});

	it("a directory literally named plan.md does NOT false-pass (exit 2)", () => {
		project = scaffold();
		// Create tasks/plans/sub/plan.md as a DIRECTORY — a glob-only test would accept it.
		fs.mkdirSync(path.join(project.dir, "tasks", "plans", "sub", "plan.md"), { recursive: true });
		const r = runGate("src/app.ts");
		expect(r.status).toBe(2);
		expect(r.stderr).toContain("@@GATE_BLOCK@@");
	});

	it("writes to a plan file are never blocked (allow-list, exit 0)", () => {
		project = scaffold();
		const r = runGate("tasks/plans/x/plan.md");
		expect(r.status).toBe(0);
	});

	it("writes to a test file are never blocked (exit 0)", () => {
		project = scaffold();
		const r = runGate("src/app.test.ts");
		expect(r.status).toBe(0);
	});

	it("MEOWKIT_GATE1_REQUIRE_APPROVED=1 blocks a draft plan (exit 2)", () => {
		project = scaffold();
		project.addPlan({ nested: true, approved: false });
		const r = runGate("src/app.ts", { MEOWKIT_GATE1_REQUIRE_APPROVED: "1" });
		expect(r.status).toBe(2);
		expect(r.stderr).toContain("@@GATE_BLOCK@@");
	});

	it("MEOWKIT_GATE1_REQUIRE_APPROVED=1 allows an approved plan (exit 0)", () => {
		project = scaffold();
		project.addPlan({ nested: true, approved: true });
		const r = runGate("src/app.ts", { MEOWKIT_GATE1_REQUIRE_APPROVED: "1" });
		expect(r.status).toBe(0);
	});
});
