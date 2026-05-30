import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The portable registry lives at homedir()/.mewkit/. Stub HOME to a temp dir and
// re-import the module so REGISTRY_PATH (evaluated at import time) points there —
// the real user registry is never touched.
let tmpHome: string;

beforeEach(async () => {
	tmpHome = await mkdtemp(join(tmpdir(), "mewkit-reg-home-"));
	vi.stubEnv("HOME", tmpHome);
	vi.resetModules();
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(tmpHome, { recursive: true, force: true });
});

describe("portable registry installed-metadata back-ref", () => {
	it("round-trips optional back-ref fields", async () => {
		const mod = await import("../reconcile/portable-registry.js");
		await mod.addPortableInstallation("foo", "skill", "codex", false, "/t/foo", "/s/foo", {
			sourceChecksum: "a",
			targetChecksum: "b",
			installedVersion: "2.9.20",
			installedChecksum: "deadbeef",
		});
		const reg = await mod.readPortableRegistry();
		const entry = reg.installations.find((i) => i.item === "foo");
		expect(entry?.installedVersion).toBe("2.9.20");
		expect(entry?.installedChecksum).toBe("deadbeef");
	});

	it("omits the back-ref fields when they are not provided", async () => {
		const mod = await import("../reconcile/portable-registry.js");
		await mod.addPortableInstallation("bar", "skill", "codex", false, "/t/bar", "/s/bar", {
			sourceChecksum: "a",
			targetChecksum: "b",
		});
		const reg = await mod.readPortableRegistry();
		const entry = reg.installations.find((i) => i.item === "bar");
		expect(entry?.installedVersion).toBeUndefined();
		expect(entry?.installedChecksum).toBeUndefined();
	});

	it("loads a legacy registry written before the back-ref fields existed", async () => {
		const dir = join(tmpHome, ".mewkit");
		await mkdir(dir, { recursive: true });
		const legacy = {
			version: "3.0",
			installations: [
				{
					item: "old",
					type: "skill",
					provider: "codex",
					global: false,
					path: "/t/old",
					installedAt: "t",
					sourcePath: "/s/old",
					sourceChecksum: "a",
					targetChecksum: "b",
					installSource: "kit",
				},
			],
		};
		await writeFile(join(dir, "portable-registry.json"), JSON.stringify(legacy), "utf-8");

		const mod = await import("../reconcile/portable-registry.js");
		const reg = await mod.readPortableRegistry();
		expect(reg.installations[0]?.item).toBe("old");
		expect(reg.installations[0]?.installedVersion).toBeUndefined();
	});
});
