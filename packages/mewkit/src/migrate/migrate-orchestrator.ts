// Main migration orchestrator. Composes all phases into runMigrate(options).

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { applyMewkitOverrides } from "./provider-overrides.js";
import { resolveMigrationScope } from "./migrate-scope-resolver.js";
import { discoverAll, flattenForReconcile, itemsByType } from "./migrate-discover.js";
import {
	MewkitMigrateError,
	selectProviders,
	selectScope,
	validateFlags,
	warnUnverifiedProviders,
} from "./migrate-mode-resolver.js";
import { providers } from "./provider-registry.js";
import { detectProviderPathCollisions, getPortableInstallPath } from "./provider-registry-utils.js";
import {
	acquireMigrationLock,
	buildSourceItemState,
	buildTargetStates,
	buildTypeDirectoryStates,
	generateDiff,
	loadPortableEvolutionManifest,
	readPortableRegistry,
	reconcile,
	releaseMigrationLock,
	resolveConflict,
	updateAppliedManifestVersion,
	type ReconcileAction,
} from "./reconcile/index.js";
import { convertItem } from "./converters/index.js";
import { buildConversionReport } from "./validation/migrate-conversion-report.js";
import { convertMcpJsonToCodexToml } from "./converters/mcp-json-to-codex-toml.js";
import { installCodexMcpServers } from "./hooks/codex-mcp-installer.js";
import {
	createReferenceIntegrityIndex,
	type ReferenceIntegrityIndex,
} from "./references/fence-aware-reference-rewriter.js";
import { codexBulkActionShim, providerKey, skillActionShim } from "./migrate-action-shims.js";
import { executeDeleteAction, executeInstallAction } from "./portable-installer.js";
import { installSkillDirectory } from "./skill-directory-installer.js";
import { buildInstalledBackRef, type InstalledBackRef } from "../core/install-metadata-backref.js";
import { installCodexAgents, mergeHooksSettings } from "./hooks/index.js";
import { loadModelRoutingConfig } from "./model-routing-config.js";
import { printActionDetails, printFinalSummary, printPreflight } from "./migrate-ui-summary.js";
import {
	collectProviderContractDiagnostics,
	summarizeProviderContractDiagnostics,
} from "./provider-contract-diagnostics.js";
import {
	buildPortableSkillsByProvider,
	buildSkillDryRunMessages,
	filterPlanForPortability,
	summarizeRuleMigrationByProvider,
} from "./portability-policy.js";
import type { MigrateOptions, PortableItem, PortableType, ProviderType, SkillInfo } from "./types.js";

export interface RunMigrateContext {
	bundledKitDir: string;
	argv: string[];
}

export async function runMigrate(options: MigrateOptions, ctx: RunMigrateContext): Promise<number> {
	applyMewkitOverrides();
	validateFlags(options, ctx.argv);

	const scope = resolveMigrationScope(ctx.argv, {
		only: options.only,
		skipConfig: options.skipConfig,
		skipRules: options.skipRules,
		skipHooks: options.skipHooks,
	});

	const targets = await selectProviders(options);
	warnUnverifiedProviders(targets);
	const isGlobal = await selectScope(options);
	const modelRouting = await loadModelRoutingConfig();

	const lockResult = await acquireMigrationLock({ scope: isGlobal ? "global" : "project" });
	if (!lockResult.acquired) {
		console.error(pc.red(`Another mewkit migrate is in progress (PID ${lockResult.heldBy ?? "unknown"})`));
		return 1;
	}

	try {
		return await runMigrateUnderLock(options, ctx, scope, targets, isGlobal, modelRouting.warnings);
	} finally {
		await releaseMigrationLock(lockResult.lockPath);
	}
}

