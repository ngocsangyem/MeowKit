// `hooks.<name>: false` really switches an observer off.
//
// "The config value is false" is not the claim worth proving — the claim is that
// the observer does not run. So each of the registry's toggle keys is switched
// off in a throwaway project and the assertion is made on the dispatcher's
// selection, which is the thing that decides whether the handler is ever loaded.
// That is also why one key covers a handler registered twice: the filter runs
// per entry, not per handler.
//
// The protected names are the mirror image: they are not observers at all, the
// loader refuses them, and the gate keeps blocking. That half is asserted in the
// config rejection suite and in the golden gate fixtures.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface RegistryEntry {
	event: string;
	matcher?: string;
	handler: string;
	toggleKey: string;
}

const registry = require_(path.join(REPO_ROOT, ".claude/hooks/handlers.json")) as { handlers: RegistryEntry[] };
const { loadRegistry, selectHandlers, validate } = require_(path.join(REPO_ROOT, ".claude/hooks/lib/handler-registry.cjs")) as {
	loadRegistry: (root: string) => RegistryEntry[];
	selectHandlers: (entries: RegistryEntry[], event: string, matcher: string, options: { root: string }) => RegistryEntry[];
	validate: (handlers: unknown[]) => { errors: string[] };
};

const toggleKeys = [...new Set(registry.handlers.map((h) => h.toggleKey))].sort();

/** A project whose only content is the registry and an optional config. */
function project(config?: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mk-toggle-"));
	fs.mkdirSync(path.join(dir, ".claude/hooks"), { recursive: true });
	fs.cpSync(path.join(REPO_ROOT, ".claude/hooks/handlers.json"), path.join(dir, ".claude/hooks/handlers.json"));
	if (config !== undefined) {
		fs.mkdirSync(path.join(dir, ".meowkit"), { recursive: true });
		fs.writeFileSync(path.join(dir, ".meowkit/config.yaml"), config);
	}
	return dir;
}

/** Every entry the dispatcher would run, across every registered event. */
function selectedEverywhere(root: string): RegistryEntry[] {
	const entries = loadRegistry(root);
	const out: RegistryEntry[] = [];
	for (const entry of entries) {
		const picked = selectHandlers(entries, entry.event, entry.matcher ?? "", { root, env: {}, home: "/nonexistent-home" } as never);
		for (const p of picked) if (!out.includes(p)) out.push(p);
	}
	return out;
}

describe("the registry's shape is the config surface", () => {
	it("has the registrations it had, over distinct kebab-case keys", () => {
		expect(registry.handlers.length).toBe(22);
		expect(toggleKeys.length).toBe(21);
		for (const key of toggleKeys) expect(key, key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
	});

	it("names each toggle after its handler file, so there is nothing to translate", () => {
		for (const entry of registry.handlers) {
			expect(path.basename(entry.handler, path.extname(entry.handler)), entry.handler).toBe(entry.toggleKey);
		}
	});

	it("rejects a camelCase key and a key that names another handler", () => {
		const camel = validate([{ event: "Stop", handler: "./handlers/post-session.cjs", toggleKey: "postSession" }]);
		expect(camel.errors.join(" ")).toMatch(/not kebab-case/);
		const mismatch = validate([{ event: "Stop", handler: "./handlers/post-session.cjs", toggleKey: "post-write" }]);
		expect(mismatch.errors.join(" ")).toMatch(/does not match handler file/);
	});

	it("registers budget-tracker twice, so one key must cover both", () => {
		expect(registry.handlers.filter((h) => h.toggleKey === "budget-tracker").length).toBe(2);
	});
});

describe("each observer toggle removes its observer from the dispatcher's selection", () => {
	it("selects every registration when no config is present", () => {
		const root = project();
		expect(selectedEverywhere(root).length).toBe(registry.handlers.length);
	});

	for (const key of toggleKeys) {
		it(`hooks.${key}: false`, () => {
			const root = project(`hooks:\n  ${key}: false\n`);
			const selected = selectedEverywhere(root);
			expect(selected.some((e) => e.toggleKey === key), `${key} was still selected`).toBe(false);
			// Every other registration is untouched: a toggle that switched off more
			// than it named would be worse than one that switched off nothing.
			const expected = registry.handlers.filter((h) => h.toggleKey !== key).length;
			expect(selected.length).toBe(expected);
		});
	}

	it("switches off both of budget-tracker's registrations with the single key", () => {
		const root = project("hooks:\n  budget-tracker: false\n");
		expect(selectedEverywhere(root).filter((e) => e.toggleKey === "budget-tracker")).toEqual([]);
	});

	it("runs every observer when the config is malformed", () => {
		// Fail-open extends to configuration. An observer that switched itself off
		// on a parse error would be the least visible failure available.
		const root = project("hooks:\n\tbudget-tracker: false\n");
		expect(selectedEverywhere(root).length).toBe(registry.handlers.length);
	});

	it("does not run a disabled handler end to end", () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "mk-toggle-e2e-"));
		fs.mkdirSync(path.join(root, ".claude/hooks/handlers"), { recursive: true });
		fs.cpSync(path.join(REPO_ROOT, ".claude/hooks/dispatch.cjs"), path.join(root, ".claude/hooks/dispatch.cjs"));
		fs.cpSync(path.join(REPO_ROOT, ".claude/hooks/lib"), path.join(root, ".claude/hooks/lib"), { recursive: true });
		fs.writeFileSync(path.join(root, ".claude/hooks/handlers/post-write.cjs"), "'use strict';\nmodule.exports = () => 'post-write-ran\\n';\n");
		fs.writeFileSync(
			path.join(root, ".claude/hooks/handlers.json"),
			JSON.stringify({ schema: 2, handlers: [{ event: "PostToolUse", matcher: "Edit|Write", handler: "./handlers/post-write.cjs", toggleKey: "post-write" }] }),
		);

		const run = (): string => {
			const result = spawnSync(process.execPath, [path.join(root, ".claude/hooks/dispatch.cjs"), "PostToolUse", "Edit|Write"], {
				input: JSON.stringify({ tool_input: { file_path: path.join(root, "src/a.ts") } }),
				env: { ...process.env, CLAUDE_PROJECT_DIR: root, HOME: root },
				encoding: "utf8",
			});
			return result.stdout;
		};

		expect(run()).toContain("post-write-ran");
		fs.mkdirSync(path.join(root, ".meowkit"), { recursive: true });
		fs.writeFileSync(path.join(root, ".meowkit/config.yaml"), "hooks:\n  post-write: false\n");
		expect(run()).not.toContain("post-write-ran");
	});
});
