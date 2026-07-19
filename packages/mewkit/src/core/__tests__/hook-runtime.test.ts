// Runtime-descriptor contract: write is refused for an out-of-project/missing executable, read
// re-validates the trust gate (absolute + exists + inside project), and a tampered/missing
// descriptor degrades to a reason (never throws). This is the gate that keeps a hook from ever
// running an arbitrary binary.
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	writeRuntimeDescriptor,
	readRuntimeDescriptor,
	executableIsTrusted,
	descriptorPath,
	resolveInProjectExecutable,
} from "../hook-runtime.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
function makeProject(): { root: string; claudeDir: string; bin: string } {
	const root = mkdtempSync(join(tmpdir(), "mewkit-runtime-"));
	roots.push(root);
	const claudeDir = join(root, ".claude");
	mkdirSync(claudeDir, { recursive: true });
	// A real in-project "executable" file (content irrelevant to the trust gate).
	const binDir = join(root, "node_modules", ".bin");
	mkdirSync(binDir, { recursive: true });
	const bin = join(binDir, "mewkit");
	writeFileSync(bin, "#!/usr/bin/env node\n");
	return { root, claudeDir, bin };
}
const NOW = "2026-07-19T20:00:00.000Z";

describe("executableIsTrusted", () => {
	it("accepts an existing absolute file inside the project", () => {
		const { root, bin } = makeProject();
		expect(executableIsTrusted(bin, root)).toBe(true);
	});
	it("rejects a relative path, a non-existent file, and a path outside the project", () => {
		const { root, bin } = makeProject();
		expect(executableIsTrusted("node_modules/.bin/mewkit", root)).toBe(false);
		expect(executableIsTrusted(join(root, "nope"), root)).toBe(false);
		expect(executableIsTrusted("/usr/local/bin/mewkit", root)).toBe(false);
		expect(executableIsTrusted("/tmp/evil", root)).toBe(false);
		expect(bin).toBeTruthy();
	});

	it("rejects a symlink at an in-project path whose REAL target escapes the project", () => {
		const { root } = makeProject();
		// An external target, and an in-project symlink pointing at it (the tampered-runtime case).
		const outside = mkdtempSync(join(tmpdir(), "mewkit-outside-"));
		roots.push(outside);
		const evil = join(outside, "evil");
		writeFileSync(evil, "#!/bin/sh\n");
		const link = join(root, "node_modules", ".bin", "evil-link");
		symlinkSync(evil, link);
		// Lexically the link is inside the project, but its real target is not → must be rejected.
		expect(executableIsTrusted(link, root)).toBe(false);
	});
});

describe("write + read round-trip", () => {
	it("writes a descriptor for an in-project executable and reads it back", async () => {
		const { root, claudeDir, bin } = makeProject();
		await writeRuntimeDescriptor(claudeDir, { executable: bin, packageVersion: "1.18.2", now: NOW });
		const res = readRuntimeDescriptor(claudeDir);
		expect("descriptor" in res && res.descriptor.executable).toBe(bin);
		expect(existsSync(descriptorPath(claudeDir))).toBe(true);
	});

	it("REFUSES to write a descriptor for an executable outside the project", async () => {
		const { claudeDir } = makeProject();
		await expect(
			writeRuntimeDescriptor(claudeDir, { executable: "/usr/local/bin/mewkit", packageVersion: "x", now: NOW }),
		).rejects.toThrow(/refusing to write runtime descriptor/);
	});
});

describe("read-side validation (hostile / stale descriptor)", () => {
	it("returns a reason for a missing descriptor", () => {
		const { claudeDir } = makeProject();
		expect(readRuntimeDescriptor(claudeDir)).toEqual({ reason: "no runtime descriptor" });
	});

	it("rejects a descriptor whose executable escaped the project (tampered)", () => {
		const { claudeDir } = makeProject();
		writeFileSync(
			descriptorPath(claudeDir),
			JSON.stringify({ schemaVersion: "1.0", executable: "/tmp/evil", packageVersion: "x", writtenAt: NOW }),
		);
		const res = readRuntimeDescriptor(claudeDir);
		expect("reason" in res && res.reason).toMatch(/outside the project boundary/);
	});

	it("rejects a corrupt descriptor without throwing", () => {
		const { claudeDir } = makeProject();
		writeFileSync(descriptorPath(claudeDir), "{ not json");
		expect("reason" in readRuntimeDescriptor(claudeDir)).toBe(true);
	});
});

describe("resolveInProjectExecutable", () => {
	it("finds node_modules/.bin/mewkit when present", () => {
		const { root, bin } = makeProject();
		expect(resolveInProjectExecutable(root)).toBe(bin);
	});
	it("returns null when no in-project executable exists", () => {
		const root = mkdtempSync(join(tmpdir(), "mewkit-runtime-empty-"));
		roots.push(root);
		expect(resolveInProjectExecutable(root)).toBeNull();
	});
});
