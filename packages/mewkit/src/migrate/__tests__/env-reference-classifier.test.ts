import { describe, expect, it } from "vitest";
import { classifyEnvReference, isEnvReference } from "../references/reference-classifier.js";

describe(".claude/.env reference reclassification", () => {
	it("recognizes .env and .env.<suffix> references", () => {
		expect(isEnvReference(".claude/.env")).toBe(true);
		expect(isEnvReference(".claude/.env.example")).toBe(true);
		expect(isEnvReference(".claude/.env.local")).toBe(true);
	});

	it("does not match unrelated .claude paths", () => {
		expect(isEnvReference(".claude/skills/foo")).toBe(false);
		expect(isEnvReference(".claude/environment")).toBe(false);
		expect(isEnvReference(".claude/rules/env.md")).toBe(false);
	});

	it("points .env references at the emitted shell_environment_policy scaffold", () => {
		const classification = classifyEnvReference(".claude/.env");
		expect(classification).not.toBeNull();
		expect(classification?.neutral).toContain("[shell_environment_policy] scaffold");
		// Supersedes the old "no provider equivalent" reason.
		expect(classification?.reason).toContain("shell_environment_policy");
		expect(classification?.reason).not.toContain("no provider equivalent");
		// Nudges away from committing secrets.
		expect(classification?.reason).toContain("do not paste secrets");
	});

	it("returns null for non-.env paths so callers fall through", () => {
		expect(classifyEnvReference(".claude/skills/x/run.py")).toBeNull();
	});
});
