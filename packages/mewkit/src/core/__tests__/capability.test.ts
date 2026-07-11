// Phase 2 slice 1: capability builder (reuse of enumerateArtifacts, denormalization,
// authored kinds, rule exclusion, 100% invocable-artifact coverage) + pure validation
// (cross-ref, containment, uniqueness, unknown invocation id, dependency cycle).
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCapabilities } from "../build-capabilities.js";
import { validateCapabilities, validateCapabilityEntries } from "../validate-capabilities.js";
import { CapabilityEntrySchema, type CapabilityEntry } from "../capability.js";
import { renderCapabilityView } from "../generate-capability-view.js";
import { enumerateArtifacts, type InventoryEntry } from "../build-inventory.js";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A small but structurally complete installed `.claude/`. */
function makeClaudeDir(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-cap-"));
	dirs.push(root);
	const c = join(root, ".claude");
	const w = (rel: string, body: string): void => {
		mkdirSync(join(c, rel, ".."), { recursive: true });
		writeFileSync(join(c, rel), body);
	};
	w("skills/foo/SKILL.md", "---\nname: mk:foo\ndescription: Foo skill\nowner: lifecycle\nkeywords:\n  - alpha\n  - beta\nwhen_to_use: use foo\n---\n# Foo\n");
	w("agents/bar.md", "---\nname: bar\ndescription: Bar agent\nowner: review\n---\n# Bar\n");
	w("commands/mk/baz.md", "# baz\n");
	w("hooks/qux.sh", "#!/bin/bash\nexit 0\n");
	w("rules/some-rule.md", "# rule\n");
	writeFileSync(
		join(c, "harness-inventory.json"),
		JSON.stringify({
			artifacts: {
				"commands/mk/baz.md": { owner: "utility", criticality: "medium", status: "active", runtime: "claude-code" },
				"hooks/qux.sh": { owner: "security", criticality: "critical", status: "active", runtime: "claude-code" },
				"rules/some-rule.md": { owner: "lifecycle", criticality: "medium", status: "active", runtime: "claude-code" },
			},
		}),
	);
	return c;
}

describe("buildCapabilities", () => {
	it("projects disk skills/agents/commands/hooks to capabilities and EXCLUDES rules", () => {
		const caps = buildCapabilities(makeClaudeDir());
		const byId = new Map(caps.map((c) => [c.id, c]));
		expect(byId.get("mk:foo")?.kind).toBe("skill");
		expect(byId.get("bar")?.kind).toBe("agent");
		expect(byId.get("baz")?.kind).toBe("command");
		expect(byId.get("qux")?.kind).toBe("hook");
		// rule is inventory-only context, never a capability
		expect(caps.some((c) => c.id === "some-rule")).toBe(false);
	});

	it("denormalizes owner from inventory and infers intents from skill keywords", () => {
		const caps = buildCapabilities(makeClaudeDir());
		const foo = caps.find((c) => c.id === "mk:foo")!;
		expect(foo.owner).toBe("lifecycle");
		expect(foo.installedState).toBe("installed");
		expect(foo.intents).toEqual(["alpha", "beta"]);
		expect(foo.whenToUse).toBe("use foo");
		expect(foo.invocation).toEqual({ kind: "skill", id: "invoke-skill" });
		expect(foo.provenance.owner).toBe("inferred");
	});

	it("includes authored tool/service capabilities with authored provenance", () => {
		const caps = buildCapabilities(makeClaudeDir());
		const jira = caps.find((c) => c.id === "jira")!;
		expect(jira.kind).toBe("tool");
		expect(jira.sourcePath).toBeNull();
		expect(jira.provenance.description).toBe("authored");
		expect(caps.some((c) => c.kind === "context-service")).toBe(true);
		expect(caps.some((c) => c.kind === "state-service")).toBe(true);
	});

	it("covers 100% of enumerated invocable-kind artifacts", () => {
		const claudeDir = makeClaudeDir();
		const { refs } = enumerateArtifacts(claudeDir);
		const expected = refs.filter((r) => r.type !== "rule").map((r) => r.rel).sort();
		const covered = buildCapabilities(claudeDir)
			.map((c) => c.sourcePath)
			.filter((p): p is string => p !== null)
			.sort();
		expect(expected.every((p) => covered.includes(p))).toBe(true);
	});

	it("every built entry satisfies the zod schema", () => {
		for (const c of buildCapabilities(makeClaudeDir())) {
			expect(() => CapabilityEntrySchema.parse(c)).not.toThrow();
		}
	});
});

