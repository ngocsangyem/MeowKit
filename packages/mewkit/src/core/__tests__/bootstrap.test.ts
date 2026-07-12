// Phase 3 slice 2: the capability-resolution bootstrap. It is a TRUSTED CONSTANT — a
// static, human-approved, generic-functional block. These tests gate (a) the model-visible
// budget (fails CI on unapproved growth) and (b) injection-safety / brand-neutrality.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	renderBootstrap,
	estimateTokens,
	BOOTSTRAP_FILENAME,
	BOOTSTRAP_MAX_LINES,
	BOOTSTRAP_MAX_TOKENS,
} from "../bootstrap.js";

const bootstrap = renderBootstrap("claude-code");

const repositoryClaudeDir = fileURLToPath(new URL("../../../../../.claude/", import.meta.url));

describe("bootstrap budget (CI-gated growth)", () => {
	it("stays within the approved line ceiling", () => {
		expect(bootstrap.split("\n").length).toBeLessThanOrEqual(BOOTSTRAP_MAX_LINES);
	});

	it("stays within the approved token ceiling", () => {
		expect(estimateTokens(bootstrap)).toBeLessThanOrEqual(BOOTSTRAP_MAX_TOKENS);
	});
});

describe("bootstrap is a deterministic trusted constant", () => {
	it("returns identical text on every call (not derived from any input/state)", () => {
		expect(renderBootstrap("claude-code")).toBe(renderBootstrap("claude-code"));
	});
});

describe("bootstrap content contract", () => {
	it("names the resolver invocation and the outcome vocabulary", () => {
		expect(bootstrap).toContain("npx mewkit capabilities resolve --intent");
		for (const outcome of ["selected", "ambiguous", "unavailable", "unsupported"]) {
			expect(bootstrap).toContain(`\`${outcome}\``);
		}
	});

	it("tells the model when NOT to resolve (no forced call before ordinary edits)", () => {
		expect(bootstrap.toLowerCase()).toContain("don't resolve");
	});
});

describe("committed bootstrap file (SessionStart hook source) matches the constant", () => {
	it("the live .claude/capability-bootstrap.md is in sync with renderBootstrap()", () => {
		const file = join(repositoryClaudeDir, BOOTSTRAP_FILENAME);
		// The hook emits this committed file; it must not drift from the source constant.
		// Regenerate with `mewkit capabilities bootstrap --write` if this fails.
		expect(existsSync(file), `${BOOTSTRAP_FILENAME} should be committed for the SessionStart hook`).toBe(true);
		expect(readFileSync(file, "utf-8")).toBe(renderBootstrap("claude-code") + "\n");
	});
});

describe("bootstrap injection-safety / brand-neutrality", () => {
	it("contains no instruction-override / injection patterns", () => {
		const lowered = bootstrap.toLowerCase();
		for (const pattern of [
			"ignore previous",
			"disregard",
			"you are now",
			"new system prompt",
			"forget your",
			"pretend you are",
		]) {
			expect(lowered).not.toContain(pattern);
		}
	});

	it("is brand-neutral prose — no toolkit-architecture narrative (only the invocation names the CLI)", () => {
		// The single unavoidable CLI reference is the `mewkit capabilities resolve` invocation
		// line; the surrounding prose must not narrate what MeowKit is.
		const prose = bootstrap.replace(/`npx mewkit capabilities resolve[^`]*`/g, "");
		expect(prose.toLowerCase()).not.toContain("meowkit");
	});
});
