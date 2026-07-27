// The CLI surface, declared once. minimist options, `--help`, and the docs synopsis are all
// derived from this file, and a contract test fails if the dispatcher reads a flag that is not
// here. Add a flag here first; nothing else needs editing.
//
// Known boundary: `wiki` receives the whole parsed args object as a pass-through bag and reads
// its own flags from it (`--max-pages`, `--include-content`, and ~20 more). Those are not
// dispatcher reads, so they are deliberately absent rather than half-covered. Declaring them
// here without routing them through minimist would claim a contract that does not hold.
import type { Catalogue, FlagSpec } from "./catalogue-types.js";

const COMMANDS = [
	{ name: "init", summary: "Scaffold or update MeowKit in the current project" },
	{ name: "upgrade", summary: "Upgrade MeowKit to the latest version" },
	{ name: "validate", summary: "Validate .claude/ project structure", usage: "validate [--mode authoring|flat-copy]" },
	{
		name: "capabilities",
		summary: "Inspect or resolve the capability manifest",
		subcommands: ["list", "explain", "resolve", "view", "bootstrap", "projections"],
	},
	{ name: "budget", summary: "View token usage and cost log", subcommands: ["context"] },
	{
		name: "memory",
		summary: "Manage agent memory (lessons and patterns)",
		subcommands: ["capture", "render-views", "seed-from-md"],
	},
	{ name: "setup", summary: "Guided post-scaffold configuration" },
	{ name: "doctor", summary: "Diagnose common environment issues", subcommands: ["provenance"] },
	{ name: "status", summary: "Print version and config summary" },
	{ name: "task-state", summary: "Durable task record", subcommands: ["show", "update"] },
	{
		name: "advice",
		summary: "Bounded supervision checkpoints for --advice; records evidence, approves nothing",
		subcommands: ["begin", "commit", "status", "validate-packet"],
	},
	{ name: "orient", summary: "Resume orientation from durable task state; reads records only" },
	{ name: "context", summary: "Repo-context evidence", subcommands: ["resolve", "check", "record"] },
	{ name: "task", summary: "Create and list task files", subcommands: ["new", "list"] },
	{ name: "migrate", summary: "Export MeowKit to external coding-agent tools" },
	{ name: "providers", summary: "Show the effective provider support matrix and enforcement levels" },
	{ name: "explain-support", summary: "Alias of `providers`" },
	{
		name: "visual-plan",
		summary: "Visual plan contracts",
		subcommands: [
			"validate",
			"status",
			"approve",
			"rehash",
			"export",
			"prepare-feedback",
			"apply-feedback",
			"patch",
			"edit",
			"view",
		],
	},
	{
		name: "review",
		summary: "High-assurance PR review, resumable across sittings via a session id",
		subcommands: ["prepare", "read", "coverage", "compose", "submit", "cleanup"],
	},
	{ name: "inventory", summary: "List harness artifacts with governance metadata" },
	{ name: "plan", summary: "Plan lifecycle", subcommands: ["status", "check", "approve", "archive"] },
	{ name: "trace", summary: "On-demand trace recall", subcommands: ["score", "audit", "propose"] },
	{
		name: "wiki",
		summary: "Long-term project knowledge",
		subcommands: ["context", "init", "propose", "approve", "search", "reindex", "handoff"],
		passThrough: true,
	},
	{ name: "index", summary: "Build or refresh the derived SQLite index over the append logs" },
	{ name: "query", summary: "Read-only aggregate queries over the derived index" },
	{ name: "pack", summary: "Manage install packs", subcommands: ["list", "add", "remove"] },
	{ name: "verdict-gate", summary: "Check a review verdict against the active plan" },
	{ name: "docs-manifest", summary: "Generate or drift-check the docs reference manifest" },
];

