import { existsSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import {
	fetchReleases,
	downloadRelease,
	cleanupDownload,
	smartUpdate,
	readInstallMetadata,
	hasPackManifest,
	loadPackManifest,
	resolvePacks,
} from "../core/index.js";
import type { ReleaseInfo, UpdateStats, UserConfig } from "../core/index.js";
import { beginMachineOutput, envelopeEmitter, type MutationReport } from "../core/mutation-report.js";
import { installMutationReport } from "./install-report.js";
import { runMigrate } from "../migrate/migrate-orchestrator.js";
import { resolveCodexModuleDir } from "../migrate/modules/codex-authored-bundle.js";
import { reconcileApplyCodexBundle } from "../migrate/modules/codex-reconcile-apply.js";
import { resolveCursorModuleDir } from "../migrate/modules/cursor-authored-bundle.js";
import { reconcileApplyCursorBundle } from "../migrate/modules/cursor-reconcile-apply.js";
import { describeRetiredSkills } from "../migrate/modules/retired-skill-cleanup.js";
import { meowkitStatePaths } from "../state/meowkit-state-paths.js";
import { reportOrphanedV2Stores } from "../core/report-orphaned-stores.js";
import { createSnapshot } from "../core/snapshot.js";
import { confirmationRequiredMessage, EXIT_NEEDS_CONFIRMATION, needsConfirmation } from "../core/destructive-guard.js";
import { populateKitCache } from "../core/kit-cache.js";
import { LEGACY_DESCRIPTOR_REL, legacyDescriptorPath } from "../state/resolve-config-path.js";
import { migrateLegacyDescriptor } from "./migrate-config-descriptor.js";

/** Provider toolkits that upgrade can propagate to, keyed by their project marker dir. */
const PROPAGATABLE_PROVIDERS: ReadonlyArray<{ tool: string; dir: string }> = [
	{ tool: "cursor", dir: ".cursor" },
	{ tool: "codex", dir: ".codex" },
];

/** True when `projectDir` has an AUTHORED Cursor install — the cursor reconciliation ledger
 *  exists. This is the disambiguation signal (not `.cursor/` dir presence): a legacy
 *  `.claude/` → `.cursor/` converter export also creates a `.cursor/` dir, so dir presence
 *  alone cannot tell an authored bundle apart from a legacy export. */
function hasCursorLedger(projectDir: string): boolean {
	return existsSync(meowkitStatePaths(join(projectDir, ".meowkit")).cursorLedger);
}

/** Refresh the authored Cursor bundle in place (reconciled — user edits preserved or
 *  reported as conflicts, never blind-overwritten). Shared by `upgradeCursorToolkit`
 *  (cursor-only project) and `reMigrateInstalledProviders` (mixed project). */
async function refreshCursorBundle(projectDir: string): Promise<void> {
	const moduleDir = resolveCursorModuleDir();
	if (!existsSync(join(moduleDir, "manifest.json"))) {
		console.error(pc.red("Cursor bundle not found in this install — reinstall the `mewkit` package."));
		return;
	}
	const result = await reconcileApplyCursorBundle(moduleDir, projectDir, { projectRoot: projectDir });
	const preserved = result.entries.filter((e) => e.action === "skip" && e.reasonCode === "user-edits-preserved").length;
	console.log(
		pc.green(
			`Cursor toolkit refreshed — ${result.writes} updated${preserved > 0 ? `, ${preserved} preserving your edits` : ""}.`,
		),
	);
	if (result.conflicts.length > 0) {
		console.log(
			pc.yellow(`  ${result.conflicts.length} conflict(s) — both you and mewkit changed these; left untouched:`),
		);
		for (const c of result.conflicts) console.log(pc.dim(`    ${c.targetPath}`));
	}
	for (const line of describeRetiredSkills(result.retired)) console.log(pc.dim(`  ${line}`));
}

/** After a `.claude/` upgrade, re-export to any installed downstream provider toolkit
 *  so the whole install moves together (a bare `mewkit upgrade` no longer leaves
 *  .cursor/.codex stale). Best-effort: a failing provider is reported, not fatal.
 *
 *  Cursor is special-cased: a mixed `.claude/` + authored `.cursor/` project (the ledger
 *  exists) must NEVER re-run the legacy `.claude/` → `.cursor/` converter — that converter
 *  regenerates `.cursor/` content from `.claude/` from scratch and has no notion of the
 *  authored bundle's ledger, so it would clobber authored files. The authored bundle is
 *  refreshed via the reconciler instead (`refreshCursorBundle`), same as `upgradeCursorToolkit`. */
async function reMigrateInstalledProviders(projectDir: string): Promise<void> {
	const cursorLedgerPresent = hasCursorLedger(projectDir);
	if (cursorLedgerPresent) await refreshCursorBundle(projectDir);

	const installed = PROPAGATABLE_PROVIDERS.filter(({ tool, dir }) => {
		if (tool === "cursor" && cursorLedgerPresent) return false;
		return existsSync(join(projectDir, dir));
	});
	if (installed.length === 0) return;
	console.log(
		`\n${pc.bold("Propagating upgrade to installed provider toolkits:")} ${installed.map((p) => p.tool).join(", ")}`,
	);
	for (const { tool } of installed) {
		try {
			await runMigrate(
				{ tool, source: join(projectDir, ".claude"), force: true, yes: true },
				{ bundledKitDir: join(projectDir, ".claude"), argv: [] },
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(pc.yellow(`[!] Re-exporting ${tool} failed (${msg}) — re-run 'mewkit migrate ${tool}'.`));
		}
	}
}

/** A codex-only project (from `init --target codex`) has no `.claude/`; upgrade it by
 *  reconciling the authored Codex bundle from the installed package against the project
 *  ledger. Managed artifacts are refreshed, but a user-edited file is PRESERVED and
 *  reported as a conflict rather than silently overwritten. */
async function upgradeCodexToolkit(projectDir: string): Promise<void> {
	console.log(pc.bold("Codex toolkit detected (no .claude/) — refreshing from the installed mewkit bundle."));
	const moduleDir = resolveCodexModuleDir();
	if (!existsSync(join(moduleDir, "manifest.json"))) {
		console.error(pc.red("Codex bundle not found in this install — reinstall the `mewkit` package."));
		process.exit(1);
	}
	const result = await reconcileApplyCodexBundle(moduleDir, projectDir, { projectRoot: projectDir });
	const preserved = result.entries.filter((e) => e.action === "skip" && e.reasonCode === "user-edits-preserved").length;
	console.log(
		pc.green(
			`Codex toolkit refreshed — ${result.writes} updated${preserved > 0 ? `, ${preserved} preserving your edits` : ""}.`,
		),
	);
	if (result.conflicts.length > 0) {
		console.log(
			pc.yellow(`  ${result.conflicts.length} conflict(s) — both you and mewkit changed these; left untouched:`),
		);
		for (const c of result.conflicts) console.log(pc.dim(`    ${c.targetPath}`));
	}
	for (const line of describeRetiredSkills(result.retired)) console.log(pc.dim(`  ${line}`));
}

/** A cursor-only project (from `init --target cursor`) has no `.claude/`; upgrade it by
 *  reconciling the authored Cursor bundle from the installed package against the project
 *  ledger. Gated on the ledger's presence (not `.cursor/` dir), since a `.cursor/` dir alone
 *  cannot tell an authored install apart from a legacy converter export. */
async function upgradeCursorToolkit(projectDir: string): Promise<void> {
	console.log(pc.bold("Cursor toolkit detected (no .claude/) — refreshing from the installed mewkit bundle."));
	// Fail closed as the solo entrypoint (parity with upgradeCodexToolkit): a cursor-only
	// project whose install is corrupt must not silently exit 0 having done nothing. The
	// shared refreshCursorBundle stays best-effort for the mixed-project reMigrate path,
	// where one broken provider must not abort propagation to the others.
	const moduleDir = resolveCursorModuleDir();
	if (!existsSync(join(moduleDir, "manifest.json"))) {
		console.error(pc.red("Cursor bundle not found in this install — reinstall the `mewkit` package."));
		process.exit(1);
	}
	await refreshCursorBundle(projectDir);
}

export interface UpgradeArgs {
	check?: boolean;
	beta?: boolean;
	list?: boolean;
	noCleanup?: boolean;
	yes?: boolean;
	/** Overwrite files this project has edited. Destructive, so it is gated. */
	force?: boolean;
	/** Plan only: no snapshot, no write, no cache rewrite. */
	dryRun?: boolean;
	/** False in a non-TTY session; the destructive guard reads it. */
	interactive?: boolean;
	/** Print the one mutation envelope on stdout; the narration goes to stderr. */
	json?: boolean;
}

/** Read installed version from canonical metadata (instant, no npx), with legacy fallback. */
function getLocalVersion(): string | null {
	try {
		const { source, meta } = readInstallMetadata(join(process.cwd(), ".claude"));
		if (source === "none" || !meta) return null;
		// A legacy checksum manifest has no trustworthy version; report it only when
		// a real version was recovered (never the empty placeholder).
		return meta.version ? meta.version : null;
	} catch {
		return null;
	}
}

/** Format a date string as YYYY-MM-DD */
function formatDate(iso: string): string {
	return iso.split("T")[0];
}

/** Show available releases fetched from GitHub */
async function listReleases(localVersion: string | null): Promise<void> {
	console.log(pc.dim("Fetching available releases from GitHub..."));

	const releases = await fetchReleases();

	const stable = releases.filter((r) => !r.isBeta);
	const beta = releases.filter((r) => r.isBeta);

	console.log();
	console.log(pc.bold("Channels:"));
	console.log(`  ${pc.green("stable:")}  ${stable[0]?.version ?? "none"}`);
	if (beta.length > 0) {
		console.log(`  ${pc.yellow("beta:")}    ${beta[0]?.version ?? "none"}`);
	}

	console.log();
	console.log(pc.bold("Recent releases:"));
	for (const r of releases.slice(0, 10)) {
		const installed = r.version === localVersion ? pc.cyan(" (installed)") : "";
		const label = r.isBeta ? pc.yellow(" (beta)") : "";
		console.log(`  ${r.version}${label}${installed}  ${pc.dim(formatDate(r.publishedAt))}`);
	}
}

/** Compare local vs latest GitHub release */
async function checkVersion(localVersion: string | null, useBeta: boolean): Promise<void> {
	console.log(pc.dim("Checking for updates..."));

	const releases = await fetchReleases();
	const latestStable = releases.find((r) => !r.isBeta);
	const latestBeta = releases.find((r) => r.isBeta);

	console.log(`${pc.bold("Local version:")}   ${localVersion ? pc.cyan(localVersion) : pc.dim("not installed")}`);
	if (latestStable) {
		console.log(
			`${pc.bold("Latest stable:")}   ${pc.green(latestStable.version)}  ${pc.dim(formatDate(latestStable.publishedAt))}`,
		);
	}
	if (latestBeta) {
		console.log(
			`${pc.bold("Latest beta:")}     ${pc.yellow(latestBeta.version)}  ${pc.dim(formatDate(latestBeta.publishedAt))}`,
		);
	}

	const compareTo = useBeta ? (latestBeta ?? latestStable) : latestStable;
	if (!compareTo) {
		console.log(pc.yellow("No releases found on GitHub."));
		return;
	}

	if (localVersion === compareTo.version) {
		console.log(pc.green("\nAlready up to date."));
	} else {
		console.log(pc.yellow(`\nUpdate available: ${localVersion ?? "none"} → ${compareTo.version}`));
		console.log(pc.dim("Run `npx mewkit upgrade` to install."));
	}
}

/** Perform the upgrade: download latest release and apply via smart update */
async function performUpgrade(
	localVersion: string | null,
	useBeta: boolean,
	cleanup: boolean,
	assumeYes: boolean,
	dryRun: boolean,
	force: boolean,
): Promise<UpdateStats | null> {
	console.log(pc.dim("Fetching latest release from GitHub..."));

	const releases = await fetchReleases();
	const latest: ReleaseInfo | undefined = useBeta
		? (releases.find((r) => r.isBeta) ?? releases.find((r) => !r.isBeta))
		: releases.find((r) => !r.isBeta);

	if (!latest) {
		console.error(pc.red("No releases found on GitHub."));
		process.exit(1);
	}

	if (localVersion === latest.version) {
		console.log(pc.green(`Already up to date (v${latest.version}).`));
		return null;
	}

	console.log(`Upgrading: ${pc.dim(localVersion ?? "none")} → ${pc.cyan(latest.version)}`);
	console.log(pc.dim(`Downloading v${latest.version}...`));

	let sourceDir: string;
	try {
		sourceDir = await downloadRelease(latest);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(pc.red(`Download failed: ${msg}`));
		process.exit(1);
	}

	try {
		const config: UserConfig = {
			description: "",
			enableCostTracking: true,
			enableMemory: true,
			geminiApiKey: null,
		};

		// Before the first write of the run: a copy of everything the release
		// could overwrite, plus the v2 descriptor the migration below replaces.
		// A dry run takes none, because it writes nothing to recover from.
		const snapshot = dryRun
			? null
			: createSnapshot(process.cwd(), "upgrade", [
					".claude",
					...(legacyDescriptorPath(process.cwd()) === null ? [] : [LEGACY_DESCRIPTOR_REL]),
				]);
		if (snapshot !== null) {
			console.log(pc.dim(`Snapshot ${snapshot.id} — ${snapshot.fileCount} file(s); restore with \`mewkit backups restore ${snapshot.id}\``));
		}

		// Pack-aware upgrade: a partial install upgrades only its installed packs;
		// removed packs stay removed. Corrupt/absent metadata (or a legacy/full
		// install with `packs` undefined) falls through to a full upgrade — never
		// abort the very upgrade that would repair corruption.
		let installedPacks: string[] | undefined;
		let installedProfile: string | undefined;
		try {
			const { meta } = readInstallMetadata(join(process.cwd(), ".claude"));
			installedPacks = meta?.packs;
			installedProfile = meta?.profile;
		} catch {
			installedPacks = undefined;
		}
		const claudeSrc = join(sourceDir, ".claude");
		const allowedPaths =
			installedPacks && hasPackManifest(claudeSrc)
				? resolvePacks(claudeSrc, loadPackManifest(claudeSrc), installedPacks)
				: undefined;

		const stats = await smartUpdate(config, sourceDir, process.cwd(), dryRun, force, {
			cleanup,
			assumeYes,
			allowedPaths,
			profile: installedProfile,
			packs: installedPacks,
		});

		console.log();
		console.log(pc.green(pc.bold(dryRun ? "Upgrade plan (nothing was written)" : "Upgrade complete!")));
		console.log(`  ${pc.dim("Before:")} ${localVersion ?? "not installed"}`);
		console.log(`  ${pc.dim("After:")}  ${latest.version}`);
		console.log();
		console.log(`  ${pc.green("added")}   ${stats.added}`);
		console.log(`  ${pc.cyan("updated")} ${stats.updated}`);
		console.log(`  ${pc.dim("skipped")} ${stats.skipped}`);
		if (stats.deletionsDeleted.length > 0) {
			console.log(
				`  ${pc.red("deleted")} ${stats.deletionsDeleted.length}  ${pc.dim("(marked for removal by the release)")}`,
			);
		}
		if (stats.orphansDeleted.length > 0) {
			console.log(`  ${pc.red("removed")} ${stats.orphansDeleted.length}  ${pc.dim("(release no longer ships)")}`);
		}
		if (stats.orphansSkipped.length > 0) {
			// NAME them. A count alone is unactionable: a leftover rule file still auto-loads
			// and can outrank the current release's guidance, and the user cannot judge the risk
			// — or delete the file by hand — from the number alone.
			console.log(
				pc.yellow(`\n  ${stats.orphansSkipped.length} orphan file(s) detected but not deleted (use --yes to confirm):`),
			);
			for (const relPath of stats.orphansSkipped) console.log(pc.yellow(`    .claude/${relPath}`));
		}
		reportOrphanedV2Stores(process.cwd());

		if (stats.userModified.length > 0) {
			console.log(
				pc.yellow(`\n  ${stats.userModified.length} user-modified file(s) preserved (use --force to overwrite).`),
			);
		}

		if (!dryRun) {
			migrateLegacyDescriptor(process.cwd());

			// Propagate the upgrade to any installed downstream provider toolkits.
			await reMigrateInstalledProviders(process.cwd());
		}
		return stats;
	} finally {
		// The local kit copy is written BEFORE the download is removed: the
		// temp directory is the only place the kit's own bytes exist, and every
		// later deletion decision is checked against them. A dry run leaves the
		// existing cache alone, because it installed nothing.
		try {
			if (!dryRun) populateKitCache(sourceDir, process.cwd(), latest.version);
		} catch (err: unknown) {
			console.log(pc.yellow(`  Could not write the local kit copy: ${err instanceof Error ? err.message : String(err)}`));
			console.log(pc.dim("  `mewkit uninstall` will refuse to delete until `mewkit upgrade` succeeds in writing it."));
		}
		cleanupDownload(sourceDir);
	}
}

export async function upgrade(args: UpgradeArgs): Promise<void> {
	const json = args.json === true;
	if (json) beginMachineOutput();
	/** One envelope per run, whichever of this command's several ends is reached. */
	const emit = envelopeEmitter(json);
	const noChange = (note: string): MutationReport => ({
		ok: true,
		command: "upgrade",
		dryRun: args.dryRun === true,
		planned: [],
		applied: [],
		notes: [note],
	});

	// Provider-only project(s) (`init --target codex` / `init --target cursor`): no
	// `.claude/` to update — refresh whichever authored bundle(s) are present instead of the
	// release flow. A project can have more than one provider-only bundle installed with no
	// claude-code kit; refresh every one present rather than returning after the first match.
	// (Skip for --check/--list, which are version queries.)
	const cwd = process.cwd();
	if (!args.check && !args.list && !existsSync(join(cwd, ".claude"))) {
		const hasCodex = existsSync(join(cwd, ".codex"));
		const hasCursor = hasCursorLedger(cwd);
		if (hasCodex || hasCursor) {
			if (hasCodex) await upgradeCodexToolkit(cwd);
			if (hasCursor) await upgradeCursorToolkit(cwd);
			emit(() => noChange("refreshed the authored provider bundle(s); this project has no .claude/"));
			return;
		}
	}

	const localVersion = getLocalVersion();
	const useBeta = args.beta ?? false;

	if (localVersion) {
		const isBeta = localVersion.includes("-beta") || localVersion.includes("-rc");
		console.log(`${pc.bold("Current version:")} ${pc.cyan(localVersion)}${isBeta ? pc.dim(" (beta)") : ""}`);
	} else {
		console.log(`${pc.bold("Current version:")} ${pc.dim("not installed")}`);
	}

	try {
		if (args.list) {
			await listReleases(localVersion);
			emit(() => noChange("listed the available releases; nothing was changed"));
			return;
		}

		if (args.check) {
			await checkVersion(localVersion, useBeta);
			emit(() => noChange("reported the installed version against the channel; nothing was changed"));
			return;
		}

		// `--force` overwrites files this project has edited, so it is one of the
		// four destructive invocations: in a session with no terminal to confirm
		// in it previews and stops rather than acting on an unseen plan.
		if (args.force === true && needsConfirmation({ assumeYes: args.yes === true, interactive: args.interactive !== false })) {
			console.log(pc.yellow(confirmationRequiredMessage("upgrade --force")));
			const preview = await performUpgrade(localVersion, useBeta, args.noCleanup !== true, true, /* dryRun */ true, /* force */ true);
			process.exitCode = EXIT_NEEDS_CONFIRMATION;
			emit(() =>
				preview === null
					? noChange("already up to date; nothing was changed")
					: installMutationReport("upgrade", preview, true, ["--force needs confirmation: this is the plan, nothing was written"]),
			);
			return;
		}

		const stats = await performUpgrade(
			localVersion,
			useBeta,
			/* cleanup */ args.noCleanup !== true,
			/* assumeYes */ args.yes === true,
			/* dryRun */ args.dryRun === true,
			/* force */ args.force === true,
		);
		emit(() =>
			stats === null
				? noChange("already up to date; nothing was changed")
				: installMutationReport("upgrade", stats, args.dryRun === true, [`from ${localVersion ?? "not installed"}`]),
		);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(pc.red(`upgrade failed: ${msg}`));
		process.exit(1);
	}
}
