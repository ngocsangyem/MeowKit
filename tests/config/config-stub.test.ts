// The file `init` writes: a commented stub per key, one live schema pointer, and
// no key the schema does not have.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { loadConfigFile } from "../../packages/mewkit/src/config/load-config.js";
import { observerNames } from "../../packages/mewkit/src/config/observer-names.js";
import { KEY_DOC, knownKeys, SCHEMA_URL } from "../../packages/mewkit/src/config/schema.js";
import { renderConfigStub } from "../../packages/mewkit/src/config/write-stub.js";

const require_ = createRequire(import.meta.url);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const names = observerNames(REPO_ROOT);

describe("the config stub", () => {
	const body = renderConfigStub(names);
	const lines = body.split("\n").filter((l) => l.trim() !== "");

	it("has exactly one live line, the schema pointer", () => {
		const live = lines.filter((l) => !l.startsWith("#"));
		expect(live).toEqual([`$schema: ${SCHEMA_URL}`]);
	});

	it("points at the schema the generator publishes", () => {
		const schema = require_(join(REPO_ROOT, "packages/mewkit/schemas/config-v1.json")) as { $id: string };
		expect(schema.$id).toBe(SCHEMA_URL);
	});

	it("carries a stub for every schema key and nothing else", () => {
		const stubbed = new Set<string>();
		let group = "";
		for (const raw of lines) {
			const line = raw.replace(/^#/, "");
			// An explanation line, not a stub.
			if (line.trimStart().startsWith("#")) continue;
			const match = /^(\s*)([A-Za-z$][A-Za-z0-9_.-]*):(.*)$/.exec(line);
			if (match === null) continue;
			const [, indent, key, rest] = match;
			if (indent === "" && rest.trim() === "") {
				group = key;
				continue;
			}
			if (key === "$schema") continue;
			stubbed.add(indent === "" ? key : `${group}.${key}`);
		}
		expect([...stubbed].sort()).toEqual(Object.keys(knownKeys(names)).sort());
	});

	it("never declares pm.auto, which has no reader", () => {
		expect(body).not.toContain("pm.auto");
		expect(body).not.toMatch(/^#?\s*pm:/m);
	});

	// The stub is the kit's own instruction to the user about a brake on spending,
	// and the only code that reads these three keys is the budget tracker. So the
	// unit the stub documents and the numbers it ships are asserted against that
	// handler's literal defaults rather than against a second copy of them here.
	describe("the budget stub says what the tracker reads", () => {
		const tracker = readFileSync(join(REPO_ROOT, ".claude/hooks/handlers/budget-tracker.cjs"), "utf8");
		const defaultOf = (key: string): number => {
			const pattern = new RegExp(`values\\['budget\\.${key}'\\][^;]*?:\\s*(\\d+)`, "s");
			const match = pattern.exec(tracker);
			expect(match, `no default for budget.${key} in the tracker`).not.toBeNull();
			return Number((match as RegExpExecArray)[1]);
		};
		const stubValue = (leaf: string): number => {
			const match = new RegExp(`^#\\s{2}${leaf}: (-?\\d+)$`, "m").exec(body);
			expect(match, `no budget.${leaf} stub line`).not.toBeNull();
			return Number((match as RegExpExecArray)[1]);
		};

		it("ships the tracker's own warn and block thresholds", () => {
			expect(stubValue("warn")).toBe(defaultOf("warn"));
			expect(stubValue("block")).toBe(defaultOf("block"));
		});

		it("never raises the hard block, which budget.cap overrides", () => {
			expect(stubValue("cap")).toBeLessThanOrEqual(stubValue("block"));
		});

		it("documents all three in the unit the tracker compares them in", () => {
			expect(tracker).toContain("in USD");
			for (const key of ["budget.cap", "budget.warn", "budget.block"]) {
				expect(KEY_DOC[key], key).toContain("USD");
				expect(KEY_DOC[key], key).not.toContain("token");
				expect(KEY_DOC[key], key).not.toContain("percent");
			}
		});
	});

	it("loads cleanly, so an installed project is not born misconfigured", () => {
		const file = join(REPO_ROOT, "tests", "config", "fixtures", "accept-schema-pointer.yaml");
		// The stub's own live content is the schema pointer, which the committed
		// corpus covers on both readers; this asserts the loader accepts it.
		expect(readFileSync(file, "utf8")).toContain("$schema:");
		const result = loadConfigFile(file, names, "project config");
		expect(result.ok).toBe(true);
	});
});

describe("the config stub with migrated values", () => {
	it("uncomments only the keys that were chosen, and opens their parent", () => {
		const body = renderConfigStub(names, { "hooks.budget-tracker": "false", "budget.cap": "123" });
		expect(body).toMatch(/^budget:$/m);
		expect(body).toMatch(/^ {2}cap: 123$/m);
		expect(body).toMatch(/^# {2}warn: /m);
		expect(body).toMatch(/^hooks:$/m);
		expect(body).toMatch(/^ {2}budget-tracker: false$/m);
		expect(body).toMatch(/^# {2}learning-observer: false$/m);
	});

	it("is accepted by the loader with those values applied", () => {
		const body = renderConfigStub(names, { "hooks.budget-tracker": "false", "budget.cap": "123" });
		// Round-trip through the real loader. Written OUTSIDE the committed
		// corpus, which the reader-agreement suite enumerates by extension.
		const dir = mkdtempSync(join(tmpdir(), "mewkit-stub-"));
		const file = join(dir, "config.yaml");
		writeFileSync(file, body, "utf8");
		try {
			const result = loadConfigFile(file, names, "project config");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.values["budget.cap"]).toBe(123);
				expect(result.values["hooks.budget-tracker"]).toBe(false);
			}
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
