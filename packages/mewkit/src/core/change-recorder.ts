// A filesystem facade that records every write it is asked for and performs it
// only when this is not a dry run.
//
// The alternative was a second description of what each step writes — one branch
// that plans and one that acts. Two descriptions of one write is one of them going
// stale, and the stale one is the preview, which is exactly the thing a user is
// trusting when they pass `--dry-run`. Here the recorded item IS the write: a step
// cannot report a change it did not make, or make one it did not report.
import { appendFileSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { relative } from "node:path";

import type { PlannedChange } from "./mutation-report.js";

export interface ChangeRecorder {
	readonly dryRun: boolean;
	/** Every change, in the order it was asked for. */
	readonly changes: PlannedChange[];
	write(file: string, content: string): void;
	copy(from: string, to: string): void;
	append(file: string, content: string): void;
	mkdir(dir: string): void;
	/** Record a change made by code this facade does not own (an installer, a venv). */
	record(action: string, file: string, detail?: string): void;
}

export function changeRecorder(root: string, dryRun: boolean): ChangeRecorder {
	const changes: PlannedChange[] = [];
	const rel = (file: string): string => relative(root, file) || file;
	const note = (action: string, file: string, detail?: string): void => {
		changes.push(detail === undefined ? { action, path: rel(file) } : { action, path: rel(file), detail });
	};

	return {
		dryRun,
		changes,
		write(file, content) {
			note(existsSync(file) ? "update" : "create", file);
			if (!dryRun) writeFileSync(file, content, "utf-8");
		},
		copy(from, to) {
			note("copy", to, `from ${rel(from)}`);
			if (!dryRun) copyFileSync(from, to);
		},
		append(file, content) {
			note("append", file);
			if (!dryRun) appendFileSync(file, content, "utf-8");
		},
		mkdir(dir) {
			if (existsSync(dir)) return;
			note("mkdir", dir);
			if (!dryRun) mkdirSync(dir, { recursive: true });
		},
		record: note,
	};
}
