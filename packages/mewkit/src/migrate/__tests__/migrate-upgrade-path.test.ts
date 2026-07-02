// Upgrade path: when a NEW toolkit version changes its conversion output, a
// re-run over a target produced by the OLD version must classify the change as
// "we changed our conversion" (update) — not as a user conflict — because the
// 3-way checksum shows the target still matches what the registry recorded.
//
// The old-version state is simulated by rewriting an installed target file and
// its registry targetChecksum consistently (as if an older converter wrote it).

import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupMigrateE2e, type MigrateE2eEnv } from "./helpers/migrate-e2e-harness.js";

let env: MigrateE2eEnv;

function checksum(content: string): string {
	return createHash("sha256").update(content, "utf-8").digest("hex");
}

beforeAll(async () => {
	env = await setupMigrateE2e("target-upgrade-e2e");
	expect(await env.run({})).toBe(0);
}, 60_000);

afterAll(async () => {
	await env.cleanup();
});

describe("upgrade path — conversion-output changes reconcile without conflicts", () => {
	it("re-converts a target written by a previous version instead of flagging a conflict", async () => {
		const registryPath = join(env.tempHome, ".mewkit", "portable-registry.json");
		const skillPath = join(env.projectDir, ".agents", "skills", "source-command-mk-fix", "SKILL.md");
		const currentOutput = readFileSync(skillPath, "utf-8");

		// Simulate the previous version's (different) converter output, with the
		// registry recording exactly that output — i.e. the user never edited it.
		const previousOutput = currentOutput.replace("# Command template:", "# Ported command:");
		await writeFile(skillPath, previousOutput, "utf-8");
		const registry = JSON.parse(await readFile(registryPath, "utf-8")) as {
			installations: Array<{ item: string; type: string; sourceChecksum: string; targetChecksum: string }>;
		};
		const entry = registry.installations.find((i) => i.item === "mk/fix" && i.type === "command");
		expect(entry).toBeDefined();
		if (entry) {
			// The registry records the CONVERTED output checksum as sourceChecksum;
			// an older toolkit version would have recorded its own (different) output.
			entry.sourceChecksum = checksum(previousOutput);
			entry.targetChecksum = checksum(previousOutput);
		}
		await writeFile(registryPath, JSON.stringify(registry, null, 2), "utf-8");

		// Re-run WITHOUT --force: the reconciler must treat this as a clean
		// update (source unchanged, target unedited by the user) and restore the
		// current conversion output.
		expect(await env.run({})).toBe(0);
		expect(readFileSync(skillPath, "utf-8")).toBe(currentOutput);
	});
});
