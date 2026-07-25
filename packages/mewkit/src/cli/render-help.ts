// `--help`, rendered from the catalogue.
//
// The hand-written version listed 26 commands and 42 of its flags appeared nowhere in it, so
// the only way to discover them was to read the dispatcher. Generating the text means a flag
// cannot exist without being documented.
import pc from "picocolors";
import { CLI_CATALOGUE } from "./command-catalogue.js";
import type { FlagSpec } from "./catalogue-types.js";
import { summaryFor } from "./flag-summary.js";

/** Flags every command accepts, listed once at the top rather than under each command. */
function globalFlags(): FlagSpec[] {
	return CLI_CATALOGUE.flags.filter((f) => f.commands.length === 0);
}

/** Flags grouped under the command they belong to, in catalogue order. */
function flagsByCommand(): Map<string, FlagSpec[]> {
	const out = new Map<string, FlagSpec[]>();
	for (const cmd of CLI_CATALOGUE.commands) out.set(cmd.name, []);
	for (const flag of CLI_CATALOGUE.flags) {
		for (const cmd of flag.commands) out.get(cmd)?.push(flag);
	}
	return out;
}

function flagLabel(flag: FlagSpec): string {
	const value = flag.type === "string" ? " <value>" : "";
	return `--${flag.name}${value}`;
}

function flagSummary(flag: FlagSpec, command: string): string {
	const summary = summaryFor(flag, command);
	return flag.repeatable ? `${summary} (repeatable)` : summary;
}

/** One column width for every flag block, so the summaries line up across sections. */
function labelWidth(): number {
	return Math.max(...CLI_CATALOGUE.flags.map((f) => flagLabel(f).length)) + 2;
}

function pad(text: string, width: number): string {
	return text.length >= width ? text + " " : text + " ".repeat(width - text.length);
}

export function renderHelp(version: string): string {
	const byCommand = flagsByCommand();
	const flagWidth = labelWidth();
	const lines: string[] = [
		"",
		`${pc.bold(pc.cyan("mewkit"))} ${pc.dim(`v${version}`)} — MeowKit runtime CLI`,
		"",
		`${pc.bold("Usage:")}`,
		"  mewkit <command> [options]",
		"",
		`${pc.bold("Commands:")}`,
	];

	const nameWidth = Math.max(...CLI_CATALOGUE.commands.map((c) => c.name.length)) + 2;
	for (const cmd of CLI_CATALOGUE.commands) {
		lines.push(`  ${pc.green(pad(cmd.name, nameWidth))}${cmd.summary}`);
		if (cmd.subcommands?.length) {
			lines.push(`  ${" ".repeat(nameWidth)}${pc.dim(cmd.subcommands.join(" · "))}`);
		}
	}

	lines.push("", `${pc.bold("Global options:")}`);
	for (const flag of globalFlags()) {
		lines.push(`  ${pad(flagLabel(flag), flagWidth)}${flagSummary(flag, "")}`);
	}

	for (const cmd of CLI_CATALOGUE.commands) {
		const flags = byCommand.get(cmd.name) ?? [];
		if (flags.length === 0) continue;
		lines.push("", `${pc.bold(`${cmd.name} options:`)}`);
		for (const flag of flags) {
			lines.push(`  ${pad(flagLabel(flag), flagWidth)}${flagSummary(flag, cmd.name)}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}
