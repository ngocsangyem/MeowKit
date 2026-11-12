// `--dry-run` and `--json` on the mutating commands that did not have them.
//
// Two properties per command, and they are the two a caller depends on: a dry run
// leaves the project byte-identical (compared by a recursive checksum manifest of
// everything, not by a spot check), and `--json` puts exactly one parseable
// document on stdout with the narration moved to stderr rather than deleted.
import { describe, expect, it } from "vitest";

import { createProject, installFixture, runMewkit, type Fixture, type RunResult } from "./install-harness.js";
import { manifest } from "./lib/uninstall-fixture.js";

interface Envelope {
	ok: boolean;
	command: string;
	dryRun: boolean;
	planned: { action: string; path: string; detail?: string }[];
	applied: { action: string; path: string }[];
	notes: string[];
	error?: string;
}

/** Parsing the WHOLE of stdout is the assertion: one document, no prose around it. */
const envelope = (run: RunResult): Envelope => JSON.parse(run.stdout) as Envelope;
const paths = (items: { path: string }[]): string[] => items.map((i) => i.path).sort();

/** Every file in the project, so "wrote nothing" is a comparison and not a sample. */
const whole = (fx: Fixture): Record<string, string> => manifest(fx.root, ".");

/** The closed mutating set, and the one place a user looks for a flag. */
const MUTATING = ["init", "upgrade", "setup", "uninstall", "backups", "pack"];

describe("the mutating set declares both flags", () => {
	it("every one shows --json and --dry-run in its own help section", () => {
		const fx = createProject();
		// CI=true turns colour on, and the escape codes around a section heading
		// would hide it from the split below.
		const help = runMewkit(fx, ["--help"], { NO_COLOR: "1" }).stdout;
		for (const verb of MUTATING) {
			const section = help.split(`\n${verb} options:\n`)[1]?.split("\n\n")[0] ?? "";
			expect(section, `${verb} has no help section`).not.toBe("");
			expect(section, `${verb} does not declare --json`).toContain("--json");
			expect(section, `${verb} does not declare --dry-run`).toContain("--dry-run");
		}
	});
});

describe("init", () => {
	it("--json emits one envelope on stdout and narrates on stderr", () => {
		const fx = createProject();
		const run = runMewkit(fx, ["init", "--yes", "--json"]);
		expect(run.status, run.stderr.slice(-1500)).toBe(0);
		const env = envelope(run);
		expect(env.command).toBe("init");
		expect(env.ok).toBe(true);
		expect(env.dryRun).toBe(false);
		expect(env.notes).toContain("mode: new");
		// The human narration is moved, not lost.
		expect(run.stderr).toContain("MeowKit installed");
		expect(run.stdout).not.toContain("MeowKit installed");
	});

	it("--dry-run --json writes nothing at all", () => {
		const fx = createProject();
		const before = whole(fx);
		const run = runMewkit(fx, ["init", "--yes", "--dry-run", "--json"]);
		expect(run.status).toBe(0);
		const env = envelope(run);
		expect(env.dryRun).toBe(true);
		expect(env.applied).toEqual([]);
		expect(whole(fx)).toEqual(before);
	});
});

describe("setup", () => {
	it("--dry-run writes nothing, and what it planned is what a real run then does", () => {
		const { fx, run: install } = installFixture();
		expect(install.status, install.all.slice(-1500)).toBe(0);
		const before = whole(fx);

		const dry = envelope(runMewkit(fx, ["setup", "--dry-run", "--json"]));
		expect(dry.dryRun).toBe(true);
		expect(dry.applied).toEqual([]);
		expect(dry.planned.length).toBeGreaterThan(0);
		expect(whole(fx)).toEqual(before);

		// The same plan printed for a human, item for item.
		const human = runMewkit(fx, ["setup", "--dry-run"]);
		for (const change of dry.planned) expect(human.stdout).toContain(change.path);
		expect(whole(fx)).toEqual(before);

		const real = envelope(runMewkit(fx, ["setup", "--json"]));
		expect(real.dryRun).toBe(false);
		expect(paths(real.applied)).toEqual(paths(dry.planned));
		expect(whole(fx)).not.toEqual(before);
	});

	it("without --yes in a non-TTY it still succeeds — it destroys nothing", () => {
		const { fx } = installFixture();
		const run = runMewkit(fx, ["setup"]);
		expect(run.status).toBe(0);
	});
});

describe("pack add / pack remove", () => {
	it("remove --dry-run plans the deletions and performs none", () => {
		const { fx } = installFixture();
		const before = whole(fx);
		const dry = envelope(runMewkit(fx, ["pack", "remove", "testing", "--dry-run", "--json"]));
		expect(dry.command).toBe("pack remove");
		expect(dry.dryRun).toBe(true);
		expect(dry.planned.length).toBeGreaterThan(0);
		expect(dry.planned.every((c) => c.action === "delete")).toBe(true);
		expect(dry.applied).toEqual([]);
		expect(whole(fx)).toEqual(before);

		const real = envelope(runMewkit(fx, ["pack", "remove", "testing", "--yes", "--json"]));
		expect(paths(real.applied)).toEqual(paths(dry.planned));
	});

	it("add --dry-run plans the writes and performs none", () => {
		const { fx } = installFixture();
		expect(runMewkit(fx, ["pack", "remove", "testing", "--yes"]).status).toBe(0);
		const before = whole(fx);
		const dry = envelope(runMewkit(fx, ["pack", "add", "testing", "--dry-run", "--json"]));
		expect(dry.command).toBe("pack add");
		expect(dry.dryRun).toBe(true);
		expect(dry.planned.length).toBeGreaterThan(0);
		expect(dry.applied).toEqual([]);
		expect(whole(fx)).toEqual(before);

		const real = envelope(runMewkit(fx, ["pack", "add", "testing", "--json"]));
		expect(real.dryRun).toBe(false);
		expect(paths(real.planned)).toEqual(paths(dry.planned));
		expect(whole(fx)).not.toEqual(before);
	});
});

describe("upgrade", () => {
	it("--dry-run --json plans the next release and writes nothing", () => {
		const { fx } = installFixture();
		const before = whole(fx);
		const dry = envelope(runMewkit(fx, ["upgrade", "--yes", "--dry-run", "--json"], {}, "9.9.10-fixture"));
		expect(dry.command).toBe("upgrade");
		expect(dry.dryRun).toBe(true);
		expect(dry.applied).toEqual([]);
		expect(whole(fx)).toEqual(before);
	});
});
