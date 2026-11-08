// no-python-checks.cjs — the check list the no-Python harness runs.
//
// Each entry is { name, run } where `run` returns null on success or a string
// naming what went wrong. `validate --parity` is deliberately absent: no such
// flag is declared, and `validate` ignores unknown flags, so asserting it would pass
// without checking anything.

const fs = require("node:fs");
const path = require("node:path");

/** The 23 core verbs, each with the fixture arguments it needs. */
const CORE_VERBS = [
	{ argv: ["doctor"], where: "repo" },
	{ argv: ["orient"], where: "repo" },
	{ argv: ["status"], where: "repo" },
	{ argv: ["validate", "--packs"], where: "repo" },
	{ argv: ["validate", "--gates"], where: "repo" },
	{ argv: ["validate", "--memory"], where: "repo" },
	{ argv: ["validate", "--workflow"], where: "repo" },
	{ argv: ["validate", "--agents"], where: "repo" },
	{ argv: ["validate", "--ownership"], where: "repo" },
	{ argv: ["inventory", "--check"], where: "repo" },
	{ argv: ["plan", "status", "@plan"], where: "fixture" },
	{ argv: ["plan", "check", "@phase"], where: "fixture" },
	{ argv: ["plan", "approve", "@plan", "--by", "no-python-harness"], where: "fixture" },
	{ argv: ["note", "gotchas"], where: "fixture", stdin: true },
	{ argv: ["task", "new", "--type", "feature", "no-python harness fixture task"], where: "fixture" },
	{ argv: ["task-state"], where: "fixture" },
	{ argv: ["verdict-gate", "260101-fixture"], where: "fixture" },
	{ argv: ["review"], where: "fixture", tolerateUsage: true },
	{ argv: ["budget", "context"], where: "repo" },
	{ argv: ["trace", "score"], where: "repo" },
	{ argv: ["context", "resolve", "README.md"], where: "repo" },
	{ argv: ["advice"], where: "fixture", tolerateUsage: true },
	{ argv: ["skill", "env", "--list"], where: "repo" },
];

const MEMORY_ENTRY = [
	"## A no-Python harness run proves the core verbs need no interpreter  <!-- 2026-11-08 -->",
	"",
	"Why: the verb list is only a claim until something runs it on a stripped PATH.",
	"Apply when: changing a core verb or the hook runtime.",
	"Source: scripts/check-no-python.cjs",
	"",
].join("\n");

function buildVerbChecks(ctx) {
	return CORE_VERBS.map((verb) => ({
		name: `mewkit ${verb.argv.join(" ")}`,
		run: () => {
			const argv = verb.argv.map((a) =>
				a === "@plan" ? path.join(ctx.planRel, "plan.md") : a === "@phase" ? path.join(ctx.planRel, "phase-01-fixture.md") : a,
			);
			const cwd = verb.where === "repo" ? ctx.repoRoot : ctx.fixtureRoot;
			const result = ctx.runCli(argv, { cwd, input: verb.stdin ? MEMORY_ENTRY : undefined });
			if (result.pythonMentioned) return `mentioned a missing interpreter: ${result.pythonMentioned}`;
			// `review` and `advice` are verb GROUPS whose every subcommand needs a
			// prepared session that does not exist in a fresh project. What this
			// harness is for is whether the verb runs at all without an interpreter, so
			// the bare verb's usage output is the fixture: it proves the module loaded,
			// dispatched and answered. A Python dependency would fail before any of that.
			if (verb.tolerateUsage && result.usage) return null;
			return result.status === 0 ? null : `exit ${result.status}: ${result.firstErrorLine}`;
		},
	}));
}

function buildSuiteChecks(ctx) {
	return [
		{
			name: "vitest tests/hooks (golden replay + gate/privacy/pre-ship crash paths)",
			run: () => {
				const r = ctx.run("npx", ["vitest", "run", "tests/hooks"], { cwd: ctx.repoRoot });
				return r.status === 0 ? null : `exit ${r.status}`;
			},
		},
		{
			name: "node --test .claude/hooks/__tests__/*.test.cjs",
			run: () => {
				const dir = path.join(ctx.repoRoot, ".claude", "hooks", "__tests__");
				const files = fs
					.readdirSync(dir)
					.filter((f) => f.endsWith(".test.cjs"))
					.map((f) => path.join(dir, f));
				if (files.length === 0) return "no node-native hook tests found";
				const r = ctx.run(process.execPath, ["--test", ...files], { cwd: ctx.repoRoot });
				return r.status === 0 ? null : `exit ${r.status}`;
			},
		},
	];
}

function buildAuditCheck(ctx) {
	return {
		name: "injection-audit records a planted critical finding in the security log",
		run: () => {
			const script = path.join(ctx.repoRoot, ".claude", "scripts", "injection-audit.cjs");
			ctx.run(process.execPath, [script, ctx.fixtureRoot], { cwd: ctx.fixtureRoot });
			const log = path.join(ctx.fixtureRoot, ".meowkit", "telemetry", "security-log.md");
			if (!fs.existsSync(log)) return `no entry written to ${path.relative(ctx.fixtureRoot, log)}`;
			return fs.readFileSync(log, "utf-8").includes("CRITICAL") ? null : "security log holds no CRITICAL entry";
		},
	};
}

function buildStructuralCheck(ctx) {
	return {
		name: "mewkit plan check --structural reports its completion marker",
		run: () => {
			const r = ctx.runCli(["plan", "check", "--structural", path.join(ctx.planRel, "plan.md")], {
				cwd: ctx.fixtureRoot,
			});
			if (r.status !== 0) return `exit ${r.status}: ${r.firstErrorLine}`;
			return r.stdout.includes("PLAN_COMPLETE") ? null : "stdout carries no PLAN_COMPLETE marker";
		},
	};
}

function buildSetupCheck(ctx) {
	return {
		name: "mewkit setup exits 0, creates no environment, and reports what it skipped",
		run: () => {
			const r = ctx.runCli(["setup"], { cwd: ctx.fixtureRoot });
			if (r.status !== 0) return `exit ${r.status}: ${r.firstErrorLine}`;
			const envs = path.join(ctx.fixtureRoot, ".meowkit", "envs");
			if (fs.existsSync(envs) && fs.readdirSync(envs).length > 0) return "setup created an interpreter environment";
			if (fs.existsSync(path.join(ctx.fixtureRoot, ".claude", "skills", ".venv"))) return "setup created a shared venv";
			return /skip|Skipped|skipped/.test(r.stdout) ? null : "setup reported nothing as skipped";
		},
	};
}

function buildChecks(ctx) {
	return [
		...buildSuiteChecks(ctx),
		buildAuditCheck(ctx),
		...buildVerbChecks(ctx),
		buildStructuralCheck(ctx),
		buildSetupCheck(ctx),
	];
}

module.exports = { buildChecks, CORE_VERBS };
