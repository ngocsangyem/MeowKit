// Resolve the summary a flag should show under a given command.
//
// A flag is declared once because minimist parses it once, but several genuinely mean different
// things depending on the command: `--profile` picks an install subset on `init` and a context
// profile to estimate on `budget`. Printing the first meaning under both was how the old help
// text misled people.
import type { FlagSpec } from "./catalogue-types.js";

/** The per-command summary when one is declared, otherwise the general one. */
export function summaryFor(flag: FlagSpec, command: string): string {
	return flag.perCommand?.[command] ?? flag.summary;
}
