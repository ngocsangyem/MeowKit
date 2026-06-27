import { describe, expect, it } from "vitest";
import {
	buildClaudeMarketplaceJson,
	buildClaudePluginJson,
	buildCodexMarketplaceJson,
	buildCodexPluginJson,
	ClaudeMarketplaceJsonSchema,
	ClaudePluginJsonSchema,
	CodexMarketplaceJsonSchema,
	CodexPluginJsonSchema,
	PLUGIN_NAME,
} from "../plugin-manifest.js";

const ID = {
	version: "2.12.0",
	description: "MeowKit harness",
	author: { name: "ngocsangyem", email: "nnsang24@gmail.com" },
};

describe("Claude manifests", () => {
	it("builds a schema-valid plugin.json named mk with the release version", () => {
		const json = buildClaudePluginJson(ID);
		expect(json.name).toBe(PLUGIN_NAME);
		expect(json.version).toBe("2.12.0");
		expect(ClaudePluginJsonSchema.parse(json)).toBeTruthy();
	});

	it("builds a schema-valid marketplace.json with one mk plugin entry", () => {
		const json = buildClaudeMarketplaceJson({
			...ID,
			marketplaceName: "meowkit",
			owner: { name: "ngocsangyem" },
			source: "./",
		});
		expect(json.plugins[0].name).toBe(PLUGIN_NAME);
		expect(json.plugins[0].source).toBe("./");
		expect(ClaudeMarketplaceJsonSchema.parse(json)).toBeTruthy();
	});
});

describe("Codex manifests", () => {
	it("builds a schema-valid codex plugin.json with a string skills path and interface block", () => {
		const json = buildCodexPluginJson({ ...ID, displayName: "MeowKit" });
		expect(json.name).toBe(PLUGIN_NAME);
		expect(json.skills).toBe("./skills/");
		expect(json.interface.displayName).toBe("MeowKit");
		expect(CodexPluginJsonSchema.parse(json)).toBeTruthy();
	});

	it("builds a schema-valid codex marketplace.json with a local source object", () => {
		const json = buildCodexMarketplaceJson({
			marketplaceName: "meowkit",
			sourcePath: "./plugins/mk",
		});
		expect(json.plugins[0].source.source).toBe("local");
		expect(json.plugins[0].source.path).toBe("./plugins/mk");
		expect(CodexMarketplaceJsonSchema.parse(json)).toBeTruthy();
	});
});

describe("version is the single source of truth", () => {
	it("propagates one version into every manifest", () => {
		const v = "9.9.9-beta.1";
		expect(buildClaudePluginJson({ ...ID, version: v }).version).toBe(v);
		expect(buildCodexPluginJson({ ...ID, version: v }).version).toBe(v);
	});
});
