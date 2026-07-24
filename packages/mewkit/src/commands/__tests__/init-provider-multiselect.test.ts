import { mkdtempSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `npx mewkit init` (no provider flag, fresh dir) shows a provider multiselect.
// These tests drive the picker by mocking @clack/prompts and verify:
//  - codex-only selection provisions the authored bundle offline (no .claude/, no network);
//  - the picker is SUPPRESSED whenever an explicit provider intent is given
//    (update mode, or --target, or --migrate) — the gate that keeps those flows intact.

const multiselectResult = { value: ["codex"] as string[] };
const multiselectSpy = vi.fn(async () => multiselectResult.value);

vi.mock("@clack/prompts", () => {
	const passthrough = () => undefined;
	return {
		intro: passthrough,
		outro: passthrough,
		cancel: passthrough,
		log: { info: passthrough, warn: passthrough, success: passthrough, message: passthrough, error: passthrough },
		spinner: () => ({ start: passthrough, stop: passthrough, message: passthrough }),
		multiselect: multiselectSpy,
		select: async () => "full",
		confirm: async () => false,
		text: async () => "",
		password: async () => "",
		isCancel: () => false,
	};
});

// Stop the base Claude-kit install before it reaches the network: an empty release
// list makes init cancel + process.exit(1). The picker decision happens BEFORE this,
// so suppression is observable regardless of the later exit.
vi.mock("../../core/index.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../core/index.js")>()),
	fetchReleases: async () => [],
}));

let dir: string;
let orig: string;
let exitSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
	orig = process.cwd();
	dir = mkdtempSync(join(tmpdir(), "init-picker-"));
	process.chdir(dir);
	multiselectResult.value = ["codex"];
	multiselectSpy.mockClear();
	exitSpy = vi.spyOn(process, "exit").mockImplementation(((c?: number) => {
		throw new Error(`process.exit(${c})`);
	}) as never);
});
afterEach(() => {
	process.chdir(orig);
	rmSync(dir, { recursive: true, force: true });
	exitSpy.mockRestore();
	vi.resetModules();
});

describe("init provider multiselect", () => {
	it("codex-only selection copies the authored bundle and never creates .claude/", async () => {
		const { init } = await import("../init.js");
		await init({});
		expect(multiselectSpy).toHaveBeenCalledTimes(1);
		expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
		expect(existsSync(join(dir, ".codex", "config.toml"))).toBe(true);
		expect(existsSync(join(dir, ".agents", "skills"))).toBe(true);
		expect(existsSync(join(dir, ".claude"))).toBe(false);
	});

	it("codex-only --dry-run writes nothing", async () => {
		const { init } = await import("../init.js");
		await init({ dryRun: true });
		expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
		expect(existsSync(join(dir, ".codex"))).toBe(false);
	});

	it("does NOT show the picker in update mode (existing .claude/)", async () => {
		mkdirSync(join(dir, ".claude"));
		const { init } = await import("../init.js");
		await init({}).catch(() => undefined); // base install exits early (no releases)
		expect(multiselectSpy).not.toHaveBeenCalled();
	});

	it("does NOT show the picker when --migrate is passed (keeps the legacy export flow)", async () => {
		const { init } = await import("../init.js");
		await init({ migrate: true }).catch(() => undefined);
		expect(multiselectSpy).not.toHaveBeenCalled();
	});
});
