import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkCodexHookTrust } from "../doctor-codex-hook-trust.js";

let dir: string | null = null;
afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
	dir = null;
});

function makeTarget(hooksContent: string): string {
	dir = mkdtempSync(join(tmpdir(), "codex-doctor-"));
	mkdirSync(join(dir, ".codex"), { recursive: true });
	writeFileSync(join(dir, ".codex", "hooks.json"), hooksContent);
	return dir;
}

describe("checkCodexHookTrust", () => {
	it("reports each configured hook with HONEST trust states (never fabricates enforcement/execution)", () => {
		const d = makeTarget(
			JSON.stringify({
				hooks: {
					PreToolUse: [
						{ matcher: "Bash", hooks: [{ command: 'node ".codex/hooks/privacy-block.cjs"' }] },
						{ matcher: "apply_patch|Edit|Write", hooks: [{ command: 'node ".codex/hooks/gate-enforcement.cjs"' }] },
					],
					UserPromptSubmit: [{ hooks: [{ command: 'node ".codex/hooks/capture.cjs"' }] }],
				},
			}),
		);
		const rs = checkCodexHookTrust(d);
		expect(rs).toHaveLength(3);
		expect(rs.map((r) => r.name).join(" ")).toContain("privacy-block.cjs");
		for (const r of rs) {
			expect(r.status).toBe("pass"); // configured, not a failure
			expect(r.detail).toContain("configured=yes");
			expect(r.detail).toContain("trusted=unverified");
			expect(r.detail).toContain("executed=not-observed");
			expect(r.detail).toContain("enforced=no");
			// The whole point of red-team 7.1: never claim runtime enforcement/observation.
			expect(r.detail).not.toMatch(/enforced=yes|executed=(yes|observed)/);
		}
	});

	it("resolves the hook label from commandWindows when command is absent", () => {
		const d = makeTarget(
			JSON.stringify({
				hooks: {
					PreToolUse: [
						{ matcher: "Bash", hooks: [{ commandWindows: "node -e require('...codex/hooks/privacy-block.cjs')" }] },
					],
				},
			}),
		);
		const rs = checkCodexHookTrust(d);
		expect(rs).toHaveLength(1);
		expect(rs[0].name).toContain("privacy-block.cjs");
	});

	it("returns nothing when the target has no hooks.json", () => {
		dir = mkdtempSync(join(tmpdir(), "codex-doctor-"));
		expect(checkCodexHookTrust(dir)).toEqual([]);
	});

	it("reports a hooks.json parse error as a FAIL (never a silent pass)", () => {
		const d = makeTarget("{ this is : not valid json");
		const rs = checkCodexHookTrust(d);
		expect(rs).toHaveLength(1);
		expect(rs[0].status).toBe("fail");
	});
});
