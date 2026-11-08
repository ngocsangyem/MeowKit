// `mewkit <command> --help` must print usage and never dispatch the command. `upgrade --help`
// used to fall through to a real upgrade that overwrote `.claude/` in the current directory.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import minimist from "minimist";
import { describe, expect, it } from "vitest";
import { CLI_CATALOGUE } from "../command-catalogue.js";
import { minimistOptions } from "../minimist-options.js";
import { helpRequest } from "../render-help.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Parse argv the way the dispatcher does, then ask for help. */
function helpFor(argv: string[]): string | null {
	const args = minimist(argv, minimistOptions());
	return helpRequest(args.help, args._[0] as string | undefined, "1.0.0");
}

describe("helpRequest", () => {
	it("returns null when help is not requested", () => {
		expect(helpFor(["upgrade"])).toBeNull();
	});

	it.each(CLI_CATALOGUE.commands.map((c) => c.name))("%s --help and -h return that command's usage", (name) => {
		for (const flag of ["--help", "-h"]) {
			const text = helpFor([name, flag]);
			expect(text, `${name} ${flag}`).not.toBeNull();
			expect(text).toContain(`mewkit ${name}`);
		}
	});

	it("lists the command's own flags", () => {
		const text = helpFor(["upgrade", "--help"]) ?? "";
		expect(text).toContain("--check");
		expect(text).toContain("--allow-kit-source");
	});

	it("falls back to the full help for an unknown command or no command", () => {
		expect(helpFor(["nope", "--help"])).toContain("Commands:");
		expect(helpFor(["--help"])).toContain("Commands:");
	});

	it("is checked by the dispatcher before any command is dispatched", () => {
		const src = readFileSync(join(here, "..", "..", "index.ts"), "utf-8");
		const check = src.indexOf("helpRequest(args.help");
		expect(check, "dispatcher must call helpRequest").toBeGreaterThan(-1);
		expect(check).toBeLessThan(src.indexOf("switch (command)"));
	});
});
