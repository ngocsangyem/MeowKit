// The one envelope a mutating command prints for `--json`, and the one mechanism
// that keeps human text out of stdout while that envelope is being produced.
//
// Shape first: `uninstall` and `backups` already print `{ ok, dryRun, … }` with a
// `planned` list and the subset that was actually carried out. Every other
// mutating command prints the same thing rather than inventing a second shape, so
// a caller can parse one envelope and ask the same questions of any of them.
//
// Then stdout. A machine-readable run must put NOTHING on stdout but the
// envelope, and the commands that mutate the most (`init`, `migrate`) narrate
// through a prompt library that writes to `process.stdout` directly from ~60 call
// sites. Threading a reporter through all of them would be a far larger change
// than the flag is worth, so for the duration of a `--json` run stdout is pointed
// at stderr: the user still sees the narration, and the envelope — written through
// the real stdout captured here — is the only thing a pipe receives.

/** One line of a command's change list: what it would do, or did, to one path. */
export interface PlannedChange {
	/** `create`, `update`, `append`, `copy`, `mkdir`, `delete`, `skip`, or a provider action name. */
	action: string;
	/** Project-relative where possible, so two runs of the same plan compare equal. */
	path: string;
	detail?: string;
}

export interface MutationReport {
	ok: boolean;
	/** The verb as the user typed it (`pack add`, not `pack`), so a log line is unambiguous. */
	command: string;
	dryRun: boolean;
	/** What the run set out to do — the same items the human preview prints. */
	planned: PlannedChange[];
	/** What it actually did. Empty on a dry run, which is the assertion that matters. */
	applied: PlannedChange[];
	/** The human lines that are not change items: step verdicts, warnings, hints. */
	notes: string[];
	error?: string;
	/** What to do about `error` — never printed without it. */
	fix?: string;
}

type Write = typeof process.stdout.write;

let realWrite: Write | null = null;

function setWrite(fn: Write): void {
	// `defineProperty` rather than assignment: the property is typed with the
	// stream's overload set, and a redirect is one signature, so an assignment
	// would need a cast to compile.
	Object.defineProperty(process.stdout, "write", { value: fn, configurable: true, writable: true });
}

/**
 * Point stdout at stderr until `endMachineOutput`. Idempotent: a nested call is a
 * no-op rather than a second capture that would restore the wrong function.
 */
export function beginMachineOutput(): void {
	if (realWrite !== null) return;
	realWrite = process.stdout.write.bind(process.stdout);
	setWrite(process.stderr.write.bind(process.stderr));
}

export function endMachineOutput(): void {
	if (realWrite === null) return;
	setWrite(realWrite);
	realWrite = null;
}

/**
 * Print the envelope on the REAL stdout, redirect or no redirect, so the caller
 * does not have to care whether it is still inside a machine-output window.
 */
export function printMutationJson(report: MutationReport): void {
	const write = realWrite ?? process.stdout.write.bind(process.stdout);
	write(`${JSON.stringify(report, null, 2)}\n`);
	emitted = true;
}

let emitted = false;

/**
 * Whether an envelope has already been printed this process. A command whose work
 * can end at one of several returns uses this to print exactly one envelope —
 * stdout carrying two JSON documents is as unparseable as stdout carrying prose.
 */
export function jsonEmitted(): boolean {
	return emitted;
}

/**
 * `emit(make)` for a command whose work can end at one of several returns:
 * prints the envelope and closes the machine-output window, or does nothing at
 * all when the run is not machine-readable. The report is built lazily, because
 * without `--json` there is nothing to build it from.
 *
 * Pairing the print with `endMachineOutput` here rather than at each call site
 * is the point: a command that printed the envelope and left stdout pointed at
 * stderr would send everything after it to the wrong stream.
 */
export function envelopeEmitter(json: boolean): (make: () => MutationReport) => void {
	return (make) => {
		if (!json) return;
		printMutationJson(make());
		endMachineOutput();
	};
}

/** A report for a command that refused to run, with the way forward attached. */
export function refusal(command: string, error: string, fix: string): MutationReport {
	return { ok: false, command, dryRun: false, planned: [], applied: [], notes: [], error, fix };
}

/**
 * Print an envelope on the way out if the command stopped before printing one.
 * A command that validates as it goes exits from many places; a caller parsing
 * stdout should get a document saying it failed rather than an empty stream.
 */
export function ensureEnvelopeOnExit(command: string): void {
	process.on("exit", (code) => {
		if (emitted) return;
		printMutationJson(
			refusal(
				command,
				`${command} stopped with status ${code} before it could report.`,
				"The reason is on stderr — resolve it and re-run.",
			),
		);
	});
}
