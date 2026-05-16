import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../reconcile/portable-registry.js", () => ({
	addPortableInstallation: vi.fn(async () => undefined),
	removePortableInstallation: vi.fn(async () => undefined),
}));

import { installCodexAgents } from "../hooks/codex-toml-installer.js";
import { providers } from "../provider-registry.js";
import type { PortableItem } from "../types.js";

const originalCodexAgents = structuredClone(providers.codex.agents);

afterEach(() => {
	providers.codex.agents = structuredClone(originalCodexAgents);
});

function makeAgent(name: string): PortableItem {
	return {
		name,
		description: `${name} description`,
		type: "agent",
		sourcePath: `.claude/agents/${name}.md`,
		frontmatter: {
			name,
			description: `${name} description`,
		},
		body: `You are ${name}.`,
	};
}

describe("codex toml installer", () => {
	it("only writes config entries for agents that were selected for install", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-codex-agents-"));
		const codexRoot = join(root, ".codex");
		const agentsDir = join(codexRoot, "agents");

		providers.codex.agents = {
			...providers.codex.agents!,
			projectPath: agentsDir,
			globalPath: agentsDir,
		};

		const analyst = makeAgent("analyst");
		const architect = makeAgent("architect");
		const result = await installCodexAgents([analyst], {
			global: false,
			configAgents: [analyst],
		});

		expect(result.success).toBe(true);
		const configToml = await readFile(join(codexRoot, "config.toml"), "utf-8");
		expect(configToml).toContain("[agents.analyst]");
		expect(configToml).not.toContain("[agents.architect]");
		expect(configToml).toContain('config_file = "agents/analyst.toml"');
		expect(configToml).not.toContain("architect.toml");
	});
});
