// `mewkit <command> --help` must print usage and never dispatch the command.
//
// Help used to be answered only for the bare `mewkit`, so `upgrade --help` fell through to a
// real upgrade that downloaded a release and overwrote `.claude/` in the current directory,
// and `init --help` started an update-mode install. Help is therefore resolved from the
// catalogue BEFORE the dispatcher's switch, for every command — including the ones with no
// sub-verbs, which is where the fall-through was. Asserted over the whole catalogue so a
// command added later cannot reintroduce it.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import minimist from "minimist";
import { describe, expect, it } from "vitest";
import { CLI_CATALOGUE } from "../command-catalogue.js";
import { minimistOptions } from "../minimist-options.js";
import { classifyInvocation, renderCommandHelp, renderSubcommandHelp } from "../strict-dispatch.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Parse argv the way the dispatcher does, then classify it the way the dispatcher does. */
function classify(argv: string[]) {
	const args = minimist(argv, minimistOptions());
	return classifyInvocation(
		CLI_CATALOGUE,
		args._.map((value) => String(value)),
		args.help === true,
	);
}

/** The text the dispatcher would print, or null when it would run the command instead. */
function helpFor(argv: string[]): string | null {
	const invocation = classify(argv);
	if (invocation.kind === "command-help") return renderCommandHelp(CLI_CATALOGUE, invocation.command).join("\n");
	if (invocation.kind === "subcommand-help") {
		return renderSubcommandHelp(CLI_CATALOGUE, invocation.command, invocation.subcommand).join("\n");
	}
	return null;
}

describe("help is answered instead of the command", () => {
	it("runs the command when help is not requested", () => {
		expect(helpFor(["upgrade"])).toBeNull();
		expect(classify(["upgrade"]).kind).toBe("run");
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

	it("is resolved by the dispatcher before any command is dispatched", () => {
		const src = readFileSync(join(here, "..", "..", "index.ts"), "utf-8");
		const check = src.indexOf("classifyInvocation(");
		expect(check, "dispatcher must classify the invocation").toBeGreaterThan(-1);
		expect(check).toBeLessThan(src.indexOf("switch (command)"));
	});
});
