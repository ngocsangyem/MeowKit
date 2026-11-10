// Round-trip tests for .claude/hooks/lib/approval-receipt.cjs — the single home for the
// Gate 1 approval receipt (the SAME helper the shell gate verifies with). Asserts the
// exit-code contract the gate depends on: 0 fresh · 10 no-receipt · 11 stale, plus the
// load-bearing property that the body hash EXCLUDES frontmatter (so the stamp cannot
// invalidate itself, while an edit to the plan body does).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const HELPER = path.resolve(process.cwd(), ".claude/hooks/lib/approval-receipt.cjs");

let tmp: string | null = null;
afterEach(() => {
	if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
	tmp = null;
});

function makePlan(body = "# Demo\n\nScope body line.\n", extraFm = ""): string {
	tmp = fs.mkdtempSync(path.join(os.tmpdir(), "receipt-"));
	const p = path.join(tmp, "plan.md");
	fs.writeFileSync(p, `---\ntitle: "Demo"\nstatus: pending\n${extraFm}---\n\n${body}`);
	return p;
}

/**
 * The receipt helper is a library, not a CLI, so it is driven as one in a child
 * process: the same module the gate requires, with its result surfaced as the
 * exit code and the status line the subcommands used to print.
 */
function run(sub: string, file: string, approver?: string) {
	const driver = [
		`const lib = require(${JSON.stringify(HELPER)});`,
		`const r = lib[${JSON.stringify(sub)}](process.argv[1], process.argv[2] || undefined);`,
		'process.stdout.write(String(r.status) + "\\n");',
		'process.exit(r.code);',
	].join("\n");
	const r = spawnSync(process.execPath, ["-e", driver, file, approver ?? ""], { encoding: "utf8" });
	return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("approval-receipt.cjs", () => {
	it("verify on an unstamped plan reports no-receipt (exit 10)", () => {
		const p = makePlan();
		const r = run("verify", p);
		expect(r.status).toBe(10);
		expect(r.stdout).toMatch(/no-receipt/);
	});

	it("stamp then verify is fresh (exit 0) and writes a single approval block", () => {
		const p = makePlan();
		expect(run("stamp", p, "sang@example.com").status).toBe(0);
		expect(run("verify", p).status).toBe(0);
		const text = fs.readFileSync(p, "utf8");
		expect((text.match(/^approval:$/gm) ?? []).length).toBe(1);
		expect(text).toMatch(/approved_by: sang@example\.com/);
		expect(text).toMatch(/plan_hash: [0-9a-f]{64}/);
	});

	it("editing the plan BODY invalidates the receipt (stale, exit 11)", () => {
		const p = makePlan();
		run("stamp", p);
		fs.appendFileSync(p, "\nNew scope added after approval.\n");
		expect(run("verify", p).status).toBe(11);
	});

	it("editing NON-body frontmatter does NOT invalidate the receipt (body-hash excludes frontmatter)", () => {
		const p = makePlan();
		run("stamp", p);
		// Flip a frontmatter field that is not the body — must stay fresh.
		const text = fs.readFileSync(p, "utf8").replace("status: pending", "status: in-progress");
		fs.writeFileSync(p, text);
		expect(run("verify", p).status).toBe(0);
	});

	it("re-stamping is idempotent — never duplicates the approval block", () => {
		const p = makePlan();
		run("stamp", p);
		run("stamp", p);
		const text = fs.readFileSync(p, "utf8");
		expect((text.match(/^approval:$/gm) ?? []).length).toBe(1);
	});

	it("hash is deterministic for identical bodies and differs when the body changes", () => {
		const p = makePlan();
		const h1 = run("hash", p).stdout.trim();
		const h2 = run("hash", p).stdout.trim();
		expect(h1).toBe(h2);
		expect(h1).toMatch(/^[0-9a-f]{64}$/);
		fs.appendFileSync(p, "changed\n");
		expect(run("hash", p).stdout.trim()).not.toBe(h1);
	});
});
