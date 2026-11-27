// Fragments replace the shared `## Unreleased` section. These cases pin the format the stable
// release writes into the published changelog.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
type Fragment = { name: string; section: string; body: string };
const ac = require("../../scripts/release/assemble-changelog.cjs") as {
	parseFragment: (name: string, text: string) => Fragment;
	render: (fragments: Fragment[]) => string;
	insertSection: (changelog: string, version: string, date: string, body: string) => string;
	extractSection: (changelog: string, version: string) => string | null;
};

describe("parseFragment", () => {
	it("reads the section and body", () => {
		const f = ac.parseFragment("a.md", "---\nsection: Bug Fixes\n---\n- fixed x\n");
		expect(f).toEqual({ name: "a.md", section: "Bug Fixes", body: "- fixed x" });
	});

	it("rejects an unknown section, missing frontmatter and an empty body", () => {
		expect(() => ac.parseFragment("a.md", "---\nsection: Misc\n---\n- x")).toThrow(/not one of/);
		expect(() => ac.parseFragment("a.md", "- x")).toThrow(/frontmatter/);
		expect(() => ac.parseFragment("a.md", "---\nsection: CLI\n---\n\n")).toThrow(/empty body/);
	});
});

describe("render", () => {
	it("groups by section in the published schema order", () => {
		const out = ac.render([
			{ name: "b.md", section: "Bug Fixes", body: "- b" },
			{ name: "a.md", section: "Features", body: "- a" },
			{ name: "c.md", section: "Bug Fixes", body: "- c" },
		]);
		expect(out).toBe("### Features\n\n- a\n\n### Bug Fixes\n\n- b\n- c");
	});
});

describe("insertSection", () => {
	const page = "---\ntitle: x\n---\n\n## Upgrade\n\ntext\n\n## 3.1.1 (2026-11-26)\n\n- old\n";

	it("inserts above the newest released version, below the Upgrade block", () => {
		const out = ac.insertSection(page, "3.2.0", "2026-12-01", "### CLI\n\n- new");
		expect(out).toContain("text\n\n## 3.2.0 (2026-12-01)\n\n### CLI\n\n- new\n\n## 3.1.1 (2026-11-26)");
	});

	it("refuses a version the page already has", () => {
		expect(() => ac.insertSection(page, "3.1.1", "2026-12-01", "- x")).toThrow(/already has/);
	});
});

describe("extractSection", () => {
	it("returns one version's body for the release notes", () => {
		const page = "## Upgrade\n\nx\n\n## 3.2.0 (2026-12-01)\n\n### CLI\n\n- new\n\n## 3.1.1 (2026-11-26)\n\n- old\n";
		expect(ac.extractSection(page, "3.2.0")).toBe("### CLI\n\n- new");
		expect(ac.extractSection(page, "3.1.1")).toBe("- old");
		expect(ac.extractSection(page, "9.9.9")).toBeNull();
	});
});