describe("renderCapabilityView", () => {
	it("renders a stable table of only capabilities that carry intents, sorted by id", () => {
		const claudeDir = makeClaudeDir();
		const view = renderCapabilityView(buildCapabilities(claudeDir));
		expect(view).toContain("| Capability | Kind | Invocation | Intent source | Intents (user phrases) |");
		// The fixture skill mk:foo has inferred keyword intents ⇒ it appears.
		expect(view).toContain("`mk:foo`");
		// A command with no intents (baz) does not appear.
		expect(view).not.toContain("`baz`");
	});
});

describe("validateCapabilities", () => {
	it("reports no errors on a coherent fixture", () => {
		const errors = validateCapabilities(makeClaudeDir()).filter((i) => i.level === "error");
		expect(errors).toEqual([]);
	});

	it("builds and validates the LIVE harness with zero ERROR-level issues", () => {
		const live = join(process.cwd(), ".claude");
		const caps = buildCapabilities(live);
		// Guard against a false-green: buildCapabilities always returns the authored
		// constants even with no .claude/, so assert disk enumeration actually ran.
		expect(caps.some((c) => c.sourcePath !== null)).toBe(true);
		expect(caps.filter((c) => c.sourcePath !== null).length).toBeGreaterThan(50);
		const errors = validateCapabilities(live).filter((i) => i.level === "error");
		// WARN (coverage/intent-overlap) is expected on the real harness; ERROR is not.
		expect(errors).toEqual([]);
	});
});

describe("validateCapabilityEntries (pure)", () => {
	const base = (over: Partial<CapabilityEntry>): CapabilityEntry => ({
		id: "x",
		kind: "skill",
		description: "",
		aliases: [],
		sourcePath: "skills/x/SKILL.md",
		inventoryId: "x",
		owner: "lifecycle",
		installedState: "installed",
		intents: [],
		whenToUse: null,
		invocation: { kind: "skill", id: "invoke-skill" },
		requirements: [],
		support: {},
		verification: { kind: "unknown" },
		dependencies: { upstream: [], downstream: [] },
		provenance: {},
		...over,
	});
	const inv = (over: Partial<InventoryEntry>): InventoryEntry => ({
		type: "skill",
		path: "skills/x/SKILL.md",
		id: "x",
		owner: "lifecycle",
		criticality: "medium",
		status: "active",
		runtime: "claude-code",
		source: "frontmatter",
		...over,
	});

	it("errors on an unknown invocation id (hostile frontmatter cannot smuggle a command)", () => {
		const issues = validateCapabilityEntries([base({ invocation: { kind: "skill", id: "rm -rf /" } })], [inv({})]);
		expect(issues.some((i) => i.level === "error" && /unknown invocation id/.test(i.message))).toBe(true);
	});

	it("errors on a sourcePath that escapes .claude/", () => {
		const issues = validateCapabilityEntries([base({ sourcePath: "../../etc/passwd" })], [inv({})]);
		expect(issues.some((i) => i.level === "error" && /escapes/.test(i.message))).toBe(true);
	});

	it("errors when denormalized owner disagrees with inventory", () => {
		const issues = validateCapabilityEntries([base({ owner: "wrong" })], [inv({ owner: "lifecycle" })]);
		expect(issues.some((i) => i.level === "error" && /disagrees/.test(i.message))).toBe(true);
	});

	it("warns on a dangling upstream dependency (no matching capability)", () => {
		const issues = validateCapabilityEntries([base({ dependencies: { upstream: ["ghost"], downstream: [] } })], [inv({})]);
		expect(issues.some((i) => i.level === "warn" && /no matching capability: ghost/.test(i.message))).toBe(true);
	});

	it("errors on a dependency cycle", () => {
		const a = base({ id: "a", inventoryId: "a", sourcePath: "skills/a/SKILL.md", dependencies: { upstream: ["b"], downstream: [] } });
		const b = base({ id: "b", inventoryId: "b", sourcePath: "skills/b/SKILL.md", dependencies: { upstream: ["a"], downstream: [] } });
		const issues = validateCapabilityEntries([a, b], [inv({ id: "a", path: "skills/a/SKILL.md" }), inv({ id: "b", path: "skills/b/SKILL.md" })]);
		expect(issues.some((i) => i.level === "error" && /cycle/.test(i.message))).toBe(true);
	});
});
