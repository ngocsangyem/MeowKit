import { describe, expect, it } from "vitest";
import { cursorConfig } from "../config.js";
import { cursorContract } from "../contract.js";

// Regression guard for the Cursor capability claims. The legacy .claude→.cursor
// converter must not over-state support: every "documented"/"partial" claim needs a
// source URL, and the converter must not present itself as a fully-verified native
// harness. Deleting or weakening these assertions is the only way to re-introduce the
// over-claim, so the guard is intentionally strict.

const URL_RE = /^https?:\/\/.+/;

describe("cursor capability claims", () => {
	it("every documented/partial capability cites at least one source URL", () => {
		for (const [name, entry] of Object.entries(cursorContract.capabilities)) {
			if (entry.status === "documented" || entry.status === "partial") {
				expect(entry.docs.length, `capability "${name}" claims support without a source`).toBeGreaterThan(0);
				for (const url of entry.docs) expect(url, `capability "${name}" cites a non-URL source`).toMatch(URL_RE);
			}
		}
	});

	it("every documented/partial surface cites at least one source URL", () => {
		for (const [name, entry] of Object.entries(cursorContract.surfaces)) {
			if (!entry) continue;
			if (entry.status === "documented" || entry.status === "partial") {
				expect(entry.docs.length, `surface "${name}" claims support without a source`).toBeGreaterThan(0);
				for (const url of entry.docs) expect(url, `surface "${name}" cites a non-URL source`).toMatch(URL_RE);
			}
		}
	});

	it("registry entry cites a verification date and docs", () => {
		expect(cursorContract.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(cursorContract.docs.length).toBeGreaterThan(0);
		for (const url of cursorContract.docs) expect(url).toMatch(URL_RE);
	});

	it("the legacy converter does not claim a verified native harness", () => {
		// Support is reported per environment (see the native-bundle plan), never via a
		// single "verified" flag; the converter is an honest "experimental" export.
		expect(cursorConfig.supportLevel).not.toBe("verified");
	});

	it("the legacy converter does not claim full native subagents", () => {
		// It projects delegation into .cursor/rules/*.mdc; native .cursor/agents/*.md
		// custom agents ship via the authored bundle, so subagents is at most "partial".
		expect(cursorConfig.subagents).not.toBe("full");
	});
});
