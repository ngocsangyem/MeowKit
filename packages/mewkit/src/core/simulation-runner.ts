import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { scaffoldHarnessProject, hasHarness, type HarnessProject } from "./harness-scaffold.js";
import { runConfiguredHook, type HookRunResult } from "./hook-runner.js";

/**
 * Declarative scenario engine that generalizes the hardcoded `doctor --hard-gates`
 * probes into data-driven given→when→expect cases. Reuses the Phase-1 scaffold +
 * hook-runner (the real configured-hook execution path) — independent of the event
 * log. The `assertOutcome` here is THE single assertion path, also consumed by
 * `doctor-hard-gates.ts`, so the two never diverge.
 */

export type SimStatus = "PASS" | "FAIL" | "SKIP";

export interface ExpectSpec {
	/** Whether the hook should block the tool call. */
	blocked: boolean;
	/** Marker string expected on the named stream when blocked. */
	marker?: string;
	/** Exact exit code; when omitted on a block, any non-zero passes. */
	exitCode?: number;
	/** Which stream carries the marker — explicit per scenario (block markers vary). */
	expectStream?: "stdout" | "stderr";
}

interface WhenSpec {
	/** Tool name (matched against settings.json hook matchers). */
	tool: string;
	/** Hook script basename to exercise (the `only` filter — keeps runs deterministic). */
	hook: string;
	file_path?: string;
	command?: string;
	/** Extra env for this step (e.g. MEOWKIT_GATE1_REQUIRE_APPROVED=1). */
	env?: Record<string, string>;
}

interface GivenSpec {
	/** Create an (unapproved) plan so Gate 1 existence passes. */
	plan?: boolean;
	/** Remove all plans (force the no-plan state). */
	clearPlans?: boolean;
	/** Arrange arbitrary files in the temp project. */
	files?: Array<{ path: string; content: string }>;
}

interface StepSpec {
	given?: GivenSpec;
	when: WhenSpec;
	expect: ExpectSpec;
}

export interface Scenario {
	name: string;
	description?: string;
	/** Single-step shorthand (mutually exclusive with `steps`). */
	given?: GivenSpec;
	when?: WhenSpec;
	expect?: ExpectSpec;
	/** Ordered multi-step lifecycle (e.g. full-lifecycle). */
	steps?: StepSpec[];
}

export interface StepResult {
	status: SimStatus;
	detail: string;
	expected: string;
	actual: string;
}

export interface ScenarioResult {
	name: string;
	description?: string;
	status: SimStatus;
	steps: StepResult[];
}

/**
 * THE shared assertion: compare a hook run result against an expectation. Returns
 * PASS / FAIL / SKIP. Two honesty guards:
 *  - an allow-case (`blocked:false`) where NO hook ran → SKIP (never a vacuous PASS),
 *  - a block-case where no hook ran → FAIL (the gate was not exercised).
 */
export function assertOutcome(result: HookRunResult | undefined, expect: ExpectSpec): { status: SimStatus; detail: string } {
	const stream = expect.expectStream ?? "stderr";
	if (!result) {
		if (expect.blocked === false) {
			return { status: "SKIP", detail: "No hook matched the tool — allow-case not exercised (would pass vacuously)." };
		}
		return { status: "FAIL", detail: "Expected a block but no hook ran for this tool." };
	}
	const streamText = stream === "stdout" ? result.stdout : result.stderr;
	if (expect.blocked) {
		const markerOk = !expect.marker || streamText.includes(expect.marker);
		const exitOk = expect.exitCode !== undefined ? result.status === expect.exitCode : result.status !== 0;
		if (markerOk && exitOk) {
			return { status: "PASS", detail: `Blocked as expected (exit ${result.status}${expect.marker ? `, ${expect.marker} on ${stream}` : ""}).` };
		}
		return {
			status: "FAIL",
			detail: `Expected block (exit ${expect.exitCode ?? "≠0"}${expect.marker ? `, ${expect.marker} on ${stream}` : ""}) but got exit ${result.status}; marker ${markerOk ? "present" : "absent"}.`,
		};
	}
	if (result.status === 0) return { status: "PASS", detail: "Allowed (exit 0)." };
	return { status: "FAIL", detail: `Expected allow (exit 0) but got exit ${result.status}.` };
}

/** Apply a step's `given` to the scaffolded project (in-place). */
function applyGiven(project: HarnessProject, given: GivenSpec | undefined): void {
	if (!given) return;
	if (given.clearPlans) project.clearPlans();
	if (given.plan) project.addPlan({ nested: true });
	for (const f of given.files ?? []) {
		const abs = path.join(project.dir, f.path);
		fs.mkdirSync(path.dirname(abs), { recursive: true });
		fs.writeFileSync(abs, f.content);
	}
}

