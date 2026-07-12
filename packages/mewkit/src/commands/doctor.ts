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
import { getConsolidationLedger, type ConsolidationStatus } from "../core/consolidation-ledger.js";

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
	provenance?: boolean;
	explain?: boolean;
	consolidation?: boolean;
}): Promise<void> {
	if (args?.provenance) {
		explainProvenance(findProjectRoot(), args.explain ?? false);
		return;
	}

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

	if (args?.consolidation) {
		results.push(...checkConsolidation());
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

/** A file's provenance verifiability, decided only from locally available evidence. */
type ProvenanceClass = "verified" | "known-modified" | "unknown";

/**
 * Classify one installed entry's provenance from metadata alone (no fetching).
 * `trustedBaseline` is true only when the `baseChecksum` is a real as-shipped hash
 * (canonical `new` metadata). Legacy sources reconstruct `baseChecksum` from the disk
 * itself, so a `checksum === baseChecksum` match proves nothing about what shipped —
 * such kit files are `unknown`, never `verified`.
 */
export function classifyProvenance(
	entry: { owner: string; checksum: string; baseChecksum: string },
	trustedBaseline: boolean,
): ProvenanceClass {
	// No as-shipped baseline recorded ⇒ we cannot prove what shipped.
	if (!entry.baseChecksum) return "unknown";
	if (entry.owner === "user") return "verified"; // user-owned by design, not a kit claim
	if (entry.owner === "meowkit-modified") return "known-modified";
	// Kit-owned pristine match is provable ONLY against a trusted (release-sourced)
	// baseline; a disk-reconstructed legacy baseline cannot attest as-shipped identity.
	if (entry.checksum !== entry.baseChecksum) return "known-modified";
	return trustedBaseline ? "verified" : "unknown";
}

/**
 * Read-only `doctor provenance --explain`. Reports what provenance can and cannot be
 * proven from locally available evidence, in three honest classes: verified (as-shipped
 * identity provable), known-modified (diverged from a KNOWN baseline), and unknown (no
 * baseline recorded). It NEVER fetches a release, and it proposes a repair only when an
 * exact trusted payload is locally available — doctor has none on disk, so it proposes
 * none and says so, rather than relabeling or reconstructing silently.
 */
export function explainProvenance(root: string | null, explain: boolean): void {
	console.log(pc.bold(pc.cyan("MeowKit Provenance")));
	console.log(pc.dim("Read-only: reports what can and cannot be proven locally. No fetch, no relabel.\n"));

	if (!root) {
		console.log(pc.yellow("  Project root not found — nothing to explain."));
		return;
	}

	let source: string;
	let files: Array<{ path: string; owner: string; checksum: string; baseChecksum: string }>;
	try {
		const result = readInstallMetadata(path.join(root, ".claude"));
		if (result.source === "none" || !result.meta) {
			console.log(pc.yellow("  No installed metadata found — provenance cannot be established."));
			console.log(pc.dim("  Run `mewkit upgrade` to write canonical metadata, then re-run this command."));
			return;
		}
		source = result.source;
		files = result.meta.files;
	} catch (err) {
		if (err instanceof CorruptInstallMetadataError) {
			console.log(pc.red(`  Canonical metadata.json is corrupt: ${err.detail}`));
			console.log(pc.dim("  Provenance is unprovable until it is regenerated (`mewkit upgrade`)."));
			return;
		}
		throw err;
	}

	// Only canonical `new` metadata carries a trusted as-shipped baseline. Legacy
	// sources reconstruct baselines from disk, so their "matches" prove nothing.
	const trustedBaseline = source === "new";
	const buckets: Record<ProvenanceClass, string[]> = { verified: [], "known-modified": [], unknown: [] };
	for (const f of files) buckets[classifyProvenance(f, trustedBaseline)].push(f.path);

	console.log(`  ${pc.dim("Metadata source:")} ${source}`);
	if (!trustedBaseline) {
		console.log(
			pc.yellow(
				`  Baseline is reconstructed from disk (source=${source}), not a trusted release payload —\n` +
					"  as-shipped identity is NOT provable for these files. Run `mewkit upgrade` to write\n" +
					"  canonical metadata with real baselines.",
			),
		);
	}
	if (files.length === 0) {
		console.log(pc.red("  No file-level provenance recorded — nothing can be proven. Run `mewkit upgrade`."));
		return;
	}
	console.log(`  ${pc.green("verified")}       ${buckets.verified.length} — as-shipped identity provable`);
	console.log(`  ${pc.yellow("known-modified")} ${buckets["known-modified"].length} — diverged from a known baseline`);
	console.log(`  ${pc.red("unknown")}        ${buckets.unknown.length} — as-shipped identity not provable\n`);

	if (explain) {
		const sample = (paths: string[]): string =>
			paths.length === 0 ? "(none)" : paths.slice(0, 10).join(", ") + (paths.length > 10 ? `, …(+${paths.length - 10})` : "");
		console.log(`  ${pc.yellow("known-modified")}: ${sample(buckets["known-modified"])}`);
		console.log(`  ${pc.red("unknown")}: ${sample(buckets.unknown)}\n`);
	}

	// Repair proposal is gated on a locally-available trusted payload. doctor never
	// downloads a release, so it cannot repair here — it says so instead of guessing.
	const repairable = buckets["known-modified"].length + buckets.unknown.length;
	if (repairable === 0) {
		console.log(pc.green("  All tracked files have provable provenance. No repair needed."));
	} else {
		console.log(
			pc.dim(
				`  ${repairable} file(s) are modified or lack a baseline. No repair is proposed here: doctor has no\n` +
					"  trusted release payload on disk. Exact historical repair requires the matching release\n" +
					"  payload and a separately-approved repair flow — it is never reconstructed silently.",
			),
		);
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

/**
 * Phase-7 consolidation ledger surfacing. Reports each candidate's deprecation/experimental/
 * authoring-only status HONESTLY: the status label is NOT a runtime-availability claim (a
 * deprecated or authoring-only artifact may be fully functional at runtime). Every candidate is
 * `deletionThisPhase:false`, so nothing here is a failure — statuses map to pass/na/warn, never
 * fail. The `detail` always names the outstanding gates so a reader sees WHY nothing is removed.
 */
function checkConsolidation(): DiagResult[] {
	const statusToDiag: Record<ConsolidationStatus, Status> = {
		canonical: "pass",
		"keep-legacy": "pass",
		"authoring-only": "na",
		experimental: "na",
		deprecated: "warn",
		undecided: "na",
	};
	return getConsolidationLedger().map((c) => ({
		status: statusToDiag[c.status],
		name: `Consolidation: ${c.id} [${c.status}]`,
		// Honest: status is a classification, not a runtime-availability verdict. Gates say why it stays.
		detail: `${c.purpose} — status is a classification, not a runtime-availability claim; not removed this phase. Gates: ${c.remainingGates.join("; ")}`,
	}));
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
