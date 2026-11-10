// Resolve the summary a flag should show under a given command.
//
// A flag is declared once because minimist parses it once, but several genuinely mean different
// things depending on the command: `--profile` picks an install subset on `init` and a context
// profile to estimate on `budget`. Printing the first meaning under both was how the old help
// text misled people.
import type { Catalogue, FlagSpec } from "./catalogue-types.js";

/** The per-command summary when one is declared, otherwise the general one. */
export function summaryFor(flag: FlagSpec, command: string): string {
	return flag.perCommand?.[command] ?? flag.summary;
}

/** The summary as it is printed: the per-command text, marked when the flag repeats. */
export function flagText(flag: FlagSpec, command: string): string {
	const summary = summaryFor(flag, command);
	return flag.repeatable ? `${summary} (repeatable)` : summary;
}

/** `--name <value>` as a user types it. */
export function flagLabel(flag: FlagSpec): string {
	return `--${flag.name}${flag.type === "string" ? " <value>" : ""}`;
}

/**
 * The flags declared for one command, as plain uncolored lines. Shared by the help a
 * user asks for and the generated manual an agent reads, so the two cannot drift —
 * both answer from the catalogue rather than from prose written beside it.
 */
export function flagLines(catalogue: Catalogue, command: string): string[] {
	const flags = catalogue.flags.filter((f) => f.commands.includes(command));
	if (flags.length === 0) return [];
	const width = Math.max(...flags.map((f) => flagLabel(f).length)) + 2;
	return flags.map((flag) => `  ${flagLabel(flag).padEnd(width)}${flagText(flag, command)}`);
}
