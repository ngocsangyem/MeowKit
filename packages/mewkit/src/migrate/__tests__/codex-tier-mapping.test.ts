import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	CODEX_TIER_INHERIT_NOTE,
	CODEX_TIER_REASONING_EFFORT,
	loadModelRoutingConfig,
} from "../model-routing-config.js";
import { resolveModel, setTaxonomyOverrides } from "../model-taxonomy.js";

afterEach(() => setTaxonomyOverrides(undefined));

describe("codex tier reasoning-effort mapping", () => {
	it("maps source tiers to documented model_reasoning_effort values", () => {
		expect(CODEX_TIER_REASONING_EFFORT.heavy).toBe("xhigh");
		expect(CODEX_TIER_REASONING_EFFORT.balanced).toBe("high");
		expect(CODEX_TIER_REASONING_EFFORT.light).toBe("medium");
		// Documented ladder only (Codex accepts minimal|low|medium|high|xhigh).
		for (const effort of Object.values(CODEX_TIER_REASONING_EFFORT)) {
			expect(["minimal", "low", "medium", "high", "xhigh"]).toContain(effort);
		}
	});

	it("fills the documented effort when a codex tier model omits reasoningEffort", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-codex-tier-"));
		await writeFile(
			join(root, ".meowkit.config.json"),
			JSON.stringify({
				modelRouting: {
					providers: {
						codex: {
							tiers: {
								// No effort supplied — documented per-tier effort is filled in.
								heavy: { model: "user-heavy" },
								balanced: { model: "user-balanced" },
								light: { model: "user-light" },
							},
						},
					},
				},
			}),
		);

		await loadModelRoutingConfig(root);

		// The "haiku -> inherit default" gap is now closed: a pinned model resolves
		// with the documented effort instead of "No configured codex model".
		expect(resolveModel("haiku", "codex").resolved).toEqual({ model: "user-light", effort: "medium" });
		expect(resolveModel("sonnet", "codex").resolved).toEqual({ model: "user-balanced", effort: "high" });
		expect(resolveModel("opus", "codex").resolved).toEqual({ model: "user-heavy", effort: "xhigh" });
	});

	it("does not override an explicitly configured effort", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-codex-tier-explicit-"));
		await writeFile(
			join(root, ".meowkit.config.json"),
			JSON.stringify({
				modelRouting: { providers: { codex: { tiers: { light: { model: "user-light", reasoningEffort: "low" } } } } },
			}),
		);

		await loadModelRoutingConfig(root);

		expect(resolveModel("haiku", "codex").resolved).toEqual({ model: "user-light", effort: "low" });
	});

	it("provides an explicit documented-inherit note for the no-config gap", () => {
		expect(CODEX_TIER_INHERIT_NOTE).toContain("inherits Codex's configured default model");
		expect(CODEX_TIER_INHERIT_NOTE).toContain("minimal|low|medium|high|xhigh");
	});
});
