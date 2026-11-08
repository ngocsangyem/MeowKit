// A setting that stopped being read has to say so.
//
// Two findings are asserted here rather than one, because they fail in opposite
// directions: a malformed config must not be reported as absent, and a removed
// name must not be reported as nothing at all.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { checkProjectConfig, checkRemovedEnvNames } from "../doctor-config-checks.js";
import { REMOVED_ENV_NAMES } from "../../config/removed-env-names.js";

/** A throwaway project with the given `.meowkit/` files. */
function project(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), "mk-doctor-cfg-"));
	mkdirSync(join(root, ".meowkit"), { recursive: true });
	for (const [rel, body] of Object.entries(files)) writeFileSync(join(root, rel), body);
	return root;
}

describe("the project config finding", () => {
	it("passes with no config at all", () => {
		const result = checkProjectConfig(project({}));
		expect(result.status).toBe("pass");
		expect(result.detail).toContain("default");
	});

	it("passes and counts the keys of a valid config", () => {
		const result = checkProjectConfig(project({ ".meowkit/config.yaml": "tdd: true\n" }));
		expect(result.status).toBe("pass");
		expect(result.detail).toContain("1 key(s)");
	});

	it("reports a malformed config with its file, its line and its code", () => {
		const result = checkProjectConfig(project({ ".meowkit/config.yaml": "budget:\n\tcap: 5\n" }));
		expect(result.status).toBe("fail");
		expect(result.detail).toContain(".meowkit/config.yaml:2");
		expect(result.detail).toContain("tab-indentation");
		expect(result.fix).toBeTruthy();
		// The parser's own exception is never what the user reads.
		expect(result.detail).not.toContain("YAMLException");
		expect(result.detail).not.toContain("at Object.<anonymous>");
	});

	it("calls a project with only the v2 descriptor migration-pending and names the next action", () => {
		const result = checkProjectConfig(project({ ".meowkit/config.json": '{"features":{}}\n' }));
		expect(result.status).toBe("warn");
		expect(result.detail).toContain("migration pending");
		expect(result.fix).toContain("mewkit upgrade");
	});
});

describe("a removed setting that is still exported", () => {
	const root = project({});

	it("says nothing when the environment carries none of them", () => {
		expect(checkRemovedEnvNames(root, {})).toEqual([]);
	});

	it("names the replacement key and the file to edit for a collapsed hook switch", () => {
		const [finding, ...rest] = checkRemovedEnvNames(root, { MEOWKIT_LOOP_DETECT: "off" });
		expect(rest).toEqual([]);
		expect(finding.status).toBe("fail");
		expect(finding.name).toContain("MEOWKIT_LOOP_DETECT");
		expect(finding.detail).toContain("hooks.loop-detection");
		expect(finding.fix).toContain(".meowkit/config.yaml");
		expect(finding.fix).toContain("unset MEOWKIT_LOOP_DETECT");
	});

	it("says a reader-less drop has no replacement rather than inventing one", () => {
		// Taken from the generated list rather than spelled out: a dropped name
		// written into a file under a scanned tree would keep itself in the name
		// universe and make its own deletion unobservable.
		const dropped = REMOVED_ENV_NAMES.find((r) => r.replacement === "");
		expect(dropped, "no reader-less drop in the generated list").toBeDefined();
		const name = dropped?.name ?? "";
		const [finding] = checkRemovedEnvNames(root, { [name]: "4000" });
		expect(finding.status).toBe("fail");
		expect(finding.detail).toContain("Nothing replaced it");
		expect(finding.fix).toBe(`unset ${name} in your shell profile`);
	});

	it("leaves the supported override alone", () => {
		// `MEOWKIT_TDD` still turns strict mode on, at the top of the chain.
		// Reporting it as removed is the failure this case exists to catch.
		expect(REMOVED_ENV_NAMES.some((r) => r.name === "MEOWKIT_TDD")).toBe(false);
		expect(checkRemovedEnvNames(root, { MEOWKIT_TDD: "1" })).toEqual([]);
	});

	it("leaves the density name alone, because the gate still reads it from the environment", () => {
		expect(REMOVED_ENV_NAMES.some((r) => r.name === "MEOWKIT_AUTOBUILD_MODE")).toBe(false);
	});

	it("ignores an empty export, which selects nothing", () => {
		expect(checkRemovedEnvNames(root, { MEOWKIT_LOOP_DETECT: "" })).toEqual([]);
	});
});
