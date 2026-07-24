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
import { buildConversionReport, MigrationLedger } from "./validation/migrate-conversion-report.js";
import { buildRunRecords, type RunOutcome } from "./validation/migration-ledger-inputs.js";
import { buildMigrationReport, writeMigrationReport } from "./validation/migration-report-writer.js";
import type { MigrationDecisionRecord } from "./validation/migration-record-types.js";
import { discoverEnvKeys } from "./discovery/config-discovery.js";
import { emitShellEnvPolicyScaffold } from "./providers/codex/shell-env-policy-emitter.js";
import { homedir } from "node:os";
import { getCodexRoot } from "./hooks/codex-path-safety.js";
import { applyActiveCodexOverlay } from "./modules/codex-reconcile-apply.js";
import { formatMcpIncludeRerunCommand } from "./migrate-ui-summary.js";
import { convertMcpJsonToCodexToml } from "./converters/mcp-json-to-codex-toml.js";
import { installCodexMcpServers } from "./hooks/codex-mcp-installer.js";
import { installCodexShellEnvPolicy } from "./hooks/codex-shell-env-installer.js";
import { CODEX_MIN_SUPPORTED_VERSION } from "./providers/codex/capabilities.js";
import {
	createReferenceIntegrityIndex,
	type ReferenceIntegrityIndex,
} from "./references/fence-aware-reference-rewriter.js";
import { codexBulkActionShim, providerKey, skillActionShim } from "./migrate-action-shims.js";
import { executeDeleteAction, executeInstallAction } from "./portable-installer.js";
import { installSkillDirectory } from "./skill-directory-installer.js";
import { buildInstalledBackRef, type InstalledBackRef } from "../core/install-metadata-backref.js";
import { installCodexAgents, mergeHooksSettings } from "./hooks/index.js";
import { installCodexCapabilityProjection } from "./capability-bootstrap-projection.js";
import { printActionDetails, printFinalSummary, printPreflight, printReportPath } from "./migrate-ui-summary.js";
import {
	collectProviderContractDiagnostics,
	summarizeProviderContractDiagnostics,
} from "./provider-contract-diagnostics.js";
import {
	buildPortableSkillsByProvider,
	buildSkillDryRunMessages,
	computeSkillParity,
	filterPlanForPortability,
	summarizeRuleMigrationByProvider,
	type SkillParity,
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

	const lockResult = await acquireMigrationLock({ scope: isGlobal ? "global" : "project" });
	if (!lockResult.acquired) {
		console.error(pc.red(`Another mewkit migrate is in progress (PID ${lockResult.heldBy ?? "unknown"})`));
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

	// Built once, up front: threaded into BOTH the reconcile preview (buildSourceItemState)
	// and the install path so the codex-agent preview checksum matches install output.
	const migratedRefs = buildMigratedRefsIndex(discovered);

	const sourceItems = flattenForReconcile(discovered).map((item) =>
		buildSourceItemState(item, item.type, targets, { migratedRefs }),
	);

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
	const portableSkills = await buildPortableSkillsByProvider(discovered.skills, targets, {
		includeUnportable: options.includeUnportable,
	});
	const ruleSummaries = summarizeRuleMigrationByProvider(discovered.rules, targets);
	const skillDryRunMessages = buildSkillDryRunMessages(portableSkills.skillsByProvider, targets);
	// Codex parity score (Phase 5): the measured metric of the staged full-semantic-parity track.
	// Printed in the migration output; portable+adapted / total (degraded + forced excluded).
	const codexParity: SkillParity | null = targets.includes("codex")
		? computeSkillParity(discovered.skills, "codex", { includeUnportable: options.includeUnportable })
		: null;
	const parityBanners = codexParity
		? [
				`Codex skill parity: ${codexParity.parityPct}% — ${codexParity.parityCount}/${codexParity.total} portable+adapted` +
					` (${codexParity.portable} portable, ${codexParity.adapted} adapted; ${codexParity.adaptedDegraded} degraded, ` +
					`${codexParity.includedUnportable} forced, ${codexParity.skipped} skipped as unportable). ` +
					`Full semantic parity is a staged track — see the parity roadmap.`,
			]
		: [];
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
	// When .mcp.json exists but --include-mcp is off, surface the exact re-run command
	// (Phase 5 field on PreflightContext); undefined otherwise.
	const mcpIncludeAdvisory =
		mcpApplicable && !options.includeMcp
			? { rerunCommand: formatMcpIncludeRerunCommand(["mewkit", ...ctx.argv]) }
			: undefined;

	// Phase 5 shell-env scaffold: from .claude/.env KEY NAMES only (no values). The
	// scaffold text is emitted into the codex config output; the aggregate count of
	// secret-like key names omitted is recorded in the report (names never surface).
	let secretKeysOmitted = 0;
	let shellEnvScaffold = "";
	if (targets.includes("codex")) {
		const envKeys = await discoverEnvKeys(join(discovered.source.root, ".env"));
		const scaffold = emitShellEnvPolicyScaffold(envKeys);
		secretKeysOmitted = scaffold.omittedSecretCount;
		shellEnvScaffold = scaffold.content;
		for (const warning of scaffold.warnings) mcpBanners.push(warning);
	}

	const collisions = detectProviderPathCollisions(targets, { global: isGlobal });
	const collisionBanners = collisions.map(
		(c) =>
			`Shared target: ${c.path} (${c.portableType}) used by ${c.providers.join(" + ")} — each provider writes the same content here`,
	);
	const manifestCleanupCount = portabilityFiltered.plan.actions.filter(
		(action) => action.reasonCode === "renamed-cleanup" || action.reasonCode === "path-migrated-cleanup",
	).length;
	const manifestBanners =
		manifest && manifestCleanupCount > 0
			? [`Portable manifest ${manifest.mewkitVersion}: ${manifestCleanupCount} cleanup action(s) planned`]
			: [];

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
			...manifestBanners,
			...mcpBanners,
			...portabilityFiltered.skipMessages,
			...portableSkills.skipMessages,
			...providerDiagnosticMessages,
			...ruleSummaries.flatMap((summary) => summary.messages),
			...skillDryRunMessages,
			...parityBanners,
		],
		conversionReport,
		mcpIncludeAdvisory,
	});

	if (options.dryRun) {
		printActionDetails(portabilityFiltered.plan.actions);
		console.log();
		console.log(pc.dim("(dry run — no files written)"));
		return conversionReport.validationErrors.length > 0 ? 1 : 0;
	}

	if (conversionReport.validationErrors.length > 0) {
		console.error(
			pc.red("Aborting before install: the reference rewriter left unexplained source references (see above)."),
		);
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

	// The ledger accumulates every run-time decision; it is serialized in the
	// finally-path below so the outcome is persisted even on a partial failure.
	const ledger = new MigrationLedger();
	const reportProvider: ProviderType = targets.includes("codex") ? "codex" : targets[0];
	const reportVersion = manifest?.mewkitVersion ?? "unknown";
	// Orchestrator-owned accumulators: retained by the finally-path even if
	// executePlan throws mid-run, so the report captures what happened up to then.
	const sink: ExecutePlanSink = { results: [], outcomes: new Map<string, RunOutcome>(), phaseRecords: [] };

	try {
		const installCtx = { allItems: itemsByT, installedBackRef, migratedRefs };
		const executed = await executePlan(
			portabilityFiltered.plan.actions,
			installCtx,
			portableSkills.skillsByProvider,
			targets,
			isGlobal,
			scope.skills,
			join(discovered.source.root, "settings.json"),
			sink,
		);

		// Authored-Codex overlay (author-first transition) runs HERE — after the converter
		// writes its base artifacts, but BEFORE the dynamic injectors below (capability
		// bootstrap, shell-env, MCP). The overlay copies each `active` authored artifact over
		// the converter output; for a flipped merge-surface (config.toml / AGENTS.md) it writes
		// the authored BASE, and the idempotent injectors then merge their per-project content
		// onto it. Gated on converter success (the injectors run regardless — non-fatal, recorded).
		// Inert while every entry is draft, so today's converter path is otherwise unchanged.
		if (targets.includes("codex") && !executed.results.some((r) => !r.success)) {
			// Overlay onto the SCOPE ROOT (project cwd / home), not the .codex dir — the manifest
			// targetPaths are scope-root-relative (".codex/config.toml", "AGENTS.md").
			const scopeRoot = isGlobal ? homedir() : process.cwd();
			const overlay = await applyActiveCodexOverlay(scopeRoot, { global: isGlobal });
			if (overlay.writes > 0) console.log(pc.green(`[+] Applied ${overlay.writes} authored Codex artifact(s)`));
		}

		// Codex config + rules merge-single (AGENTS.md), deferred from executePlan to run HERE —
		// after the overlay, before the capability-bootstrap injector. When AGENTS.md is flipped
		// authored, the overlay wrote its base and these sections merge onto it; when draft, the
		// overlay is inert and they build AGENTS.md exactly as the inline loop used to. Always
		// installs (executeInstallAction ignores action.action), so a re-run re-merges onto the
		// force-overwritten base — idempotent (merge-single strips-prior-by-key + re-ranks).
		if (targets.includes("codex")) {
			for (const action of executed.deferredCodexAgentsMdActions) {
				try {
					const result = await executeInstallAction(action, installCtx);
					executed.results.push(result);
					sink.phaseRecords.push(...(result.records ?? []));
					recordOutcome(
						sink.outcomes,
						action.type,
						action.item,
						result.success
							? { outcome: "migrated", target: action.targetPath }
							: { outcome: "failed", error: result.error },
					);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					executed.results.push({ action, success: false, error: message });
					recordOutcome(sink.outcomes, action.type, action.item, { outcome: "failed", error: message, internalError: true });
				}
			}
		}

		// This projection is not a migrated source artifact. It is CLI-owned trusted context
		// plus data-only manifest snapshot, so it is installed after normal AGENTS.md merging.
		// A Codex project can then resolve capabilities even when `.claude/` is not retained.
		if (targets.includes("codex")) {
			const projection = await installCodexCapabilityProjection(discovered.source.root, { global: isGlobal });
			executed.results.push({
				action: {
					action: "install",
					item: "capability resolver projection",
					type: "config",
					provider: "codex",
					global: isGlobal,
					targetPath: projection.agentsPath,
					reason: "Trusted capability bootstrap and data-only manifest projection",
				},
				success: projection.success,
				error: projection.error,
			});
			if (!projection.success) console.error(pc.red(`[x] Capability resolver projection failed: ${projection.error}`));
		}

		// Emit the [shell_environment_policy] scaffold into the codex config output
		// (real run, idempotent managed block). Failure is non-fatal but recorded.
		if (targets.includes("codex") && shellEnvScaffold.length > 0) {
			const envResult = await installCodexShellEnvPolicy(shellEnvScaffold, { global: isGlobal });
			if (!envResult.success) {
				console.error(pc.red(`[x] shell_environment_policy scaffold write failed: ${envResult.error}`));
			}
		}

		let mcpFailed = false;
		if (mcpApplicable && options.includeMcp) {
			mcpFailed = !(await migrateMcpServers(mcpSourcePath, isGlobal));
		}

		printFinalSummary(executed.results);
		const hasFailures = executed.results.some((r) => !r.success);
		if (!hasFailures && manifest) {
			await updateAppliedManifestVersion(manifest.mewkitVersion);
		}
		return hasFailures || mcpFailed ? 1 : 0;
	} finally {
		// Persist what happened — even on partial failure. A failed report write is
		// logged but NEVER masks the original run exception (it is re-thrown by the
		// finally semantics because we do not swallow it). The sink holds outcomes
		// accumulated up to a mid-run throw. The report is provider-parameterized but
		// codex is the first (and today only) consumer with a resolved output dir, so
		// non-codex runs are left byte-for-byte unchanged.
		if (targets.includes("codex")) {
			ledger.addAll(
				buildRunRecords({
					discovered,
					provider: reportProvider,
					outcomes: sink.outcomes,
					phaseRecords: sink.phaseRecords,
					preservedOccurrences: conversionReport.preservedOccurrences,
				}),
			);

			const report = buildMigrationReport({
				provider: reportProvider,
				version: reportVersion,
				records: ledger.all(),
				budgetLines: conversionReport.budgetLines,
				secretKeysOmitted,
				codexMinSupportedVersion: CODEX_MIN_SUPPORTED_VERSION,
			});

			try {
				const outputDir = getCodexRoot({ global: isGlobal });
				const written = await writeMigrationReport(report, outputDir);
				printReportPath(written.verdictLine);
			} catch (writeErr) {
				// Log the write failure without masking whatever the run was already doing.
				console.error(
					pc.red(
						`[x] Failed to write migration report: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`,
					),
				);
			}
		}
	}
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

export interface ExecutePlanResult {
	results: Array<import("./portable-installer.js").InstallResult>;
	/** Per-artifact run outcome keyed by `${type}:${source}` for the run-report ledger. */
	outcomes: Map<string, RunOutcome>;
	/** Structured Phase 1-3 records surfaced on install results (skills, hooks). */
	phaseRecords: MigrationDecisionRecord[];
	/** Codex config/rules merge-single actions (they target AGENTS.md), captured out of the main
	 *  loop so the orchestrator installs them AFTER the authored-bundle overlay. The overlay may
	 *  write the authored AGENTS.md base first; these sections then merge onto it. Captured
	 *  regardless of reconcile action (install/skip/conflict) — the overlay force-overwrites AGENTS.md
	 *  every run, so the sections must ALWAYS be re-merged (never left "skipped") to stay idempotent. */
	deferredCodexAgentsMdActions: ReconcileAction[];
}

function recordOutcome(
	outcomes: Map<string, RunOutcome>,
	type: PortableType,
	source: string,
	outcome: RunOutcome,
): void {
	outcomes.set(`${type}:${source}`, outcome);
}

/**
 * Shared, mutable accumulators the orchestrator owns so that a mid-run throw in
 * executePlan does NOT lose the outcomes recorded before the throw — the finally
 * path still writes what happened up to the failure point.
 */
export interface ExecutePlanSink {
	results: Array<import("./portable-installer.js").InstallResult>;
	outcomes: Map<string, RunOutcome>;
	phaseRecords: MigrationDecisionRecord[];
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
	sink: ExecutePlanSink,
): Promise<ExecutePlanResult> {
	const results = sink.results;
	const outcomes = sink.outcomes;
	const phaseRecords = sink.phaseRecords;
	const codexAgentActions = new Set<string>();
	const codexHookActions = new Set<string>();
	const codexAgentsMdActions: ReconcileAction[] = [];
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
		// Codex config + rules both merge-single into AGENTS.md. Capture them here — BEFORE the
		// skip/conflict handlers — so EVERY non-delete one defers to the post-overlay pass (the
		// overlay force-overwrites AGENTS.md each run, so a "skip" must still re-merge to stay
		// idempotent). Delete actions fall through to normal handling.
		if (action.provider === "codex" && (action.type === "config" || action.type === "rules") && action.action !== "delete") {
			codexAgentsMdActions.push(action);
			continue;
		}
		if (action.action === "skip") {
			// A no-op skip means the artifact is already present on the target — it is
			// migrated (installed), not absent. Only a user-deleted-respected skip
			// leaves the target absent. Recording this keeps re-run reports honest and
			// the migrated/skipped identity stable across idempotent runs.
			if (action.reasonCode !== "user-deleted-respected" && action.reasonCode !== "source-removed-orphan") {
				recordOutcome(outcomes, action.type, action.item, {
					outcome: "migrated",
					target: action.targetPath || undefined,
				});
			}
			continue;
		}
		if (action.action === "conflict" && action.resolution?.type === "keep") {
			// User kept their edited target — the artifact is still installed (migrated).
			recordOutcome(outcomes, action.type, action.item, {
				outcome: "migrated",
				target: action.targetPath || undefined,
			});
			continue;
		}
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
				phaseRecords.push(...(result.records ?? []));
				if (result.success) {
					recordOutcome(outcomes, action.type, action.item, { outcome: "migrated", target: action.targetPath });
				} else {
					// executeInstallAction returns audit failures as structured errors; treat
					// any non-success as a failed outcome (audit vs conversion reason is on the record).
					recordOutcome(outcomes, action.type, action.item, { outcome: "failed", error: result.error });
				}
				if (result.success && action.type === "hooks") {
					const provider = action.provider as ProviderType;
					const providerMap = hookTargetPathsByProvider.get(provider) ?? new Map<string, string>();
					providerMap.set(action.item, action.targetPath);
					hookTargetPathsByProvider.set(provider, providerMap);
				}
			}
		} catch (err) {
			// An internal (non-audit) installer exception: record as failed with an
			// internal-error reason rather than letting the artifact vanish silently.
			const message = err instanceof Error ? err.message : String(err);
			results.push({ action, success: false, error: message });
			if (action.action !== "delete") {
				recordOutcome(outcomes, action.type, action.item, {
					outcome: "failed",
					error: message,
					internalError: true,
				});
			}
		}
	}

	if (targets.includes("codex") && codexAgentActions.size > 0) {
		const agentsToWrite = ctx.allItems.agent.filter((agent) => codexAgentActions.has(agent.name));
		const result = await installCodexAgents(agentsToWrite, {
			global: isGlobal,
			configAgents: agentsToWrite,
			migratedRefs: ctx.migratedRefs,
		});
		results.push({
			action: codexBulkActionShim("agent", "codex", isGlobal, result.written),
			success: result.success,
			error: result.error,
		});
		// The bulk install is all-or-nothing; record each batched agent's outcome so the
		// per-artifact report is not left blank for the 24 codex agents.
		for (const agent of agentsToWrite) {
			recordOutcome(
				outcomes,
				"agent",
				agent.name,
				result.success ? { outcome: "migrated" } : { outcome: "failed", error: result.error },
			);
		}
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
			// Thread the Phase 2 per-hook decision records (codex today) into the ledger,
			// and record a baseline migrated/failed outcome per hook item in the batch.
			phaseRecords.push(...(result.records ?? []));
			for (const hook of hookItems) {
				recordOutcome(
					outcomes,
					"hooks",
					hook.name,
					result.success ? { outcome: "migrated" } : { outcome: "failed", error: result.error },
				);
			}
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
					records: r.records,
				});
				phaseRecords.push(...(r.records ?? []));
				recordOutcome(
					outcomes,
					"skill",
					skill.name,
					r.success ? { outcome: "migrated", target: r.path } : { outcome: "failed", error: r.error },
				);
			}
		}
	}

	return { results, outcomes, phaseRecords, deferredCodexAgentsMdActions: codexAgentsMdActions };
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
