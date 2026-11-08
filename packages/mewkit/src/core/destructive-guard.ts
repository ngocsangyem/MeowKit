// One rule for the four commands that can destroy work: never run blind.
//
// `uninstall`, `backups restore`, `upgrade --force` and `init --force` can each
// remove or overwrite something a user cannot get back from anywhere but a
// snapshot. In an interactive session they ask. In a session with no terminal to
// ask — CI, a pipe, a hook — asking is impossible, so they print what they would
// do and stop.
//
// The exit code is 3 rather than 1 on purpose: a script has to be able to tell
// "this needs your confirmation" from "this failed", and both from success.
// Commands that destroy nothing are deliberately NOT subject to this: `init` and
// `setup` on a fresh project stay scriptable, because a guard that stopped them
// too would make the whole CLI unusable in CI for no safety gained.

/** Exit status for "a destructive command was asked for and could not confirm". */
export const EXIT_NEEDS_CONFIRMATION = 3;

export interface ConfirmContext {
	/** True when `--yes` was passed. */
	assumeYes: boolean;
	/** False in a non-TTY session. */
	interactive: boolean;
}

/** Whether this invocation must stop at a preview instead of acting. */
export function needsConfirmation({ assumeYes, interactive }: ConfirmContext): boolean {
	return !assumeYes && !interactive;
}

/** The line every one of the four prints before exiting 3, naming the way forward. */
export function confirmationRequiredMessage(command: string): string {
	return `${command} can overwrite or remove files and this session has no terminal to confirm in. Nothing was written. Re-run with --yes (or --dry-run to see the plan).`;
}