async function runMigrateUnderLock(
	options: MigrateOptions,
	ctx: RunMigrateContext,
	scope: ReturnType<typeof resolveMigrationScope>,
	targets: ProviderType[],
	isGlobal: boolean,
	modelRoutingWarnings: string[],
): Promise<number> {
	const spinner = process.stdout.isTTY ? p.spinner() : null;
	spinner?.start("Discovering portable items...");

	const discovered = await discoverAll(scope, {
		source: options.source,
		bundledKitDir: ctx.bundledKitDir,
	});
	spinner?.stop("Discovery complete.");

	const sourceItems = flattenForReconcile(discovered).map((item) => buildSourceItemState(item, item.type, targets));

	const registry = await readPortableRegistry();
	const manifest = await loadPortableEvolutionManifest(ctx.bundledKitDir, registry);
	const targetStates = await buildTargetStates(registry.installations);

	const typeDirectoryStates = buildTypeDirectoryStates(
		targets.map((provider) => ({ provider, global: isGlobal })),
		["agent", "command", "skill", "config", "rules", "hooks"],
	);

	const plan = reconcile({
		sourceItems,
		registry,
		targetStates,
		manifest,
		providerConfigs: targets.map((provider) => ({ provider, global: isGlobal })),
		typeDirectoryStates,
		force: options.force,
		respectDeletions: options.respectDeletions,
	});

	const itemsByT = itemsByType(discovered);
	const portabilityFiltered = filterPlanForPortability(plan, itemsByT, { allRules: options.allRules });
	const portableSkills = await buildPortableSkillsByProvider(discovered.skills, targets);
	const ruleSummaries = summarizeRuleMigrationByProvider(discovered.rules, targets);
	const skillDryRunMessages = buildSkillDryRunMessages(portableSkills.skillsByProvider, targets);
	const providerDiagnosticMessages = options.providers
		? summarizeProviderContractDiagnostics(collectProviderContractDiagnostics(), targets)
		: [];

	for (const action of portabilityFiltered.plan.actions) {
		if (!action.targetPath) {
			action.targetPath =
				getPortableInstallPath(action.item, action.provider as ProviderType, providerKey(action.type), {
					global: action.global,
				}) ?? "";
		}
	}

	const mcpSourcePath = join(process.cwd(), ".mcp.json");
	const mcpApplicable = targets.includes("codex") && existsSync(mcpSourcePath);
	const mcpBanners: string[] = [];
	if (mcpApplicable) {
		mcpBanners.push(
			options.includeMcp
				? ".mcp.json will be merged into .codex/config.toml [mcp_servers] (--include-mcp)"
				: ".mcp.json detected but not migrated — opt in with --include-mcp",
		);
	}

	const collisions = detectProviderPathCollisions(targets, { global: isGlobal });
	const collisionBanners = collisions.map(
		(c) =>
			`Shared target: ${c.path} (${c.portableType}) used by ${c.providers.join(" + ")} — each provider writes the same content here`,
	);
	const modelRoutingBanners = modelRoutingWarnings.map((warning) => `Model routing: ${warning}`);
	const manifestCleanupCount = portabilityFiltered.plan.actions.filter(
		(action) => action.reasonCode === "renamed-cleanup" || action.reasonCode === "path-migrated-cleanup",
	).length;
	const manifestBanners =
		manifest && manifestCleanupCount > 0
			? [`Portable manifest ${manifest.mewkitVersion}: ${manifestCleanupCount} cleanup action(s) planned`]
			: [];

	const migratedRefs = buildMigratedRefsIndex(discovered);

	// In-memory conversion pass: classifier decisions, budget projections, and
	// the unresolved-reference invariant check all land in the preflight report.
	const conversionReport = buildConversionReport({
		actions: portabilityFiltered.plan.actions,
		itemsByType: itemsByT,
		skillsByProvider: portableSkills.skillsByProvider,
		migratedRefs,
	});

	printPreflight(portabilityFiltered.plan, {
		source: { root: discovered.source.root, origin: discovered.source.origin },
		skippedShellHooks: discovered.skippedShellHooks.length,
		bannerExtras: [
			...collisionBanners,
			...modelRoutingBanners,
			...manifestBanners,
			...mcpBanners,
			...portabilityFiltered.skipMessages,
			...portableSkills.skipMessages,
			...providerDiagnosticMessages,
			...ruleSummaries.flatMap((summary) => summary.messages),
			...skillDryRunMessages,
		],
		conversionReport,
	});

	if (options.dryRun) {
		printActionDetails(portabilityFiltered.plan.actions);
		console.log();
		console.log(pc.dim("(dry run — no files written)"));
		return conversionReport.validationErrors.length > 0 ? 1 : 0;
	}

	if (conversionReport.validationErrors.length > 0) {
		console.error(pc.red("Aborting before install: the reference rewriter left unexplained source references (see above)."));
		return 1;
	}

	// Compute diffs lazily for conflicting actions so the "Show diff" prompt has data.
	for (const action of portabilityFiltered.plan.actions) {
		if (action.action !== "conflict") continue;
		await attachConflictDiff(action, itemsByT, migratedRefs);

		const policy = options.force ? "overwrite" : "keep";
		const resolution = await resolveConflict(action, {
			interactive: !!process.stdout.isTTY && !options.yes,
			color: !!process.stdout.isTTY,
			nonInteractivePolicy: policy,
		});
		action.resolution = resolution;
	}

	const confirmed =
		options.yes ||
		!process.stdout.isTTY ||
		(await confirmExecution(
			portabilityFiltered.plan.summary.install +
				portabilityFiltered.plan.summary.update +
				portabilityFiltered.plan.summary.delete,
		));
	if (!confirmed) return 130;

	// One-way bridge: link exported assets back to the installed metadata they
	// came from. Absent installed metadata yields null and the bridge is omitted.
	const installedBackRef = buildInstalledBackRef(discovered.source.root);

	const results = await executePlan(
		portabilityFiltered.plan.actions,
		{ allItems: itemsByT, installedBackRef, migratedRefs },
		portableSkills.skillsByProvider,
		targets,
		isGlobal,
		scope.skills,
		join(discovered.source.root, "settings.json"),
	);

	let mcpFailed = false;
	if (mcpApplicable && options.includeMcp) {
		mcpFailed = !(await migrateMcpServers(mcpSourcePath, isGlobal));
	}

	printFinalSummary(results);
	const hasFailures = results.some((r) => !r.success);
	if (!hasFailures && manifest) {
		await updateAppliedManifestVersion(manifest.mewkitVersion);
	}
	return hasFailures || mcpFailed ? 1 : 0;
}

