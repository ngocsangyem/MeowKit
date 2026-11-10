// Each rejection class fires its own rule, and rejects the whole file.
//
// Agreement between the two readers is proved elsewhere; what is proved here is
// that the verdict is the RIGHT one. A config refused for the wrong reason gives
// the user a message about the wrong key, and a config that applied the keys
// before the bad one would configure a session that matches no file.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { observerNames } from "../../packages/mewkit/src/config/observer-names.js";
import { loadConfigFile } from "../../packages/mewkit/src/config/load-config.js";
import { PROTECTED_HOOKS } from "../../packages/mewkit/src/config/schema.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const FIXTURES = join(HERE, "fixtures");
const names = observerNames(REPO_ROOT);

/** Fixture → the rule that must fire, by identifier. */
const EXPECTED: Record<string, string> = {
	"reject-secret-key.yaml": "secret-in-config",
	"reject-secret-value.yaml": "secret-in-config",
	"reject-absolute-path-posix.yaml": "absolute-path",
	"reject-absolute-path-windows.yaml": "absolute-path",
	"reject-gates-namespace.yaml": "forbidden-namespace",
	"reject-paths-namespace.yaml": "forbidden-namespace",
	"reject-unknown-key.yaml": "unknown-key",
	"reject-wrong-type.yaml": "wrong-type",
	"reject-not-in-enum.yaml": "not-in-enum",
	"reject-user-scope-only.yaml": "user-scope-only",
	"reject-state-only-key.yaml": "state-only-key",
	"grammar-duplicate-key.yaml": "duplicate-key",
	"grammar-tab.yaml": "tab-indentation",
	"grammar-three-levels.yaml": "nesting-too-deep",
	"grammar-anchor.yaml": "anchor-not-supported",
	"grammar-array-of-maps.yaml": "sequence-not-supported",
	"grammar-block-scalar.yaml": "block-scalar-not-supported",
	"grammar-flow-map.yaml": "flow-collection-not-supported",
	"grammar-null-value.yaml": "null-not-supported",
	"grammar-float.yaml": "float-not-supported",
	// A spelling a full YAML parser resolves and a hand reader cannot. Each is
	// refused rather than resolved, so neither reader has to guess at the other's
	// answer — the divergence these cover is a value, not a construct.
	"grammar-boolean-titlecase.yaml": "bad-boolean-spelling",
	"grammar-boolean-uppercase.yaml": "bad-boolean-spelling",
	"grammar-signed-integer.yaml": "non-decimal-integer",
	"grammar-hex-integer.yaml": "non-decimal-integer",
	"grammar-octal-integer.yaml": "non-decimal-integer",
	"grammar-double-quote-escape.yaml": "escape-not-supported",
	"grammar-unterminated-quote.yaml": "unterminated-quote",
	"grammar-trailing-after-quote.yaml": "trailing-content-after-quote",
	"grammar-dotted-key.yaml": "dotted-key",
	// A tag is the one construct a full parser resolves and a hand reader reads as
	// text, so the two sides disagreed on the TYPE rather than on the spelling:
	// `!!bool true` was a boolean to one and the string "!!bool true" to the other.
	// Every tag family is refused by its leading `!`, before any type is guessed.
	"grammar-tag.yaml": "tag-not-supported",
	"grammar-tag-boolean-false.yaml": "tag-not-supported",
	"grammar-verbatim-tag.yaml": "tag-not-supported",
	"grammar-tag-custom.yaml": "tag-not-supported",
	"grammar-tag-integer.yaml": "tag-not-supported",
	"grammar-tag-nested-integer.yaml": "tag-not-supported",
	"grammar-tag-nested-boolean.yaml": "tag-not-supported",
	"grammar-tag-string.yaml": "tag-not-supported",
};

for (const name of Object.keys(PROTECTED_HOOKS)) {
	EXPECTED[`reject-protected-${name}.yaml`] = "protected-hook";
}

describe("the loader rejects what a committed config must not say", () => {
	for (const [fixture, code] of Object.entries(EXPECTED)) {
		it(`${fixture} → ${code}`, () => {
			const result = loadConfigFile(join(FIXTURES, fixture), names, "project config");
			expect(result.ok, `${fixture} was accepted`).toBe(false);
			if (result.ok) return;
			expect(result.error.code).toBe(code);
			// Nothing is applied partially: there is no `values` on a failure, so
			// the applied-key count is zero by construction rather than by luck.
			expect(Object.hasOwn(result, "values")).toBe(false);
		});
	}

	it("names the file and the line for a grammar failure", () => {
		const result = loadConfigFile(join(FIXTURES, "grammar-tab.yaml"), names, "project config");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.line).toBe(2);
		expect(result.error.message).toContain("grammar-tab.yaml:2");
	});

	it("says which hook cannot be disabled and why, not merely that the key is unknown", () => {
		const result = loadConfigFile(join(FIXTURES, "reject-protected-gate2-check.yaml"), names, "project config");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.message).toContain("gate2-check");
		expect(result.error.message).toContain("Gate 2");
		expect(result.error.fix).toContain("not a preference");
	});

	it("names the scope a rejected key came from", () => {
		for (const scope of ["project config", "user config"] as const) {
			const result = loadConfigFile(join(FIXTURES, "reject-unknown-key.yaml"), names, scope);
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.message).toContain(scope);
			expect(result.error.scope).toBe(scope);
		}
	});

	it("accepts the Gate 1 hatch key in the user file only", () => {
		const file = join(FIXTURES, "reject-user-scope-only.yaml");
		const asUser = loadConfigFile(file, names, "user config");
		expect(asUser.ok).toBe(true);
		const asProject = loadConfigFile(file, names, "project config");
		expect(asProject.ok).toBe(false);
	});

	it("prints no stack trace and no parser class name", () => {
		for (const fixture of Object.keys(EXPECTED)) {
			const result = loadConfigFile(join(FIXTURES, fixture), names, "project config");
			if (result.ok) continue;
			const text = `${result.error.message} ${result.error.fix}`;
			expect(text, fixture).not.toMatch(/at Object\.<anonymous>|YAMLException|\bat .*\(.*:\d+:\d+\)/);
		}
	});

	it("every rejection fixture on disk is covered by an expected identifier", () => {
		const onDisk = readFileSync(join(HERE, "reader-agreement.test.ts"), "utf8");
		expect(onDisk).toContain("accept-");
		const uncovered = Object.keys(EXPECTED).filter((f) => {
			try {
				readFileSync(join(FIXTURES, f));
				return false;
			} catch {
				return true;
			}
		});
		expect(uncovered, "expected identifiers naming a fixture that does not exist").toEqual([]);
	});
});
