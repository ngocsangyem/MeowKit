// The config resolver names ONE file and never falls back.
//
// The fallback it used to have mattered while the thing being resolved was an
// install descriptor that had moved. The committed config is a different kind of
// document, so a project still carrying only the old descriptor is not "served
// by the legacy path" — it is migration-pending, a state the resolver reports
// rather than papers over. These cover the four shapes a project can be in.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { configWritePath, legacyDescriptorPath, migrationPending } from "../resolve-config-path.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function makeRoot(shape: "empty" | "descriptor" | "pre-move-descriptor" | "config" | "both"): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-config-"));
	roots.push(root);
	if (shape === "pre-move-descriptor") {
		mkdirSync(join(root, ".claude"), { recursive: true });
		writeFileSync(join(root, ".claude", "meowkit.config.json"), "{}");
	}
	if (shape === "descriptor" || shape === "both") {
		mkdirSync(join(root, ".meowkit"), { recursive: true });
		writeFileSync(join(root, ".meowkit", "config.json"), "{}");
	}
	if (shape === "config" || shape === "both") {
		mkdirSync(join(root, ".meowkit"), { recursive: true });
		writeFileSync(join(root, ".meowkit", "config.yaml"), "tdd: true\n");
	}
	return root;
}

describe("configWritePath", () => {
	it("names `.meowkit/config.yaml` whatever the project shape is", () => {
		for (const shape of ["empty", "descriptor", "pre-move-descriptor", "config", "both"] as const) {
			const root = makeRoot(shape);
			expect(configWritePath(root)).toBe(join(root, ".meowkit", "config.yaml"));
		}
	});

	it("reports a project with only the v2 descriptor as migration-pending", () => {
		const root = makeRoot("descriptor");
		expect(migrationPending(root)).toBe(true);
		expect(legacyDescriptorPath(root)).toBe(join(root, ".meowkit", "config.json"));
	});

	it("reports the pre-move descriptor the same way", () => {
		const root = makeRoot("pre-move-descriptor");
		expect(migrationPending(root)).toBe(true);
		expect(legacyDescriptorPath(root)).toBe(join(root, ".claude", "meowkit.config.json"));
	});

	it("is not migration-pending once the committed config exists, even with the old file present", () => {
		const root = makeRoot("both");
		expect(migrationPending(root)).toBe(false);
	});

	it("is not migration-pending for a project with neither file — that is defaults", () => {
		const root = makeRoot("empty");
		expect(migrationPending(root)).toBe(false);
		expect(legacyDescriptorPath(root)).toBeNull();
	});
});
