import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
	checkClaudeDir,
	checkConfig,
	checkGit,
	checkInstallMode,
	checkHooks,
	checkMcp,
	checkMemory,
	checkNodeVersion,
	checkPipPackages,
	checkPython,
	checkScripts,
	checkSystemDeps,
	checkVenv,
	type DiagResult,
	type Status,
} from "./doctor-checks.js";
import { checkMemoryHealth } from "./doctor-memory-checks.js";
import { checkHardGates } from "./doctor-hard-gates.js";
import {
	collectProviderContractDiagnostics,
	summarizeProviderContractDiagnostics,
	type ProviderDiagnosticSeverity,
} from "../migrate/provider-contract-diagnostics.js";
import { readInstallMetadata, CorruptInstallMetadataError } from "../core/install-metadata.js";
import { readPortableRegistry } from "../migrate/reconcile/portable-registry.js";

function statusIcon(status: Status): string {
	switch (status) {
		case "pass":
			return pc.green("PASS");
		case "fail":
			return pc.red("FAIL");
		case "warn":
			return pc.yellow("WARN");
		case "na":
			return pc.dim("N/A");
	}
}

function providerSeverityToStatus(severity: ProviderDiagnosticSeverity): Status {
	if (severity === "fail") return "fail";
	if (severity === "warn") return "warn";
	return "pass";
}

/** Find MeowKit project root — checks cwd only (no walk-up to avoid matching parent projects). */
function findProjectRoot(): string | null {
	const cwd = process.cwd();
	const hasDotClaude = fs.existsSync(path.join(cwd, ".claude"));
	const hasConfig = fs.existsSync(path.join(cwd, ".claude", "meowkit.config.json"));
	const hasManifest = fs.existsSync(path.join(cwd, ".claude", "meowkit.manifest.json"));
	const hasClaude = fs.existsSync(path.join(cwd, "CLAUDE.md"));
	if (hasDotClaude || hasConfig || hasManifest || hasClaude) {
		return cwd;
	}
	return null;
}

export async function doctor(args?: {
	report?: boolean;
	providers?: boolean;
	state?: boolean;
	hardGates?: boolean;
}): Promise<void> {
	console.log(pc.bold(pc.cyan("MeowKit Doctor")));
	console.log(pc.dim("Diagnosing common issues...\n"));

	const root = findProjectRoot();
	if (root) {
		console.log(`  ${pc.dim("Project:")} ${root}\n`);
	}

	const systemDepResults = await checkSystemDeps(root);

	const results: DiagResult[] = [
		checkNodeVersion(),
		checkPython(),
		checkGit(),
		checkClaudeDir(root),
		checkConfig(root),
		checkInstallMode(root),
		checkHooks(root),
		checkScripts(root),
		checkMemory(root),
		checkMcp(root),
		checkVenv(root),
		checkPipPackages(root),
		...systemDepResults,
	];

	if (args?.providers) {
		results.push(
			...collectProviderContractDiagnostics()
				.filter((diagnostic) => diagnostic.severity !== "pass")
				.map((diagnostic) => ({
					status: providerSeverityToStatus(diagnostic.severity),
					name: `Provider contract: ${diagnostic.providerDisplayName}/${diagnostic.surface}`,
					detail: diagnostic.message,
					fix:
						diagnostic.severity === "fail"
							? "Disable the provider surface or update its official documentation contract."
							: undefined,
				})),
		);
		if (summarizeProviderContractDiagnostics(collectProviderContractDiagnostics()).length === 0) {
			results.push({
				status: "pass",
				name: "Provider contracts",
				detail: "All effective provider surfaces match documented contracts.",
			});
		}
	}

	results.push(...(await checkMetadataHealth(root)));

	if (args?.state) {
		results.push(...checkStateTaxonomy(root));
		results.push(...checkMemoryHealth(root));
	}

	if (args?.hardGates) {
		results.push(...(await checkHardGates(root)));
	}

	for (const r of results) {
		console.log(`  [${statusIcon(r.status)}] ${r.name}`);
		console.log(`         ${pc.dim(r.detail)}`);
		if (r.fix) {
			console.log(`         ${pc.cyan(`Fix: ${r.fix}`)}`);
		}
	}

	console.log();

	const pass = results.filter((r) => r.status === "pass").length;
	const fail = results.filter((r) => r.status === "fail").length;
	const warn = results.filter((r) => r.status === "warn").length;
	const na = results.filter((r) => r.status === "na").length;

	const parts: string[] = [pc.green(`${pass} passed`)];
	if (warn > 0) parts.push(pc.yellow(`${warn} warnings`));
	if (na > 0) parts.push(pc.dim(`${na} n/a`));
	if (fail > 0) parts.push(pc.red(`${fail} failed`));
	console.log(parts.join(", "));

	if (args?.report) {
		const lines = [
			"# MeowKit Doctor Report",
			`Date: ${new Date().toISOString()}`,
			`Node: ${process.versions.node}`,
			`Platform: ${process.platform} ${process.arch}`,
			`Project: ${root ?? "not found"}`,
			"",
			"## Results",
			...results.map((r) => `- [${r.status.toUpperCase()}] ${r.name}: ${r.detail}${r.fix ? ` (fix: ${r.fix})` : ""}`),
			"",
			`## Summary: ${pass} passed, ${warn} warnings, ${fail} failed`,
		];
		console.log(pc.dim("\n--- Report ---"));
		console.log(lines.join("\n"));
	}

	if (fail > 0) process.exit(1);
}

