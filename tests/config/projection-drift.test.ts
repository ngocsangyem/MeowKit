// What a Codex or Cursor install lays down cannot instruct an agent to read a
// variable the kit deleted.
//
// Skills and agents are projected from `.claude/`, which the environment-name
// scan covers. The files under `kit/overlays/` are written by hand for one
// runtime and are outside that scan — were they in scope, an overlay's own copy
// of a name would keep that name in the universe for ever — which makes them the
// one door a deletion can leak through unseen. So a dropped name is held to the
// same retention list here as everywhere else.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const TABLE_REL = "env-name-classification.json";
const PROJECTION_DIRS = ["kit/overlays"];

interface Table {
	names: { name: string; class: string }[];
	retainedDropOccurrences: Record<string, { in: string[]; why: string } | string>;
}

const table = require_(join(REPO_ROOT, TABLE_REL)) as Table;

/** Every projection file naming `name` as a whole word. */
function projectionFiles(name: string): string[] {
	const result = spawnSync("grep", ["-rlwE", name, ...PROJECTION_DIRS, "--binary-files=without-match"], {
		cwd: REPO_ROOT,
		encoding: "utf8",
	});
	return (result.stdout ?? "")
		.split("\n")
		.map((s) => s.trim())
		.filter((s) => s !== "");
}

/** Where the table says a dropped name may still appear, if anywhere. */
function retainedIn(name: string): string[] {
	const entry = table.retainedDropOccurrences[name];
	return entry !== undefined && typeof entry !== "string" ? entry.in : [];
}

// No environment name is written literally anywhere below. This file sits in a
// scanned tree, so a name spelled here would put itself back into the universe
// the scan defines — the same reason the classification table lives outside
// every scanned tree. Every probe is derived from that table instead.
describe("the provider projections carry no deleted environment variable", () => {
	/** Dropped names the table retains specifically inside the projections tree. */
	const retainedHere = Object.entries(table.retainedDropOccurrences)
		.filter(
			([key, value]) =>
				key !== "comment" &&
				typeof value !== "string" &&
				value.in.some((a) => PROJECTION_DIRS.some((dir) => a.includes(dir))),
		)
		.map(([key]) => key);

	it("has a tree to check, dropped names to check for, and a working probe", () => {
		expect(table.names.filter((r) => r.class === "drop").length).toBeGreaterThan(0);
		// A positive control: a name the kit keeps must be found by the same call
		// the check below relies on, so a zero result there is evidence of absence
		// rather than of a broken or mis-rooted grep.
		const kept = table.names.filter((r) => r.class !== "drop");
		expect(
			kept.some((r) => projectionFiles(r.name).length > 0),
			"the probe finds no kept name either",
		).toBe(true);
		for (const name of retainedHere) expect(projectionFiles(name).length, name).toBeGreaterThan(0);
	});

	it("names a dropped variable only where its retention reason allows", () => {
		const strays: string[] = [];
		for (const row of table.names.filter((r) => r.class === "drop")) {
			const allowed = retainedIn(row.name);
			strays.push(
				...projectionFiles(row.name)
					.filter((file) => !allowed.some((a) => file.includes(a)))
					.map((file) => `${row.name} at ${file}`),
			);
		}
		expect(strays, "a projection instructs an agent to read a variable the kit deleted").toEqual([]);
	});
});
