import { describe, expect, it } from "vitest";
import { buildProviders, disableUndocumentedSurfaces, type ProviderManifest } from "../providers/index.js";
import type { ProviderCapabilityRegistryEntry } from "../providers/contract-types.js";
import type { ProviderConfig } from "../providers/provider-config-types.js";

function makeConfig(name: string, overrides: Partial<ProviderConfig> = {}): ProviderConfig {
	const base: ProviderConfig = {
		name: name as ProviderConfig["name"],
		displayName: name,
		subagents: "none",
		agents: null,
		commands: null,
		skills: null,
		config: null,
		rules: null,
		hooks: null,
		settingsJsonPath: null,
		detect: async () => false,
	};
	return { ...base, ...overrides };
}

function makeContract(
	documented: Array<"agent" | "command" | "skill" | "config" | "rules" | "hooks">,
): ProviderCapabilityRegistryEntry {
	const surfaces: ProviderCapabilityRegistryEntry["surfaces"] = {};
	for (const s of documented) {
		surfaces[s] = { status: "documented", docs: ["https://example.test"] };
	}
	return {
		docs: ["https://example.test"],
		lastVerified: "2026-01-01",
		surfaces,
		capabilities: {} as ProviderCapabilityRegistryEntry["capabilities"],
	};
}

describe("binaryCache singleton identity", () => {
	it("binaryCache is the same Map instance across import paths", async () => {
		const { binaryCache: fromRegistry } = await import("../provider-registry.js");
		const { binaryCache: fromHelpers } = await import("../providers/detection-helpers.js");
		expect(Object.is(fromRegistry, fromHelpers)).toBe(true);
	});
});

describe("buildProviders composer", () => {
	it("returns an empty record when no manifests are supplied", () => {
		expect(buildProviders([])).toEqual({});
	});

	it("throws on duplicate manifest ids", () => {
		const dup: ProviderManifest = {
			id: "x",
			config: makeConfig("x"),
			contract: makeContract([]),
		};
		expect(() => buildProviders([dup, dup])).toThrowError(/duplicate provider manifest id/);
	});

	it("nulls undocumented portable-surface fields", () => {
		const cfg = makeConfig("y", {
			agents: {
				projectPath: "p",
				globalPath: "g",
				format: "direct-copy",
				writeStrategy: "per-file",
				fileExtension: ".md",
			},
		});
		const manifest: ProviderManifest = {
			id: "y",
			config: cfg,
			contract: makeContract([]),
		};
		const built = buildProviders([manifest]);
		expect(built.y!.agents).toBeNull();
	});

	it("applies the override callback BEFORE disabling undocumented surfaces (composer order)", () => {
		const sequence: string[] = [];
		const manifest: ProviderManifest = {
			id: "z",
			config: makeConfig("z", {
				agents: {
					projectPath: "before",
					globalPath: "before",
					format: "direct-copy",
					writeStrategy: "per-file",
					fileExtension: ".md",
				},
			}),
			contract: makeContract(["agent"]),
			overrides: (config) => {
				sequence.push("override");
				if (config.agents) config.agents.projectPath = "patched";
			},
		};
		// Intercept disable to record ordering relative to override.
		const built = buildProviders([
			{
				...manifest,
				contract: {
					...manifest.contract,
					get surfaces() {
						sequence.push("disable-read");
						return { agent: { status: "documented", docs: [] } };
					},
				} as ProviderCapabilityRegistryEntry,
			},
		]);
		expect(sequence[0]).toBe("override");
		expect(sequence.indexOf("override")).toBeLessThan(sequence.indexOf("disable-read"));
		expect(built.z!.agents?.projectPath).toBe("patched");
	});

	it("nulls an override patch that targets an undocumented surface (safety semantics)", () => {
		// Manifest declares NO documented surfaces; the override attempts to set
		// `agents.projectPath`. The disable loop must run AFTER and null `agents`,
		// proving overrides cannot escape the documentation filter.
		const manifest: ProviderManifest = {
			id: "guard",
			config: makeConfig("guard", {
				agents: {
					projectPath: "ignored",
					globalPath: null,
					format: "direct-copy",
					writeStrategy: "per-file",
					fileExtension: ".md",
				},
			}),
			contract: makeContract([]),
			overrides: (config) => {
				if (config.agents) config.agents.projectPath = "x";
			},
		};
		const built = buildProviders([manifest]);
		expect(built.guard!.agents).toBeNull();
	});

	it("disableUndocumentedSurfaces is idempotent", () => {
		const cfg = makeConfig("idem", {
			agents: {
				projectPath: "p",
				globalPath: "g",
				format: "direct-copy",
				writeStrategy: "per-file",
				fileExtension: ".md",
			},
		});
		disableUndocumentedSurfaces(cfg, makeContract([]));
		disableUndocumentedSurfaces(cfg, makeContract([]));
		expect(cfg.agents).toBeNull();
	});
});
