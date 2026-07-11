// Phase 3 slice 2: real host-availability probes for `capabilities resolve`. Probes are
// exercised against a temp project root (deterministic filesystem) + real PATH lookups
// for a binary that exists (node) and one that does not.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hostProbes } from "../capabilities.js";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function makeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-hostprobe-"));
	dirs.push(root);
	return root;
}

describe("hostProbes.containedFileExists", () => {
	it("returns true for an existing contained path", () => {
		const root = makeRoot();
		mkdirSync(join(root, "tasks"));
		expect(hostProbes(root).containedFileExists("tasks")).toBe(true);
	});

	it("returns false for a path-shaped id that is absent", () => {
		expect(hostProbes(makeRoot()).containedFileExists("docs/project-context.md")).toBe(false);
	});

	it("returns null for a bare, absent logical id (undetermined, not a false 'unavailable')", () => {
		expect(hostProbes(makeRoot()).containedFileExists("some-logical-name")).toBeNull();
	});

	it("returns false for a path that escapes the project root", () => {
		expect(hostProbes(makeRoot()).containedFileExists("../../etc/passwd")).toBe(false);
	});

	it("returns false for an in-root symlink that points OUTSIDE the tree (true containment)", () => {
		const root = makeRoot();
		const outside = makeRoot(); // a separate real dir outside `root`
		symlinkSync(outside, join(root, "link"));
		// abs = root/link exists, but its real path is outside root ⇒ not contained.
		expect(hostProbes(root).containedFileExists("link")).toBe(false);
	});

	it("returns null for empty or '.' ids (not a concrete requirement path)", () => {
		const p = hostProbes(makeRoot());
		expect(p.containedFileExists("")).toBeNull();
		expect(p.containedFileExists(".")).toBeNull();
	});
});

describe("hostProbes.mcpServerConfigured", () => {
	it("returns null when no .mcp.json is present", () => {
		expect(hostProbes(makeRoot()).mcpServerConfigured("jira")).toBeNull();
	});

	it("returns true/false by server presence in .mcp.json (no secrets read)", () => {
		const root = makeRoot();
		writeFileSync(join(root, ".mcp.json"), JSON.stringify({ mcpServers: { jira: { command: "x" } } }));
		const p = hostProbes(root);
		expect(p.mcpServerConfigured("jira")).toBe(true);
		expect(p.mcpServerConfigured("slack")).toBe(false);
	});

	it("honors the `servers` fallback key", () => {
		const root = makeRoot();
		writeFileSync(join(root, ".mcp.json"), JSON.stringify({ servers: { jira: {} } }));
		expect(hostProbes(root).mcpServerConfigured("jira")).toBe(true);
	});

	it("returns null on malformed .mcp.json (graceful, no throw)", () => {
		const root = makeRoot();
		writeFileSync(join(root, ".mcp.json"), "{not valid json");
		expect(hostProbes(root).mcpServerConfigured("jira")).toBeNull();
	});
});

describe("hostProbes.commandExists", () => {
	it("detects a present binary and a missing one", () => {
		const p = hostProbes(makeRoot());
		expect(p.commandExists("node")).toBe(true);
		expect(p.commandExists("definitely-not-a-real-binary-xyzzy")).toBe(false);
	});
});
