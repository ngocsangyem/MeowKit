// Target and delivery are refused by name, and the plugin shape is built from
// the provider declarations already in the tree rather than from a second table.
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { getProjection } from "../../core/provider-projection.js";
import { emitPluginDelivery, hasPluginDelivery, pluginManifestPath } from "../../emit/emit-plugin-delivery.js";
import { buildPluginManifest } from "../../emit/plugin-manifest.js";
import { resolveTargetDelivery } from "../init-target-delivery.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..", "..");

const roots: string[] = [];
afterAll(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
	const dir = mkdtempSync(join(tmpdir(), "mewkit-delivery-"));
	roots.push(dir);
	return dir;
}

describe("target and delivery", () => {
	it("defaults to the Claude Code native shape when neither flag is passed", () => {
		expect(resolveTargetDelivery(undefined, undefined)).toEqual({ target: "claude-code", delivery: "native" });
	});

	it("accepts each target, and the plugin delivery only for Claude Code", () => {
		for (const target of ["claude-code", "codex", "cursor"]) {
			expect(resolveTargetDelivery(target, undefined)).toEqual({ target, delivery: "native" });
		}
		expect(resolveTargetDelivery("claude-code", "plugin")).toEqual({ target: "claude-code", delivery: "plugin" });
	});

	it("refuses an unknown target by name and lists the valid ones", () => {
		const outcome = resolveTargetDelivery("claude-codee", undefined);
		expect("error" in outcome && outcome.error).toMatch(/Unknown --target "claude-codee"/);
		expect("error" in outcome && outcome.error).toMatch(/claude-code, codex, cursor/);
		expect("error" in outcome && outcome.error).toMatch(/Nothing was written/);
	});

	it("refuses --delivery on a target that has one shape, rather than ignoring it", () => {
		// Ignoring it would print success while producing the native bundle the flag
		// was passed to avoid.
		for (const target of ["codex", "cursor"]) {
			const outcome = resolveTargetDelivery(target, "plugin");
			expect("error" in outcome && outcome.error).toMatch(/--delivery is meaningful for --target claude-code only/);
			expect("error" in outcome && outcome.error).toMatch(/Nothing was written/);
		}
	});

	it("refuses an unknown delivery by name", () => {
		const outcome = resolveTargetDelivery("claude-code", "pluginn");
		expect("error" in outcome && outcome.error).toMatch(/Unknown --delivery "pluginn"/);
		expect("error" in outcome && outcome.error).toMatch(/native, plugin/);
	});
});

describe("plugin delivery", () => {
	it("writes the manifest at the documented path with only documented keys", async () => {
		const root = temp();
		const written = await emitPluginDelivery(root, "2.15.0");
		expect(written).toBe(pluginManifestPath(root));
		expect(hasPluginDelivery(root)).toBe(true);

		const manifest = JSON.parse(readFileSync(written, "utf8")) as Record<string, unknown>;
		// `name` is the only key the host requires, and it must be kebab-case with
		// no spaces, `@`, `:` or path separators.
		expect(typeof manifest.name).toBe("string");
		expect(manifest.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
		expect(manifest.version).toBe("2.15.0");
		// An unrecognized top-level key is stripped by the host with a validator
		// warning, so only declared keys are written.
		const declared = new Set([
			"name",
			"displayName",
			"version",
			"description",
			"license",
			"keywords",
			"homepage",
			"repository",
		]);
		for (const key of Object.keys(manifest)) expect(declared.has(key)).toBe(true);
	});

	it("names no component path, so the host's own scan stays on", () => {
		// `commands`, `agents`, `outputStyles` and the rest REPLACE their default
		// directories when set. The kit writes its content into exactly those
		// defaults, so declaring them would turn the host's scan off and replace it
		// with a list that has to be kept correct by hand.
		const manifest = buildPluginManifest("2.15.0") as unknown as Record<string, unknown>;
		for (const key of ["commands", "agents", "skills", "hooks", "mcpServers", "outputStyles", "workflows"]) {
			expect(manifest[key]).toBeUndefined();
		}
	});

	it("takes the plugin's description from the provider declaration rather than restating it", () => {
		const projection = getProjection("claude-plugin");
		expect(buildPluginManifest("2.15.0").description).toContain(projection.evidence);
	});

	it("leaves the claude-plugin declarations exactly as they are, and adds no second table", () => {
		const projection = getProjection("claude-plugin");
		// The build these declarations presuppose now exists, so they stand and are
		// exercised by the install above rather than corrected down.
		expect(projection.status).toBe("supported");
		expect(projection.bootstrapPlacement).toBe("sessionstart-hook-via-plugin-build");
		for (const level of Object.values(projection.levels)) expect(level).toBe("supported");

		// The emitter READS them. A second capability, lifecycle or operations table
		// would be two answers to one question — the defect the single ship-set
		// source exists to prevent, one layer up.
		const emitterDir = join(REPO, "packages", "mewkit", "src", "emit");
		for (const name of ["plugin-manifest.ts", "emit-plugin-delivery.ts"]) {
			const source = readFileSync(join(emitterDir, name), "utf8");
			expect(source).not.toMatch(/discoverable:|selectable:|invocable:|enforceable:/);
			expect(source).not.toMatch(/CLAUDE_PLUGIN_(LIFECYCLE|OPERATIONS|INVOCATION)\s*[=:]/);
		}
		expect(readFileSync(join(emitterDir, "plugin-manifest.ts"), "utf8")).toMatch(/getProjection\(/);
	});
});
