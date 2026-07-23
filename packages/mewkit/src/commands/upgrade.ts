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
import type { ReleaseInfo, UserConfig } from "../core/index.js";
import { runMigrate } from "../migrate/migrate-orchestrator.js";
import { resolveCodexModuleDir, copyAuthoredCodexBundle } from "../migrate/modules/codex-authored-bundle.js";

/** Provider toolkits that upgrade can propagate to, keyed by their project marker dir. */
const PROPAGATABLE_PROVIDERS: ReadonlyArray<{ tool: string; dir: string }> = [
	{ tool: "cursor", dir: ".cursor" },
	{ tool: "codex", dir: ".codex" },
];

/** After a `.claude/` upgrade, re-export to any installed downstream provider toolkit
 *  so the whole install moves together (a bare `mewkit upgrade` no longer leaves
 *  .cursor/.codex stale). Best-effort: a failing provider is reported, not fatal. */
async function reMigrateInstalledProviders(projectDir: string): Promise<void> {
	const installed = PROPAGATABLE_PROVIDERS.filter((p) => existsSync(join(projectDir, p.dir)));
	if (installed.length === 0) return;
	console.log(`\n${pc.bold("Propagating upgrade to installed provider toolkits:")} ${installed.map((p) => p.tool).join(", ")}`);
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
 *  re-copying the authored Codex bundle from the installed package. Managed artifacts
 *  are refreshed (a user-edited AGENTS.md is overwritten — re-run after editing). */
function upgradeCodexToolkit(projectDir: string): void {
	console.log(pc.bold("Codex toolkit detected (no .claude/) — refreshing from the installed mewkit bundle."));
	const moduleDir = resolveCodexModuleDir();
	if (!existsSync(join(moduleDir, "manifest.json"))) {
		console.error(pc.red("Codex bundle not found in this install — reinstall the `mewkit` package."));
		process.exit(1);
	}
	const copied = copyAuthoredCodexBundle(moduleDir, projectDir);
	console.log(pc.green(`Codex toolkit refreshed (${copied.length} artifacts): AGENTS.md, .codex/, .agents/skills/.`));
}

export interface UpgradeArgs {
	check?: boolean;
	beta?: boolean;
	list?: boolean;
	noCleanup?: boolean;
	yes?: boolean;
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
): Promise<void> {
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
		return;
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

		const stats = await smartUpdate(config, sourceDir, process.cwd(), /* dryRun */ false, /* force */ false, {
			cleanup,
			assumeYes,
			allowedPaths,
			profile: installedProfile,
			packs: installedPacks,
		});

		console.log();
		console.log(pc.green(pc.bold("Upgrade complete!")));
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
			console.log(
				pc.yellow(`\n  ${stats.orphansSkipped.length} orphan file(s) detected but not deleted (use --yes to confirm).`),
			);
		}

		if (stats.userModified.length > 0) {
			console.log(
				pc.yellow(`\n  ${stats.userModified.length} user-modified file(s) preserved (use --force to overwrite).`),
			);
		}

		// Propagate the upgrade to any installed downstream provider toolkits.
		await reMigrateInstalledProviders(process.cwd());
	} finally {
		cleanupDownload(sourceDir);
	}
}

export async function upgrade(args: UpgradeArgs): Promise<void> {
	// Codex-only project (`init --target codex`): no `.claude/` to update — refresh the
	// authored Codex bundle instead. (Skip for --check/--list, which are version queries.)
	const cwd = process.cwd();
	if (!args.check && !args.list && !existsSync(join(cwd, ".claude")) && existsSync(join(cwd, ".codex"))) {
		upgradeCodexToolkit(cwd);
		return;
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
			return;
		}

		if (args.check) {
			await checkVersion(localVersion, useBeta);
			return;
		}

		await performUpgrade(
			localVersion,
			useBeta,
			/* cleanup */ args.noCleanup !== true,
			/* assumeYes */ args.yes === true,
		);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(pc.red(`upgrade failed: ${msg}`));
		process.exit(1);
	}
}
