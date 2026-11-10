import { describe, expect, it } from "vitest";
import { checkSkillFrontmatter } from "../check-skill-frontmatter.js";
import { checkFrontmatterContract } from "../../commands/validate.js";
import { makeSkillTree } from "./helpers/skill-tree-fixture.js";

const ENV_BODY_SKILL = `---
name: mk:test-env
description: A skill that calls an external Jira service for testing.
when_to_use: Use to test the external-service env-var detection path.
---

# Test Env

Set MEOW_JIRA_SITE_URL before invoking.
`;

const JIRA_LEAF_NO_FIELD = `---
name: mk:test-jira-leaf
description: A user-invocable Jira leaf skill for testing the owner/agent marker path.
when_to_use: Use to test the frontmatter-marker detection path.
user-invocable: true
owner: jira
agent: jira-issue
---

# Test Jira Leaf

No env var in the body — detected via owner/agent frontmatter marker.
`;

const ANNOTATED_SKILL = `---
name: mk:test-annotated
description: A fully annotated external-service skill for testing the no-warn path.
when_to_use: Use to test that annotated skills produce no tool-contract warning.
owner: jira
agent: jira-issue
requires_external_service: ["jira"]
default_enabled: false
---

# Test Annotated

Set MEOW_JIRA_SITE_URL before invoking.
`;

const REQUIRES_NO_DEFAULT = `---
name: mk:test-missing-default
description: A skill that declares requires_external_service but omits default_enabled.
when_to_use: Use to test the default_enabled cross-check warning.
requires_external_service: ["jira"]
---

# Test Missing Default

Body text.
`;

const PLAIN_SKILL = `---
name: mk:test-plain
description: A plain non-external skill that must not trigger any tool-contract warning.
when_to_use: Use to confirm plain skills are unaffected.
---

# Test Plain

Just a normal skill.
`;

describe("tool-contract advisories", () => {
	it("warns when a body names an external-service env var and the field is absent", () => {
		const report = checkSkillFrontmatter(makeSkillTree({ "test-env": ENV_BODY_SKILL }));
		expect(report.errors).toEqual([]);
		expect(report.warnings.join("\n")).toContain("requires_external_service");
	});

	it("warns on the owner/agent marker path with no env var in the body", () => {
		const report = checkSkillFrontmatter(makeSkillTree({ "test-jira-leaf": JIRA_LEAF_NO_FIELD }));
		expect(report.errors).toEqual([]);
		expect(report.warnings.join("\n")).toContain("requires_external_service");
	});

	it("reports advisories as WARN, which is what --strict promotes to a failure", () => {
		const results = checkFrontmatterContract(makeSkillTree({ "test-jira-leaf": JIRA_LEAF_NO_FIELD }));
		expect(results.some((r) => r.status === "fail")).toBe(false);
		expect(results.some((r) => r.status === "warn")).toBe(true);
	});

	it("stays silent for a fully annotated skill", () => {
		const report = checkSkillFrontmatter(makeSkillTree({ "test-annotated": ANNOTATED_SKILL }));
		expect(report.errors).toEqual([]);
		expect(report.warnings.join("\n")).not.toContain("requires_external_service");
		expect(report.warnings.join("\n")).not.toContain("default_enabled");
	});

	it("warns when requires_external_service is present but default_enabled is not", () => {
		const report = checkSkillFrontmatter(makeSkillTree({ "test-missing-default": REQUIRES_NO_DEFAULT }));
		expect(report.errors).toEqual([]);
		expect(report.warnings.join("\n")).toContain("default_enabled");
	});

	it("leaves a plain skill alone", () => {
		const report = checkSkillFrontmatter(makeSkillTree({ "test-plain": PLAIN_SKILL }));
		expect(report.errors).toEqual([]);
		expect(report.warnings.join("\n")).not.toContain("requires_external_service");
	});
});

describe("schema coverage", () => {
	it("accepts the advisory tool-contract fields", () => {
		const report = checkSkillFrontmatter(
			makeSkillTree({
				"test-fields": `---
name: mk:test-fields
description: A test skill with the advisory tool-contract fields.
when_to_use: Use to confirm the advisory fields validate.
requires_external_service: ["jira", "confluence"]
default_enabled: false
stable_output_contract: true
---

# Fields
`,
			}),
		);
		expect(report.errors).toEqual([]);
	});

	it("rejects an unknown dependency edge type", () => {
		const report = checkSkillFrontmatter(
			makeSkillTree({
				"test-edge": `---
name: mk:test-edge
description: A skill with an invalid dependency edge type.
when_to_use: Use to confirm the edge-type enum is enforced.
dependency_edges:
  - id: mk:other
    type: unsupported
---

# Edge
`,
			}),
		);
		expect(report.errors.join("\n")).toContain("not one of");
	});
});
