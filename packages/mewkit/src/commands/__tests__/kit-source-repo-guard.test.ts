import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `init` and `upgrade` must refuse to install a release over the MeowKit source repo, whose
// `.claude/` is the kit's authored source. The release fetch is stubbed: reaching it at all
// means the guard did not fire.

const fetchReleasesSpy = vi.fn(async () => []);
vi.mock("../../core/index.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../core/index.js")>()),
	fetchReleases: fetchReleasesSpy,
}));

vi.mock("@clack/prompts", () => {
	const passthrough = () => undefined;
	return {
		intro: passthrough,
		outro: passthrough,
		cancel: passthrough,
		log: { info: passthrough, warn: passthrough, success: passthrough, message: passthrough, error: passthrough },
		spinner: () => ({ start: passthrough, stop: passthrough, message: passthrough }),
		multiselect: async () => ["claude-code"],
		select: async () => "full",
		confirm: async () => false,
		text: async () => "",
		password: async () => "",
		isCancel: () => false,
	};
});

const { upgrade } = await import("../upgrade.js");
const { init } = await import("../init.js");
const { isKitSourceRepo } = await import("../kit-source-repo-guard.js");

class ExitCalled extends Error {
	constructor(readonly code: number | undefined) {
		super(`process.exit(${String(code)})`);
	}
}

let dir: string;
let orig: string;
let errors: string[];
beforeEach(() => {
	orig = process.cwd();
	dir = mkdtempSync(join(tmpdir(), "kit-source-guard-"));
	process.chdir(dir);
	fetchReleasesSpy.mockClear();
	errors = [];
	vi.spyOn(process, "exit").mockImplementation((code?: string | number | null) => {
		throw new ExitCalled(code as number | undefined);
	});
	vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
		errors.push(a.map(String).join(" "));
	});
	vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
	vi.restoreAllMocks();
	process.chdir(orig);
	rmSync(dir, { recursive: true, force: true });
});

function makeSourceRepo(): void {
	mkdirSync(join(dir, ".claude"), { recursive: true });
	writeFileSync(join(dir, ".claude", "authored.md"), "authored\n");
	mkdirSync(join(dir, "packages", "mewkit"), { recursive: true });
	writeFileSync(join(dir, "packages", "mewkit", "package.json"), JSON.stringify({ name: "mewkit" }));
}

async function exitCodeOf(run: () => Promise<void>): Promise<number | undefined | "returned"> {
	try {
		await run();
		return "returned";
	} catch (err) {
		if (err instanceof ExitCalled) return err.code;
		throw err;
	}
}

describe("isKitSourceRepo", () => {
	it("needs both .claude/ and the mewkit package", () => {
		expect(isKitSourceRepo(dir)).toBe(false);
		mkdirSync(join(dir, ".claude"));
		expect(isKitSourceRepo(dir)).toBe(false);
		mkdirSync(join(dir, "packages", "mewkit"), { recursive: true });
		writeFileSync(join(dir, "packages", "mewkit", "package.json"), JSON.stringify({ name: "other" }));
		expect(isKitSourceRepo(dir)).toBe(false);
		writeFileSync(join(dir, "packages", "mewkit", "package.json"), JSON.stringify({ name: "mewkit" }));
		expect(isKitSourceRepo(dir)).toBe(true);
	});
});

describe("upgrade in the kit source repo", () => {
	it("refuses with exit 1 before any network or write", async () => {
		makeSourceRepo();
		expect(await exitCodeOf(() => upgrade({}))).toBe(1);
		expect(fetchReleasesSpy).not.toHaveBeenCalled();
		expect(errors.join("\n")).toContain("--allow-kit-source");
		expect(readdirSync(join(dir, ".claude"))).toEqual(["authored.md"]);
	});

	it("proceeds past the guard with --allow-kit-source", async () => {
		makeSourceRepo();
		// The stubbed empty release list then ends the run, without writing anything.
		expect(await exitCodeOf(() => upgrade({ allowKitSource: true }))).toBe(1);
		expect(fetchReleasesSpy).toHaveBeenCalled();
		expect(errors.join("\n")).not.toContain("refusing");
	});

	it("still allows the read-only --check", async () => {
		makeSourceRepo();
		await exitCodeOf(() => upgrade({ check: true }));
		expect(fetchReleasesSpy).toHaveBeenCalled();
		expect(errors.join("\n")).not.toContain("refusing");
	});

	it("does not fire in an ordinary project", async () => {
		mkdirSync(join(dir, ".claude"));
		await exitCodeOf(() => upgrade({}));
		expect(fetchReleasesSpy).toHaveBeenCalled();
		expect(errors.join("\n")).not.toContain("refusing");
	});
});

describe("init in the kit source repo", () => {
	it("refuses with exit 1 before any network or write", async () => {
		makeSourceRepo();
		expect(await exitCodeOf(() => init({}))).toBe(1);
		expect(fetchReleasesSpy).not.toHaveBeenCalled();
		expect(errors.join("\n")).toContain("refusing to run in the MeowKit source repo");
	});

	it("refuses provider-bundle targets too", async () => {
		makeSourceRepo();
		expect(await exitCodeOf(() => init({ target: "codex" }))).toBe(1);
		expect(readdirSync(dir).sort()).toEqual([".claude", "packages"]);
	});

	it("proceeds past the guard with --allow-kit-source", async () => {
		makeSourceRepo();
		await exitCodeOf(() => init({ allowKitSource: true }));
		expect(fetchReleasesSpy).toHaveBeenCalled();
	});
});
