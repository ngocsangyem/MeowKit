import fs from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
	fetchReleases,
	downloadRelease,
	cleanupDownload,
	smartUpdate,
	validate,
	hasPackManifest,
	loadPackManifest,
	resolveProfile,
	flattenProfile,
	availableProfiles,
} from "../core/index.js";
import type { ReleaseInfo, UserConfig } from "../core/index.js";
import { promptAndInstallSystemDeps } from "./setup.js";
import { getRequirementsSource, formatPackageList } from "../core/skills-dependencies.js";
import { ensureVenv, installPipPackages } from "../core/dependency-installer.js";
import { runMigrate, MewkitMigrateError } from "../migrate/migrate-orchestrator.js";
import type { MigrateOptions, ProviderType } from "../migrate/types.js";
import { providers } from "../migrate/provider-registry.js";
import { resolveCodexModuleDir } from "../migrate/modules/codex-authored-bundle.js";
import { packSelectionBudgetWarning, type PackSelection } from "../migrate/modules/codex-skill-packs.js";
import { reconcileApplyCodexBundle } from "../migrate/modules/codex-reconcile-apply.js";
import {
	CODEX_MIN_SUPPORTED_VERSION,
	detectCodexVersion,
	isCodexVersionSupported,
} from "../migrate/providers/codex/capabilities.js";
import { resolveCursorModuleDir } from "../migrate/modules/cursor-authored-bundle.js";
import { reconcileApplyCursorBundle } from "../migrate/modules/cursor-reconcile-apply.js";
import {
	CURSOR_MIN_SUPPORTED_VERSION,
	detectCursorVersion,
	isCursorVersionSupported,
} from "../migrate/providers/cursor/capabilities.js";
import { loadMcpProfileCatalog, type McpProfileSelection } from "../migrate/modules/cursor-mcp-profile-catalog.js";
import { applyMcpProfiles, isCloudExposedProject } from "../migrate/modules/cursor-mcp-profiles.js";

export interface InitArgs {
	dryRun?: boolean;
	force?: boolean;
	beta?: boolean;
	/** When true, run interactive provider multiselect after init unpacks. */
	migrate?: boolean;
	/**
	 * Target provider toolkit to create. `codex` and `cursor` each copy their own
	 * authored bundle directly (a provider-only project, no `.claude/`). Any other
	 * supported provider unpacks `.claude/` then exports to it via the legacy
	 * converter. Omitted = the default Claude Code kit (`.claude/`). Replaces the
	 * old `--migrate-to`.
	 */
	target?: string;
	/** When true, scope the post-init migration globally (~/.cursor/, etc.) instead of per-project. */
	migrateGlobal?: boolean;
	/**
	 * Install profile (core/developer/product/atlassian/security/research/full).
	 * Omitted = full (today's behavior). Works in update mode too, to TRIM an
	 * existing install down to the selected profile.
	 */
	profile?: string;
	/**
	 * Skill-pack selection for the Codex and Cursor bundles. Comma-separated pack names
	 * (e.g. `core,integrations`) or `all`. Omitted = the FULL catalog; pass an explicit
	 * list to narrow the install. Named `--skill-packs` to avoid the existing boolean
	 * `--packs` validate flag.
	 */
	skillPacks?: string;
	/**
	 * Cursor MCP profile selection (only meaningful with a Cursor target). Comma-separated
	 * profile names (e.g. `github-context`) or `all`. Omitted = an interactive multiselect
	 * prompt (default: none selected) when not a dry-run, or no MCP config at all in a
	 * dry-run. Fresh install NEVER writes `.cursor/mcp.json` on its own — this flag/prompt
	 * is the only path to MCP authority.
	 */
	mcpProfiles?: string;
	/**
	 * Second, explicit opt-in required to apply an MCP profile selection to a project that
	 * may run as a Cursor Cloud Agent (has a git remote configured) — `beforeMCPExecution`
	 * has no local enforcement equivalent in Cloud Agents. Omitted ⇒ an interactive confirm
	 * prompt covers the same acknowledgement when a profile was selected and the project is
	 * cloud-exposed.
	 */
	allowCloudMcp?: boolean;
}

