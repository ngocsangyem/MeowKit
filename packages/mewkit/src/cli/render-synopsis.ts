// The CLI flag reference as Markdown, generated from the catalogue.
//
// The docs used to restate flags by hand, which is the clone-that-drifts pattern the docs audit
// found everywhere else. Generating the table means the reference cannot disagree with what
// minimist parses, because both come from the same array.
import { CLI_CATALOGUE } from "./command-catalogue.js";
import type { FlagSpec } from "./catalogue-types.js";
import { summaryFor } from "./flag-summary.js";

// MDX rejects HTML comments — `<!--` is parsed as a tag and fails the build. The marker has to
// be an MDX expression comment, which is why this does not reuse the capability view's syntax.
export const SYNOPSIS_START = "{/* GENERATED:cli-flags START */}";
export const SYNOPSIS_END = "{/* GENERATED:cli-flags END */}";

/** A literal `|` ends a Markdown table cell, so any in a summary must be escaped. */
function escapePipes(text: string): string {
	return text.replace(/\|/g, "\\|");
}

function cell(flag: FlagSpec, command: string): string {
	const value = flag.type === "string" ? " `<value>`" : "";
	const repeat = flag.repeatable ? ", repeatable" : "";
	return `| \`--${flag.name}\`${value} | ${escapePipes(summaryFor(flag, command))}${repeat} |`;
}

/** The full flag reference, one section per command, in catalogue order. */
export function renderSynopsis(): string {
	const byCommand = new Map<string, FlagSpec[]>();
	for (const cmd of CLI_CATALOGUE.commands) byCommand.set(cmd.name, []);
	const global: FlagSpec[] = [];
	for (const flag of CLI_CATALOGUE.flags) {
		if (flag.commands.length === 0) global.push(flag);
		for (const cmd of flag.commands) byCommand.get(cmd)?.push(flag);
	}

	const out: string[] = [
		SYNOPSIS_START,
		"",
		"_Generated from the CLI catalogue. Edit `packages/mewkit/src/cli/command-catalogue.ts`, not this table._",
		"",
		"### Every command",
		"",
		"| Flag | What it does |",
		"|---|---|",
		...global.map((f) => cell(f, "")),
		"",
	];

	for (const cmd of CLI_CATALOGUE.commands) {
		const flags = byCommand.get(cmd.name) ?? [];
		out.push(`### \`mewkit ${cmd.name}\``, "", cmd.summary + ".");
		if (cmd.subcommands?.length) {
			out.push("", `Subcommands: ${cmd.subcommands.map((s) => `\`${s}\``).join(", ")}.`);
		}
		if (cmd.passThrough) {
			out.push(
				"",
				"This command reads its own flags, which are owned by its subsystem rather than by the CLI catalogue.",
			);
		}
		if (flags.length > 0) {
			out.push("", "| Flag | What it does |", "|---|---|", ...flags.map((f) => cell(f, cmd.name)));
		}
		out.push("");
	}

	out.push(SYNOPSIS_END);
	return out.join("\n");
}
