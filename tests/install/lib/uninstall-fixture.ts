// One recipe for the uninstall fixtures, used by both test files.
//
// Two files share it rather than each building a tree: a divergence between two
// recipes would read as a behaviour difference in the command under test, which
// is the same reason the port replay harness reuses its corpus cases.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { expect } from "vitest";

import { installFixture, type Fixture } from "../install-harness.js";

/** A file of each never-delete class, so "your data survives" is a comparison. */
export const PROTECTED_SAMPLES = [
	join(".meowkit", "memory", "decisions.md"),
	join(".meowkit", "telemetry", "cost-log"),
	join(".meowkit", "state", "fixture-flag"),
	join(".meowkit", "envs", "keep"),
	join(".meowkit", ".env"),
];

/** A file the user wrote inside the kit tree — the `orphan` class. */
export const USER_SKILL = join(".claude", "skills", "fixture-user-skill", "SKILL.md");

/** One kit file edited, so the `modified` class is non-empty. */
export const MODIFIED_REL = join(".claude", "hooks", "dispatch.cjs");

export const sha = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");

/** A recursive checksum manifest, so "nothing else changed" is a comparison. */
export function manifest(root: string, dir: string, out: Record<string, string> = {}): Record<string, string> {
	const abs = join(root, dir);
	if (!existsSync(abs)) return out;
	for (const name of readdirSync(abs)) {
		if (name === ".git") continue;
		const rel = join(dir, name);
		const st = statSync(join(root, rel));
		if (st.isDirectory()) manifest(root, rel, out);
		else out[rel] = sha(join(root, rel));
	}
	return out;
}

export function seed(fx: Fixture): void {
	for (const rel of PROTECTED_SAMPLES) {
		mkdirSync(join(fx.root, rel, ".."), { recursive: true });
		writeFileSync(join(fx.root, rel), `fixture ${rel}\n`, "utf8");
	}
	mkdirSync(join(fx.root, USER_SKILL, ".."), { recursive: true });
	writeFileSync(join(fx.root, USER_SKILL), "# a skill the user wrote\n", "utf8");
}

/** A fresh install per case: the invocations must not see each other's work. */
export function fresh(): Fixture {
	const { fx, run } = installFixture();
	expect(run.status, run.all.slice(-2000)).toBe(0);
	seed(fx);
	writeFileSync(join(fx.root, MODIFIED_REL), `${readFileSync(join(fx.root, MODIFIED_REL), "utf8")}\n// edited by the project\n`, "utf8");
	return fx;
}

export interface UninstallJson {
	ok: boolean;
	classes: Record<string, string[]>;
	planned: string[];
	deleted: string[];
	cache: { state: string; cachedVersion: string | null; recordedVersion: string | null };
	refusals: { path: string; reason: string }[];
	error?: string;
	fix?: string;
}

export const parse = (text: string): UninstallJson => JSON.parse(text) as UninstallJson;
