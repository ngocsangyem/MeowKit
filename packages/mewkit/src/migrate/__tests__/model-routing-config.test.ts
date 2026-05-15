import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { convertFmToCodexToml } from "../converters/fm-to-codex-toml.js";
import { loadModelRoutingConfig } from "../model-routing-config.js";
import { resolveModel, setTaxonomyOverrides } from "../model-taxonomy.js";
import type { PortableItem } from "../types.js";

afterEach(() => {
	setTaxonomyOverrides(undefined);
});

describe("model routing config", () => {
	it("loads provider tier models from .meowkit.config.json", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-model-routing-"));
		await writeFile(
			join(root, ".meowkit.config.json"),
			JSON.stringify({
				modelRouting: {
					providers: {
						codex: {
							tiers: {
								heavy: { model: "codex-heavy", reasoningEffort: "xhigh" },
								balanced: { model: "codex-balanced", reasoningEffort: "high" },
								light: { model: "codex-light", reasoningEffort: "medium" },
							},
						},
					},
				},
			}),
		);

		const loaded = await loadModelRoutingConfig(root);

		expect(loaded.path).toBe(join(root, ".meowkit.config.json"));
		expect(loaded.warnings).toEqual([]);
		expect(resolveModel("opus", "codex").resolved).toEqual({ model: "codex-heavy", effort: "xhigh" });
		expect(resolveModel("sonnet", "codex").resolved).toEqual({ model: "codex-balanced", effort: "high" });
		expect(resolveModel("haiku", "codex").resolved).toEqual({ model: "codex-light", effort: "medium" });
	});

	it("does not invent target models when config is missing", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-no-model-routing-"));
		await loadModelRoutingConfig(root);

		const resolved = resolveModel("sonnet", "codex");

		expect(resolved.resolved).toBeNull();
		expect(resolved.warning).toContain("No configured codex model");
	});

	it("writes documented Codex custom-agent fields and configured model effort", async () => {
		setTaxonomyOverrides({
			codex: {
				heavy: { model: "codex-heavy", effort: "xhigh" },
			},
		});
		const item: PortableItem = {
			name: "architect",
			displayName: "Architect",
			description: "Designs systems",
			type: "agent",
			sourcePath: "/tmp/architect.md",
			frontmatter: { model: "opus", tools: "Read, Edit" },
			body: "Plan the system.",
		};

		const result = convertFmToCodexToml(item);

		expect(result.content).toContain('name = "Architect"');
		expect(result.content).toContain('description = "Designs systems"');
		expect(result.content).toContain('model = "codex-heavy"');
		expect(result.content).toContain('model_reasoning_effort = "xhigh"');
		expect(result.content).toContain('developer_instructions = """');
	});
});
