import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { checkDocsReferences } from "../core/check-docs-references.js";
import { collectProviderContractDiagnostics } from "../migrate/provider-contract-diagnostics.js";
import { isHookScript } from "../core/is-hook-script.js";
import { checkWorkflowDrift } from "../core/check-workflow-drift.js";
import { checkOwnership } from "../core/build-inventory.js";
import type { Status } from "./doctor-checks.js";

// validate reports STRUCTURE & WIRING only — that gate files exist and are wired, not that
// they actually block. Behavioral proof is `doctor --hard-gates`. Statuses are honest:
// PASS / WARN / N/A / FAIL. WARN and N/A do not fail the build unless --strict is passed.

export type Section = "Structure" | "Hooks" | "Portability" | "Docs" | "Workflow" | "Ownership" | "Inventory";

export interface CheckResult {
	name: string;
	status: Status;
	detail: string;
	section: Section;
}

interface ValidateOptions {
	portable?: boolean;
	strict?: boolean;
	/** Scope the run to the workflow drift-check only (used by the CI step). */
	workflow?: boolean;
	/** Scope the run to the ownership-completeness check only (used by CI). */
	ownership?: boolean;
}

const ok = (cond: boolean): Status => (cond ? "pass" : "fail");

/** Find MeowKit .claude/ in cwd only (no walk-up). */
function findMeowkitDir(startDir: string): string | null {
	const candidate = path.join(startDir, ".claude");
	if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
		return candidate;
	}
	return null;
}

function checkFileExists(baseDir: string, relativePath: string, section: Section): CheckResult {
	const fullPath = path.join(baseDir, relativePath);
	const exists = fs.existsSync(fullPath);
	return {
		name: `File exists: ${relativePath}`,
		status: ok(exists),
		detail: exists ? fullPath : `Missing: ${fullPath}`,
		section,
	};
}

function checkDirExists(meowkitDir: string, relativePath: string): CheckResult {
	const fullPath = path.join(meowkitDir, relativePath);
	const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
	return {
		name: `Directory exists: ${relativePath}`,
		status: ok(exists),
		detail: exists ? fullPath : `Missing: ${fullPath}`,
		section: "Structure",
	};
}

export function checkHooksExecutable(meowkitDir: string): CheckResult[] {
	const hooksDir = path.join(meowkitDir, "hooks");
	const results: CheckResult[] = [];

	if (!fs.existsSync(hooksDir)) {
		results.push({ name: "Hooks directory", status: "fail", detail: `Missing: ${hooksDir}`, section: "Hooks" });
		return results;
	}

	// Only real hook scripts. Directories (lib/, handlers/, __tests__/) and sidecars
	// (HOOKS_INDEX.md, handlers.json) are NOT hooks — the old code reported them as
	// "Hook executable" because accessSync(X_OK) succeeds on a traversable directory.
	const entries = fs.readdirSync(hooksDir).filter((f) => !f.startsWith("."));
	const hookFiles = entries.filter((f) => isHookScript(path.join(hooksDir, f)));
	const skipped = entries.length - hookFiles.length;

	if (hookFiles.length === 0) {
		results.push({ name: "Hooks present", status: "fail", detail: "No hook scripts found in hooks/", section: "Hooks" });
		return results;
	}

	for (const hook of hookFiles) {
		const hookPath = path.join(hooksDir, hook);
		let executable = true;
		try {
			fs.accessSync(hookPath, fs.constants.X_OK);
		} catch {
			executable = false;
		}
		results.push({
			name: `Hook executable: ${hook}`,
			status: ok(executable),
			detail: executable ? hookPath : `Not executable: ${hookPath}`,
			section: "Hooks",
		});
	}

	if (skipped > 0) {
		results.push({
			name: "Hooks: non-script entries skipped",
			status: "pass",
			detail: `${skipped} non-script entr(ies) in hooks/ (subdirs, .md, .json) correctly excluded.`,
			section: "Hooks",
		});
	}

	return results;
}

function checkConfigJson(meowkitDir: string): CheckResult {
	const configPath = path.join(meowkitDir, "meowkit.config.json");
	if (!fs.existsSync(configPath)) {
		return { name: "Config JSON valid", status: "fail", detail: `Missing: ${configPath}`, section: "Structure" };
	}
	try {
		JSON.parse(fs.readFileSync(configPath, "utf-8"));
		return { name: "Config JSON valid", status: "pass", detail: configPath, section: "Structure" };
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return { name: "Config JSON valid", status: "fail", detail: `Invalid JSON: ${message}`, section: "Structure" };
	}
}

function checkDocsRefsContract(meowkitDir: string): CheckResult[] {
	const contractPath = path.join(meowkitDir, "rules", "docs-reference-contract.md");
	if (!fs.existsSync(contractPath)) {
		return [{ name: "Docs-reference contract present", status: "fail", detail: `Missing: ${contractPath}`, section: "Docs" }];
	}
	try {
		const { scannedFiles, findings, errorCount, warnCount } = checkDocsReferences(meowkitDir);
		const summary = `Scanned ${scannedFiles} files — ${errorCount} error(s), ${warnCount} warning(s)`;
		const status: Status = errorCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";
		const detail =
			errorCount === 0
				? summary
				: `${summary}\n         ${findings
						.filter((f) => f.level === "ERROR")
						.slice(0, 10)
						.map((f) => `${f.file}:${f.line}: ${f.token}`)
						.join("\n         ")}`;
		return [{ name: "Docs references on Type-1 allowlist", status, detail, section: "Docs" }];
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return [{ name: "Docs references on Type-1 allowlist", status: "fail", detail: `Validator crashed: ${message}`, section: "Docs" }];
	}
}

