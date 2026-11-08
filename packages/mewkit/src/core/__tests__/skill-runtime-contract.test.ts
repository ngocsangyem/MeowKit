import { describe, expect, it } from "vitest";
import { checkSkillFrontmatter } from "../check-skill-frontmatter.js";
import { makeSkillTree, REPO_ROOT } from "./helpers/skill-tree-fixture.js";

const INTERPRETER_IN_RUNTIME = `---
name: mk:test-bad-runtime
description: A skill that records its interpreter requirement in the wrong field.
when_to_use: Use to test that an interpreter value in runtime is rejected.
runtime: python
---

# Test Bad Runtime
`;

const PROVIDER_IN_REQUIRES_RUNTIME = `---
name: mk:test-bad-requires
description: A skill that records an execution environment in the interpreter field.
when_to_use: Use to test that a provider value in requires_runtime is rejected.
requires_runtime: ["claude-code"]
---

# Test Bad Requires
`;

const UNDECLARED_PYTHON = `---
name: mk:test-undeclared
description: A skill that documents a Python entry script but declares no interpreter.
when_to_use: Use to test the undeclared-interpreter rule.
---

# Test Undeclared

Run \`python3 scripts/do-thing.py\` to use this skill.
`;

const DECLARED_PYTHON = `---
name: mk:test-declared
description: A skill that documents a Python entry script and declares its interpreter.
when_to_use: Use to test the declared-interpreter happy path.
requires_runtime: ["python>=3.9"]
---

# Test Declared

Run \`scripts/do-thing.py\` to use this skill.
`;

const UNVERSIONED_RUNTIME = `---
name: mk:test-shape
description: A skill whose interpreter requirement omits the version comparator.
when_to_use: Use to confirm the pinned value shape is enforced.
requires_runtime: ["python"]
---

# Shape
`;

describe("runtime vs requires_runtime", () => {
	it("fails an interpreter value recorded in runtime", () => {
		const report = checkSkillFrontmatter(makeSkillTree({ "test-bad-runtime": INTERPRETER_IN_RUNTIME }));
		expect(report.errors.join("\n")).toContain("names an interpreter");
	});

	it("fails an execution-environment value recorded in requires_runtime", () => {
		const report = checkSkillFrontmatter(makeSkillTree({ "test-bad-requires": PROVIDER_IN_REQUIRES_RUNTIME }));
		expect(report.errors.join("\n")).toContain("names an execution environment");
	});

	it("fails an entry with no comparator or version", () => {
		const report = checkSkillFrontmatter(makeSkillTree({ "test-shape": UNVERSIONED_RUNTIME }));
		expect(report.errors.join("\n")).toContain("does not match");
	});
});

describe("documented interpreter declaration", () => {
	it("fails a skill that documents a .py entry script and declares no interpreter", () => {
		const root = makeSkillTree(
			{ "test-undeclared": UNDECLARED_PYTHON },
			{ "test-undeclared/scripts/do-thing.py": "print('hi')\n" },
		);
		expect(checkSkillFrontmatter(root).errors.join("\n")).toContain("declares no 'requires_runtime'");
	});

	it("passes the same skill once it declares the interpreter", () => {
		const root = makeSkillTree(
			{ "test-declared": DECLARED_PYTHON },
			{ "test-declared/scripts/do-thing.py": "print('hi')\n" },
		);
		const report = checkSkillFrontmatter(root);
		expect(report.errors).toEqual([]);
		expect(report.valid).toBe(1);
	});

	it("passes the unmodified kit tree", () => {
		const report = checkSkillFrontmatter(REPO_ROOT);
		expect(report.errors).toEqual([]);
		expect(report.valid).toBeGreaterThan(100);
	});
});