/** Opt-in .mcp.json → config.toml [mcp_servers] migration for the Codex target. */
async function migrateMcpServers(mcpSourcePath: string, isGlobal: boolean): Promise<boolean> {
	try {
		const raw = await readFile(mcpSourcePath, "utf-8");
		const converted = convertMcpJsonToCodexToml(raw);
		for (const warning of converted.warnings) {
			console.log(pc.yellow(`[!] ${warning}`));
		}
		if (!converted.content) return true;

		const result = await installCodexMcpServers(converted.content, { global: isGlobal });
		if (!result.success) {
			console.error(pc.red(`[x] MCP server merge failed: ${result.error}`));
			return false;
		}
		console.log(pc.green(`[+] Merged ${converted.serverNames.length} MCP server(s) into ${result.configPath}`));
		return true;
	} catch (err) {
		console.error(pc.red(`[x] MCP migration failed: ${err instanceof Error ? err.message : String(err)}`));
		return false;
	}
}

async function confirmExecution(count: number): Promise<boolean> {
	const choice = await p.confirm({
		message: `Execute ${count} action(s)?`,
		initialValue: true,
	});
	if (p.isCancel(choice)) return false;
	return choice === true;
}

/**
 * Build the migration-set membership index used by the fenced-reference
 * integrity check: source-relative reference forms of every discovered item.
 */
function buildMigratedRefsIndex(discovered: Awaited<ReturnType<typeof discoverAll>>): ReferenceIntegrityIndex {
	const entries: string[] = [];
	const root = discovered.source.root;
	for (const item of [...discovered.agents, ...discovered.commands, ...discovered.rules, ...discovered.hooks]) {
		const rel = relative(root, item.sourcePath).replace(/\\/g, "/");
		if (!rel.startsWith("..")) entries.push(`.claude/${rel}`);
	}
	if (discovered.config) entries.push("CLAUDE.md");
	for (const skill of discovered.skills) {
		entries.push(`.claude/skills/${skill.dirName}/`);
	}
	return createReferenceIntegrityIndex(entries);
}

