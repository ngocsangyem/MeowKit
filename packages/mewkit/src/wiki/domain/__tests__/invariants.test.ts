import { describe, expect, it } from "vitest";
import {
	assertCanonicalComplete,
	assertClaimHasSource,
	assertNoTraversal,
	assertTransition,
	canTransition,
} from "../invariants.js";
import { makeWikiPageId, makeWikiSlug } from "../types.js";
import type { WikiClaim, WikiPage } from "../types.js";

describe("assertNoTraversal", () => {
	it("accepts a plain repo-relative path", () => {
		expect(() => assertNoTraversal("pages/getting-started.md")).not.toThrow();
	});

	it.each([
		["../../etc/passwd", "parent traversal"],
		["pages/../../../secret", "embedded traversal"],
		["./pages/x.md", "single-dot segment"],
		["/etc/passwd", "absolute posix path"],
		["C:\\Windows\\System32", "absolute windows path"],
		["pages\\x.md", "backslash separator"],
		["pages/\0/x.md", "null byte"],
		["", "empty path"],
	])("rejects %s (%s)", (path) => {
		expect(() => assertNoTraversal(path)).toThrow();
	});
});

describe("makeWikiSlug", () => {
	it("accepts a valid slug", () => {
		expect(makeWikiSlug("meowkit-wiki")).toBe("meowkit-wiki");
	});

	it.each(["../escape", "Has Spaces", "UPPER", "double--hyphen", "trailing-", "with/slash", ".."])(
		"rejects invalid slug %s",
		(slug) => {
			expect(() => makeWikiSlug(slug)).toThrow();
		},
	);
});

function buildPage(overrides: Partial<WikiPage> = {}): WikiPage {
	return {
		id: makeWikiPageId("page-1"),
		slug: makeWikiSlug("demo"),
		title: "Demo",
		path: "pages/demo.md",
		content: "body",
		state: "approved",
		createdAt: "2026-06-29T00:00:00.000Z",
		updatedAt: "2026-06-29T00:00:00.000Z",
		provenance: { origin: "human", sourceIds: [] },
		links: [],
		...overrides,
	};
}

describe("assertCanonicalComplete", () => {
	it("passes a complete page", () => {
		expect(() => assertCanonicalComplete(buildPage())).not.toThrow();
	});

	it("rejects a page missing a title", () => {
		expect(() => assertCanonicalComplete(buildPage({ title: "" }))).toThrow(/title/);
	});

	it("rejects a page missing updatedAt", () => {
		expect(() => assertCanonicalComplete(buildPage({ updatedAt: "" }))).toThrow(/updatedAt/);
	});

	it("rejects a page whose path traverses", () => {
		expect(() => assertCanonicalComplete(buildPage({ path: "../escape.md" }))).toThrow();
	});
});

describe("assertClaimHasSource", () => {
	const base: WikiClaim = { id: "c1", text: "x", external: false };

	it("allows an internal claim without a source", () => {
		expect(() => assertClaimHasSource(base)).not.toThrow();
	});

	it("requires a source id for an external claim", () => {
		expect(() => assertClaimHasSource({ ...base, external: true })).toThrow(/sourceId/);
	});

	it("accepts an external claim that names its source", () => {
		expect(() => assertClaimHasSource({ ...base, external: true, sourceId: "s1" })).not.toThrow();
	});
});

describe("canTransition", () => {
	it("allows proposed → scanned", () => {
		expect(canTransition("proposed", "scanned", { origin: "agent" }).ok).toBe(true);
	});

	it("forbids unscanned content reaching approved", () => {
		const result = canTransition("proposed", "approved", { origin: "human" });
		expect(result.ok).toBe(false);
	});

	it("allows scanned → approved", () => {
		expect(canTransition("scanned", "approved", { origin: "human" }).ok).toBe(true);
	});

	it("forbids an agent-origin candidate self-committing", () => {
		const result = canTransition("approved", "committed", { origin: "agent" });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/self-commit|committed/);
	});

	it("allows a human-origin approved page to commit", () => {
		expect(canTransition("approved", "committed", { origin: "human" }).ok).toBe(true);
	});

	it("allows a system-origin approved page to commit", () => {
		expect(canTransition("approved", "committed", { origin: "system" }).ok).toBe(true);
	});

	it("rejects a no-op transition", () => {
		expect(canTransition("scanned", "scanned", { origin: "human" }).ok).toBe(false);
	});

	it("rejects transitions out of a terminal state", () => {
		expect(canTransition("committed", "approved", { origin: "human" }).ok).toBe(false);
		expect(canTransition("quarantined", "approved", { origin: "human" }).ok).toBe(false);
	});
});

describe("assertTransition", () => {
	it("throws on an illegal transition", () => {
		expect(() => assertTransition("approved", "committed", { origin: "agent" })).toThrow();
	});

	it("does not throw on a legal transition", () => {
		expect(() => assertTransition("scanned", "approved", { origin: "human" })).not.toThrow();
	});
});
