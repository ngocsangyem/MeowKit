// Shape of the CLI catalogue: the one place a command or flag is declared.
//
// Before this existed the same flag had to be written down in three places — the minimist
// options, the help text, and the docs — and nothing checked them against each other. Six
// flags were being read without being declared (so minimist guessed their type), six were
// declared and read nowhere, and forty-two never appeared in `--help` at all.

/** How minimist should parse a flag. Booleans take no value; strings always take one. */
export type FlagType = "boolean" | "string";

export interface FlagSpec {
	/** Flag name without dashes, kebab-case, exactly as typed. */
	name: string;
	type: FlagType;
	/**
	 * Commands the flag applies to. Empty means global (`--help`, `--version`).
	 * This is documentation and grouping, not enforcement: minimist parses flags before a
	 * command is known, so a flag typed at the wrong command is still parsed, just unused.
	 */
	commands: string[];
	/** One line, present tense, describing what passing it does. */
	summary: string;
	/** Repeatable flags collect into an array rather than taking the last value. */
	repeatable?: boolean;
	/**
	 * Summary override for a command where the flag means something else. One flag is one
	 * minimist declaration, but `--profile` selects an install subset on `init` and a context
	 * profile to estimate on `budget`; printing one summary in both places is just wrong.
	 */
	perCommand?: Record<string, string>;
}

export interface CommandSpec {
	name: string;
	/** One line for `--help`. */
	summary: string;
	/** Sub-verbs this command accepts, if any. */
	subcommands?: string[];
	/** Longer usage shown under the command in generated docs, if the shape is not obvious. */
	usage?: string;
	/**
	 * The dispatcher hands this command the whole parsed args object and the subsystem reads
	 * its own flags from it. Those flags are owned there, not here, and are deliberately left
	 * untyped so minimist's inference applies (`--max-pages 3` should arrive as a number).
	 * Catalogue contracts do not extend into a pass-through command's flags.
	 */
	passThrough?: boolean;
}

export interface Catalogue {
	commands: CommandSpec[];
	flags: FlagSpec[];
	/** Short aliases, e.g. `h` for `help`. */
	aliases: Record<string, string>;
}
