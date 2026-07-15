import { afterEach, describe, expect, it } from "vitest";
import {
	listModelProfiles,
	providerSupportsProfile,
	resolveModel,
	setTaxonomyOverrides,
} from "../model-taxonomy.js";

afterEach(() => setTaxonomyOverrides(undefined));

describe("named model profiles resolve on supported providers", () => {
	it("resolves `fable` to the verified runtime identifier on claude-code", () => {
		// The identifier is the whole point of the profile — a wrong string here is
		// a 404 at runtime, which is why it is verified rather than assumed.
		expect(resolveModel("fable", "claude-code")).toEqual({ resolved: { model: "claude-fable-5" } });
	});

	it("resolves without a warning on a supported provider", () => {
		expect(resolveModel("fable", "claude-code").warning).toBeUndefined();
	});

	it("needs no user override to resolve on a supported provider", () => {
		setTaxonomyOverrides(undefined);
		expect(resolveModel("fable", "claude-code").resolved?.model).toBe("claude-fable-5");
	});

	it("carries evidence for how the identifier was verified", () => {
		// A bare string with no provenance becomes archaeology at the first rename.
		for (const { name, profile } of listModelProfiles()) {
			expect(profile.evidence.length, `${name} needs evidence`).toBeGreaterThan(0);
		}
	});
});

describe("unsupported providers get a DISCLOSED fallback, never a silent one", () => {
	it("falls back to the configured heavy tier and says so", () => {
		setTaxonomyOverrides({ codex: { heavy: { model: "gpt-5-codex", effort: "xhigh" } } });
		const result = resolveModel("fable", "codex");

		expect(result.resolved).toEqual({ model: "gpt-5-codex", effort: "xhigh" });
		// The warning is the contract: a substitution nobody is told about is
		// indistinguishable from the model they asked for.
		expect(result.warning).toMatch(/not available on codex/);
		expect(result.warning).toMatch(/gpt-5-codex/);
		expect(result.warning).toMatch(/substitution, not an equivalent/);
	});

	it("never silently removes the model on an unsupported provider", () => {
		setTaxonomyOverrides({ codex: { heavy: { model: "gpt-5-codex" } } });
		const result = resolveModel("fable", "codex");
		expect(result.resolved).not.toBeNull();
		expect(result.warning).toBeTruthy();
	});

	it("warns actionably when the fallback tier is unconfigured", () => {
		setTaxonomyOverrides(undefined);
		const result = resolveModel("fable", "codex");
		expect(result.resolved).toBeNull();
		expect(result.warning).toMatch(/inherit its default/);
		expect(result.warning).toMatch(/modelRouting\.providers\.codex\.tiers\.heavy/);
	});

	it("reports support per provider", () => {
		expect(providerSupportsProfile("fable", "claude-code")).toBe(true);
		expect(providerSupportsProfile("fable", "codex")).toBe(false);
		expect(providerSupportsProfile("not-a-profile", "claude-code")).toBe(false);
	});
});

describe("the profile is tier-orthogonal", () => {
	it("does not become a tier — tier names still resolve as tiers", () => {
		setTaxonomyOverrides({ codex: { heavy: { model: "gpt-5-codex" } } });
		// `opus` is a TIER; it must keep resolving through SOURCE_TIER_MAP and must
		// not be shadowed by profile lookup.
		expect(resolveModel("opus", "codex").resolved?.model).toBe("gpt-5-codex");
		expect(resolveModel("opus", "codex").warning).toBeUndefined();
	});

	it("a profile name is not a tier alias", () => {
		// If `fable` ever became a ModelTier, every exhaustive Record<ModelTier,…>
		// in model-routing-config.ts would compile-break. It must stay orthogonal.
		expect(providerSupportsProfile("heavy", "claude-code")).toBe(false);
		expect(providerSupportsProfile("opus", "claude-code")).toBe(false);
	});
});

describe("genuinely unknown models keep the existing warn + comment-out behavior", () => {
	// Regression guard: the profile lookup must not swallow unknown strings, or a
	// typo'd model silently resolves to something instead of being flagged.
	it.each([["gpt-4"], ["fable-5"], ["claude-fable-5"], ["totally-made-up"]])(
		"still warns for %s",
		(model) => {
			const result = resolveModel(model, "codex");
			expect(result.resolved).toBeNull();
			expect(result.warning).toMatch(/not in taxonomy, commented out/);
		},
	);

	it("still ignores `inherit` and empty values", () => {
		expect(resolveModel("inherit", "codex")).toEqual({ resolved: null });
		expect(resolveModel("   ", "codex")).toEqual({ resolved: null });
		expect(resolveModel(undefined, "codex")).toEqual({ resolved: null });
	});

	it("still warns on non-string frontmatter", () => {
		const result = resolveModel(42 as unknown as string, "codex");
		expect(result.resolved).toBeNull();
		expect(result.warning).toMatch(/non-string model frontmatter/);
	});
});

describe("user overrides still win for tiers", () => {
	it("a configured tier override resolves ahead of the inherit warning", () => {
		setTaxonomyOverrides({ opencode: { balanced: { model: "some/model" } } });
		expect(resolveModel("sonnet", "opencode").resolved?.model).toBe("some/model");
	});
});
