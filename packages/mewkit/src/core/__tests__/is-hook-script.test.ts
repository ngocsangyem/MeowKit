// Unit test for the shared hook-script detector. Pins the exclusions that the old
// readdir+accessSync(X_OK) logic got wrong: directories and non-script sidecars must
// NOT count as hooks.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isHookScript } from "../is-hook-script.js";

let dir: string;
beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), "mewkit-ihs-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const make = (name: string, mode = 0o644, body = "x"): string => {
	const p = path.join(dir, name);
	fs.writeFileSync(p, body);
	fs.chmodSync(p, mode);
	return p;
};

describe("isHookScript", () => {
	it("accepts .sh / .cjs / .js / .mjs files", () => {
		expect(isHookScript(make("gate.sh"))).toBe(true);
		expect(isHookScript(make("dispatch.cjs"))).toBe(true);
		expect(isHookScript(make("x.js"))).toBe(true);
		expect(isHookScript(make("x.mjs"))).toBe(true);
	});

	it("rejects directories (lib/, handlers/, __tests__/) even though they are traversable", () => {
		const sub = path.join(dir, "lib");
		fs.mkdirSync(sub, 0o755);
		expect(isHookScript(sub)).toBe(false);
	});

	it("rejects index/doc/json sidecars", () => {
		expect(isHookScript(make("HOOKS_INDEX.md"))).toBe(false);
		expect(isHookScript(make("handlers.json"))).toBe(false);
		expect(isHookScript(make("README.md"))).toBe(false);
		expect(isHookScript(make("config.json"))).toBe(false);
	});

	it("accepts an extensionless executable with a shell shebang", () => {
		expect(isHookScript(make("runme", 0o755, "#!/bin/bash\necho hi\n"))).toBe(true);
	});

	it("rejects an extensionless non-executable or shebang-less file", () => {
		expect(isHookScript(make("notes", 0o644, "#!/bin/bash\n"))).toBe(false);
		expect(isHookScript(make("data", 0o755, "plain text\n"))).toBe(false);
	});

	it("rejects a path that does not exist", () => {
		expect(isHookScript(path.join(dir, "nope.sh"))).toBe(false);
	});
});
