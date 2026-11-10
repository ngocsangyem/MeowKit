// `mewkit versions` — what is installed here, as four facts.
//
// Its own verb rather than an alias or a flag on another one. The CLI and the
// kit carry independent versions, and the question "which kit is in this
// project, laid down by which CLI, for which runtime, in which shape" has no
// single existing answer: one command prints the CLI's version, another lists
// versions available to download. Neither says what is on disk.
//
// A project with no install exits non-zero. Printing "none" with a success exit
// makes the command unusable in a script: the caller cannot tell "no install"
// from "an install whose version is the string none".
import { join } from "node:path";

import pc from "picocolors";

import { readInstallMetadata, CorruptInstallMetadataError } from "../core/install-metadata.js";

const UNKNOWN = "unknown";

interface VersionsReport {
	cliVersion: string;
	kitVersion: string;
	target: string;
	delivery: string;
	origin: string;
}

function buildReport(root: string, cliVersion: string): VersionsReport | { error: string } {
	const claudeDir = join(root, ".claude");
	let meta;
	try {
		meta = readInstallMetadata(claudeDir).meta;
	} catch (error) {
		if (error instanceof CorruptInstallMetadataError) {
			return {
				error:
					"This project's install record is unreadable, so its versions cannot be reported. Run `mewkit upgrade` to rebuild it.",
			};
		}
		throw error;
	}
	// Presence of `.claude/` is NOT the test. An external target
	// (`init --target codex|cursor`) is a real install with no provider directory
	// of its own here, and reporting it as "nothing installed" would make this
	// command useless in exactly the projects whose target is worth asking about.
	if (meta === null) {
		return {
			error:
				"No MeowKit install was found in this directory, so there are no installed versions to report. Run `mewkit init` to create one.",
		};
	}
	// Absent provenance is reported as unknown rather than guessed. A project
	// installed before provenance was recorded has a real kit version and no
	// recorded target, and inventing "claude-code" would make the field a
	// statement about the CLI's defaults rather than about the project.
	const p = meta.provenance;
	return {
		cliVersion,
		kitVersion: p?.kitVersion ?? meta.version ?? UNKNOWN,
		target: p?.target ?? UNKNOWN,
		delivery: p?.delivery ?? UNKNOWN,
		origin: p?.origin ?? UNKNOWN,
	};
}

export function versions(cliVersion: string, args?: { json?: boolean }): void {
	const report = buildReport(process.cwd(), cliVersion);
	if ("error" in report) {
		if (args?.json) console.log(JSON.stringify({ error: report.error }, null, 2));
		else console.error(pc.red(report.error));
		process.exitCode = 1;
		return;
	}
	if (args?.json) {
		console.log(JSON.stringify(report, null, 2));
		return;
	}
	console.log(`${pc.dim("CLI")}       ${report.cliVersion}`);
	console.log(`${pc.dim("Kit")}       ${report.kitVersion}`);
	console.log(`${pc.dim("Target")}    ${report.target}`);
	console.log(`${pc.dim("Delivery")}  ${report.delivery}`);
	console.log(`${pc.dim("Origin")}    ${report.origin}`);
}