/**
 * Installed-metadata + portable-registry health. Read-only: surfaces the metadata
 * source, schema, installed version, and user-modified count, and reports a corrupt
 * canonical metadata.json as a clear FAIL rather than silently treating it as absent.
 * "Pending delete" needs a release manifest to compare against; doctor has none on
 * disk, so it is reported as n/a rather than fabricated.
 */
function checkInstalledMetadata(root: string | null): DiagResult {
	if (!root) {
		return { status: "warn", name: "Installed metadata", detail: "Project root not found; skipped metadata health check." };
	}
	try {
		const { source, meta } = readInstallMetadata(path.join(root, ".claude"));
		if (source === "none" || !meta) {
			return {
				status: "warn",
				name: "Installed metadata",
				detail: "No installed metadata found. Run `mewkit upgrade` to write canonical metadata.",
			};
		}
		const userModified = meta.files.filter((f) => f.owner === "meowkit-modified").length;
		const schema = source === "new" ? meta.schemaVersion : "n/a (legacy)";
		return {
			status: source === "new" ? "pass" : "warn",
			name: "Installed metadata",
			detail:
				`source=${source}, schema=${schema}, version=${meta.version || "unknown"}, ` +
				`user-modified=${userModified}, pending-delete=n/a (run upgrade)`,
		};
	} catch (err) {
		if (err instanceof CorruptInstallMetadataError) {
			return {
				status: "fail",
				name: "Installed metadata",
				detail: `Canonical metadata.json is corrupt: ${err.detail}`,
				fix: "Re-run `mewkit upgrade` to regenerate .claude/metadata.json.",
			};
		}
		throw err;
	}
}

async function checkMetadataHealth(root: string | null): Promise<DiagResult[]> {
	const results: DiagResult[] = [checkInstalledMetadata(root)];

	// The portable registry is global (~/.mewkit/), not per-project, so it is
	// checked regardless of whether a project root was found.
	try {
		const registry = await readPortableRegistry();
		results.push({
			status: "pass",
			name: "Portable registry",
			detail: `schema ${registry.version}, ${registry.installations.length} installation(s).`,
		});
	} catch (err) {
		results.push({
			status: "warn",
			name: "Portable registry",
			detail: `Could not read portable registry: ${(err as Error).message}`,
		});
	}

	return results;
}

function checkStateTaxonomy(root: string | null): DiagResult[] {
	if (!root) {
		return [{ status: "warn", name: "State taxonomy", detail: "Project root not found; skipped state path checks." }];
	}
	const results: DiagResult[] = [
		{
			status: fs.existsSync(path.join(root, "session-state")) ? "pass" : "warn",
			name: "Runtime state directory",
			detail: "Ephemeral runtime files use project-root session-state/.",
		},
		{
			status: fs.existsSync(path.join(root, ".claude", "session-state")) ? "warn" : "pass",
			name: "Legacy Claude session state",
			detail: ".claude/session-state/ is legacy; prefer project-root session-state/ for runtime state.",
		},
		{
			status: fs.existsSync(path.join(root, "tasks", "autobuild-runs")) ? "pass" : "warn",
			name: "Autobuild run ledger",
			detail: "Autobuild audit events belong under tasks/autobuild-runs/.",
		},
	];
	return results;
}
