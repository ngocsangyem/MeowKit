// Validate flag combinations and resolve provider selection for `mewkit migrate`.
import * as p from "@clack/prompts";
import type { MigrateOptions, ProviderType } from "./types.js";
import { detectInstalledProviders, getAllProviderTypes } from "./provider-registry-utils.js";
import { providers } from "./provider-registry.js";

const ALL_TARGET_TYPES: ProviderType[] = (getAllProviderTypes() as ProviderType[]).filter(
	(t): t is ProviderType => t !== "claude-code",
);

export class MewkitMigrateError extends Error {
	exitCode: number;
	constructor(message: string, exitCode = 1) {
		super(message);
		this.exitCode = exitCode;
	}
}

export function validateFlags(options: MigrateOptions, argv: string[]): void {
	if (options.install && options.reconcile) {
		throw new MewkitMigrateError("--install and --reconcile are mutually exclusive", 2);
	}
	if (options.reinstallEmptyDirs && options.respectDeletions) {
		throw new MewkitMigrateError(
			"--reinstall-empty-dirs and --respect-deletions are mutually exclusive",
			2,
		);
	}
	if (options.tool === "claude-code") {
		throw new MewkitMigrateError(
			"claude-code is mewkit's source format, not a migration target. Use 'mewkit init' to scaffold .claude/.",
			2,
		);
	}
	void argv;
}

export async function selectProviders(
	options: MigrateOptions,
): Promise<ProviderType[]> {
	if (options.tools && options.tools.length > 0) {
		const unknown: string[] = [];
		const valid: ProviderType[] = [];
		for (const t of options.tools) {
			if (ALL_TARGET_TYPES.includes(t as ProviderType)) valid.push(t as ProviderType);
			else unknown.push(t);
		}
		if (unknown.length > 0) {
			throw new MewkitMigrateError(`Unknown tool(s): ${unknown.join(", ")}`, 2);
		}
		if (valid.length === 0) {
			throw new MewkitMigrateError("No valid tools in --migrate-to list", 2);
		}
		return valid;
	}

	if (options.tool) {
		const tool = options.tool as ProviderType;
		if (!ALL_TARGET_TYPES.includes(tool)) {
			throw new MewkitMigrateError(`Unknown tool: ${options.tool}`, 2);
		}
		return [tool];
	}

	if (options.all) return [...ALL_TARGET_TYPES];

	if (options.yes) {
		const result = await safeDetectInstalledTargets();
		if (result.failed) {
			throw new MewkitMigrateError(
				`Provider detection failed (${result.error ?? "unknown error"}). Pass --all or specify a tool explicitly to proceed in non-interactive mode.`,
				2,
			);
		}
		if (result.installed.length === 0) {
			console.log("[i] No installed providers detected; defaulting to all 15 targets.");
			return [...ALL_TARGET_TYPES];
		}
		return result.installed;
	}

	if (!process.stdout.isTTY) {
		throw new MewkitMigrateError(
			"Non-TTY environment without --yes/--all. Specify a tool or pass --yes for non-interactive auto-detect.",
			2,
		);
	}

	// Interactive mode tolerates detection failure — picker still works without hints.
	const detectionResult = await safeDetectInstalledTargets();
	if (detectionResult.failed) {
		console.log(`[!] Provider detection failed: ${detectionResult.error ?? "unknown error"}. Continuing without detection hints.`);
	}
	const detected: ProviderType[] = detectionResult.installed;

	const choice = await p.multiselect({
		message: "Select providers to migrate to:",
		options: ALL_TARGET_TYPES.map((t) => ({
			value: t,
			label: providers[t].displayName,
			hint: detected.includes(t) ? "(installed)" : undefined,
		})),
		required: true,
		initialValues: detected.length > 0 ? detected : ALL_TARGET_TYPES,
	});

	if (p.isCancel(choice)) throw new MewkitMigrateError("Cancelled", 130);
	return choice as ProviderType[];
}

export async function selectScope(options: MigrateOptions): Promise<boolean> {
	if (options.global) return true;
	if (options.yes || !process.stdout.isTTY) return false;

	const choice = await p.select({
		message: "Installation scope:",
		options: [
			{ value: "project", label: "Project (./.cursor/, etc.)" },
			{ value: "global", label: "Global (~/.cursor/, etc.)" },
		],
		initialValue: "project",
	});

	if (p.isCancel(choice)) throw new MewkitMigrateError("Cancelled", 130);
	return choice === "global";
}

export function warnUnverifiedProviders(providers_: ProviderType[]): void {
	for (const p of providers_) {
		if (providers[p]._unverified) {
			console.log(
				`[!] ${providers[p].displayName} support is UNVERIFIED. Migration may produce broken output. Report issues at <repo>/issues if it fails.`,
			);
		}
	}
}

/** Result of detection — distinguishes genuine-empty from probe failure so
 *  callers can decide whether to fall back safely or refuse to proceed. */
interface DetectionResult {
	installed: ProviderType[];
	failed: boolean;
	error?: string;
}

/** Detect installed providers, catching probe failures separately from genuine
 *  empty results. Callers in non-interactive mode should treat failures as fatal. */
async function safeDetectInstalledTargets(): Promise<DetectionResult> {
	try {
		const list = await detectInstalledProviders();
		const installed = list.filter((t) => t !== "claude-code") as ProviderType[];
		return { installed, failed: false };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { installed: [], failed: true, error: msg };
	}
}
