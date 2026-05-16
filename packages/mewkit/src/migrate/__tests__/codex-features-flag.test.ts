import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureCodexHooksFeatureFlag } from "../hooks/codex-features-flag.js";

describe("codex features flag", () => {
	it("writes the canonical hooks feature flag", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-codex-hooks-"));
		const configPath = join(root, ".codex", "config.toml");

		const result = await ensureCodexHooksFeatureFlag(configPath, false);

		expect(result.status).toBe("written");
		const content = await readFile(configPath, "utf-8");
		expect(content).toContain("[features]");
		expect(content).toContain("hooks = true");
		expect(content).not.toContain("codex_hooks = true");
	});

	it("migrates deprecated codex_hooks to hooks", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-codex-hooks-"));
		const configPath = join(root, ".codex", "config.toml");
		await mkdir(join(root, ".codex"), { recursive: true });
		await writeFile(configPath, "[features]\ncodex_hooks = false\n", "utf-8");

		const result = await ensureCodexHooksFeatureFlag(configPath, false);

		expect(result.status).toBe("updated");
		const content = await readFile(configPath, "utf-8");
		expect(content).toContain("[features]");
		expect(content).toContain("hooks = true");
		expect(content).not.toContain("codex_hooks");
	});
});
