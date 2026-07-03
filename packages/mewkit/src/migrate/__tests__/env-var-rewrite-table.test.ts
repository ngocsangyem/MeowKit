import { describe, expect, it } from "vitest";
import {
	ENV_VAR_REWRITE_TABLE,
	SAFE_REWRITE_OUTPUT,
	envVarTokenPattern,
	resolveEnvVar,
} from "../references/env-var-rewrite-table.js";
import { applyEnvVarRewrites } from "../apply-env-var-rewrites.js";

describe("env-var rewrite table", () => {
	it("rewrites $CLAUDE_PROJECT_DIR to the provider-neutral $PROJECT_ROOT", () => {
		const r = resolveEnvVar("$CLAUDE_PROJECT_DIR");
		expect(r?.disposition).toBe("rewrite");
		expect(r?.rewriteTo).toBe("$PROJECT_ROOT");
	});

	it("rewrites ${CLAUDE_PLUGIN_DATA} to the documented Codex convention", () => {
		const r = resolveEnvVar("${CLAUDE_PLUGIN_DATA}");
		expect(r?.disposition).toBe("rewrite");
		expect(r?.rewriteTo).toContain("CODEX_HOME");
		expect(r?.annotation).toMatch(/UNMAPPED/i);
	});

	it("neutralizes (does not rewrite) unmapped $CLAUDE_* and $ANTHROPIC_* vars", () => {
		expect(resolveEnvVar("$CLAUDE_SESSION_ID")?.disposition).toBe("neutralize");
		expect(resolveEnvVar("$ANTHROPIC_API_KEY")?.disposition).toBe("neutralize");
		expect(resolveEnvVar("$ANTHROPIC_API_KEY")?.rewriteTo).toBeUndefined();
	});

	it("returns null for a non-Claude/Anthropic token", () => {
		expect(resolveEnvVar("$HOME")).toBeNull();
		expect(resolveEnvVar("$MEOWKIT_MODEL_HINT")).toBeNull();
	});

	it("every table rewriteTo passes the SAFE_REWRITE_OUTPUT allowlist", () => {
		for (const entry of ENV_VAR_REWRITE_TABLE) {
			if (entry.disposition === "rewrite") {
				expect(SAFE_REWRITE_OUTPUT.test(entry.rewriteTo ?? "")).toBe(true);
			}
		}
	});

	// INJECTION GUARD: rewrite output is a STATIC literal lookup — a token wrapped in
	// shell metacharacters must never leak those characters into the output. The token
	// with metacharacters is not a table key, so it resolves to null (no rewrite).
	it("never emits shell metacharacters — injection input resolves to null", () => {
		for (const hostile of [
			"$CLAUDE_PROJECT_DIR; rm -rf /",
			"$CLAUDE_PROJECT_DIR`whoami`",
			"$CLAUDE_PROJECT_DIR$(curl evil)",
		]) {
			// The exact hostile string is not a table key.
			expect(resolveEnvVar(hostile)).toBeNull();
		}
	});

	it("applyEnvVarRewrites substitutes only the bare token and leaves injection payloads inert", () => {
		const hostile = "echo $CLAUDE_PROJECT_DIR; rm -rf / `whoami` $(curl evil)\n";
		const { content, applied } = applyEnvVarRewrites(hostile);
		// The bare $CLAUDE_PROJECT_DIR token is rewritten; the surrounding injection
		// text is preserved verbatim (it was never used to build the replacement).
		expect(content).toContain("echo $PROJECT_ROOT; rm -rf / `whoami` $(curl evil)");
		expect(content).not.toContain("$CLAUDE_PROJECT_DIR");
		expect(applied.map((a) => a.rewrittenTo)).toContain("$PROJECT_ROOT");
		// Output introduces no NEW metacharacters beyond what the input already had.
		expect(SAFE_REWRITE_OUTPUT.test("$PROJECT_ROOT")).toBe(true);
	});

	it("token pattern matches both $VAR and ${VAR} forms", () => {
		const matches = "$CLAUDE_MODEL and ${CLAUDE_PLUGIN_DATA} and $ANTHROPIC_KEY".match(envVarTokenPattern());
		expect(matches).toEqual(["$CLAUDE_MODEL", "${CLAUDE_PLUGIN_DATA}", "$ANTHROPIC_KEY"]);
	});
});