/**
 * Honest portability rendering. The old code did `if (severity === "pass") continue` (hiding
 * configured surfaces) and `passed: severity !== "fail"` (rendering WARN as green PASS, and
 * never surfacing unsupported surfaces). Now: pass→PASS, warn→WARN, fail→FAIL, and an
 * `unsupported` surface → N/A. A one-line coverage summary makes the totals explicit.
 */
/**
 * Map a provider diagnostic to an honest status. Crucially: a `warn`-severity diagnostic
 * renders WARN (the old code mapped it to PASS), and an `unsupported` surface renders N/A
 * (the old code silently dropped it).
 */
export function diagnosticToStatus(surfaceStatus: string, severity: "pass" | "warn" | "fail"): Status {
	if (surfaceStatus === "unsupported") return "na";
	if (severity === "fail") return "fail";
	if (severity === "warn") return "warn";
	return "pass";
}

function checkPortability(): CheckResult[] {
	const diagnostics = collectProviderContractDiagnostics();
	const results: CheckResult[] = [];
	let nPass = 0,
		nWarn = 0,
		nNa = 0,
		nFail = 0;

	for (const d of diagnostics) {
		const status = diagnosticToStatus(d.surfaceStatus, d.severity);
		if (status === "na") nNa++;
		else if (status === "fail") nFail++;
		else if (status === "warn") nWarn++;
		else nPass++;
		results.push({
			name: `Provider contract: ${d.providerDisplayName}/${d.surface}`,
			status,
			detail: d.message,
			section: "Portability",
		});
	}

	results.push({
		name: "Portability coverage",
		status: "pass",
		detail: `${nPass} native, ${nNa} N/A, ${nWarn} warn, ${nFail} fail across ${diagnostics.length} surface(s).`,
		section: "Portability",
	});
	return results;
}

function statusIcon(status: Status): string {
	switch (status) {
		case "pass":
			return pc.green("PASS");
		case "warn":
			return pc.yellow("WARN");
		case "na":
			return pc.dim("N/A ");
		case "fail":
			return pc.red("FAIL");
	}
}

function printResult(result: CheckResult): void {
	console.log(`  [${statusIcon(result.status)}] ${result.name}`);
	if (result.status !== "pass") {
		console.log(`         ${pc.dim(result.detail)}`);
	}
}

export async function validate(args: ValidateOptions = {}): Promise<void> {
	console.log(pc.bold(pc.cyan("Validating .claude/ project structure...")));
	console.log(
		pc.dim("Scope: structure & wiring only. Run `mewkit doctor --hard-gates` to verify the gates actually block."),
	);
	console.log();

	const meowkitDir = findMeowkitDir(process.cwd());
	if (!meowkitDir) {
		console.error(pc.red("Could not find .claude/ directory in the current directory."));
		process.exit(1);
	}

	console.log(`${pc.dim("Found:")} ${meowkitDir}`);
	console.log();

	const projectRoot = path.dirname(meowkitDir);

	// `--workflow` / `--ownership` scope the run to a single check (cheap CI
	// invocations). The default run includes both alongside the structural checks.
	let results: CheckResult[];
	if (args.workflow) {
		results = checkWorkflowDrift(projectRoot);
	} else if (args.ownership) {
		results = checkOwnership(meowkitDir);
	} else {
		results = [
			checkDirExists(meowkitDir, "agents"),
			checkDirExists(meowkitDir, "hooks"),
			checkFileExists(projectRoot, "CLAUDE.md", "Structure"),
			checkConfigJson(meowkitDir),
			...checkHooksExecutable(meowkitDir),
			...checkDocsRefsContract(meowkitDir),
			// Default run is advisory: a wholly-absent governance file WARNs
			// (prompt `mewkit upgrade`) rather than failing an un-synced install.
			// The scoped `--workflow`/`--ownership` paths above stay strict for CI.
			...checkWorkflowDrift(projectRoot, { missingSpecSeverity: "warn" }),
			...checkOwnership(meowkitDir, { missingInfraSeverity: "warn" }),
		];
		if (args.portable) {
			results.push(...checkPortability());
		}
	}

	// "Inventory" is a valid Section but is produced only by `inventory --check`
	// (stale-index), never by this validate run — listed here for render
	// completeness so any future inclusion in `results` is printed, not dropped.
	const sections: Section[] = ["Structure", "Hooks", "Portability", "Docs", "Workflow", "Ownership", "Inventory"];
	for (const section of sections) {
		const inSection = results.filter((r) => r.section === section);
		if (inSection.length === 0) continue;
		console.log(pc.bold(section));
		for (const r of inSection) printResult(r);
		console.log();
	}

	const count = (s: Status) => results.filter((r) => r.status === s).length;
	const pass = count("pass"),
		warn = count("warn"),
		na = count("na"),
		fail = count("fail");

	const parts = [pc.green(`${pass} passed`)];
	if (warn > 0) parts.push(pc.yellow(`${warn} warnings`));
	if (na > 0) parts.push(pc.dim(`${na} n/a`));
	if (fail > 0) parts.push(pc.red(`${fail} failed`));
	console.log(parts.join(", "));

	// FAIL always fails the build. WARN fails only under --strict (off by default).
	if (fail > 0 || (args.strict && warn > 0)) {
		process.exit(1);
	}
}