/** Parse the `--skill-packs` value into a PackSelection (full catalog when absent). */
function parseSkillPacks(raw?: string): PackSelection {
	// Omitted flag installs the FULL catalog. The bundle ships every skill, so a default
	// that silently installed only the `core` pack left users comparing their install
	// against the source tree and concluding skills were missing. An explicit
	// `--skill-packs core` (or any named list) still narrows the install.
	if (raw === undefined) return "all";
	const v = raw.trim();
	if (v === "") return [];
	if (v.toLowerCase() === "all") return "all";
	return v
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Parse the `--mcp-profiles` value into a `McpProfileSelection`. Unlike skill packs, an
 *  OMITTED flag never falls back to a catalog default — MCP is deny-by-default, so an absent
 *  flag is resolved by `resolveMcpSelection` (interactive prompt, still defaulting to none)
 *  rather than by this parser. */
function parseMcpProfiles(raw: string): McpProfileSelection {
	const v = raw.trim();
	if (v === "") return [];
	if (v.toLowerCase() === "all") return "all";
	return v
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Resolve the MCP profile selection for one Cursor install. An explicit `--mcp-profiles`
 *  flag (including an empty string, meaning "none") is authoritative and skips the prompt
 *  entirely. Otherwise, in a KNOWN-interactive session (the fresh multi-provider picker path,
 *  which already ran its own prompt to get here) and outside a dry-run, offer an opt-in
 *  multiselect defaulting to nothing selected — deny-by-default survives the interactive path
 *  too. The explicit `--target cursor` entrypoint is used by scripts/CI as well as humans, so
 *  it NEVER prompts on its own (`interactive=false`) — an omitted flag there resolves to
 *  "none" silently rather than blocking on stdin. No catalog (pre-Phase-5 bundle) or zero
 *  shipped profiles ⇒ resolve to "none" without prompting either way. */
async function resolveMcpSelection(
	moduleDir: string,
	explicit: string | undefined,
	dryRun: boolean,
	interactive: boolean,
): Promise<McpProfileSelection> {
	if (explicit !== undefined) return parseMcpProfiles(explicit);
	if (dryRun || !interactive) return [];
	const catalog = loadMcpProfileCatalog(moduleDir);
	if (!catalog || Object.keys(catalog.profiles).length === 0) return [];
	const choice = await p.multiselect({
		message: "Select Cursor MCP profile(s) to enable (opt-in — default: none)",
		options: Object.entries(catalog.profiles).map(([name, profile]) => ({
			value: name,
			label: name,
			hint: profile.description || undefined,
		})),
		required: false,
		initialValues: [],
	});
	return p.isCancel(choice) ? [] : (choice as string[]);
}

/** Resolve the second cloud-gate opt-in. A project without a git remote is never treated as
 *  cloud-exposed, so the gate is a no-op there regardless of the flag. An explicit `true`
 *  flag always satisfies the gate. Otherwise, a cloud-exposed project with a non-empty
 *  selection needs a decision: in a known-interactive session it gets one confirm prompt;
 *  outside one (the explicit `--target cursor` entrypoint, scripts/CI) there is no one to ask,
 *  so it fails closed (blocked) rather than hanging on stdin or silently applying MCP to a
 *  project with no local enforcement equivalent. */
async function resolveAllowCloudMcp(
	targetDir: string,
	explicit: boolean | undefined,
	selection: McpProfileSelection,
	dryRun: boolean,
	interactive: boolean,
): Promise<boolean> {
	if (explicit) return true;
	const hasSelection = selection === "all" || selection.length > 0;
	if (!hasSelection || dryRun || !isCloudExposedProject(targetDir)) return true;
	if (!interactive) return false;
	const confirm = await p.confirm({
		message:
			"This project has a git remote and may run as a Cursor Cloud Agent, where MCP tool calls have NO local " +
			"hook enforcement (beforeMCPExecution is not supported in Cloud Agents). Apply the selected MCP profile(s) anyway?",
		initialValue: false,
	});
	return !p.isCancel(confirm) && confirm === true;
}

/** Resolve + apply the Cursor MCP profile selection for one install, after the authored
 *  bundle itself has already been written. Never runs during a dry-run (no prompt, no write).
 *  `interactive` MUST be true only for a call site that is already guaranteed to be running in
 *  an interactive session (today: the fresh multi-provider picker path) — the explicit
 *  `--target cursor` entrypoint always passes `false` since it is also used non-interactively
 *  by scripts/CI/tests. Non-fatal: a lint failure or an unknown profile name is reported and
 *  skipped rather than aborting the whole install — MCP is an optional, additive surface. */
async function applySelectedMcpProfiles(
	targetDir: string,
	moduleDir: string,
	mcpProfilesArg: string | undefined,
	allowCloudMcpArg: boolean | undefined,
	dryRun: boolean,
	interactive: boolean,
): Promise<void> {
	if (dryRun) return;
	const selection = await resolveMcpSelection(moduleDir, mcpProfilesArg, dryRun, interactive);
	if (selection !== "all" && selection.length === 0) return;

	const allowCloudMcp = await resolveAllowCloudMcp(targetDir, allowCloudMcpArg, selection, dryRun, interactive);
	try {
		const result = await applyMcpProfiles(moduleDir, targetDir, selection, { allowCloudMcp, projectRoot: targetDir });
		if (result.blockedByCloudGate) {
			p.log.warn(
				"MCP profile selection BLOCKED: this project may run as a Cursor Cloud Agent (a git remote is configured) " +
					"and beforeMCPExecution has no cloud enforcement equivalent. Re-run with --allow-cloud-mcp to accept the residual risk.",
			);
			return;
		}
		if (!result.applied) return;
		const conflictNote =
			result.conflictServers.length > 0
				? `, ${result.conflictServers.length} conflict(s) left untouched (your existing server config wins): ${result.conflictServers.join(", ")}`
				: "";
		p.log.success(
			`Cursor MCP profile(s) merged into .cursor/mcp.json: ${result.addedServers.length} server(s) added${conflictNote}.`,
		);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		p.log.warn(`MCP profile selection skipped: ${msg}`);
	}
}

/** Profile picker options (stable names; resolution validates against the release manifest). */
const PROFILE_OPTIONS = [
	{ value: "full", label: "full", hint: "everything (default — same as today)" },
	{ value: "core", label: "core", hint: "recommended — lifecycle essentials, smallest" },
	{ value: "developer", label: "developer", hint: "core + testing + git + docs" },
	{ value: "product", label: "product", hint: "developer + product/autobuild" },
	{ value: "atlassian", label: "atlassian", hint: "developer + Jira/Confluence" },
	{ value: "security", label: "security", hint: "core + security audit" },
	{ value: "research", label: "research", hint: "core + research/brainstorming" },
];

interface ResolvedInstall {
	allowedPaths?: Set<string>;
	profile: string;
	packs?: string[];
}

/**
 * Resolve the install allow-set from a profile name against the extracted release.
 * `full`/undefined ⇒ no allow-set (byte-identical full install). A release with no
 * pack-manifest.json (pre-Phase-3) cannot honor a partial profile — warn + full.
 */
function resolveInstall(sourceDir: string, profileName: string | undefined): ResolvedInstall {
	if (!profileName || profileName === "full") return { profile: "full" };
	const srcClaude = join(sourceDir, ".claude");
	if (!hasPackManifest(srcClaude)) {
		p.log.warn(`This release has no pack-manifest.json — installing the full profile instead of '${profileName}'.`);
		return { profile: "full" };
	}
	const manifest = loadPackManifest(srcClaude);
	if (!availableProfiles(manifest).includes(profileName)) {
		p.cancel(`Unknown profile "${profileName}". Available: ${availableProfiles(manifest).join(", ")}`);
		process.exit(1);
	}
	return {
		allowedPaths: resolveProfile(srcClaude, manifest, profileName),
		profile: profileName,
		packs: flattenProfile(manifest, profileName).packs,
	};
}

/** Detect if this is a fresh install or an update */
function detectMode(targetDir: string): "new" | "update" {
	return fs.existsSync(join(targetDir, ".claude")) ? "update" : "new";
}

/** Build @clack/prompts options from release list (top 4 + manual entry) */
function buildReleaseOptions(releases: ReleaseInfo[], beta: boolean) {
	const latestStable = releases.find((r) => !r.isBeta);
	const pool = beta ? releases : releases.filter((r) => !r.isBeta);
	const options = pool.slice(0, 4).map((r) => ({
		value: r.tag,
		label: `${r.version}${r.isBeta ? pc.yellow(" (beta)") : ""}${r.tag === latestStable?.tag ? pc.green(" (latest)") : ""}`,
		hint: r.publishedAt.split("T")[0],
	}));
	options.push({ value: "__manual__", label: pc.dim("Enter version manually..."), hint: "" });
	return options;
}

/** Cancel-safe wrapper: exits on Ctrl+C */
function cancelCheck(value: unknown): void {
	if (p.isCancel(value)) {
		p.cancel("Installation cancelled.");
		process.exit(0);
	}
}

/** Prompt the user for project description, skill deps, and Gemini key */
async function promptNewInstall(): Promise<UserConfig & { installDeps: boolean; profile: string }> {
	// Profile picker first — default `full` preserves current UX; `core` recommended.
	const profileChoice = await p.select({
		message: "Select an install profile",
		options: PROFILE_OPTIONS,
		initialValue: "full",
	});
	cancelCheck(profileChoice);
	const profile = typeof profileChoice === "string" ? profileChoice : "full";

	const description = await p.text({
		message: "Describe your project (optional)",
		placeholder: "Press Enter to skip",
		validate() {
			return undefined;
		},
	});
	cancelCheck(description);

	// Skills dependencies prompt (before Gemini key — more common question first)
	const installDeps = await p.confirm({
		message: "Install Python skill dependencies? (into .claude/skills/.venv)",
		initialValue: false,
	});
	const shouldInstallDeps = p.isCancel(installDeps) ? false : installDeps;

	// --- API Keys ---
	const addGeminiKey = await p.confirm({
		message: "Add Gemini API key? (recommended — analysis, image gen, video gen)",
		initialValue: false,
	});
	cancelCheck(addGeminiKey);

	let geminiApiKey: string | null = null;
	if (addGeminiKey) {
		const keyInput = await p.password({
			message: "Enter your Gemini API key (get one at aistudio.google.com/apikey)",
			validate(value: string) {
				if (!value || value.trim().length === 0) return "API key is required";
				if (value.trim().length < 10) return "Key too short — check aistudio.google.com/apikey";
				return undefined;
			},
		});
		cancelCheck(keyInput);
		geminiApiKey = typeof keyInput === "string" ? keyInput.trim() : null;
	}

	// External provider keys (optional fallback)
	const externalProviderKeys: Record<string, string> = {};

	const EXTERNAL_PROVIDERS = [
		{
			id: "minimax",
			name: "MiniMax",
			description: "TTS (332 voices), music, Hailuo video, image fallback",
			envVar: "MEOWKIT_MINIMAX_API_KEY",
			setupUrl: "platform.minimax.io",
			extraEnvVars: {} as Record<string, string>,
		},
		{
			id: "openrouter",
			name: "OpenRouter",
			description: "Image gen fallback (Flux models)",
			envVar: "MEOWKIT_OPENROUTER_API_KEY",
			setupUrl: "openrouter.ai/keys",
			extraEnvVars: { MEOWKIT_OPENROUTER_FALLBACK_ENABLED: "true" },
		},
	];

	const addFallback = await p.confirm({
		message: "Add fallback API keys for external providers? (optional)",
		initialValue: false,
	});

	if (addFallback && !p.isCancel(addFallback)) {
		const choices = await p.multiselect({
			message: "Select external providers:",
			options: EXTERNAL_PROVIDERS.map((prov) => ({
				value: prov.id,
				label: prov.name,
				hint: prov.description,
			})),
			required: false,
		});

		if (!p.isCancel(choices)) {
			for (const providerId of choices as string[]) {
				const provider = EXTERNAL_PROVIDERS.find((pr) => pr.id === providerId);
				if (!provider) continue;
				const keyInput = await p.password({
					message: `Enter your ${provider.name} API key (get one at ${provider.setupUrl})`,
					validate(value: string) {
						if (!value || value.trim().length === 0) return "API key is required";
						return undefined;
					},
				});
				if (p.isCancel(keyInput)) continue;
				externalProviderKeys[provider.envVar] = String(keyInput).trim();
				for (const [k, v] of Object.entries(provider.extraEnvVars)) {
					externalProviderKeys[k] = v;
				}
			}
		}
	}

	return {
		description: typeof description === "string" ? description.trim() : "",
		enableCostTracking: true,
		enableMemory: true,
		geminiApiKey,
		externalProviderKeys: Object.keys(externalProviderKeys).length > 0 ? externalProviderKeys : undefined,
		installDeps: shouldInstallDeps,
		profile,
	};
}

/** Print install/update summary */
function printSummary(
	stats: { updated: number; added: number; skipped: number; userModified: string[] },
	dryRun: boolean,
): void {
	console.log(`\n${pc.bold("Summary:")}`);
	if (stats.added > 0) console.log(`  ${pc.green("added")}     ${stats.added}`);
	if (stats.updated > 0) console.log(`  ${pc.cyan("updated")}   ${stats.updated}`);
	if (stats.skipped > 0) console.log(`  ${pc.dim("skipped")}   ${stats.skipped}`);
	if (stats.userModified.length > 0) {
		console.log(pc.yellow(`\n  ${stats.userModified.length} user-modified file(s) preserved:`));
		stats.userModified.slice(0, 8).forEach((f) => console.log(`    ${pc.dim(f)}`));
		if (stats.userModified.length > 8) console.log(`    ${pc.dim(`...and ${stats.userModified.length - 8} more`)}`);
	}
	if (!dryRun) {
		console.log(`\n${pc.bold("Next steps:")}`);
		console.log(`  ${pc.dim("1.")} Run ${pc.bold("npx mewkit setup")} for guided configuration`);
		console.log(`  ${pc.dim("2.")} Run ${pc.bold("npx mewkit doctor")} to verify your environment`);
	}
}

/**
 * `mewkit init --target codex` — create a Codex-native toolkit by copying the
 * authored Codex bundle shipped with the package into the project (AGENTS.md,
 * `.codex/{config.toml,agents,hooks.json,hooks}`, `.agents/skills/`). No `.claude/`,
 * no release download, no conversion — the bundle IS the source of truth for Codex.
 */
async function initCodexTarget(
	targetDir: string,
	dryRun: boolean,
	force: boolean,
	packs: PackSelection = [],
): Promise<void> {
	p.intro(pc.bgCyan(pc.black(" meowkit init --target codex ")));
	const moduleDir = resolveCodexModuleDir();
	if (!fs.existsSync(join(moduleDir, "manifest.json"))) {
		p.cancel("Codex bundle not found in this install — reinstall the `mewkit` package (`npx mewkit@latest ...`).");
		process.exit(1);
	}
	// No fail-closed guard: the reconciler preserves user edits (or surfaces a conflict)
	// instead of clobbering an existing layout, and makes a re-run idempotent. `packs`
	// selects which skill packs install (default `core`); the whole `.codex/` surface
	// always installs.
	if (dryRun) {
		const plan = await reconcileApplyCodexBundle(moduleDir, targetDir, {
			force,
			dryRun: true,
			projectRoot: targetDir,
			packs,
		});
		const toWrite = plan.entries.filter((e) => e.action === "install" || e.action === "update").length;
		const conflictNote = plan.conflicts.length > 0 ? `, ${plan.conflicts.length} conflict(s)` : "";
		p.log.info(
			`Dry-run: ${toWrite} artifact(s) would be written${conflictNote} — AGENTS.md, .codex/, .agents/skills/.`,
		);
		p.outro(pc.green("Dry-run complete — no files written."));
		return;
	}
	const result = await reconcileApplyCodexBundle(moduleDir, targetDir, { force, projectRoot: targetDir, packs });
	if (result.conflicts.length > 0) {
		p.log.warn(
			`${result.conflicts.length} existing file(s) differ from the bundle and were left untouched (re-run with --force to overwrite):`,
		);
		for (const c of result.conflicts) p.log.message(pc.dim(`  ${c.targetPath}`));
	}
	p.log.success(
		`Codex toolkit ready (${result.writes} written): AGENTS.md, .codex/{config.toml,agents,hooks.json,hooks}, .agents/skills/.`,
	);
	const budgetWarn = packSelectionBudgetWarning(moduleDir, packs);
	if (budgetWarn) p.log.warn(budgetWarn);
	p.log.info(
		"Skill packs are additive: re-run with more `--skill-packs` to add; removing an installed pack is manual (delete its .agents/skills/<name> dirs).",
	);
	await warnBelowMinCodex();
	hintLegacyMemoryForCodex(targetDir);
	p.outro(pc.green("Codex toolkit installed!"));
}

/**
 * Warn-and-degrade version gate for the Codex install. The authored bundle is inert config
 * until Codex runs it, and its gated surfaces (deny-capable hooks, `.codex/rules`) degrade
 * gracefully on an older/untrusted Codex — so a below-minimum version never hard-fails the
 * install. It only warns, so the user knows those surfaces may be ignored and that the
 * MeowKit CLI gate stays authoritative. No warning when the version can't be detected
 * (codex absent / compat env override) — do not nag on an unknown.
 */
async function warnBelowMinCodex(): Promise<void> {
	const version = await detectCodexVersion();
	if (version && !isCodexVersionSupported(version)) {
		p.log.warn(
			`Codex ${version} < ${CODEX_MIN_SUPPORTED_VERSION}: deny-capable hooks (gate-enforcement, privacy-block) and .codex/rules may be ignored by this version. Install proceeds; the MeowKit CLI gate stays authoritative. Upgrade Codex to enforce them.`,
		);
	}
}

/**
 * Codex install copies the authored bundle but does NOT run the legacy `.claude/memory/`
 * → `.meowkit/` import (that lives in the `mewkit migrate` flow). If a repo carries legacy
 * memory, surface a hint instead of silently leaving it behind — the user runs the import
 * explicitly so it stays an opt-in, conflict-aware transaction.
 */
function hintLegacyMemoryForCodex(targetDir: string): void {
	if (fs.existsSync(join(targetDir, ".claude", "memory"))) {
		p.log.info(
			"Legacy .claude/memory/ detected — import it into .meowkit/ with: mewkit migrate codex (loss-aware, conflict-safe; not run automatically).",
		);
	}
}

/**
 * `mewkit init --target cursor` — create a Cursor-native toolkit by reconciling the
 * authored Cursor bundle shipped with the package into the project (AGENTS.md,
 * `.meowkit/README.md`; more surfaces land as the bundle is authored). No `.claude/`,
 * no release download, no conversion — the bundle IS the source of truth for Cursor.
 * Mirrors `initCodexTarget` structurally; the two stay independent so a change to one
 * provider's install flow never silently ripples into the other.
 */
async function initCursorTarget(
	targetDir: string,
	dryRun: boolean,
	force: boolean,
	mcpProfiles?: string,
	allowCloudMcp?: boolean,
	packs: PackSelection = "all",
): Promise<void> {
	p.intro(pc.bgCyan(pc.black(" meowkit init --target cursor ")));
	const moduleDir = resolveCursorModuleDir();
	if (!fs.existsSync(join(moduleDir, "manifest.json"))) {
		p.cancel("Cursor bundle not found in this install — reinstall the `mewkit` package (`npx mewkit@latest ...`).");
		process.exit(1);
	}
	// No fail-closed guard: the reconciler preserves user edits (or surfaces a conflict)
	// instead of clobbering an existing layout, and makes a re-run idempotent.
	if (dryRun) {
		const plan = await reconcileApplyCursorBundle(moduleDir, targetDir, {
			force,
			dryRun: true,
			projectRoot: targetDir,
			packs,
		});
		const toWrite = plan.entries.filter((e) => e.action === "install" || e.action === "update").length;
		const conflictNote = plan.conflicts.length > 0 ? `, ${plan.conflicts.length} conflict(s)` : "";
		p.log.info(`Dry-run: ${toWrite} artifact(s) would be written${conflictNote} — AGENTS.md, .meowkit/README.md.`);
		p.log.info("Dry-run: MCP profiles are never applied or prompted for during a dry-run.");
		p.outro(pc.green("Dry-run complete — no files written."));
		return;
	}
	const result = await reconcileApplyCursorBundle(moduleDir, targetDir, { force, projectRoot: targetDir, packs });
	if (result.conflicts.length > 0) {
		p.log.warn(
			`${result.conflicts.length} existing file(s) differ from the bundle and were left untouched (re-run with --force to overwrite):`,
		);
		for (const c of result.conflicts) p.log.message(pc.dim(`  ${c.targetPath}`));
	}
	p.log.success(`Cursor toolkit ready (${result.writes} written): AGENTS.md, .meowkit/README.md.`);
	await warnBelowMinCursor();
	hintLegacyMemoryForCursor(targetDir);
	// `--target cursor` is used by scripts/CI as well as humans — never prompt on its own.
	await applySelectedMcpProfiles(targetDir, moduleDir, mcpProfiles, allowCloudMcp, dryRun, false);
	p.outro(pc.green("Cursor toolkit installed!"));
}

/**
 * Warn-and-degrade version gate for the Cursor install. The authored bundle is inert
 * content this phase (no version-gated surface yet), so a below-minimum IDE never
 * hard-fails the install — it only warns, so the user knows to upgrade before richer
 * surfaces (hooks, native agents) land in later phases. No warning when the version
 * can't be detected (the `cursor` CLI shim usually isn't on PATH) — do not nag on an
 * unknown, and the CLI's calendar versioning is never compared against this floor.
 */
async function warnBelowMinCursor(): Promise<void> {
	const version = await detectCursorVersion();
	if (version && !isCursorVersionSupported(version)) {
		p.log.warn(
			`Cursor ${version} < ${CURSOR_MIN_SUPPORTED_VERSION}: some authored surfaces may be ignored by this version. Install proceeds; the MeowKit CLI gate stays authoritative. Upgrade Cursor to enforce them.`,
		);
	}
}

/**
 * Cursor install copies the authored bundle but does NOT run the legacy `.claude/memory/`
 * → `.meowkit/` import (that lives in the `mewkit migrate` flow). If a repo carries legacy
 * memory, surface a hint instead of silently leaving it behind. Mirrors
 * `hintLegacyMemoryForCodex`.
 */
function hintLegacyMemoryForCursor(targetDir: string): void {
	if (fs.existsSync(join(targetDir, ".claude", "memory"))) {
		p.log.info(
			"Legacy .claude/memory/ detected — import it into .meowkit/ with: mewkit migrate cursor (loss-aware, conflict-safe; not run automatically).",
		);
	}
}

/**
 * Fresh-install provider picker. Multi-select with Claude Code checked by default.
 * Each choice maps to a distinct provisioning path handled by the init orchestrator:
 * Claude Code → `.claude/`, Codex → authored bundle, Cursor → `.claude/` + export.
 * Shown only when no `--target` is passed and this is a new install.
 */
async function promptProviders(): Promise<ProviderType[]> {
	const choice = await p.multiselect({
		message: "Select the toolkits to set up",
		options: [
			{
				value: "claude-code" as const,
				label: providers["claude-code"].displayName,
				hint: "installs .claude/ (default)",
			},
			{ value: "codex" as const, label: providers.codex.displayName, hint: "copies the authored Codex bundle" },
			{ value: "cursor" as const, label: providers.cursor.displayName, hint: "copies the authored Cursor bundle" },
		],
		initialValues: ["claude-code"],
		required: true,
	});
	cancelCheck(choice);
	return choice as ProviderType[];
}

/**
 * Add the Codex toolkit alongside a multi-provider install by copying the authored
 * bundle. Non-fatal (warn + skip) so a Codex hiccup never aborts the whole install —
 * unlike `initCodexTarget`, which fails closed because Codex is the ONLY target there.
 */
async function addCodexBundle(targetDir: string, force: boolean, packs: PackSelection = []): Promise<void> {
	const moduleDir = resolveCodexModuleDir();
	if (!fs.existsSync(join(moduleDir, "manifest.json"))) {
		p.log.warn("Codex bundle not found in this install — skipping the Codex toolkit.");
		return;
	}
	const result = await reconcileApplyCodexBundle(moduleDir, targetDir, { force, projectRoot: targetDir, packs });
	if (result.conflicts.length > 0) {
		p.log.warn(`${result.conflicts.length} existing Codex file(s) left untouched (re-run with --force to overwrite).`);
	}
	p.log.success(`Codex toolkit created (${result.writes} written): AGENTS.md, .codex/, .agents/skills/.`);
	const budgetWarn = packSelectionBudgetWarning(moduleDir, packs);
	if (budgetWarn) p.log.warn(budgetWarn);
	await warnBelowMinCodex();
	hintLegacyMemoryForCodex(targetDir);
}

/**
 * Add the Cursor toolkit alongside a multi-provider install by reconciling the authored
 * bundle. Non-fatal (warn + skip) so a Cursor hiccup never aborts the whole install —
 * unlike `initCursorTarget`, which fails closed because Cursor is the ONLY target there.
 */
async function addCursorBundle(
	targetDir: string,
	force: boolean,
	mcpProfiles?: string,
	allowCloudMcp?: boolean,
	packs: PackSelection = "all",
): Promise<void> {
	const moduleDir = resolveCursorModuleDir();
	if (!fs.existsSync(join(moduleDir, "manifest.json"))) {
		p.log.warn("Cursor bundle not found in this install — skipping the Cursor toolkit.");
		return;
	}
	const result = await reconcileApplyCursorBundle(moduleDir, targetDir, { force, projectRoot: targetDir, packs });
	if (result.conflicts.length > 0) {
		p.log.warn(
			`${result.conflicts.length} existing Cursor file(s) left untouched (re-run with --force to overwrite).`,
		);
	}
	p.log.success(`Cursor toolkit created (${result.writes} written): AGENTS.md, .meowkit/README.md.`);
	await warnBelowMinCursor();
	hintLegacyMemoryForCursor(targetDir);
	// Reached only via the fresh multi-provider picker, which already ran an interactive
	// prompt to get here — safe to prompt again for the MCP profile selection.
	await applySelectedMcpProfiles(targetDir, moduleDir, mcpProfiles, allowCloudMcp, false, true);
}

export async function init(args: InitArgs): Promise<void> {
	const targetDir = process.cwd();

	// `--target codex` / `--target cursor` are distinct, offline paths: reconcile the
	// authored bundle, done. No `.claude/`, no release download, no legacy converter.
	if (args.target === "codex") {
		return initCodexTarget(targetDir, args.dryRun ?? false, args.force ?? false, parseSkillPacks(args.skillPacks));
	}
	if (args.target === "cursor") {
		return initCursorTarget(
			targetDir,
			args.dryRun ?? false,
			args.force ?? false,
			args.mcpProfiles,
			args.allowCloudMcp,
			parseSkillPacks(args.skillPacks),
		);
	}

	const mode = detectMode(targetDir);
	const dryRun = args.dryRun ?? false;
	const force = args.force ?? false;

	p.intro(pc.bgCyan(pc.black(" meowkit init ")));

	if (dryRun) p.log.warn("Dry-run mode — no files will be written.");
	if (mode === "update") p.log.info("Existing .claude/ detected — running in update mode.");

	// The provider multiselect is the default ONLY for a bare fresh `init` — any explicit
	// provider intent (`--target`, `--migrate`) bypasses it and keeps its own flow. Update
	// mode keeps today's behavior (refresh .claude/); use `mewkit upgrade` to propagate.
	const picked = !args.target && !args.migrate && mode === "new" ? await promptProviders() : null;
	// Codex and Cursor are both additive, offline authored-bundle installs — picking either
	// (without also picking claude-code) never forces the base kit. No picker (update mode,
	// `--target`, or `--migrate`) ⇒ base install as today.
	const installClaudeKit = picked ? picked.includes("claude-code") : true;

	if (installClaudeKit) {
		await runClaudeKitInstall(args, targetDir, mode, dryRun, force);
	}

	// Codex and Cursor are both additive, offline authored-bundle copies when picked — neither
	// depends on the base kit or the legacy converter.
	if (picked?.includes("codex")) {
		if (dryRun) p.log.info("Dry-run: would copy the authored Codex bundle (AGENTS.md, .codex/, .agents/skills/).");
		else await addCodexBundle(targetDir, force, parseSkillPacks(args.skillPacks));
	}
	if (picked?.includes("cursor")) {
		if (dryRun) p.log.info("Dry-run: would copy the authored Cursor bundle (AGENTS.md, .meowkit/README.md).");
		else await addCursorBundle(targetDir, force, args.mcpProfiles, args.allowCloudMcp, parseSkillPacks(args.skillPacks));
	}

	// Legacy explicit paths: `--target <provider>` / `--migrate` (never active with the picker).
	if (!dryRun && !picked && (args.migrate || args.target)) {
		await runPostInitMigrate(args, targetDir);
	}

	p.outro(pc.green(mode === "new" ? "MeowKit installed!" : "MeowKit updated!"));
}

/**
 * Base Claude Code kit install: fetch releases, pick version, prompt config,
 * download, apply via smart update, validate, and install optional dependencies.
 * Owns the downloaded-source lifecycle (cleaned up in its finally). Post-install
 * provider export and the final outro are owned by the `init` orchestrator.
 */
async function runClaudeKitInstall(
	args: InitArgs,
	targetDir: string,
	mode: "new" | "update",
	dryRun: boolean,
	force: boolean,
): Promise<void> {
	// Step 1: Fetch releases
	const releaseSpinner = p.spinner();
	releaseSpinner.start("Fetching available releases...");

	let releases: ReleaseInfo[];
	try {
		releases = await fetchReleases();
	} catch (err: unknown) {
		releaseSpinner.stop("Failed to fetch releases");
		const msg = err instanceof Error ? err.message : String(err);
		p.cancel(`Cannot fetch releases from GitHub: ${msg}`);
		process.exit(1);
	}

	if (releases.length === 0) {
		releaseSpinner.stop("No releases found");
		p.cancel("No releases available on GitHub.");
		process.exit(1);
	}

	releaseSpinner.stop(`Found ${releases.length} release(s)`);

	// Step 2: Version picker
	const options = buildReleaseOptions(releases, args.beta ?? false);
	const latestStable = releases.find((r) => !r.isBeta);

	const selected = await p.select({
		message: "Select MeowKit version to install",
		options,
		initialValue: latestStable?.tag ?? releases[0].tag,
	});

	if (p.isCancel(selected)) {
		p.cancel("Installation cancelled.");
		process.exit(0);
	}

	let selectedTag = selected as string;

	// Handle manual version entry
	if (selectedTag === "__manual__") {
		const manualVersion = await p.text({
			message: "Enter version tag (e.g. v1.4.0)",
			placeholder: "v1.4.0",
			validate(value: string) {
				if (!value || !value.trim()) return "Version is required";
				return undefined;
			},
		});
		cancelCheck(manualVersion);
		selectedTag = (manualVersion as string).trim();
		// Ensure tag has 'v' prefix for consistency
		if (!selectedTag.startsWith("v")) selectedTag = `v${selectedTag}`;
	}

	const release = releases.find((r) => r.tag === selectedTag);
	if (!release) {
		p.cancel(
			`Version ${selectedTag} not found. Available: ${releases
				.slice(0, 5)
				.map((r) => r.tag)
				.join(", ")}`,
		);
		process.exit(1);
	}

	// Step 3: Config prompts (new installs only)
	let config: UserConfig & { installDeps: boolean; profile: string };
	if (mode === "new") {
		config = await promptNewInstall();
	} else {
		config = {
			description: "",
			enableCostTracking: true,
			enableMemory: true,
			geminiApiKey: null,
			installDeps: false,
			profile: "full",
		};
	}

	// `--profile` flag overrides the picker and is the only profile source in
	// update mode (where it TRIMS an existing install down to the selected set).
	const profileName = args.profile ?? config.profile;

	// Step 4: Download release
	const downloadSpinner = p.spinner();
	downloadSpinner.start(`Downloading v${release.version}...`);

	let sourceDir: string;
	try {
		sourceDir = await downloadRelease(release);
	} catch (err: unknown) {
		downloadSpinner.stop("Download failed");
		const msg = err instanceof Error ? err.message : String(err);
		p.cancel(`Failed to download release: ${msg}`);
		process.exit(1);
	}

	downloadSpinner.stop(`Downloaded v${release.version}`);

	try {
		// Step 5: Apply via smart update. Resolve the profile allow-set against the
		// extracted release (full ⇒ undefined allow-set = byte-identical install).
		const install = resolveInstall(sourceDir, profileName);
		const updateSpinner = p.spinner();
		updateSpinner.start("Applying files...");
		const stats = await smartUpdate(config, sourceDir, targetDir, dryRun, force, {
			allowedPaths: install.allowedPaths,
			profile: install.profile,
			packs: install.packs,
			// A profile install owns the full→profile downgrade trim; full does not.
			trimToProfile: install.allowedPaths !== undefined,
			// Spinner overwrites inline `[y/N]` prompts → hand the prompt back to
			// init so we can pause the spinner, ask via clack, then resume.
			confirmOrphans: async (orphans) => {
				updateSpinner.stop("Orphan files detected");
				p.log.warn(`Found ${orphans.length} orphan file(s) — files on disk no longer in release:`);
				for (const o of orphans) p.log.message(`  - ${pc.dim(o)}`);
				const answer = await p.confirm({
					message: `Delete ${orphans.length} orphan file(s)?`,
					initialValue: false,
				});
				const ok = !p.isCancel(answer) && answer === true;
				updateSpinner.start("Applying files...");
				return ok;
			},
		});
		updateSpinner.stop(`Applied: ${stats.added} added, ${stats.updated} updated, ${stats.skipped} skipped`);

		// Security confirmation for API keys
		const hasAnyKey = config.geminiApiKey || config.externalProviderKeys;
		if (hasAnyKey && !dryRun) {
			p.log.success("API keys saved to .claude/.env (local only — never committed to git)");
		}

		// Step 6: Validate (skip dry-run)
		if (!dryRun) {
			const validateSpinner = p.spinner();
			validateSpinner.start("Validating installation...");
			const result = validate(targetDir);
			if (result.valid) {
				validateSpinner.stop("Validation passed");
			} else {
				validateSpinner.stop(`Validation: ${result.issues.length} issue(s) — run \`mewkit validate\` for details`);
			}
		}

		// Step 7: System dependencies (optional, skipped on dry-run)
		// Flat list from registry — no per-skill ownership shown (locked decision #4).
		// Each dep rendered as: [ ] Name (~NMB) — all unchecked by default.
		if (!dryRun) {
			console.log(`\n${pc.bold("? Phase 2: System dependencies")} ${pc.dim("(optional)")}`);
			await promptAndInstallSystemDeps(targetDir);
		}

		// Step 8: Skills dependencies (if user opted in during config)
		if (!dryRun && config.installDeps) {
			console.log(`\n${pc.bold("? Phase 3: Skills dependencies")}`);
			const { packages, source } = getRequirementsSource(targetDir);
			console.log(pc.dim(`\n  Packages (from ${source}):\n`));
			console.log(pc.dim(formatPackageList(packages)));
			console.log();

			try {
				const { created } = ensureVenv(targetDir);
				if (created) console.log(`  ${pc.green("✓")} Python venv created`);

				const results = await installPipPackages(targetDir, packages);
				const failed = results.filter((r) => !r.success);
				if (failed.length === 0) {
					console.log(`\n  ${pc.green("✓")} All ${results.length} packages installed`);
				} else {
					console.log(`\n  ${pc.yellow("!")} ${results.length - failed.length} installed, ${failed.length} failed`);
					console.log(pc.dim(`  Re-run: npx mewkit setup --only=deps`));
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.log(`  ${pc.red("✗")} ${msg}`);
				console.log(pc.dim(`  Install later: npx mewkit setup --only=deps`));
			}
		}

		// Step 9: Summary
		printSummary(stats, dryRun);
	} finally {
		cleanupDownload(sourceDir);
	}
}

/**
 * Run a migration after init unpacks .claude/. Failure here does NOT roll back the
 * unpack — we surface the error and continue. User can re-run `mewkit migrate` later.
 */
async function runPostInitMigrate(args: InitArgs, projectDir: string): Promise<void> {
	console.log(`\n${pc.bold("? Phase 4: Export to external tools")}`);

	const migrateOptions: MigrateOptions = {
		global: args.migrateGlobal ?? false,
		yes: !!args.target, // explicit --target → non-interactive; bare --migrate stays interactive
		source: join(projectDir, ".claude"),
		force: true,
	};

	if (args.target) {
		const trimmed = args.target.trim();
		if (trimmed === "all") migrateOptions.all = true;
		else migrateOptions.tools = [trimmed];
	}

	try {
		const exitCode = await runMigrate(migrateOptions, {
			bundledKitDir: join(projectDir, ".claude"),
			argv: [],
		});
		if (exitCode !== 0) {
			console.log(pc.yellow(`[!] Migration exited with code ${exitCode} — re-run "mewkit migrate" to retry.`));
		}
	} catch (err) {
		if (err instanceof MewkitMigrateError) {
			console.log(pc.red(`[!] Migration failed: ${err.message}`));
			console.log(pc.dim(`    Re-run: mewkit migrate <tool>`));
		} else {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(pc.red(`[!] Migration error: ${msg}`));
		}
	}
}
