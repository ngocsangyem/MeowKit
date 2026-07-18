// Meta-test for `doctor --hard-gates`. Doubles as an end-to-end check of Phases 1+2:
// against the repo's real (fixed) harness every probe must PASS (the contract probe is a
// documented WARN, never FAIL); against a deliberately broken fixture the runtime probe
// must FAIL. Cross-platform deterministic: the broken hook uses a syntax error rejected
// by both bash and dash (not a dash-only bashism, which macOS /bin/sh=bash would mask).
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkHardGates } from "../doctor-hard-gates.js";

const REPO_ROOT = path.resolve(process.cwd());

let fixtureDir: string | null = null;
afterEach(() => {
	if (fixtureDir) fs.rmSync(fixtureDir, { recursive: true, force: true });
	fixtureDir = null;
});

describe("doctor --hard-gates", () => {
	it("reports no FAIL against the repo's real (fixed) harness", async () => {
		const results = await checkHardGates(REPO_ROOT);
		const fails = results.filter((r) => r.status === "fail");
		expect(fails, `unexpected FAIL probes: ${fails.map((f) => `${f.name} — ${f.detail}`).join("; ")}`).toEqual([]);
		// Sanity: the key gate probes are actually present and PASS.
		const byName = (n: string) => results.find((r) => r.name.startsWith(n));
		expect(byName("Gate 1: blocks source write with no plan")?.status).toBe("pass");
		expect(byName("Gate 1: allows source write once the plan is approved")?.status).toBe("pass");
		expect(byName("Privacy: blocks .env read")?.status).toBe("pass");
		expect(byName("Runtime: every configured shell hook")?.status).toBe("pass");
		// This probe scaffolds a throwaway project and spawns many real hooks (now incl. an
		// approval-receipt stamp), so it legitimately exceeds the 5s default on cold runs.
	}, 30000);

	it("reports a FAIL for the runtime probe against a broken hook fixture", async () => {
		fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "mewkit-hg-fixture-"));
		const hooksDir = path.join(fixtureDir, ".claude", "hooks");
		fs.mkdirSync(hooksDir, { recursive: true });
		// `fi` with no opening `if` is a syntax error in BOTH bash and dash → deterministic.
		fs.writeFileSync(path.join(hooksDir, "bad.sh"), "#!/bin/sh\nfi\n");
		fs.writeFileSync(
			path.join(fixtureDir, ".claude", "settings.json"),
			JSON.stringify({
				hooks: {
					SessionStart: [{ hooks: [{ type: "command", command: 'sh "$CLAUDE_PROJECT_DIR/.claude/hooks/bad.sh"' }] }],
				},
			}),
		);

		const results = await checkHardGates(fixtureDir);
		const runtime = results.find((r) => r.name.startsWith("Runtime: every configured shell hook"));
		expect(runtime?.status).toBe("fail");
		expect(runtime?.detail).toContain("bad.sh");
	}, 30000);
});
