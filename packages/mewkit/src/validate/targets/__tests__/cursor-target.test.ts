// `mewkit validate --target cursor <dir>`. This phase's authored bundle is a minimal
// skeleton (AGENTS.md + `.meowkit/README.md`), so the target profile's checks are narrow —
// richer structural checks (native agents, hooks, rules, skills) land alongside that content
// in later phases, mirroring how codex-target.test.ts grew with the codex bundle.
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cursorTargetProfile } from "../cursor-target.js";
import { meowkitStatePaths } from "../../../state/meowkit-state-paths.js";
import type { CheckResult } from "../../../commands/validate.js";

let dir: string | null = null;
afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
	dir = null;
});

/** Write a minimal, VALID authored Cursor target and return its root. */
function makeTarget(): string {
	dir = mkdtempSync(join(tmpdir(), "cursor-target-"));
	writeFileSync(join(dir, "AGENTS.md"), "# AGENTS.md\n");
	mkdirSync(join(dir, ".meowkit", "state"), { recursive: true });
	writeFileSync(join(dir, ".meowkit", "README.md"), "# .meowkit/\n");
	writeFileSync(meowkitStatePaths(join(dir, ".meowkit")).cursorLedger, '{"version":"3.0","installations":[]}\n');
	return dir;
}

const anyFail = (rs: CheckResult[]): boolean => rs.some((r) => r.status === "fail");

describe("cursor target validation", () => {
	it("a valid generated target passes every check (no FAIL)", async () => {
		const rs = await cursorTargetProfile.check(makeTarget());
		expect(
			anyFail(rs),
			rs
				.filter((r) => r.status === "fail")
				.map((r) => `${r.name}: ${r.detail}`)
				.join("; "),
		).toBe(false);
	});

	it("detects an authored install via the cursor ledger marker (not AGENTS.md alone)", () => {
		const target = makeTarget();
		expect(cursorTargetProfile.detect(target)).toBe(true);
	});

	it("does NOT detect a target with only a root AGENTS.md and no cursor ledger (e.g. a codex install)", () => {
		const target = mkdtempSync(join(tmpdir(), "cursor-target-no-ledger-"));
		try {
			writeFileSync(join(target, "AGENTS.md"), "# AGENTS.md\n");
			expect(cursorTargetProfile.detect(target)).toBe(false);
		} finally {
			rmSync(target, { recursive: true, force: true });
		}
	});

	it("fails when AGENTS.md is missing", async () => {
		const target = makeTarget();
		rmSync(join(target, "AGENTS.md"));
		const rs = await cursorTargetProfile.check(target);
		expect(rs.find((r) => r.name === "Cursor AGENTS.md present")?.status).toBe("fail");
	});

	it("fails when .meowkit/README.md is missing", async () => {
		const target = makeTarget();
		rmSync(join(target, ".meowkit", "README.md"));
		const rs = await cursorTargetProfile.check(target);
		expect(rs.find((r) => r.name === "Cursor .meowkit/README.md present")?.status).toBe("fail");
	});

	it("fails when the reconciliation ledger is missing", async () => {
		const target = makeTarget();
		rmSync(meowkitStatePaths(join(target, ".meowkit")).cursorLedger);
		const rs = await cursorTargetProfile.check(target);
		expect(rs.find((r) => r.name === "Cursor reconciliation ledger present")?.status).toBe("fail");
	});
});
