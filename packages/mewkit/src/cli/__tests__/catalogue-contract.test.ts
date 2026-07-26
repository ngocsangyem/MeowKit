// The catalogue only helps if it cannot fall behind. These are the three ways it could.
//
// Every one of these assertions corresponds to drift that was live when the catalogue was
// written: six flags the dispatcher read without declaring, six declared and read nowhere,
// forty-two missing from `--help`, and docs pages free to invent flags.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLI_CATALOGUE } from "../command-catalogue.js";
import { minimistOptions } from "../minimist-options.js";
import { renderHelp } from "../render-help.js";

const here = dirname(fileURLToPath(import.meta.url));
const DISPATCHER = join(here, "..", "..", "index.ts");
const DOCS_CLI = join(here, "..", "..", "..", "..", "docs", "content", "docs", "cli");

const catalogued = new Set(CLI_CATALOGUE.flags.map((f) => f.name));
const commandNames = new Set(CLI_CATALOGUE.commands.map((c) => c.name));

/** camelCase reads in the dispatcher correspond to kebab-case flags. */
const kebab = (s: string): string => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

/** Every flag the dispatcher pulls off the parsed args object. */
function dispatcherReads(): Set<string> {
	const src = readFileSync(DISPATCHER, "utf-8");
	const out = new Set<string>();
	for (const m of src.matchAll(/args\.([A-Za-z][A-Za-z0-9]*)/g)) out.add(m[1]);
	for (const m of src.matchAll(/args\["([^"]+)"\]/g)) out.add(m[1]);
	out.delete("_");
	return out;
}

describe("CLI catalogue contract", () => {
	it("covers every flag the dispatcher reads", () => {
		const missing = [...dispatcherReads()].filter((r) => !catalogued.has(r) && !catalogued.has(kebab(r)));
		expect(missing, `dispatcher reads flags absent from the catalogue: ${missing.join(", ")}`).toEqual([]);
	});

	it("declares no flag the dispatcher never reads", () => {
		const reads = dispatcherReads();
		const dead = CLI_CATALOGUE.flags
			.map((f) => f.name)
			.filter((name) => {
				const camel = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
				return !reads.has(name) && !reads.has(camel);
			});
		expect(dead, `catalogued but never read — dead surface that looks supported: ${dead.join(", ")}`).toEqual([]);
	});

	it("routes every catalogued flag through minimist with its declared type", () => {
		const opts = minimistOptions();
		const declared = new Set([...opts.boolean, ...opts.string]);
		for (const flag of CLI_CATALOGUE.flags) {
			expect(declared.has(flag.name), `${flag.name} is not declared to minimist`).toBe(true);
			const list = flag.type === "boolean" ? opts.boolean : opts.string;
			expect(list, `${flag.name} declared with the wrong type`).toContain(flag.name);
		}
		expect(opts.boolean.filter((n) => opts.string.includes(n))).toEqual([]);
	});

	it("names every flag and command in --help, so nothing is discoverable only by reading source", () => {
		const help = renderHelp("0.0.0");
		for (const flag of CLI_CATALOGUE.flags) {
			expect(help, `--${flag.name} missing from --help`).toContain(`--${flag.name}`);
		}
		for (const cmd of CLI_CATALOGUE.commands) {
			expect(help, `${cmd.name} missing from --help`).toContain(cmd.name);
		}
	});

	it("accepts no flag in the CLI docs that the catalogue does not define", () => {
		if (!existsSync(DOCS_CLI)) return; // docs package absent in a consumer checkout

		// Scoped by the command on the same line, not by "any --flag in the file". A pass-through
		// command's flags belong to its subsystem, and checking them here would report correct
		// documentation as drift.
		const passThrough = new Set(CLI_CATALOGUE.commands.filter((c) => c.passThrough).map((c) => c.name));
		const offenders: string[] = [];

		for (const file of readdirSync(DOCS_CLI).filter((f) => f.endsWith(".mdx"))) {
			for (const line of readFileSync(join(DOCS_CLI, file), "utf-8").split("\n")) {
				const invoked = /(?:npx )?mewkit ([a-z][a-z-]*)/.exec(line)?.[1];
				if (!invoked || !commandNames.has(invoked) || passThrough.has(invoked)) continue;
				for (const m of line.matchAll(/--([a-z][a-z0-9-]*)/g)) {
					const flag = m[1];
					// `--no-x` is minimist's negation of a declared boolean `x`, not its own flag.
					const base = flag.startsWith("no-") ? flag.slice(3) : flag;
					if (catalogued.has(flag) || catalogued.has(base)) continue;
					offenders.push(`${file}: mewkit ${invoked} --${flag}`);
				}
			}
		}
		expect([...new Set(offenders)], "documented flags with no catalogue entry").toEqual([]);
	});

	it("names a real command in every flag's command list", () => {
		for (const flag of CLI_CATALOGUE.flags) {
			for (const cmd of flag.commands) {
				expect(commandNames.has(cmd), `--${flag.name} lists unknown command "${cmd}"`).toBe(true);
			}
		}
	});
});
