import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { checkDocsReferences } from "../core/check-docs-references.js";
import { collectProviderContractDiagnostics } from "../migrate/provider-contract-diagnostics.js";
import { isHookScript } from "../core/is-hook-script.js";
import { checkWorkflowDrift } from "../core/check-workflow-drift.js";
import { checkGateAuthority, checkCommandDrift } from "../core/check-gate-authority.js";
import { assertOperationsNotInvocable } from "../core/provider-operations.js";
import {
	findOperationConformance,
	isBlockingGap,
	summarizeOperationConformance,
} from "../core/check-operation-conformance.js";
import { findPseudoCapabilities } from "../core/check-pseudo-capabilities.js";
import { findGenericCoreTokens, summarizeGenericCoreTokens } from "../core/check-generic-core-tokens.js";
import { checkStaleIndex } from "../core/check-stale-index.js";
import { checkPluginParity } from "../core/check-plugin-parity.js";
import { checkOwnership } from "../core/build-inventory.js";
import { checkAgentConformance } from "../core/check-agent-conformance.js";
import { checkSubstrate } from "../core/substrate.js";
import { checkPacks } from "../core/check-packs.js";
import { checkPlugin, checkPluginNamespace, checkPluginManifests } from "../core/check-plugin-manifests.js";
import { validateCapabilities } from "../core/validate-capabilities.js";
import { buildCapabilities } from "../core/build-capabilities.js";
import { capabilityViewDrift } from "../core/generate-capability-view.js";
import { parseMergedSections } from "../migrate/config-merger/merge-single-sections.js";
import { discoverSkills } from "../migrate/discovery/index.js";
import { buildPortableSkillsByProvider } from "../migrate/portability-policy.js";
import { getTargetProfile, targetProfileNames } from "../validate/targets/target-profile.js";
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
	| "Substrate"
	| "Inventory"
	| "Packs"
	| "Plugin"
	| "Rules"
	| "Gates"
	| "Capabilities"
	| "Agents"
	| "Target";

export interface CheckResult {
	name: string;
	status: Status;
	detail: string;
	section: Section;
}

/**
 * Consumer profile for a validate run.
 * - `authoring`: the MeowKit source checkout. Gets the full authoring-coherence
 *   suite (workflow drift, ownership/substrate completeness, pack-manifest
 *   coherence, routing-table breadth, plugin manifests) alongside consumer checks.
 * - `flat-copy`: a project that installed `.claude/` by copy. Gets only
 *   consumer-actionable checks; authoring-coherence checks are suppressed because a
 *   consumer legitimately customizes `CLAUDE.md`/`rules` (tripping workflow-drift and
 *   routing-breadth) and has no `plugin/` build output (plugin-manifest N/A), so those
 *   checks would surface as false failures in a healthy consumer install.
 * Provider projection/plugin payloads are validated by adapter-specific paths
 * (e.g. `--portable`, `--plugin`), not by guessing a third mode here.
 */
export type ValidateMode = "authoring" | "flat-copy";

interface ValidateOptions {
	portable?: boolean;
	strict?: boolean;
	/** Explicit mode override. When absent, mode is auto-detected from the project. */
	mode?: ValidateMode;
	/** Scope the run to the workflow drift-check only (used by the CI step). */
	workflow?: boolean;
	/** Scope the run to the gate-authority contract check only (used by CI). */
	gates?: boolean;
	/** Scope the run to the canonical↔plugin parity check only (used by CI). */
	parity?: boolean;
	/** Scope the run to the ownership-completeness check only (used by CI). */
	ownership?: boolean;
	/** Scope the run to the responsibility-substrate check only (used by CI). */
	substrate?: boolean;
	/** Scope the run to the pack-manifest coherence check only (used by CI). */
	packs?: boolean;
	/** Scope the run to the routing-table-breadth WARN check only. */
	rules?: boolean;
	/** Scope the run to the plugin namespace + manifest guards only (used by CI). */
	plugin?: boolean;
	/** Scope the run to the capability-manifest coherence check only (CI-adoptable). */
	capabilities?: boolean;
	/** Scope the run to the declared agent-contract conformance check. */
	agents?: boolean;
	/** Validate a GENERATED provider target instead of a `.claude/` project: the provider key
	 * (e.g. "codex"). Requires `targetDir`. Mutually exclusive with `--portable`. */
	target?: string;
	/** The generated target directory to validate (with `--target`). */
	targetDir?: string;
}

const ok = (cond: boolean): Status => (cond ? "pass" : "fail");

/**
 * Deterministically detect the validate mode from the project layout. The MeowKit
 * source checkout ships the CLI TypeScript source (`packages/mewkit/src`) beside its
 * `.claude/`; a consumer flat-copy install has `.claude/` but no CLI source tree.
 * That single filesystem signal is the discriminator. An explicit `--mode` overrides it.
 */
