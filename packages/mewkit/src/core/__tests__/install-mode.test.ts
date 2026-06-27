import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkInstallMode } from "../../commands/doctor-checks.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("checkInstallMode", () => {
	it("reports N/A when no MeowKit install is present", async () => {
		const dir = await mkdtemp(join(tmpdir(), "mk-mode-"));
		tempDirs.push(dir);
		const r = checkInstallMode(dir);
		expect(r.status).toBe("na");
	});

	it("detects a flat-copy install via .claude/metadata.json (not N/A)", async () => {
		const dir = await mkdtemp(join(tmpdir(), "mk-mode-"));
		tempDirs.push(dir);
		await mkdir(join(dir, ".claude"), { recursive: true });
		await writeFile(join(dir, ".claude", "metadata.json"), '{"version":"2.12.0"}');
		const r = checkInstallMode(dir);
		// pass (flat-copy) normally; warn only if the mk plugin is ALSO installed in
		// this environment. Either way it must not report "na".
		expect(r.status).not.toBe("na");
		expect(r.detail.toLowerCase()).toContain("flat-copy");
	});
});
