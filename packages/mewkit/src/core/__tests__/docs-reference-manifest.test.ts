// The manifest exists to detect drift, so these test the two things that would make it lie:
// asserting a fact nobody declared, and failing to notice a source file changed.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildDocsReferenceManifest } from "../docs-reference-manifest.js";
import { renderReferenceFacts, spliceReferenceFacts, FACTS_START, FACTS_END } from "../render-reference-facts.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function makeProject(skillFrontmatter: string, withPage = true): { claudeDir: string; referenceDir: string } {
	const root = mkdtempSync(join(tmpdir(), "mewkit-docs-manifest-"));
	roots.push(root);
	const claudeDir = join(root, ".claude");
	mkdirSync(join(claudeDir, "skills", "demo"), { recursive: true });
	writeFileSync(join(claudeDir, "skills", "demo", "SKILL.md"), `---\n${skillFrontmatter}\n---\n\nbody\n`);

	const referenceDir = join(root, "reference");
	mkdirSync(join(referenceDir, "skills"), { recursive: true });
	if (withPage) writeFileSync(join(referenceDir, "skills", "demo.mdx"), `---\ntitle: "demo"\n---\n\nprose\n`);
	return { claudeDir, referenceDir };
}

describe("docs reference manifest", () => {
	it("leaves phase null when nothing declares one, rather than asserting on-demand", () => {
		const { claudeDir, referenceDir } = makeProject('name: demo\ndescription: "d"');
		const entry = buildDocsReferenceManifest(claudeDir, referenceDir).entries[0];
		// 40 agent pages document a real phase that no agent frontmatter carries. Defaulting here
		// would assert "not phase-anchored" for artifacts that are.
		expect(entry.phase).toBeNull();
	});

	it("records a declared phase verbatim", () => {
		const { claudeDir, referenceDir } = makeProject('name: demo\ndescription: "d"\nphase: 3');
		expect(buildDocsReferenceManifest(claudeDir, referenceDir).entries[0].phase).toBe("3");
	});

	it("changes the source hash when the source file changes", () => {
		const { claudeDir, referenceDir } = makeProject('name: demo\ndescription: "before"');
		const before = buildDocsReferenceManifest(claudeDir, referenceDir).entries[0];
		writeFileSync(
			join(claudeDir, "skills", "demo", "SKILL.md"),
			`---\nname: demo\ndescription: "after"\n---\n\nbody\n`,
		);
		const after = buildDocsReferenceManifest(claudeDir, referenceDir).entries[0];
		expect(after.sourceHash).not.toBe(before.sourceHash);
		expect(after.description).toBe("after");
	});

	it("marks an artifact with no reference page unclassified, never public", () => {
		const { claudeDir, referenceDir } = makeProject('name: demo\ndescription: "d"', false);
		expect(buildDocsReferenceManifest(claudeDir, referenceDir).entries[0].visibility).toBe("unclassified");
	});

	it("honors an explicit internal declaration over the presence of a page", () => {
		const { claudeDir, referenceDir } = makeProject('name: demo\ndescription: "d"\nvisibility: internal');
		expect(buildDocsReferenceManifest(claudeDir, referenceDir).entries[0].visibility).toBe("internal");
	});

	it("drops ownership values that are parse garbage rather than paths", () => {
		// The inventory's prose ownership parser captures fenced blocks and example commands on
		// several agents. One contained `<args>`, which MDX read as an unclosed tag and failed the
		// build. A path has no whitespace, backticks, or angle brackets; anything else is dropped.
		const { claudeDir, referenceDir } = makeProject('name: demo\ndescription: "d"');
		const entries = buildDocsReferenceManifest(claudeDir, referenceDir).entries;
		for (const e of entries) {
			for (const out of e.output) {
				expect(out, `${e.id} owns a value that is not a path`).toMatch(/^[^\s`<>\n]+$/);
			}
		}
	});

	it("does not read user-invocable: false as internal", () => {
		// All nine skills declaring it carry public pages: auto-invoked, not secret.
		const { claudeDir, referenceDir } = makeProject('name: demo\ndescription: "d"\nuser-invocable: false');
		expect(buildDocsReferenceManifest(claudeDir, referenceDir).entries[0].visibility).toBe("public");
	});
});

describe("reference facts splice", () => {
	const entry = {
		id: "mk:demo",
		kind: "skill" as const,
		title: "Demo",
		description: "d",
		sourcePath: "skills/demo/SKILL.md",
		sourceHash: "abc",
		aliases: [],
		owner: "lifecycle",
		phase: null,
		runtime: "claude-code",
		visibility: "public" as const,
		risk: "critical",
		dependencies: [],
		output: [],
		lastVerified: null,
	};

	it("omits undeclared rows instead of printing empty ones", () => {
		const block = renderReferenceFacts(entry);
		expect(block).toContain("**Owner**");
		expect(block).not.toContain("**Phase**");
		expect(block).not.toContain("**Depends on**");
	});

	it("inserts below the frontmatter and leaves the prose untouched", () => {
		const body = `---\ntitle: "demo"\n---\n\n## What This Skill Does\n\nprose\n`;
		const out = spliceReferenceFacts(body, renderReferenceFacts(entry));
		expect(out).toContain("## What This Skill Does");
		expect(out).toContain("prose");
		expect(out.indexOf(FACTS_START)).toBeLessThan(out.indexOf("## What This Skill Does"));
		expect(out.startsWith(`---\ntitle: "demo"\n---\n`)).toBe(true);
	});

	it("replaces a previous block rather than stacking a second one", () => {
		const body = `---\ntitle: "demo"\n---\n\n## Section\n`;
		const once = spliceReferenceFacts(body, renderReferenceFacts(entry));
		const twice = spliceReferenceFacts(once, renderReferenceFacts({ ...entry, owner: "changed" }));
		expect(twice.split(FACTS_START).length - 1).toBe(1);
		expect(twice.split(FACTS_END).length - 1).toBe(1);
		expect(twice).toContain("`changed`");
		expect(twice).not.toContain("`lifecycle`");
		expect(twice).toContain("## Section");
	});

	it("uses MDX comment markers, which are the only kind MDX will build", () => {
		expect(FACTS_START.startsWith("{/*")).toBe(true);
		expect(FACTS_START).not.toContain("<!--");
	});

	it("escapes a pipe so a value cannot break the table it sits in", () => {
		const block = renderReferenceFacts({ ...entry, owner: "a|b" });
		expect(block).toContain("a\\|b");
	});
});