export function detectValidateMode(projectRoot: string): ValidateMode {
	const cliSource = path.join(projectRoot, "packages", "mewkit", "src");
	return fs.existsSync(cliSource) ? "authoring" : "flat-copy";
}

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
		results.push({
			name: "Hooks present",
			status: "fail",
			detail: "No hook scripts found in hooks/",
			section: "Hooks",
		});
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
		return [
			{ name: "Docs-reference contract present", status: "fail", detail: `Missing: ${contractPath}`, section: "Docs" },
		];
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
		return [
			{
				name: "Docs references on Type-1 allowlist",
				status: "fail",
				detail: `Validator crashed: ${message}`,
				section: "Docs",
			},
		];
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

/**
 * Operation-level conformance for the capability adapter.
 *
 * Two properties, both cheap and both load-bearing:
 *  1. No logical operation leaked into the frontmatter-reachable invocation enum.
 *     That enum's entire value is what it excludes, so erosion is silent and fatal.
 *  2. No unresolved pseudo-capability aliases in the canonical tree. `build-plugin`
 *     already refuses to ship one; surfacing it here means an author sees it at
 *     `validate` time instead of at release time.
 */
function checkOperationConformance(meowkitDir: string): CheckResult[] {
	const results: CheckResult[] = [];

	const leaks = assertOperationsNotInvocable();
	results.push({
		name: "Logical operations stay out of the invocation enum",
		status: leaks.length === 0 ? "pass" : "fail",
		detail:
			leaks.length === 0
				? "run_shell / delegate_agent / ask_user / manage_plan are not frontmatter-reachable"
				: leaks.join("\n         "),
		section: "Portability",
	});

	const pseudo = findPseudoCapabilities(meowkitDir);
	results.push({
		name: "No unresolved pseudo-capability aliases",
		status: pseudo.length === 0 ? "pass" : "fail",
		detail:
			pseudo.length === 0
				? "0 unsubstituted operation placeholders in prose"
				: pseudo.map((f) => `${f.file}:${f.line} "${f.found}"`).join("\n         "),
		section: "Portability",
	});

	// Every operation an installed skill references (via its declared host tools) must
	// resolve on each advertised provider. Disclosed local-fallbacks are fine; an
	// `unsupported`/`unknown` combo is a real cross-harness gap and must be surfaced,
	// not silently advertised.
	const conformance = findOperationConformance(meowkitDir);
	const blocking = conformance.filter(isBlockingGap);
	const example = blocking
		.slice(0, 5)
		.map((f) => `${f.skill}: ${f.operation} is ${f.support} on ${f.provider}`)
		.join("\n         ");
	results.push({
		name: "Installed-skill operations resolve on every advertised provider",
		status: blocking.length === 0 ? "pass" : "warn",
		detail:
			conformance.length === 0
				? "every operation referenced by an installed skill is supported on all advertised providers"
				: `${conformance.length} non-supported combo(s) [${summarizeOperationConformance(conformance)}]; ` +
					`${blocking.length} are unsupported/unknown (rest are disclosed local-fallbacks)` +
					(blocking.length > 0 ? `:\n         ${example}` : ""),
		section: "Portability",
	});

	return results;
}

