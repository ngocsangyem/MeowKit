// Phase 5: Codex default-deny by runtime. A runtime: claude-code skill installs on Codex ONLY
// via a tested adapter, else it is skipped; runtime: portable installs; --include-unportable forces.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { classifySkillForProvider, computeSkillParity, readSkillRuntime } from "../portability-policy.js";
import type { SkillInfo } from "../types.js";

let root: string | null = null;
afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = null;
});

/** Build a SkillInfo backed by a temp dir whose SKILL.md declares the given runtime. */
function skill(name: string, runtime: "portable" | "claude-code" | "none"): SkillInfo {
	root = root ?? mkdtempSync(join(tmpdir(), "codex-gate-"));
	const dir = join(root, name);
	mkdirSync(dir, { recursive: true });
	const fm = runtime === "none" ? "" : `runtime: ${runtime}\n`;
	writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\n${fm}---\n\n# ${name}\n`);
	return { id: `mk:${name}`, name, dirName: name, description: name, sourcePath: dir };
}

describe("Codex runtime gate (default-deny)", () => {
	it("reads the runtime frontmatter", () => {
		expect(readSkillRuntime(skill("a", "portable"))).toBe("portable");
		expect(readSkillRuntime(skill("b", "claude-code"))).toBe("claude-code");
		expect(readSkillRuntime(skill("c", "none"))).toBeUndefined();
	});

	it("portable → installs; claude-code (no adapter) → skipped; unspecified → skipped", () => {
		expect(classifySkillForProvider(skill("p", "portable"), "codex").cls).toBe("portable");
		expect(classifySkillForProvider(skill("cc", "claude-code"), "codex").cls).toBe("skipped");
		expect(classifySkillForProvider(skill("u", "none"), "codex").cls).toBe("skipped");
	});

	it("--include-unportable forces a claude-code skill in as unportable-included", () => {
		const c = classifySkillForProvider(skill("cc", "claude-code"), "codex", { includeUnportable: true });
		expect(c.cls).toBe("unportable-included");
		expect(c.reason).toMatch(/EXPERIMENTAL/);
	});

	it("skip reason names the default-deny + the override", () => {
		const c = classifySkillForProvider(skill("cc", "claude-code"), "codex");
		expect(c.reason).toMatch(/default-deny/);
		expect(c.reason).toMatch(/--include-unportable/);
	});

	it("parity = portable+adapted / total; skipped counted apart, not in the percent", () => {
		const skills = [skill("p1", "portable"), skill("p2", "portable"), skill("cc1", "claude-code"), skill("cc2", "claude-code")];
		const parity = computeSkillParity(skills, "codex");
		expect(parity.total).toBe(4);
		expect(parity.portable).toBe(2);
		expect(parity.skipped).toBe(2);
		expect(parity.parityCount).toBe(2);
		expect(parity.parityPct).toBe(50);
	});

	it("--include-unportable does not lift the parity percent (forced ≠ parity)", () => {
		const skills = [skill("p", "portable"), skill("cc1", "claude-code"), skill("cc2", "claude-code")];
		const parity = computeSkillParity(skills, "codex", { includeUnportable: true });
		expect(parity.includedUnportable).toBe(2);
		expect(parity.skipped).toBe(0);
		expect(parity.parityCount).toBe(1); // only the portable one
		expect(parity.parityPct).toBe(33);
	});
});
