// Replace a project's v2 `.meowkit/config.json` with the committed
// `config.yaml`, and say what did and did not come across.
//
// The old file is removed only AFTER the new one is written, and only when the
// caller has already snapshotted it. `uninstall` never removes it: this
// migration is the one path that does, because it is the path that replaces it.
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import pc from "picocolors";

import { planDescriptorMigration, type MigrationPlan } from "../config/migrate-descriptor.js";
import { observerNames } from "../config/observer-names.js";
import { configWritePath, legacyDescriptorPath } from "../state/resolve-config-path.js";

export interface DescriptorMigration {
	descriptor: string;
	target: string;
	plan: MigrationPlan;
	/** False for a dry run, or when the descriptor was unreadable. */
	applied: boolean;
}

/** Work out the migration without performing it. Null when there is none to do. */
export function planMigration(root: string): DescriptorMigration | null {
	const descriptor = legacyDescriptorPath(root);
	if (descriptor === null) return null;
	const target = configWritePath(root);
	if (existsSync(target)) return null;
	return { descriptor, target, plan: planDescriptorMigration(descriptor, observerNames(root)), applied: false };
}

/**
 * Perform the migration and report it. The caller must have snapshotted the
 * descriptor already — this removes it.
 */
export function migrateLegacyDescriptor(root: string, dryRun = false): DescriptorMigration | null {
	const migration = planMigration(root);
	if (migration === null) return null;
	const { descriptor, target, plan } = migration;
	const show = (file: string): string => relative(root, file) || file;

	if (!plan.readable) {
		console.log(pc.yellow(`  ${show(descriptor)} is not readable as JSON — left in place, nothing migrated.`));
		console.log(pc.dim(`  Fix or delete it, then re-run \`mewkit upgrade\` to write ${show(target)}.`));
		return migration;
	}

	console.log();
	console.log(pc.bold(`Migrating ${show(descriptor)} → ${show(target)}`));
	for (const c of plan.carried) console.log(`  ${pc.green("carried")} ${c.from} → ${c.to}: ${c.value}`);
	for (const u of plan.uncarried) console.log(`  ${pc.yellow("not carried")} ${u.from} — ${u.why}`);
	if (dryRun) {
		console.log(pc.dim(`  Dry run: ${show(target)} not written, ${show(descriptor)} left in place.`));
		return migration;
	}

	writeFileSync(target, plan.body, "utf-8");
	rmSync(descriptor, { force: true });
	console.log(pc.dim(`  ${show(descriptor)} removed; its contents are in the snapshot this run took.`));
	return { ...migration, applied: true };
}
