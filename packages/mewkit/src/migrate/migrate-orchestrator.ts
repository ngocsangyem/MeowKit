// Main migration orchestrator. Composes all phases into runMigrate(options).

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
	readPortableRegistry,
	reconcile,
	releaseMigrationLock,
	resolveConflict,
	type ReconcileAction,
} from "./reconcile/index.js";
import { executeDeleteAction, executeInstallAction } from "./portable-installer.js";
import { installSkillDirectory } from "./skill-directory-installer.js";
import { printActionDetails, printFinalSummary, printPreflight } from "./migrate-ui-summary.js";
import type { MigrateOptions, PortableItem, PortableType, ProviderType, SkillInfo } from "./types.js";

export interface RunMigrateContext {
	bundledKitDir: string;
	argv: string[];
}

export async function runMigrate(
	options: MigrateOptions,
	ctx: RunMigrateContext,
): Promise<number> {
	applyMewkitOverrides({ preferAgentsMd: options.preferAgentsMd });
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

	const lockResult = await acquireMigrationLock({ scope: isGlobal ? "global" : "project" });
	if (!lockResult.acquired) {
		console.error(
			pc.red(`Another mewkit migrate is in progress (PID ${lockResult.heldBy ?? "unknown"})`),
		);
		return 1;
	}

	try {
		return await runMigrateUnderLock(options, ctx, scope, targets, isGlobal);
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
): Promise<number> {
	const spinner = process.stdout.isTTY ? p.spinner() : null;
	spinner?.start("Discovering portable items...");

	const discovered = await discoverAll(scope, {
		source: options.source,
		bundledKitDir: ctx.bundledKitDir,
	});
	spinner?.stop("Discovery complete.");

	const sourceItems = flattenForReconcile(discovered).map((item) =>
		buildSourceItemState(item, item.type, targets),
	);

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

	for (const action of plan.actions) {
		if (!action.targetPath) {
			action.targetPath =
				getPortableInstallPath(action.item, action.provider as ProviderType, providerKey(action.type), { global: action.global }) ??
				"";
		}
	}

	const collisions = detectProviderPathCollisions(targets, { global: isGlobal });
	const collisionBanners = collisions.map(
		(c) => `Shared target: ${c.path} (${c.portableType}) used by ${c.providers.join(" + ")} — each provider writes the same content here`,
	);

	printPreflight(plan, {
		source: { root: discovered.source.root, origin: discovered.source.origin },
		skippedShellHooks: discovered.skippedShellHooks.length,
		bannerExtras: collisionBanners,
	});

	if (options.dryRun) {
		printActionDetails(plan.actions);
		console.log();
		console.log(pc.dim("(dry run — no files written)"));
		return 0;
	}

	for (const action of plan.actions) {
		if (action.action === "conflict") {
			const policy = options.force ? "overwrite" : "keep";
			const resolution = await resolveConflict(action, {
				interactive: !!process.stdout.isTTY && !options.yes,
				color: !!process.stdout.isTTY,
				nonInteractivePolicy: policy,
			});
			action.resolution = resolution;
		}
	}

	const confirmed =
		options.yes || !process.stdout.isTTY ||
		(await confirmExecution(plan.summary.install + plan.summary.update + plan.summary.delete));
	if (!confirmed) return 130;

	const itemsByT = itemsByType(discovered);
	const results = await executePlan(plan.actions, { allItems: itemsByT }, discovered.skills, targets, isGlobal, scope.skills);

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
	skills: SkillInfo[],
	targets: ProviderType[],
	isGlobal: boolean,
	skillsScopeEnabled: boolean,
): Promise<Array<import("./portable-installer.js").InstallResult>> {
	const results: Array<import("./portable-installer.js").InstallResult> = [];

	for (const action of actions) {
		if (action.action === "skip") continue;
		if (action.action === "conflict" && action.resolution?.type === "keep") continue;

		try {
			if (action.action === "delete") {
				results.push(await executeDeleteAction(action));
			} else {
				results.push(await executeInstallAction(action, ctx));
			}
		} catch (err) {
			results.push({
				action,
				success: false,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	if (skillsScopeEnabled && skills.length > 0) {
		for (const target of targets) {
			if (!providers[target].skills) continue;
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

function skillActionShim(skill: SkillInfo, provider: ProviderType, global: boolean, path: string): ReconcileAction {
	return {
		action: "install",
		item: skill.name,
		type: "skill",
		provider,
		global,
		targetPath: path,
		reason: "Skill directory install",
		isDirectoryItem: true,
	};
}

function providerKey(type: PortableType): "agents" | "commands" | "skills" | "config" | "rules" | "hooks" {
	switch (type) {
		case "agent": return "agents";
		case "command": return "commands";
		case "skill": return "skills";
		case "config": return "config";
		case "rules": return "rules";
		case "hooks": return "hooks";
	}
}

export { MewkitMigrateError };
