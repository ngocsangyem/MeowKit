// One meaning per exit code, decided before a command runs.
//
// A mistyped sub-verb used to be answered in three different ways — exit 0 and do
// nothing (so a script could not tell a typo from a no-op), exit 1 (indistinguishable
// from "ran and failed"), or exit 2 — and the user was never told what they could have
// typed instead. So the invocation is classified here, from the catalogue's own
// declarations, before any command is dispatched:
//
//   0 — the command ran and succeeded
//   1 — the command ran and failed
//   2 — the invocation itself was wrong (unknown verb, unknown sub-verb, or a missing
//       sub-verb on a command that has no meaning without one)
//
// `--help` after a sub-verb is answered from the catalogue too, so help can never
// disagree with the dispatcher and asking for help cannot run the thing you were
// asking about.
import type { Catalogue, CommandSpec } from "./catalogue-types.js";
import { flagLines } from "./flag-summary.js";

/** The invocation is wrong, as opposed to the command having run and failed. */
export const INVOCATION_ERROR = 2;

export type Invocation =
	| { kind: "run" }
	| { kind: "unknown-command"; command: string }
	| { kind: "unknown-subcommand"; command: CommandSpec; subcommand: string }
	| { kind: "missing-subcommand"; command: CommandSpec }
	| { kind: "command-help"; command: CommandSpec }
	| { kind: "subcommand-help"; command: CommandSpec; subcommand: string };

/** A `--flag` in the sub-verb slot is a flag, not a sub-verb someone misspelled. */
function looksLikeFlag(token: string): boolean {
	return token.startsWith("-");
}

/**
 * Classify `mewkit <command> <subcommand> …` without running anything. `positionals`
 * are the parsed positional arguments and `help` is whether `--help` was passed.
 */
export function classifyInvocation(catalogue: Catalogue, positionals: string[], help: boolean): Invocation {
	const name = positionals[0];
	if (!name) return { kind: "run" };
	const command = catalogue.commands.find((c) => c.name === name);
	if (!command) return { kind: "unknown-command", command: name };

	const subs = command.subcommands ?? [];
	const token = positionals[1];
	const named = token !== undefined && !looksLikeFlag(token);

	if (subs.length === 0) return help ? { kind: "command-help", command } : { kind: "run" };

	if (!named) {
		if (help) return { kind: "command-help", command };
		// A command whose bare form does real work keeps it; one that does not is a
		// usage error rather than a silent no-op.
		return command.requiresSubcommand ? { kind: "missing-subcommand", command } : { kind: "run" };
	}
	if (!subs.includes(token)) return { kind: "unknown-subcommand", command, subcommand: token };
	return help ? { kind: "subcommand-help", command, subcommand: token } : { kind: "run" };
}

/** What a user is told when the sub-verb slot is wrong: the valid values, from the catalogue. */
export function renderInvocationError(invocation: Invocation): string[] {
	let headline: string;
	if (invocation.kind === "unknown-subcommand") {
		headline = `Unknown \`${invocation.command.name}\` subcommand: ${invocation.subcommand}`;
	} else if (invocation.kind === "missing-subcommand") {
		headline = `\`mewkit ${invocation.command.name}\` needs a subcommand.`;
	} else {
		return [];
	}
	const { name, subcommands } = invocation.command;
	return [headline, `Valid subcommands: ${(subcommands ?? []).join(", ")}`, `Run \`mewkit ${name} --help\` for usage.`];
}

export function renderCommandHelp(catalogue: Catalogue, command: CommandSpec): string[] {
	const out = [`mewkit ${command.usage ?? command.name}`, "", command.summary];
	const subs = command.subcommands ?? [];
	if (subs.length > 0) {
		out.push("", "Subcommands:");
		for (const sub of subs) {
			const usage = command.subcommandUsage?.[sub];
			out.push(`  ${sub}${usage ? ` — mewkit ${usage}` : ""}`);
		}
		if (command.requiresSubcommand) out.push("", "One subcommand is required.");
	}
	const flags = flagLines(catalogue, command.name);
	if (flags.length > 0) out.push("", "Flags:", ...flags);
	return out;
}

export function renderSubcommandHelp(catalogue: Catalogue, command: CommandSpec, subcommand: string): string[] {
	const usage = command.subcommandUsage?.[subcommand] ?? `${command.name} ${subcommand}`;
	const out = [`mewkit ${usage}`, "", `${command.name} ${subcommand} — ${command.summary}`];
	const flags = flagLines(catalogue, command.name);
	if (flags.length > 0) out.push("", "Flags:", ...flags);
	return out;
}