async function executePlan(
	actions: ReconcileAction[],
	ctx: {
		allItems: Record<PortableType, PortableItem[]>;
		installedBackRef?: InstalledBackRef | null;
		migratedRefs?: ReferenceIntegrityIndex | null;
	},
	skillsByProvider: Map<ProviderType, SkillInfo[]>,
	targets: ProviderType[],
	isGlobal: boolean,
	skillsScopeEnabled: boolean,
	sourceSettingsPath: string,
): Promise<Array<import("./portable-installer.js").InstallResult>> {
	const results: Array<import("./portable-installer.js").InstallResult> = [];
	const codexAgentActions = new Set<string>();
	const codexHookActions = new Set<string>();
	const hookTargetPathsByProvider = new Map<ProviderType, Map<string, string>>();
	for (const target of targets) {
		if (target === "codex" || !providers[target].hooks) continue;
		const providerMap = new Map<string, string>();
		for (const hook of ctx.allItems.hooks) {
			const targetPath = getPortableInstallPath(hook.name, target, "hooks", { global: isGlobal });
			if (targetPath) providerMap.set(hook.name, targetPath);
		}
		if (providerMap.size > 0) hookTargetPathsByProvider.set(target, providerMap);
	}

	for (const action of actions) {
		if (action.action === "skip") continue;
		if (action.action === "conflict" && action.resolution?.type === "keep") continue;
		if (action.provider === "codex" && action.type === "agent") {
			if (action.action !== "delete") {
				codexAgentActions.add(action.item);
				continue;
			}
		}
		if (action.provider === "codex" && action.type === "hooks") {
			if (action.action !== "delete") {
				codexHookActions.add(action.item);
				continue;
			}
		}

		try {
			if (action.action === "delete") {
				results.push(await executeDeleteAction(action));
			} else {
				const result = await executeInstallAction(action, ctx);
				results.push(result);
				if (result.success && action.type === "hooks") {
					const provider = action.provider as ProviderType;
					const providerMap = hookTargetPathsByProvider.get(provider) ?? new Map<string, string>();
					providerMap.set(action.item, action.targetPath);
					hookTargetPathsByProvider.set(provider, providerMap);
				}
			}
		} catch (err) {
			results.push({
				action,
				success: false,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	if (targets.includes("codex") && codexAgentActions.size > 0) {
		const agentsToWrite = ctx.allItems.agent.filter((agent) => codexAgentActions.has(agent.name));
		const result = await installCodexAgents(agentsToWrite, { global: isGlobal, configAgents: agentsToWrite });
		results.push({
			action: codexBulkActionShim("agent", "codex", isGlobal, result.written),
			success: result.success,
			error: result.error,
		});
	}

	const hookProviders = targets.filter((target) => providers[target].hooks);
	if (ctx.allItems.hooks.length > 0 && hookProviders.length > 0) {
		for (const target of hookProviders) {
			if (target === "codex" && codexHookActions.size === 0) continue;
			const hookItems =
				target === "codex" ? ctx.allItems.hooks.filter((hook) => codexHookActions.has(hook.name)) : ctx.allItems.hooks;
			if (hookItems.length === 0) continue;
			const result = await mergeHooksSettings(target, hookItems, hookTargetPathsByProvider.get(target) ?? new Map(), {
				global: isGlobal,
				sourceSettingsPath,
			});
			results.push({
				action: codexBulkActionShim("hooks", target, isGlobal, result.hooksWritten),
				success: result.success,
				error: result.error,
			});
		}
	}

	if (skillsScopeEnabled) {
		for (const target of targets) {
			if (!providers[target].skills) continue;
			const skills = skillsByProvider.get(target) ?? [];
			for (const skill of skills) {
				const r = await installSkillDirectory(skill, target, {
					global: isGlobal,
					installedBackRef: ctx.installedBackRef,
					migratedRefs: ctx.migratedRefs,
				});
				results.push({
					action: skillActionShim(skill, target, isGlobal, r.path ?? ""),
					success: r.success,
					error: r.error,
				});
			}
		}
	}

	return results;
}

/**
 * Read the on-disk target file, run the converter against the matching source item,
 * and attach a unified diff to the action so the conflict resolver's "Show diff" UI
 * has real content. Best-effort — silent failures leave action.diff undefined and
 * the resolver will display "[i] Diff not available."
 */
async function attachConflictDiff(
	action: ReconcileAction,
	itemsByT: Record<PortableType, PortableItem[]>,
	migratedRefs?: ReferenceIntegrityIndex | null,
): Promise<void> {
	if (action.diff) return;
	if (!action.targetPath || !existsSync(action.targetPath)) return;

	const sourceItem = itemsByT[action.type]?.find((i) => i.name === action.item);
	if (!sourceItem) return;

	const providerConfig = providers[action.provider as ProviderType];
	const pathConfig = providerConfig?.[providerKey(action.type)];
	if (!pathConfig) return;

	try {
		const targetContent = await readFile(action.targetPath, "utf-8");
		const conversion = convertItem(sourceItem, pathConfig.format, action.provider as ProviderType, { migratedRefs });
		if (conversion.error) return;
		action.diff = generateDiff(targetContent, conversion.content, action.item);
	} catch {
		// Read or convert failed — leave diff undefined; resolver handles the missing case.
	}
}

export { MewkitMigrateError };
