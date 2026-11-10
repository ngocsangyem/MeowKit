// Every declaration of "which `.meowkit/` files the kit ships" must name the same
// files the release archive actually carries.
//
// The installer copies each `.meowkit/` member it knows about from the release
// and skips, without a word, any the release lacks. So when the archive list
// trailed the installer's list, a real release install silently went without
// three templates, while every fixture — built straight from the repository —
// still had them. Nothing failed until this test compared the lists directly.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { KIT_MEOWKIT_FILES as INSTALLER_MEOWKIT_FILES } from "../../core/install-meowkit-dir.js";
import { REPO } from "./helpers/ship-set-view.js";

interface ShipSetModule {
	ARCHIVE_TARGETS: string[];
	CRITICAL_TARGETS: string[];
	KIT_MEOWKIT_FILES: string[];
	excludeMatcher: (patterns: string[]) => (rel: string) => boolean;
	shipSetExclusions: (root: string) => string[];
	shipSetFiles: (root: string, isExcluded: (rel: string) => boolean) => string[];
}

const shipSet = createRequire(import.meta.url)(join(REPO, "scripts", "kit-ship-set.cjs")) as ShipSetModule;

const posix = (p: string): string => p.replace(/\\/g, "/");
const sorted = (names: readonly string[]): string[] => [...names].sort();
const shippedNames = sorted(shipSet.KIT_MEOWKIT_FILES);

describe("shipped .meowkit/ files", () => {
	it("are the same files the installer lays down", () => {
		expect(sorted(INSTALLER_MEOWKIT_FILES)).toEqual(shippedNames);
	});

	it("are each an archive root and a critical one", () => {
		const archived = shipSet.ARCHIVE_TARGETS.map(posix).filter((t) => t.startsWith(".meowkit/"));
		const critical = shipSet.CRITICAL_TARGETS.map(posix).filter((t) => t.startsWith(".meowkit/"));
		const expected = shippedNames.map((name) => `.meowkit/${name}`);
		expect(sorted(archived)).toEqual(expected);
		expect(sorted(critical)).toEqual(expected);
	});

	it("include every .meowkit/ file the pack manifest's base.files declares", () => {
		const manifest = JSON.parse(readFileSync(join(REPO, ".meowkit", "pack-manifest.json"), "utf8")) as {
			base: { files: string[] };
		};
		const trackedMeowkit = new Set(
			execFileSync("git", ["ls-files", ".meowkit"], { cwd: REPO, encoding: "utf8" })
				.split("\n")
				.filter((line) => line !== ""),
		);
		// base.files mixes `.claude/`-relative names with `.meowkit/` ones; a name
		// that is a tracked `.meowkit/` file is a claim that the kit ships it.
		const declared = manifest.base.files.filter((name) => trackedMeowkit.has(`.meowkit/${name}`));
		expect(declared.length).toBeGreaterThan(0);
		for (const name of declared) expect(shippedNames).toContain(name);
	});

	it("actually land in the archive's file list", () => {
		const isExcluded = shipSet.excludeMatcher(shipSet.shipSetExclusions(REPO));
		const files = new Set(shipSet.shipSetFiles(REPO, isExcluded));
		for (const name of shippedNames) expect(files.has(`.meowkit/${name}`)).toBe(true);
	});
});
