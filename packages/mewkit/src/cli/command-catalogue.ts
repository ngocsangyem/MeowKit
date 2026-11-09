// The CLI surface, declared once. minimist options, `--help`, and the docs synopsis are all
// derived from this file, and a contract test fails if the dispatcher reads a flag that is not
// here. Add a flag here first; nothing else needs editing.
import type { Catalogue, CommandSpec, FlagSpec } from "./catalogue-types.js";

const COMMANDS: CommandSpec[] = [
	{ name: "init", summary: "Scaffold or update MeowKit in the current project" },
	{ name: "upgrade", summary: "Upgrade MeowKit to the latest version" },
	{
		name: "validate",
		summary: "Validate .claude/ project structure",
		usage: "validate [--mode authoring|flat-copy] (--mode is a maintainer override)",
	},
	{
		name: "capabilities",
		summary: "Inspect or resolve the capability manifest",
		subcommands: ["list", "explain", "resolve", "view", "bootstrap", "projections"],
		subcommandUsage: {
			explain: "capabilities explain --intent <intent>",
			resolve: "capabilities resolve --intent <intent>",
			view: "capabilities view [--write]",
			projections: "capabilities projections [--provider <provider>]",
		},
	},
	{ name: "budget", summary: "View token usage and cost log", subcommands: ["context"] },
	{ name: "setup", summary: "Guided post-scaffold configuration" },
	{
		name: "skill",
		summary: "Per-skill interpreter environments",
		subcommands: ["env"],
		requiresSubcommand: true,
		usage: "skill env <skill>|--list",
		subcommandUsage: { env: "skill env <skill> | skill env --list" },
	},
	{ name: "doctor", summary: "Diagnose common environment issues", subcommands: ["provenance"] },
	{ name: "versions", summary: "Print the installed CLI, kit, target and delivery of this project" },
	{
		name: "task-state",
		summary: "Durable task record",
		subcommands: ["show", "update"],
		subcommandUsage: {
			show: "task-state show [<task-id>]",
			update: "task-state update <task-id> [--status <status>] [--step <text>] [--next <text>]",
		},
	},
	{
		name: "advice",
		summary: "Bounded supervision checkpoints for --advice; records evidence, approves nothing",
		subcommands: ["begin", "commit", "status", "validate-packet"],
		requiresSubcommand: true,
		subcommandUsage: {
			begin: "advice begin --run <id> --skill <skill> --stage <stage> --checkpoint <id>",
			commit: "advice commit --run <id> --checkpoint <id> --disposition <d> --outcome <o> --reason <why>",
			status: "advice status --run <id>",
			"validate-packet": "advice validate-packet --evidence <path> --packet-kind <input|output|brief>",
		},
	},
	{ name: "orient", summary: "Resume orientation from durable task state; reads records only" },
	{
		name: "task",
		summary: "Create and list task files",
		subcommands: ["new", "list"],
		requiresSubcommand: true,
		subcommandUsage: {
			new: 'task new "<description>" [--type <type>] [--priority <priority>]',
			list: "task list [--status <status>] [--all]",
		},
	},
	{ name: "migrate", summary: "Export MeowKit to external coding-agent tools", usage: "migrate <tool>" },
	{ name: "providers", summary: "Show the effective provider support matrix and enforcement levels", usage: "providers [<provider>]" },
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
		requiresSubcommand: true,
		subcommandUsage: {
			validate: "visual-plan validate <plan-dir>",
			status: "visual-plan status <plan-dir>",
			approve: "visual-plan approve <plan-dir> [--revision <rev>]",
			rehash: "visual-plan rehash <plan-dir>",
			export: "visual-plan export <plan-dir> [--format <format>]",
			"prepare-feedback": "visual-plan prepare-feedback <plan-dir> --ops <file>",
			"apply-feedback": "visual-plan apply-feedback <plan-dir> --batch <id> [--check]",
			patch: "visual-plan patch <plan-dir> --op <file>",
			edit: "visual-plan edit <plan-dir>",
			view: "visual-plan view <plan-dir> [--port <port>]",
		},
	},
	{
		name: "review",
		summary: "High-assurance PR review, resumable across sittings via a session id",
		subcommands: ["prepare", "read", "coverage", "compose", "submit", "cleanup"],
		requiresSubcommand: true,
		subcommandUsage: {
			prepare: "review prepare <pr-url|number> [--remote <remote>]",
			read: "review read --session <id> [--as <persona>]",
			coverage: "review coverage --session <id>",
			compose: "review compose --session <id> [--reply]",
			submit: "review submit --session <id> --confirm <token>",
			cleanup: "review cleanup --session <id>",
		},
	},
	{
		name: "plan",
		summary: "Plan lifecycle",
		subcommands: ["status", "check", "approve", "archive"],
		requiresSubcommand: true,
		subcommandUsage: {
			status: "plan status <plan-dir>",
			check: "plan check <phase-file> [--structural]",
			approve: "plan approve <plan-dir> [--by <name>]",
			archive: "plan archive <plan-dir> [--dry-run]",
		},
	},
	{
		name: "trace",
		summary: "On-demand trace recall",
		subcommands: ["score", "audit", "propose"],
		subcommandUsage: {
			score: "trace score [--id <run>]",
			propose: "trace propose [--commit]",
		},
	},
	{
		name: "pack",
		summary: "Manage install packs",
		subcommands: ["list", "add", "remove"],
		requiresSubcommand: true,
		subcommandUsage: { add: "pack add <pack>…", remove: "pack remove <pack>…" },
	},
	{ name: "verdict-gate", summary: "Check a review verdict against the active plan", usage: "verdict-gate <slug>" },
	{
		name: "note",
		summary: "Append a lint-checked entry to the committed team-memory store (entry on stdin)",
		usage: "note <decisions|gotchas>",
	},
	{
		name: "uninstall",
		summary: "Remove the kit's own files; dry-run unless --yes, and never your data",
		usage: "uninstall [--yes] [--force] [--json] [--dry-run]",
	},
	{
		name: "backups",
		summary: "List and restore the snapshots the mutating commands take",
		subcommands: ["list", "restore"],
		usage: "backups list | backups restore <id>",
		subcommandUsage: { restore: "backups restore <id>" },
	},
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
			"providers",
			"plan",
			"trace",
			"orient",
			"budget",
			"task-state",
			"advice",
			"visual-plan",
			"backups",
			"uninstall",
			"doctor",
			"init",
			"setup",
			"migrate",
			"upgrade",
			"versions",
		],
		"Emit machine-readable JSON",
	),
	b("yes", ["init", "upgrade", "pack", "migrate", "uninstall", "backups"], "Answer prompts affirmatively"),
	b("beta", ["init", "upgrade", "pack"], "Use the beta release channel"),
	b("dry-run", ["init", "plan", "migrate", "backups", "uninstall", "upgrade", "setup", "pack"], "Print what would happen without writing"),
	b("force", ["init", "visual-plan", "migrate", "uninstall", "upgrade"], "Overwrite user-edited targets on conflict", {
		perCommand: { init: "Overwrite an existing `.claude/`", uninstall: "Also remove kit paths this project has edited" },
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
	s("delivery", ["init"], "Claude Code only: native or plugin on-disk shape"),
	b(
		"offline",
		["init", "upgrade"],
		"Install from this project's cached kit artifact only, re-verifying it, and reach no network",
	),
	s("mcp-profiles", ["init"], "Cursor only: MCP profile names, or 'all', to merge into .cursor/mcp.json"),
	b("allow-cloud-mcp", ["init"], "Cursor only: second opt-in for applying an MCP profile to a repo with a git remote"),

	// upgrade
	b("check", ["upgrade", "visual-plan"], "Report without changing anything", {
		perCommand: { "visual-plan": "Pre-apply gate for apply-feedback" },
	}),
	b("list", ["upgrade"], "List available versions"),
	b("no-cleanup", ["upgrade"], "Keep the downloaded release directory"),

	// validate
	s(
		"mode",
		["validate"],
		"Maintainer override: force the authoring or flat-copy run profile instead of auto-detecting it",
	),
	b("portable", ["validate"], "Include portable provider contract checks"),
	b("strict", ["validate"], "Treat WARN as failure (exit 1)"),
	b("workflow", ["validate"], "Run only the workflow.yaml drift check"),
	b("gates", ["validate"], "Run only the gate-authority contract check"),
	b("ownership", ["validate"], "Run only the artifact ownership-completeness check"),
	b("agents", ["validate"], "Run only declared agent-contract conformance checks"),
	b("packs", ["validate"], "Run only the pack-manifest coherence and safety check"),
	b("rules", ["validate"], "Run only the routing-table-breadth check"),
	b("capabilities", ["validate"], "Run only the capability manifest checks"),
	b("memory", ["validate"], "Run only the committed team-memory store lint"),
	b("frontmatter", ["validate"], "Run only the SKILL.md frontmatter schema and runtime-contract check"),
	b("docs-refs", ["validate"], "Run only the `.claude` to `docs/*` reference allowlist check"),
	b("substrate", ["validate"], "Run only the responsibility-substrate drift and untagged check"),

	// skill env
	b("list", ["skill"], "List every skill that declares a runtime and the state of its environment"),
	s("skills", ["setup"], "Comma-separated skills whose interpreter environment setup should create"),

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
	b("write", ["capabilities"], "Write the generated view rather than printing it"),
	b("record", ["orient"], "Record the result to the task record; `--no-record` skips it"),

	// plan
	s("by", ["plan"], "Approver name recorded on the approval receipt"),
	b("structural", ["plan"], "`check`: validate plan.md + its phase files against the full template"),
	b("activate", ["plan", "task"], "Activate the task on creation; --no-activate opts out"),

	// trace
	s("id", ["trace"], "Trace record id"),
	s("friction", ["trace"], "Record a friction note against the current task"),
	s("responsibility", ["trace"], "Scope to one substrate responsibility"),
	b("commit", ["trace"], "Persist the proposal rather than previewing it"),

	// budget
	b("monthly", ["budget"], "Aggregate by month instead of the last ten entries"),
	s("day", ["budget"], "Filter to today, or to a specific YYYY-MM-DD"),
	s("fail-over", ["budget"], "Exit non-zero when a profile exceeds N tokens"),

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
	b("hard-gates", ["doctor"], "Live-probe the hard gates (plan, privacy, injection block)"),
	b("adopt", ["doctor"], "Rebuild the ownership baseline from the local kit cache, or refuse"),

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
	b("respect-deletions", ["migrate"], "Honor deletions.json rather than reinstating removed files"),
	b("all-rules", ["migrate"], "Merge every rule into the provider instruction file"),
	b("include-mcp", ["migrate"], "Also convert .mcp.json servers into the provider MCP config"),
	b("include-unportable", ["migrate"], "Install Claude Code skills for a provider with no adapter (experimental)"),

	// providers
	b("lifecycle", ["providers"], "Show the capability-adapter and lifecycle matrix"),

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
