// The machine-readable form of what `init` and `upgrade` print as their summary.
//
// It carries the same items in the same order as the human summary: the counts
// it reports as notes, and one planned-change entry for every path the install
// names — the files it left alone because the project edited them, and the three
// kinds of removal a release can ask for. A reader comparing the two should find
// nothing in one that is missing from the other.
import type { UpdateStats } from "../core/index.js";
import type { MutationReport, PlannedChange } from "../core/mutation-report.js";

const changes = (action: string, paths: string[], detail: string): PlannedChange[] =>
	paths.map((path) => ({ action, path, detail }));

/** Why each path is on the list. Named once, because `planned` and `applied` both say it. */
const WHY = {
	userModified: "left as the project edited it",
	orphan: "no longer in the release",
	deletion: "listed in the release deletions",
	profile: "outside the installed profile",
} as const;

/** The authored provider bundles report per artifact, so their plan maps straight across. */
export function bundleReport(
	command: "init" | "upgrade",
	entries: { action: string; targetPath: string; wrote?: boolean }[],
	dryRun: boolean,
	notes: string[],
): MutationReport {
	const planned: PlannedChange[] = entries
		.filter((e) => e.action === "install" || e.action === "update" || e.action === "conflict")
		.map((e) => ({ action: e.action, path: e.targetPath }));
	return {
		ok: true,
		command,
		dryRun,
		planned,
		applied: dryRun
			? []
			: entries.filter((e) => e.wrote === true).map((e) => ({ action: e.action, path: e.targetPath })),
		notes,
	};
}

export function installMutationReport(
	command: "init" | "upgrade",
	stats: UpdateStats,
	dryRun: boolean,
	notes: string[] = [],
): MutationReport {
	// A dry run reports what it WOULD remove in the `*Preview` lists; a real run
	// reports what it did in the others. Taking both means neither flavour has to
	// be special-cased here, because only one of each pair is ever populated.
	const planned: PlannedChange[] = [
		...changes("skip", stats.userModified, WHY.userModified),
		...changes("delete", [...stats.orphansDeleted, ...stats.orphansSkipped], WHY.orphan),
		...changes("delete", [...stats.deletionsDeleted, ...stats.deletionsPreview], WHY.deletion),
		...changes("delete", [...stats.profileTrimmed, ...stats.profileTrimPreview], WHY.profile),
	];
	const applied = dryRun
		? []
		: [
				...changes("skip", stats.userModified, WHY.userModified),
				...changes("delete", stats.orphansDeleted, WHY.orphan),
				...changes("delete", stats.deletionsDeleted, WHY.deletion),
				...changes("delete", stats.profileTrimmed, WHY.profile),
			];

	return {
		ok: true,
		command,
		dryRun,
		planned,
		applied,
		notes: [
			...notes,
			`added ${stats.added}`,
			`updated ${stats.updated}`,
			`skipped ${stats.skipped}`,
			`${stats.userModified.length} user-modified file(s) preserved`,
		],
	};
}