/** `b`/`s` keep the table readable; the type is the thing most likely to be wrong. */
type Extra = { repeatable?: boolean; perCommand?: Record<string, string> };
const b = (name: string, commands: string[], summary: string, extra: Extra = {}): FlagSpec => ({
	name,
	type: "boolean",
	commands,
	summary,
	...extra,
});
const s = (name: string, commands: string[], summary: string, extra: Extra = {}): FlagSpec => ({
	name,
	type: "string",
	commands,
	summary,
	...extra,
});

const FLAGS: FlagSpec[] = [
	b("help", [], "Show help"),
	b("version", [], "Print the CLI version"),
	b(
		"json",
		[
			"review",
			"capabilities",
			"pack",
			"explain-support",
			"providers",
			"plan",
			"inventory",
			"trace",
			"index",
			"query",
			"orient",
			"budget",
			"task-state",
			"advice",
			"context",
			"visual-plan",
			"docs-manifest",
		],
		"Emit machine-readable JSON",
	),
	b("yes", ["upgrade", "pack", "migrate"], "Answer prompts affirmatively"),
	b("beta", ["init", "upgrade", "pack"], "Use the beta release channel"),
	b("dry-run", ["init", "plan", "migrate"], "Print what would happen without writing"),
	b("force", ["init", "visual-plan", "migrate"], "Overwrite user-edited targets on conflict", {
		perCommand: { init: "Overwrite an existing `.claude/`" },
	}),

	// init
	s("target", ["init", "validate"], "Skip the toolkit picker and create one toolkit", {
		perCommand: { validate: "Validate a generated provider target instead of a `.claude/` project" },
	}),
	s("profile", ["init", "budget"], "Install a subset: core, developer, product, atlassian, security, research, full", {
		perCommand: { budget: "Estimate one context profile instead of all of them" },
	}),
	b("migrate", ["init"], "After unpack, prompt for export targets"),
	b("migrate-global", ["init"], "Use global install paths instead of project-local"),
	s("skill-packs", ["init"], "Comma-separated skill packs to install"),
	s("mcp-profiles", ["init"], "Cursor only: MCP profile names, or 'all', to merge into .cursor/mcp.json"),
	b("allow-cloud-mcp", ["init"], "Cursor only: second opt-in for applying an MCP profile to a repo with a git remote"),

	// upgrade
	b("check", ["upgrade", "inventory", "visual-plan", "docs-manifest"], "Report without changing anything", {
		perCommand: {
			inventory: "Fail if README or index counts drift from reality",
			"visual-plan": "Pre-apply gate for apply-feedback",
			"docs-manifest": "Fail when the committed manifest no longer matches the live `.claude/` tree",
		},
	}),
	b("list", ["upgrade"], "List available versions"),
	b("no-cleanup", ["upgrade"], "Keep the downloaded release directory"),

	// validate
	s("mode", ["validate"], "Force authoring or flat-copy mode instead of auto-detecting"),
	b("portable", ["validate"], "Include portable provider contract checks"),
	b("strict", ["validate", "memory"], "Treat WARN as failure (exit 1)"),
	b("workflow", ["validate"], "Run only the workflow.yaml drift check"),
	b("gates", ["validate"], "Run only the gate-authority contract check"),
	b("ownership", ["validate"], "Run only the artifact ownership-completeness check"),
	b("agents", ["validate"], "Run only declared agent-contract conformance checks"),
	b("packs", ["validate"], "Run only the pack-manifest coherence and safety check"),
	b("rules", ["validate"], "Run only the routing-table-breadth check"),
	b("capabilities", ["validate"], "Run only the capability manifest checks"),
	b("substrate", ["validate", "inventory"], "Run only the responsibility-substrate drift and untagged check", {
		perCommand: { inventory: "Print the responsibility-by-coverage substrate matrix" },
	}),

	// review
	s("remote", ["review"], "Git remote to fetch the pull request from"),
	s("session", ["review", "budget"], "Review session id from `review prepare`", {
		perCommand: { budget: "Filter to the current session, or to a specific session id" },
	}),
	s("as", ["review"], "Read the diff as one named persona"),
	b("reply", ["review"], "Post the composed review back to the pull request"),
	s("confirm", ["review"], "Confirmation token required for the irreversible submit step"),

	// capabilities
	s("intent", ["capabilities"], "Resolve this intent to the capability that owns it"),
	s("provider", ["capabilities", "advice"], "Scope the projection to one provider", {
		perCommand: { advice: "Runtime recorded on the receipt" },
	}),
	b("write", ["capabilities", "docs-manifest"], "Write the generated view rather than printing it", {
		perCommand: { "docs-manifest": "Regenerate the committed manifest" },
	}),
	b("record", ["capabilities", "orient"], "Record the result to the task record; `--no-record` skips it"),

	// plan
	s("by", ["plan"], "Approver name recorded on the approval receipt"),
	b("activate", ["plan", "task"], "Activate the task on creation; --no-activate opts out"),

	// inventory
	b("stale", ["inventory"], "Show only deprecated or experimental artifacts"),
	b("critical", ["inventory"], "Show only criticality=critical artifacts"),
	b("portable-missing", ["inventory"], "Show artifacts whose runtime is not portable"),
	b("emit", ["inventory"], "Write the substrate view rather than printing it"),
	b("emit-counts", ["inventory"], "Rewrite README and index count numbers to match reality"),

	// trace
	s("id", ["trace"], "Trace record id"),
	s("friction", ["trace"], "Record a friction note against the current task"),
	s("responsibility", ["trace"], "Scope to one substrate responsibility"),
	b("commit", ["trace"], "Persist the proposal rather than previewing it"),

	// query
	s("task", ["query", "context"], "Task id to scope the query to", {
		perCommand: { context: "Task id to record the evidence envelope against" },
	}),
	b("presets", ["query"], "List the built-in query presets"),

	// budget
	b("monthly", ["budget"], "Aggregate by month instead of the last ten entries"),
	s("day", ["budget"], "Filter to today, or to a specific YYYY-MM-DD"),
	s("fail-over", ["budget"], "Exit non-zero when a profile exceeds N tokens"),

	// memory
	b("clear", ["memory"], "Clear all memory, with confirmation"),
	b("stats", ["memory"], "Show sessions captured and patterns learned"),

	// setup
	s("only", ["setup", "migrate"], "Run a single setup step", {
		perCommand: { migrate: "Limit to item types: agents, commands, skills, config, rules, hooks" },
	}),
	b("system-deps", ["setup"], "Install system-level dependencies"),

	// doctor
	b("report", ["doctor"], "Print a shareable diagnostic report"),
	b("providers", ["doctor", "migrate"], "Include provider contract diagnostics"),
	b("state", ["doctor"], "Include state taxonomy diagnostics"),
	b("explain", ["doctor"], "Explain the provenance result rather than summarizing it"),
	b("consolidation", ["doctor"], "Show the consolidation ledger; status is not a runtime-availability claim"),
	b("hard-gates", ["doctor"], "Live-probe the hard gates (plan, privacy, injection block)"),

	// task-state
	s("status", ["task-state", "task"], "Task status: active, blocked, done", {
		perCommand: { task: "Filter the list by status: draft, in-progress, blocked, review, done" },
	}),
	s("step", ["task-state"], "What just finished"),
	s("next", ["task-state", "advice"], "The next action", {
		perCommand: { advice: "The next safe action recorded on the dossier and receipt" },
	}),
	s("plan", ["task-state"], "Path to the plan this record joins"),
	s("blocker", ["task-state"], "Record a blocker", { repeatable: true }),
	s("verification", ["task-state"], "Record a verification as ref=result", { repeatable: true }),
	s("evidence-ref", ["task-state"], "Record an evidence reference", { repeatable: true }),
	s("capability-decision", ["task-state"], "Record a capability decision as capId|decision|reason", {
		repeatable: true,
	}),

	// advice — the supervision checkpoint surface. Every flag here records evidence;
	// none of them approves, clears, or advances anything.
	s("run", ["advice"], "Supervision run id (embedded supervision requires one)"),
	s("skill", ["advice"], "The skill running the checkpoint, e.g. mk:fix"),
	s("stage", ["advice"], "Checkpoint stage: GUIDE, RESCUE, REVIEW, RECHECK"),
	s("checkpoint", ["advice"], "Named checkpoint id; repeating one is idempotent"),
	s("disposition", ["advice"], "The returned disposition, recorded verbatim"),
	s("outcome", ["advice"], "What the parent did with it: adopted, rejected, deferred"),
	s("reason", ["advice"], "Why the outcome was chosen; required even when the directive was adopted"),
	s("question", ["advice"], "The exact question the checkpoint asked"),
	s("directive", ["advice"], "The returned directive, summarized"),
	s("correction", ["advice"], "A required correction", { repeatable: true }),
	s("evidence-pointer", ["advice"], "An evidence pointer", { repeatable: true }),
	s("slug", ["advice"], "Slug used in the receipt filename; defaults to the run id"),
	s("task-id", ["advice"], "Active durable task id, or omit for none"),
	s(
		"evidence",
		["advice"],
		"Path to the workflow evidence index a correction supersedes, or the packet/brief to validate",
	),
	s("correction-kind", ["advice"], "source (keeps Gate 1) or scope (invalidates it)"),
	s("packet-kind", ["advice"], "validate-packet shape: input, output, or brief (direct consult)"),
	s("release-stage", ["advice"], "Ship scope the call is budgeted against: prepare, release, publish"),

	// context
	s("root", ["context"], "Project root to resolve the path against"),

	// task
	s("type", ["task"], "Task type: feature, bug-fix, refactor, security"),
	s("priority", ["task"], "Task priority"),
	b("all", ["task", "migrate"], "Include completed and backlog tasks", {
		perCommand: { migrate: "Export every item type rather than the default subset" },
	}),

	// migrate
	b("global", ["migrate"], "Use global install paths instead of project-local"),
	s("source", ["migrate"], "Migration source root"),
	s("source-version", ["migrate"], "Version to record for the migration source"),
	b("install", ["migrate"], "Install the runtime for the target provider"),
	b("reconcile", ["migrate"], "Reconcile an existing export instead of writing fresh"),
	b("skip-config", ["migrate"], "Do not convert configuration"),
	b("skip-rules", ["migrate"], "Do not convert rules"),
	b("skip-hooks", ["migrate"], "Do not convert hooks"),
	b("reinstall-empty-dirs", ["migrate"], "Recreate directories that were emptied by a prior run"),
	b("respect-deletions", ["migrate"], "Honor deletions.json rather than reinstating removed files"),
	b("all-rules", ["migrate"], "Merge every rule into the provider instruction file"),
	b("include-mcp", ["migrate"], "Also convert .mcp.json servers into the provider MCP config"),
	b("include-unportable", ["migrate"], "Install Claude Code skills for a provider with no adapter (experimental)"),

	// providers
	b("lifecycle", ["providers", "explain-support"], "Show the capability-adapter and lifecycle matrix"),

	// visual-plan
	s("port", ["visual-plan"], "Bind to a fixed port instead of a random one"),
	b("open", ["visual-plan"], "Auto-launch the browser"),
	b("no-open", ["visual-plan"], "Do not launch the browser"),
	s("revision", ["visual-plan"], "Pin approve to the exact reviewed revision"),
	s("format", ["visual-plan"], "Export format"),
	s("ops", ["visual-plan"], "Operations file for prepare-feedback"),
	s("op", ["visual-plan"], "Operations file for patch"),
	s("batch", ["visual-plan"], "Feedback batch id for apply-feedback"),
	s("receipt", ["visual-plan"], "Record apply-feedback outcomes to this file"),
];

export const CLI_CATALOGUE: Catalogue = {
	commands: COMMANDS,
	flags: FLAGS,
	aliases: { h: "help", v: "version", y: "yes" },
};