/** Run a single step's `when` against the project and assert against `expect`. */
function runStep(project: HarnessProject, settings: Record<string, unknown>, step: StepSpec): StepResult {
	applyGiven(project, step.given);
	const results = runConfiguredHook(settings, {
		projectDir: project.dir,
		event: "PreToolUse",
		tool: step.when.tool,
		toolName: step.when.tool,
		toolInput: { file_path: step.when.file_path, command: step.when.command },
		only: step.when.hook,
		extraEnv: step.when.env,
	});
	const result = results.find((r) => r.script === step.when.hook);
	const outcome = assertOutcome(result, step.expect);
	const stream = step.expect.expectStream ?? "stderr";
	return {
		status: outcome.status,
		detail: outcome.detail,
		expected: `${step.when.hook}: ${step.expect.blocked ? `block ${step.expect.marker ?? ""} on ${stream}` : "allow"}`.trim(),
		actual: result ? `exit ${result.status}` : "no hook ran",
	};
}

/** Normalize a scenario into its ordered step list (single-step shorthand → one step). */
function scenarioSteps(scenario: Scenario): StepSpec[] {
	if (scenario.steps && scenario.steps.length > 0) return scenario.steps;
	if (scenario.when && scenario.expect) {
		return [{ given: scenario.given, when: scenario.when, expect: scenario.expect }];
	}
	return [];
}

/** worst of the step statuses: FAIL > SKIP > PASS (SKIP is a soft failure for --all). */
function rollupSteps(steps: StepResult[]): SimStatus {
	if (steps.length === 0) return "FAIL";
	if (steps.some((s) => s.status === "FAIL")) return "FAIL";
	if (steps.some((s) => s.status === "SKIP")) return "SKIP";
	return "PASS";
}

/** Execute one scenario against a freshly-scaffolded temp harness. Cleans up always. */
export function runScenario(scenario: Scenario, srcRoot: string): ScenarioResult {
	const steps = scenarioSteps(scenario);
	if (steps.length === 0) {
		return {
			name: scenario.name,
			description: scenario.description,
			status: "FAIL",
			steps: [{ status: "FAIL", detail: "Scenario has neither a valid `when/expect` nor `steps`.", expected: "a runnable step", actual: "none" }],
		};
	}
	const project = scaffoldHarnessProject(srcRoot);
	try {
		const stepResults = steps.map((step) => runStep(project, settingsOf(srcRoot), step));
		return { name: scenario.name, description: scenario.description, status: rollupSteps(stepResults), steps: stepResults };
	} finally {
		// try/finally so the temp dir (which may hold a synthetic .env) is removed even
		// on a spawnSync timeout/throw.
		project.cleanup();
	}
}

let _settingsCache: { root: string; settings: Record<string, unknown> } | null = null;
function settingsOf(srcRoot: string): Record<string, unknown> {
	if (_settingsCache?.root === srcRoot) return _settingsCache.settings;
	const settings = JSON.parse(fs.readFileSync(path.join(srcRoot, ".claude", "settings.json"), "utf8")) as Record<string, unknown>;
	_settingsCache = { root: srcRoot, settings };
	return settings;
}

/** Load + validate a scenario YAML file. Throws on a malformed/under-specified scenario. */
export function loadScenario(file: string): Scenario {
	const parsed = yaml.load(fs.readFileSync(file, "utf8"));
	if (typeof parsed !== "object" || parsed === null) throw new Error(`${path.basename(file)}: not a YAML object`);
	const s = parsed as Partial<Scenario>;
	if (typeof s.name !== "string" || s.name.length === 0) throw new Error(`${path.basename(file)}: missing 'name'`);
	const hasSingle = s.when !== undefined && s.expect !== undefined;
	const hasSteps = Array.isArray(s.steps) && s.steps.length > 0;
	if (!hasSingle && !hasSteps) {
		throw new Error(`${path.basename(file)}: must define either when+expect or a non-empty steps list`);
	}
	return s as Scenario;
}

export interface SimulationsDir {
	/** Absolute path to `<repoRoot>/.claude/simulations`. */
	dir: string;
	exists: boolean;
}

export function simulationsDir(srcRoot: string): SimulationsDir {
	const dir = path.join(srcRoot, ".claude", "simulations");
	return { dir, exists: fs.existsSync(dir) };
}

/** List scenario YAML basenames (without extension) in the simulations dir. */
export function listScenarios(srcRoot: string): string[] {
	const { dir, exists } = simulationsDir(srcRoot);
	if (!exists) return [];
	return fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
		.map((f) => f.replace(/\.ya?ml$/, ""))
		.sort();
}

export function loadScenarioByName(srcRoot: string, name: string): Scenario {
	const { dir } = simulationsDir(srcRoot);
	for (const ext of [".yaml", ".yml"]) {
		const file = path.join(dir, `${name}${ext}`);
		if (fs.existsSync(file)) return loadScenario(file);
	}
	throw new Error(`Scenario '${name}' not found in ${dir}`);
}

export { hasHarness };
