// A project in the v2 shape — a tracked, committed `.meowkit/config.json` and no
// `config.yaml` — and what `doctor` and `upgrade` do with it.
//
// The value being protected is the user's: the old file carries choices someone
// made, so the migration has to carry them across and say by name what it could
// not carry. Deleting the file and writing fresh defaults would be silent data
// loss that looks like a successful upgrade.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createProject, runMewkit, type Fixture } from "./install-harness.js";

/** An installed project put back into the v2 shape, with the old file committed. */
function v2Project(): Fixture {
	const fx = createProject("1.0.0-fixture");
	expect(runMewkit(fx, ["init", "--yes"], {}, "1.0.0-fixture").status).toBe(0);
	rmSync(join(fx.root, ".meowkit", "config.yaml"), { force: true });
	mkdirSync(join(fx.root, ".meowkit"), { recursive: true });
	writeFileSync(
		join(fx.root, ".meowkit", "config.json"),
		`${JSON.stringify(
			{
				$schema: "https://meowkit.dev/schema/config.json",
				version: "1.0.0",
				project: { description: "a project with choices" },
				features: { costTracking: false, memory: false },
			},
			null,
			2,
		)}\n`,
		"utf8",
	);
	// Tracked and committed, as `setup-steps` deliberately left it in v2.
	execFileSync("git", ["add", "-f", ".meowkit/config.json"], { cwd: fx.root });
	execFileSync("git", ["commit", "-qm", "v2 config"], { cwd: fx.root });
	return fx;
}

describe("a v2 project", () => {
	it("is reported as migration-pending by doctor, naming upgrade as the next action", () => {
		const fx = v2Project();
		const run = runMewkit(fx, ["doctor"]);
		expect(run.all).toContain("migration pending");
		expect(run.all).toContain("mewkit upgrade");
	});

	it("is reported as migration-pending by status", () => {
		const fx = v2Project();
		expect(runMewkit(fx, ["status"]).all).toContain("migration pending");
	});

	it("has its values carried across by upgrade, uncommented, and the rest named", () => {
		const fx = v2Project();
		const run = runMewkit(fx, ["upgrade", "--yes"], {}, "2.0.0-fixture");
		expect(run.status).toBe(0);

		// Carried: the two feature switches, named with the key each became.
		expect(run.all).toContain("features.costTracking → hooks.budget-tracker: false");
		expect(run.all).toContain("features.memory → hooks.learning-observer: false");
		// Not carried: named individually, never silently dropped.
		expect(run.all).toContain("not carried");
		expect(run.all).toContain("project.description");
		expect(run.all).toContain("version");

		const yaml = readFileSync(join(fx.root, ".meowkit", "config.yaml"), "utf8");
		// Uncommented — it is the user's explicit choice now.
		expect(yaml).toMatch(/^hooks:$/m);
		expect(yaml).toMatch(/^ {2}budget-tracker: false$/m);
		expect(yaml).toMatch(/^ {2}learning-observer: false$/m);
		// Everything nobody chose stays a commented stub.
		expect(yaml).toMatch(/^#tdd: false$/m);
		expect(yaml).toContain("$schema: https://meowkit.dev/schemas/config-v1.json");
		expect(yaml).not.toContain("pm.auto");

		// The old file is gone, and its contents are in the snapshot the run took.
		expect(existsSync(join(fx.root, ".meowkit", "config.json"))).toBe(false);
		const listed = JSON.parse(runMewkit(fx, ["backups", "list", "--json"]).stdout) as {
			snapshots: { id: string }[];
		};
		const held = listed.snapshots.flatMap((s) => {
			const manifest = JSON.parse(
				readFileSync(join(fx.root, ".meowkit", "backups", s.id, "manifest.json"), "utf8"),
			) as { files: { path: string }[] };
			return manifest.files.map((f) => f.path);
		});
		expect(held).toContain(join(".meowkit", "config.json"));
	});

	it("resolves the carried values through the loader afterwards", () => {
		const fx = v2Project();
		runMewkit(fx, ["upgrade", "--yes"], {}, "2.0.0-fixture");
		const status = runMewkit(fx, ["status"]);
		expect(status.all).toContain("hooks.budget-tracker: false");
		expect(status.all).toContain("hooks.learning-observer: false");
	});
});
