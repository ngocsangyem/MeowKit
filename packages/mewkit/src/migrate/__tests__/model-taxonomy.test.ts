import { describe, expect, it } from "vitest";
import { listModelProfiles, providerSupportsProfile, resolveModel } from "../model-taxonomy.js";

// The migrate model-override mechanism was removed (author-first): the taxonomy now
// resolves named profiles and validates source tiers only. Target model ids are
// provider/deployment-specific, so a known tier resolves to "inherit default", never
// to a fabricated id.

describe("resolveModel — named profiles", () => {
	it("resolves a native profile to its verified identifier", () => {
		const result = resolveModel("fable", "claude-code");
		expect(result.resolved).toEqual({ model: "claude-fable-5" });
		expect(result.warning).toBeUndefined();
	});

	it("discloses inherit-default for a profile the provider does not support natively", () => {
		const result = resolveModel("fable", "codex");
		expect(result.resolved).toBeNull();
		expect(result.warning).toContain("not available on codex");
		expect(result.warning).toContain("inherits its own configured default");
	});
});

describe("resolveModel — source tiers", () => {
	it("returns inherit-default (no fabricated id) for a known tier", () => {
		const result = resolveModel("opus", "codex");
		expect(result.resolved).toBeNull();
		expect(result.warning).toContain('source tier "opus"');
		expect(result.warning).not.toMatch(/^Unknown model/);
	});

	it("flags an unknown model so the conformance checker can reject it", () => {
		const result = resolveModel("totally-made-up", "claude-code");
		expect(result.resolved).toBeNull();
		expect(result.warning).toMatch(/^Unknown model/);
	});

	it("treats inherit / empty as no-op (no warning)", () => {
		expect(resolveModel("inherit", "codex")).toEqual({ resolved: null });
		expect(resolveModel(undefined, "codex")).toEqual({ resolved: null });
	});
});

describe("profile introspection", () => {
	it("reports native support per provider", () => {
		expect(providerSupportsProfile("fable", "claude-code")).toBe(true);
		expect(providerSupportsProfile("fable", "codex")).toBe(false);
	});

	it("lists the registered profiles", () => {
		expect(listModelProfiles().map((p) => p.name)).toContain("fable");
	});
});
