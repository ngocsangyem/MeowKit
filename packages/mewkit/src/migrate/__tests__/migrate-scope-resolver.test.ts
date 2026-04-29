import { describe, expect, it } from "vitest";
import { resolveMigrationScope } from "../migrate-scope-resolver.js";

describe("resolveMigrationScope", () => {
	it("default: all six types enabled", () => {
		const scope = resolveMigrationScope([], {});
		expect(scope).toEqual({
			agents: true, commands: true, skills: true, config: true, rules: true, hooks: true,
		});
	});

	it("--only=skills,hooks narrows scope", () => {
		const scope = resolveMigrationScope([], { only: "skills,hooks" });
		expect(scope).toEqual({
			agents: false, commands: false, skills: true, config: false, rules: false, hooks: true,
		});
	});

	it("--only conflicts with --skip-config", () => {
		expect(() =>
			resolveMigrationScope([], { only: "skills", skipConfig: true }),
		).toThrow(/mutually exclusive/);
	});

	it("--skip-config excludes config only", () => {
		const scope = resolveMigrationScope(["--skip-config"], { skipConfig: true });
		expect(scope.config).toBe(false);
		expect(scope.agents).toBe(true);
	});

	it("--no-config (alias) also excludes config", () => {
		const scope = resolveMigrationScope(["--no-config"], {});
		expect(scope.config).toBe(false);
	});

	it("positive --config flag: only-mode enables only config", () => {
		const scope = resolveMigrationScope(["--config"], {});
		expect(scope).toEqual({
			agents: false, commands: false, skills: false, config: true, rules: false, hooks: false,
		});
	});

	it("multiple positive flags: only those enabled", () => {
		const scope = resolveMigrationScope(["--config", "--rules"], {});
		expect(scope.config).toBe(true);
		expect(scope.rules).toBe(true);
		expect(scope.agents).toBe(false);
		expect(scope.hooks).toBe(false);
	});

	it("--only ignores unknown types silently", () => {
		const scope = resolveMigrationScope([], { only: "skills,bogus" });
		expect(scope.skills).toBe(true);
		expect(scope.agents).toBe(false);
	});

	it("--skip-hooks alone keeps everything else", () => {
		const scope = resolveMigrationScope(["--skip-hooks"], { skipHooks: true });
		expect(scope.hooks).toBe(false);
		expect(scope.agents).toBe(true);
		expect(scope.skills).toBe(true);
	});
});
