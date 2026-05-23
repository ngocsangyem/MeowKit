// Main migration orchestrator. Composes all phases into runMigrate(options).

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
	readPortableRegistry,
	reconcile,
	releaseMigrationLock,
	resolveConflict,
	type ReconcileAction,
} from "./reconcile/index.js";
import { convertItem } from "./converters/index.js";
import { codexBulkActionShim, providerKey, skillActionShim } from "./migrate-action-shims.js";
import { executeDeleteAction, executeInstallAction } from "./portable-installer.js";
import { installSkillDirectory } from "./skill-directory-installer.js";
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
	const targetStates = await buildTargetStates(registry.installations);

	const typeDirectoryStates = buildTypeDirectoryStates(
		targets.map((provider) => ({ provider, global: isGlobal })),
		["agent", "command", "skill", "config", "rules", "hooks"],
	);

	const plan = reconcile({
		sourceItems,
		registry,
		targetStates,
		providerConfigs: targets.map((provider) => ({ provider, global: isGlobal })),
		typeDirectoryStates,
		force: options.force,
		respectDeletions: options.respectDeletions,
	});

	const itemsByT = itemsByType(discovered);
	const portabilityFiltered = filterPlanForPortability(plan, itemsByT);
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

	const collisions = detectProviderPathCollisions(targets, { global: isGlobal });
	const collisionBanners = collisions.map(
		(c) =>
			`Shared target: ${c.path} (${c.portableType}) used by ${c.providers.join(" + ")} — each provider writes the same content here`,
	);
	const modelRoutingBanners = modelRoutingWarnings.map((warning) => `Model routing: ${warning}`);

	printPreflight(portabilityFiltered.plan, {
		source: { root: discovered.source.root, origin: discovered.source.origin },
		skippedShellHooks: discovered.skippedShellHooks.length,
		bannerExtras: [
			...collisionBanners,
			...modelRoutingBanners,
			...portabilityFiltered.skipMessages,
			...portableSkills.skipMessages,
			...providerDiagnosticMessages,
			...ruleSummaries.flatMap((summary) => summary.messages),
			...skillDryRunMessages,
		],
	});

	if (options.dryRun) {
		printActionDetails(portabilityFiltered.plan.actions);
		console.log();
		console.log(pc.dim("(dry run — no files written)"));
		return 0;
	}

	// Compute diffs lazily for conflicting actions so the "Show diff" prompt has data.
	for (const action of portabilityFiltered.plan.actions) {
		if (action.action !== "conflict") continue;
		await attachConflictDiff(action, itemsByT);

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

	const results = await executePlan(
		portabilityFiltered.plan.actions,
		{ allItems: itemsByT },
		portableSkills.skillsByProvider,
		targets,
		isGlobal,
		scope.skills,
		join(discovered.source.root, "settings.json"),
	);

	printFinalSummary(results);
	return results.some((r) => !r.success) ? 1 : 0;
}

async function confirmExecution(count: number): Promise<boolean> {
	const choice = await p.confirm({
		message: `Execute ${count} action(s)?`,
		initialValue: true,
	});
	if (p.isCancel(choice)) return false;
	return choice === true;
}

async function executePlan(
	actions: ReconcileAction[],
	ctx: { allItems: Record<PortableType, PortableItem[]> },
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
				const r = await installSkillDirectory(skill, target, { global: isGlobal });
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
		const conversion = convertItem(sourceItem, pathConfig.format, action.provider as ProviderType);
		if (conversion.error) return;
		action.diff = generateDiff(targetContent, conversion.content, action.item);
	} catch {
		// Read or convert failed — leave diff undefined; resolver handles the missing case.
	}
}

export { MewkitMigrateError };
