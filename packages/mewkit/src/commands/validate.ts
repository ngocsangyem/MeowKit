import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { checkDocsReferences } from "../core/check-docs-references.js";
import { collectProviderContractDiagnostics } from "../migrate/provider-contract-diagnostics.js";
import { isHookScript } from "../core/is-hook-script.js";
import { checkWorkflowDrift } from "../core/check-workflow-drift.js";
import { checkOwnership } from "../core/build-inventory.js";
import { checkPacks } from "../core/check-packs.js";
import { analyzeCodexRuleSource } from "../migrate/converters/index.js";
import { discoverRules, discoverSkills } from "../migrate/discovery/index.js";
import { buildPortableSkillsByProvider } from "../migrate/portability-policy.js";
import type { Status } from "./doctor-checks.js";

// validate reports STRUCTURE & WIRING only — that gate files exist and are wired, not that
// they actually block. Behavioral proof is `doctor --hard-gates`. Statuses are honest:
// PASS / WARN / N/A / FAIL. WARN and N/A do not fail the build unless --strict is passed.

export type Section =
	| "Structure"
	| "Hooks"
	| "Portability"
	| "Docs"
	| "Workflow"
	| "Ownership"
	| "Inventory"
	| "Packs"
	| "Rules";

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
	/** Scope the run to the pack-manifest coherence check only (used by CI). */
	packs?: boolean;
	/** Scope the run to the routing-table-breadth WARN check only. */
	rules?: boolean;
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

function countFiles(dir: string, predicate: (name: string, fullPath: string) => boolean): number {
	if (!fs.existsSync(dir)) return 0;
	let count = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			count += countFiles(fullPath, predicate);
		} else if (entry.isFile() && predicate(entry.name, fullPath)) {
			count += 1;
		}
	}
	return count;
}

function countSkillDirs(dir: string): number {
	if (!fs.existsSync(dir)) return 0;
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && fs.existsSync(path.join(dir, entry.name, "SKILL.md"))).length;
}

function projectionCountResult(name: string, expected: number, actual: number, detail: string): CheckResult {
	return {
		name,
		status: expected === 0 || actual >= expected ? "pass" : "fail",
		detail: expected === 0 ? `${detail} — no portable source items expected.` : `${detail}: expected ${expected}, found ${actual}.`,
		section: "Portability",
	};
}

export async function checkCodexProjection(projectRoot: string): Promise<CheckResult[]> {
	const codexDir = path.join(projectRoot, ".codex");
	const skillsDir = path.join(projectRoot, ".agents", "skills");
	if (!fs.existsSync(codexDir) && !fs.existsSync(skillsDir)) return [];

	const results: CheckResult[] = [
		{
			name: "Codex projection: AGENTS.md",
			status: ok(fs.existsSync(path.join(projectRoot, "AGENTS.md"))),
			detail: "Codex project instructions file",
			section: "Portability",
		},
		{
			name: "Codex projection: unsupported command dirs absent",
			status: ok(!fs.existsSync(path.join(codexDir, "commands")) && !fs.existsSync(path.join(codexDir, "prompts"))),
			detail: "Codex custom command directories are not documented; migration must not emit them.",
			section: "Portability",
		},
	];

	const sourceRulesDir = path.join(projectRoot, ".claude", "rules");
	if (fs.existsSync(sourceRulesDir)) {
		const sourceRules = await discoverRules(sourceRulesDir);
		const expectedRules = sourceRules.filter((rule) => analyzeCodexRuleSource(rule).kind !== "unsupported").length;
		const actualRules = countFiles(path.join(codexDir, "rules"), (name) => name.endsWith(".rules"));
		results.push(
			projectionCountResult(
				"Codex projection: command-policy rules",
				expectedRules,
				actualRules,
				"Translated source rules with Codex-compatible command policies",
			),
		);
	}

	const sourceSkillsDir = path.join(projectRoot, ".claude", "skills");
	if (fs.existsSync(sourceSkillsDir)) {
		const sourceSkills = await discoverSkills(sourceSkillsDir);
		const portableSkills = await buildPortableSkillsByProvider(sourceSkills, ["codex"]);
		const expectedSkills = portableSkills.skillsByProvider.get("codex")?.length ?? 0;
		const actualSkills = countSkillDirs(skillsDir);
		results.push(
			projectionCountResult(
				"Codex projection: portable skills",
				expectedSkills,
				actualSkills,
				"Runtime-compatible source skill folders",
			),
		);
	}

	return results;
}

// Files exempt from the routing-breadth check: tables that look like routing tables
// by row count but are workflow/contract tables, not intent→skill dispatch. Keyed by
// rules-relative basename. The routing-header heuristic already excludes most; this
// allowlist is belt-and-suspenders for tables that drift toward routing vocabulary.
const ROUTING_BREADTH_ALLOWLIST = new Set<string>(["phase-contracts.md"]);