/** Advisory baseline while skill bodies are migrated to semantic capability prose. */
export function checkGenericCoreTokens(meowkitDir: string): CheckResult {
	const findings = findGenericCoreTokens(meowkitDir);
	const locations = findings
		.slice(0, 8)
		.map((finding) => `${finding.file}:${finding.line} "${finding.token}"`)
		.join("\n         ");
	return {
		name: "Generic-core provider token baseline",
		status: findings.length === 0 ? "pass" : "warn",
		detail:
			findings.length === 0
				? "0 provider-specific body tokens"
				: `${findings.length} finding(s); ${summarizeGenericCoreTokens(findings)}.\n         ${locations}`,
		section: "Portability",
	};
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
		detail:
			expected === 0
				? `${detail} — no portable source items expected.`
				: `${detail}: expected ${expected}, found ${actual}.`,
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
	const agentsMdPath = path.join(projectRoot, "AGENTS.md");
	if (fs.existsSync(sourceRulesDir) && fs.existsSync(agentsMdPath)) {
		// Markdown rules merge into AGENTS.md as managed "## Rule:" sections;
		// native prefix_rule() policies are the only content for .codex/rules.
		const agentsMd = fs.readFileSync(agentsMdPath, "utf-8");
		const mergedRuleSections = parseMergedSections(agentsMd).sections.filter((s) => s.kind === "rule").length;
		results.push({
			name: "Codex projection: rules merged into AGENTS.md",
			status: ok(mergedRuleSections > 0),
			detail: `${mergedRuleSections} managed rule section(s) found in AGENTS.md`,
			section: "Portability",
		});
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

/**
 * Capability-manifest coherence as validate CheckResults (authoring only). An ERROR-level
 * capability issue (broken cross-ref, containment, uniqueness, unknown invocation id, or a
 * dependency cycle) fails the section; WARN-level (coverage, duplicate intent, dangling dep,
 * dead overlay key) is advisory. A clean manifest reports a single PASS.
 */
export function checkCapabilitiesSection(meowkitDir: string): CheckResult[] {
	const issues = validateCapabilities(meowkitDir);
	if (issues.length === 0) {
		return [
			{
				name: "Capability manifest coherent",
				status: "pass",
				detail: "No cross-ref, containment, uniqueness, or cycle issues.",
				section: "Capabilities",
			},
		];
	}
	return issues.map((i) => ({
		name: `Capability ${i.level}: ${i.capabilityId ?? "-"}`,
		status: i.level === "error" ? "fail" : "warn",
		detail: i.message,
		section: "Capabilities",
	}));
}

/**
 * Generated-view drift (Phase 7, authoring only): the capabilities table in
 * docs/architecture/trigger-registry.md is GENERATED from the registry, so a spliced region must
 * not become a second editable truth. Honest states: doc absent or region not yet spliced → N/A
 * (no false failure); region matches a fresh render → PASS; region diverged → FAIL (regenerate).
 */
export function checkCapabilityViewDrift(meowkitDir: string, projectRoot: string): CheckResult[] {
	const docPath = path.join(projectRoot, "docs", "architecture", "trigger-registry.md");
	if (!fs.existsSync(docPath)) {
		return [
			{
				name: "Capability view drift",
				status: "na",
				detail: "docs/architecture/trigger-registry.md not present (authoring-only doc).",
				section: "Capabilities",
			},
		];
	}
	const state = capabilityViewDrift(fs.readFileSync(docPath, "utf-8"), buildCapabilities(meowkitDir));
	if (state === "absent-markers") {
		return [
			{
				name: "Capability view drift",
				status: "na",
				detail: "Generated region not spliced into the doc yet (GENERATED:capabilities markers absent).",
				section: "Capabilities",
			},
		];
	}
	if (state === "in-sync") {
		return [
			{
				name: "Capability view drift",
				status: "pass",
				detail: "Generated capabilities table matches the registry.",
				section: "Capabilities",
			},
		];
	}
	return [
		{
			name: "Capability view drift",
			status: "fail",
			detail:
				"Generated capabilities region has DRIFTED from the registry — regenerate + re-splice (do not hand-edit the region).",
			section: "Capabilities",
		},
	];
}

/**
 * Assemble the default-run checks for a given mode. Consumer-actionable checks run in
 * both modes; authoring-coherence checks run only in `authoring` mode — in a flat-copy
 * consumer they would be false failures (consumer customization of CLAUDE.md/rules trips
 * drift + routing-breadth; no `plugin/` build makes plugin manifests N/A). Pure and
 * side-effect-free so it can be tested directly against a fixture.
 */
export async function buildDefaultChecks(
	meowkitDir: string,
	projectRoot: string,
	mode: ValidateMode,
	portable: boolean,
): Promise<CheckResult[]> {
	// Consumer-actionable checks — a flat-copy install must still have present dirs, a
	// valid config, executable hooks, and docs references that resolve in its own `.claude/`.
	const results: CheckResult[] = [
		checkDirExists(meowkitDir, "agents"),
		checkDirExists(meowkitDir, "hooks"),
		checkFileExists(projectRoot, "CLAUDE.md", "Structure"),
		checkConfigJson(meowkitDir),
		...checkHooksExecutable(meowkitDir),
		...checkDocsRefsContract(meowkitDir),
		// Namespace purity is cheap and consumer-relevant (a leaked double-prefix would
		// misbehave in the consumer too), so it runs in both modes.
		...checkPluginNamespace(meowkitDir),
	];

	if (mode === "authoring") {
		results.push(
			// Advisory in the default run: a wholly-absent governance file WARNs
			// (prompt `mewkit upgrade`) rather than failing an un-synced install.
			// The scoped `--workflow`/`--ownership`/`--packs` paths stay strict for CI.
			...checkWorkflowDrift(projectRoot, { missingSpecSeverity: "warn" }),
			// Gate-authority stays strict even in the default run: an un-synced
			// install cannot explain a file that grants automated gate approval.
			...checkGateAuthority(projectRoot),
			...checkCommandDrift(projectRoot),
			...checkOperationConformance(meowkitDir),
			checkGenericCoreTokens(meowkitDir),
			// Declared doc counts vs the real inventory. `mewkit inventory --check`
			// owns the same check for the CI step; surfacing it here means an author
			// sees a stale README at validate time instead of at CI time. Counts are
			// derived from buildInventory, so this can only drift when a doc lies.
			...checkStaleIndex(projectRoot),
			...checkOwnership(meowkitDir, { missingInfraSeverity: "warn" }),
			...checkAgentConformance(projectRoot),
			...checkSubstrate(meowkitDir, { missingViewSeverity: "warn" }),
			...checkPacks(meowkitDir, { missingInfraSeverity: "warn" }),
			// Manifest contract is N/A until `mewkit build-plugin` has run.
			...checkPluginManifests(projectRoot),
			...checkRoutingTableBreadth(meowkitDir),
			...checkCapabilitiesSection(meowkitDir),
			...checkCapabilityViewDrift(meowkitDir, projectRoot),
		);
	}

	if (portable) {
		results.push(...checkPortability());
		results.push(...(await checkCodexProjection(projectRoot)));
	}

	return results;
}

export async function validate(args: ValidateOptions = {}): Promise<void> {
	// `--target <provider> <dir>`: validate a GENERATED provider project (no `.claude/`), so this
	// path bypasses the .claude/ requirement below. Mutually exclusive with `--portable`.
	if (args.target) {
		if (args.portable) {
			console.error(pc.red("`--target` and `--portable` are mutually exclusive."));
			process.exit(2);
		}
		const profile = getTargetProfile(args.target);
		if (!profile) {
			console.error(pc.red(`Unknown --target "${args.target}". Known targets: ${targetProfileNames().join(", ")}.`));
			process.exit(2);
		}
		const dir = path.resolve(args.targetDir ?? process.cwd());
		console.log(pc.bold(pc.cyan(`Validating ${profile.name} target: ${dir}`)));
		console.log();
		if (!profile.detect(dir)) {
			console.log(pc.red(`Not a ${profile.name} target (no generated ${profile.name} layout found at ${dir}).`));
			process.exit(1);
		}
		const targetResults = await profile.check(dir);
		renderResultsAndExit(targetResults, args.strict ?? false);
		return;
	}

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
	} else if (args.gates) {
		results = [...checkGateAuthority(projectRoot), ...checkCommandDrift(projectRoot)];
	} else if (args.parity) {
		results = checkPluginParity(projectRoot);
	} else if (args.ownership) {
		results = checkOwnership(meowkitDir);
	} else if (args.substrate) {
		results = checkSubstrate(meowkitDir);
	} else if (args.packs) {
		results = checkPacks(meowkitDir);
	} else if (args.rules) {
		results = checkRoutingTableBreadth(meowkitDir);
	} else if (args.plugin) {
		results = checkPlugin(meowkitDir, projectRoot);
	} else if (args.capabilities) {
		results = checkCapabilitiesSection(meowkitDir);
	} else if (args.agents) {
		results = checkAgentConformance(projectRoot);
	} else {
		const mode = args.mode ?? detectValidateMode(projectRoot);
		console.log(
			`${pc.dim("Mode:")} ${mode}${args.mode ? " (override)" : " (auto-detected)"} — ${
				mode === "flat-copy"
					? "consumer checks only; authoring-coherence checks suppressed"
					: "full authoring-coherence suite"
			}`,
		);
		console.log();
		results = await buildDefaultChecks(meowkitDir, projectRoot, mode, args.portable ?? false);
	}

	renderResultsAndExit(results, args.strict ?? false);
}

/**
 * Print CheckResults grouped by section, print the pass/warn/na/fail summary, and exit(1) on any
 * FAIL (or any WARN under --strict). Shared by the default `.claude/` flow and the `--target` flow.
 */
function renderResultsAndExit(results: CheckResult[], strict: boolean): void {
	// Exhaustiveness guard: this map MUST list every `Section` union member, or a check's results
	// compute but never render. The mapped type fails to compile if a member is missing, keeping
	// the union + this array in sync. ("Inventory" is produced only by `inventory --check`.)
	const SECTION_ORDER: { [K in Section]: true } = {
		Structure: true,
		Hooks: true,
		Portability: true,
		Docs: true,
		Workflow: true,
		Gates: true,
		Ownership: true,
		Substrate: true,
		Packs: true,
		Plugin: true,
		Inventory: true,
		Rules: true,
		Capabilities: true,
		Agents: true,
		Target: true,
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
	if (fail > 0 || (strict && warn > 0)) {
		process.exit(1);
	}
}
