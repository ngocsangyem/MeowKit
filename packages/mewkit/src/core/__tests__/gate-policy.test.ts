import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readGatePolicy, writeGatePolicy } from "../gate-policy.js";

let dir: string | null = null;

function tempClaude(): string {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), "mewkit-policy-"));
	const claude = path.join(dir, ".claude");
	fs.mkdirSync(claude);
	return claude;
}

afterEach(() => {
	if (dir) fs.rmSync(dir, { recursive: true, force: true });
	dir = null;
});

describe("gate policy", () => {
	it("defaults to balanced when no policy file exists", () => {
		expect(readGatePolicy(tempClaude()).policy.profile).toBe("balanced");
	});

	it("writes and reads a policy atomically", () => {
		const claude = tempClaude();
		writeGatePolicy(claude, "strict");
		expect(readGatePolicy(claude).policy.requireApprovedPlan).toBe(true);
	});

	it("fails safe as strict on malformed policy", () => {
		const claude = tempClaude();
		fs.writeFileSync(path.join(claude, "policy.json"), "{", "utf-8");
		const result = readGatePolicy(claude);
		expect(result.policy.profile).toBe("strict");
		expect(result.error).toMatch(/failing safe/);
	});
});