/** A header cell (trimmed, lowercased) that marks a table as intent→skill routing. */
const ROUTING_HEADER_CELLS = new Set<string>(["intent", "use", "user wants", "user intent"]);

function parsePipeCells(line: string): string[] {
	return line
		.replace(/^\s*\|/, "")
		.replace(/\|\s*$/, "")
		.split("|")
		.map((c) => c.trim());
}

function isTableSeparatorRow(line: string): boolean {
	return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
}

/** Parse the inventory artifacts map once (criticality lookup); empty map on any error. */
function loadInventoryArtifacts(meowkitDir: string): Record<string, { criticality?: string }> {
	const inventoryPath = path.join(meowkitDir, "harness-inventory.json");
	if (!fs.existsSync(inventoryPath)) return {};
	try {
		const inv = JSON.parse(fs.readFileSync(inventoryPath, "utf-8")) as {
			artifacts?: Record<string, { criticality?: string }>;
		};
		return inv.artifacts ?? {};
	} catch {
		return {};
	}
}

/**
 * WARN (never FAIL) when an always-loaded rule file carries a broad intent→skill
 * routing table. Such tables are skill-dispatch guidance — they belong in a skill
 * reference loaded on demand, not in always-on `.claude/rules/` context. Heuristic
 * (all must hold): the table's header row names a routing column (Intent/Use/User
 * wants), it has ≥8 data rows referencing `mk:` skills, the file's inventory
 * criticality is not `critical`, and it is not on the allowlist.
 */
export function checkRoutingTableBreadth(meowkitDir: string): CheckResult[] {
	const rulesDir = path.join(meowkitDir, "rules");
	const results: CheckResult[] = [];
	if (!fs.existsSync(rulesDir)) return results;

	const artifacts = loadInventoryArtifacts(meowkitDir);
	const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
	for (const file of files) {
		if (ROUTING_BREADTH_ALLOWLIST.has(file)) continue;
		const criticality = artifacts[`rules/${file}`]?.criticality ?? null;
		if (criticality === "critical") continue;

		const body = fs.readFileSync(path.join(rulesDir, file), "utf-8");
		const lines = body.split("\n");
		let inTable = false;
		let headerIsRouting = false;
		let mkRows = 0;
		let flagged = false;

		const finishTable = (): void => {
			if (headerIsRouting && mkRows >= 8) flagged = true;
			inTable = false;
			headerIsRouting = false;
			mkRows = 0;
		};

		for (const raw of lines) {
			const line = raw;
			const isPipeRow = /^\s*\|/.test(line);
			if (!isPipeRow) {
				if (inTable) finishTable();
				continue;
			}
			if (!inTable) {
				// First pipe row of a table = header row.
				inTable = true;
				const cells = parsePipeCells(line).map((c) => c.toLowerCase());
				headerIsRouting = cells.some((c) => ROUTING_HEADER_CELLS.has(c));
				continue;
			}
			if (isTableSeparatorRow(line)) continue;
			// Data row.
			if (/\bmk:[a-z][a-z-]*/.test(line)) mkRows += 1;
		}
		if (inTable) finishTable();

		if (flagged) {
			results.push({
				name: `Routing-table breadth: rules/${file}`,
				status: "warn",
				detail: `An intent→skill routing table (≥8 mk: rows) lives in always-loaded rules/${file}. Move skill-dispatch tables into a skill reference loaded on demand (see agent-detector references/skill-domain-routing.md).`,
				section: "Rules",
			});
		}
	}

	if (results.length === 0) {
		results.push({
			name: "Routing-table breadth",
			status: "pass",
			detail: "No broad intent→skill routing tables found in always-loaded rules/.",
			section: "Rules",
		});
	}
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
	} else if (args.packs) {
		results = checkPacks(meowkitDir);
	} else if (args.rules) {
		results = checkRoutingTableBreadth(meowkitDir);
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
			// The scoped `--workflow`/`--ownership`/`--packs` paths above stay strict for CI.
			...checkWorkflowDrift(projectRoot, { missingSpecSeverity: "warn" }),
			...checkOwnership(meowkitDir, { missingInfraSeverity: "warn" }),
			...checkPacks(meowkitDir, { missingInfraSeverity: "warn" }),
			...checkRoutingTableBreadth(meowkitDir),
		];
		if (args.portable) {
			results.push(...checkPortability());
			results.push(...(await checkCodexProjection(projectRoot)));
		}
	}

	// Exhaustiveness guard: the printed `sections` array MUST list every `Section`
	// union member, or a check's results compute but never render. The mapped type
	// fails to compile if a member is missing here, keeping union + array in sync.
	// ("Inventory" is produced only by `inventory --check`, listed for completeness.)
	const SECTION_ORDER: { [K in Section]: true } = {
		Structure: true,
		Hooks: true,
		Portability: true,
		Docs: true,
		Workflow: true,
		Ownership: true,
		Packs: true,
		Inventory: true,
		Rules: true,
	};
	const sections = Object.keys(SECTION_ORDER) as Section[];
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
