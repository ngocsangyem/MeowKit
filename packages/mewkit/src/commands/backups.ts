// `mewkit backups list` / `mewkit backups restore <id>` — read and undo the
// snapshots the mutating commands take.
//
// A snapshot nobody can list or restore is a directory, not a safety net, which
// is why this ships in the same change as the snapshots themselves.
import pc from "picocolors";

import { confirmationRequiredMessage, EXIT_NEEDS_CONFIRMATION, needsConfirmation } from "../core/destructive-guard.js";
import { listSnapshots, readSnapshot } from "../core/snapshot.js";
import { planRestore, restoreSnapshot, UnknownSnapshotError } from "../core/snapshot-restore.js";

export interface BackupsArgs {
	json?: boolean;
	dryRun?: boolean;
	yes?: boolean;
	/** False in a non-TTY session; the destructive guard reads it. */
	interactive?: boolean;
}

/** Exit code, so the caller owns `process.exit` and this stays testable. */
export function backupsList(root: string, args: BackupsArgs): number {
	const snapshots = listSnapshots(root);
	if (args.json) {
		console.log(
			JSON.stringify(
				{
					snapshots: snapshots.map((s) => ({
						id: s.id,
						createdAt: s.createdAt,
						command: s.command,
						fileCount: s.fileCount,
					})),
				},
				null,
				2,
			),
		);
		return 0;
	}
	if (snapshots.length === 0) {
		console.log(pc.dim("No snapshots. One is written before each init, upgrade and uninstall."));
		return 0;
	}
	console.log(pc.bold(`${snapshots.length} snapshot(s)`));
	for (const s of snapshots) {
		console.log(`  ${pc.cyan(s.id)}  ${pc.dim(s.createdAt)}  ${s.command}  ${s.fileCount} file(s)`);
	}
	console.log(pc.dim("\nRestore one with `mewkit backups restore <id>` — the restore is itself snapshotted."));
	return 0;
}

export function backupsRestore(root: string, id: string | undefined, args: BackupsArgs): number {
	const available = listSnapshots(root).map((s) => s.id);
	if (id === undefined || id.trim() === "") {
		console.error(pc.red("backups restore needs a snapshot id."));
		console.error(pc.dim(`Available: ${available.length === 0 ? "none" : available.join(", ")}`));
		return 1;
	}

	const manifest = readSnapshot(root, id);
	if (manifest === null) {
		const err = new UnknownSnapshotError(id, available);
		if (args.json) console.log(JSON.stringify({ ok: false, id, error: err.message, available }, null, 2));
		else {
			console.error(pc.red(err.message));
			console.error(pc.dim("Run `mewkit backups list` to see what this project has."));
		}
		return 1;
	}

	// A restore overwrites whatever is on disk now, so it is destructive: with no
	// terminal to confirm in it prints the plan and stops. The plan is the same
	// one `--dry-run` prints, so the user sees exactly what was withheld.
	const blind = args.dryRun !== true && needsConfirmation({ assumeYes: args.yes === true, interactive: args.interactive !== false });

	if (args.dryRun || blind) {
		const plan = planRestore(root, manifest);
		if (blind && !args.json) console.error(pc.yellow(confirmationRequiredMessage("backups restore")));
		if (args.json) console.log(JSON.stringify({ ok: true, dryRun: true, needsConfirmation: blind, id, ...plan }, null, 2));
		else {
			console.log(pc.bold(`Would restore ${plan.write.length} file(s) from ${id}`));
			for (const p of plan.write) console.log(`  ${pc.cyan("restore")} ${p}`);
			if (plan.unchanged.length) console.log(pc.dim(`  ${plan.unchanged.length} already identical`));
		}
		return blind ? EXIT_NEEDS_CONFIRMATION : 0;
	}

	const result = restoreSnapshot(root, id, available);
	if (args.json) {
		console.log(JSON.stringify({ ok: true, ...result }, null, 2));
		return 0;
	}
	console.log(pc.bold(`Restored ${result.restored.length} file(s) from ${id}`));
	for (const r of result.restored) console.log(`  ${pc.cyan("restored")} ${r.path}`);
	if (result.unchanged.length) console.log(pc.dim(`  ${result.unchanged.length} already identical`));
	if (result.undoId !== null) {
		console.log(pc.dim(`\nThe pre-restore state is snapshot ${result.undoId} — this restore is itself undoable.`));
	}
	return 0;
}

export function backups(root: string, subcommand: string | undefined, id: string | undefined, args: BackupsArgs): number {
	switch (subcommand) {
		case undefined:
		case "list":
			return backupsList(root, args);
		case "restore":
			return backupsRestore(root, id, args);
		default:
			console.error(pc.red(`Unknown backups subcommand: ${subcommand}`));
			console.error(pc.dim("Use `mewkit backups list` or `mewkit backups restore <id>`."));
			return 1;
	}
}
