// Data for `check-dangling-rule-refs.cjs`: every rule file that moved out of an
// always-listed rules directory into the skill that owns it, the roots that are scanned for references to them, and the
// exhaustive exemption list. Kept separate so the check itself stays short.

/**
 * The moved rules.
 *   `to`      — the file's new location, or null when it has no destination file.
 *   `inlined` — its text was merged into another file, so a bare-name mention is
 *               always stale (there is nothing left to point at).
 *   `shipped` — false when the destination does not reach an installed project:
 *               either it lives outside `.claude/` entirely, or it lives inside a
 *               skill the published kit withholds. A reader that follows the `to`
 *               path from an install finds nothing, and that is the documented
 *               answer rather than a dangling reference someone has to rediscover.
 *   `citedByName` — the rule is loaded for a session by a dispatcher and then cited
 *               by bare name in prose ("per `x.md` 2"), so a bare mention is a rule
 *               citation rather than a path a reader would follow. Rule (b) does not
 *               apply; (a) and (c) still do — and (a) reaches a citedByName entry
 *               only because its pattern covers the `rules-conditional/` prefix as
 *               well as `rules/`, which is where these three lived.
 */
const MOVED = [
	{ name: "harness-rules", to: ".claude/skills/cook/references/harness-rules.md" },
	{ name: "tdd-rules", to: ".claude/skills/cook/references/tdd-rules.md" },
	{ name: "phase-contracts", to: ".claude/skills/cook/references/phase-contracts.md" },
	{ name: "post-phase-delegation", to: ".claude/skills/cook/references/post-phase-delegation.md" },
	{ name: "task-state-emission", to: ".claude/skills/cook/references/task-state-emission.md" },
	{ name: "parallel-execution-rules", to: ".claude/skills/cook/references/parallel-execution-rules.md" },
	{ name: "orchestration-rules", to: ".claude/skills/cook/references/orchestration-rules.md" },
	{ name: "model-selection-rules", to: ".claude/skills/agent-detector/references/model-selection-rules.md" },
	{ name: "scale-adaptive-rules", to: ".claude/skills/agent-detector/references/scale-adaptive-rules.md" },
	{ name: "risk-checklist", to: ".claude/skills/agent-detector/references/risk-checklist.md" },
	{ name: "agent-routing", to: ".claude/skills/agent-detector/references/agent-routing.md" },
	{ name: "context-budget-rules", to: ".claude/skills/agent-detector/references/context-budget-rules.md" },
	{ name: "rubric-rules", to: ".claude/skills/rubric/references/rubric-rules.md" },
	{ name: "skill-authoring-rules", to: ".claude/skills/skill-creator/references/skill-authoring-rules.md" },
	{
		name: "dead-weight-audit-rules",
		to: ".claude/skills/benchmark/references/dead-weight-audit-rules.md",
		shipped: false,
	},
	{ name: "advice-supervision-rules", to: ".claude/skills/advise/references/advice-supervision-rules.md" },
	{ name: "workflow-evidence-rules", to: ".claude/skills/advise/references/workflow-evidence-rules.md" },
	{
		name: "agile-story-gates",
		to: ".claude/skills/agent-detector/references/agile-story-gates.md",
		citedByName: true,
	},
	{
		name: "agile-sprint-commitment",
		to: ".claude/skills/agent-detector/references/agile-sprint-commitment.md",
		citedByName: true,
	},
	{
		name: "agile-feedback-cycle",
		to: ".claude/skills/agent-detector/references/agile-feedback-cycle.md",
		citedByName: true,
	},
	{ name: "capability-bootstrap", to: ".claude/hooks/references/capability-bootstrap.md" },
	{ name: "docs-reference-contract", to: "docs/maintainer/docs-reference-contract.md", shipped: false },
	{ name: "step-file-rules", to: null, inlined: true },
	{ name: "anti-rationalization", to: null, inlined: true },
	{ name: "intervention-recording-rules", to: null, inlined: true },
];

/**
 * Tombstones for content that moved as a whole directory, or as a file that is not a
 * rule `.md` — neither shape fits `MOVED`, which is keyed on a rule basename, so
 * without these a stale reference to the old location matches no rule and the check
 * reports pass while verifying nothing for them.
 *   `path` — the retired location, matched as a literal.
 *   `to`   — the current location. A line that names it as well is a mapping line
 *            (a canonical-path table, a destination table, a "do not use" column),
 *            which is a reference a reader can follow rather than a dangling one.
 */
const RETIRED_PATHS = [
	{ path: ".claude/rubrics/", to: ".claude/skills/rubric/rubrics/" },
	{ path: ".claude/workflow.yaml", to: ".claude/skills/workflow-orchestrator/workflow.yaml" },
	{ path: ".claude/rules-conditional/", to: ".claude/skills/agent-detector/references/" },
];

/**
 * Scan roots. `dir` entries are walked; `file` entries are single files. Tests are
 * excluded from the CLI source root: a test asserting behavior on a deliberately
 * absent path is not a reference a reader could follow.
 */
const ROOTS = [
	{ kind: "dir", path: ".claude" },
	{ kind: "dir", path: "packages/mewkit/src" },
	{ kind: "dir", path: "docs" },
	{ kind: "dir", path: "packages/docs/content" },
	{ kind: "dir", path: "packages/docs/scripts" },
	{ kind: "file", path: "packages/docs/docs-reference-manifest.json" },
	{ kind: "dir", path: "scripts" },
	{ kind: "dir", path: ".github" },
	{ kind: "dir", path: ".meowkit" },
	{ kind: "file", path: "README.md" },
	{ kind: "file", path: "RELEASING.md" },
	{ kind: "file", path: "CLAUDE.md" },
];

/** Prefixes within a scanned root that are never read (not exemptions — not references). */
const PRUNED_PREFIXES = [
	"packages/mewkit/src/migrate/__tests__/",
	".meowkit/telemetry/", // append-only event log: past events, not live references
	".claude/session-state/",
	".claude/logs/",
	".claude/worktrees/", // sibling session worktrees: separate checkouts, not this tree
];

/** Path segments pruned anywhere under a scanned root. */
const PRUNED_SEGMENTS = ["__tests__", "__fixtures__", "node_modules", "dist", ".next", ".nuxt", ".output"];

/**
 * Exhaustive exemptions. Each records WHY the file is allowed to name an old path.
 * `docs/maintainer/deletions-note` is not needed: the root `deletions.json` and
 * `release-manifest.json` are outside the scan roots by design, because the upgrade
 * cleanup works by the deletion list NAMING the old paths.
 */
const EXEMPT = [
	{ match: "packages/docs/content/docs/changelog/", why: "changelog history — must not be rewritten" },
	{ match: "docs/archive/", why: "archived record — must not be rewritten" },
	{ match: "docs/maintainer/rule-destination-table.md", why: "the destination table maps old path → new path" },
	{ match: "docs/governance/rules-index.md", why: "rules index carries the moved-rules table" },
	{
		match: "packages/docs/content/docs/reference/rules-index.mdx",
		why: "published rules index carries the moved-rules table",
	},
	{ match: "tasks/", why: "plans, contracts and reports record the paths that were live when written" },
	{
		match: "docs/architecture/adr/260511-agile-scrum-conditional-rule-layer.md",
		why: "dated decision record — its header already says the paths below are the ones that existed then",
	},
];

/** The 5 step-filed skills whose workflow.md carries the inlined step-file contract. */
const STEP_FILE_WORKFLOWS = ["plan-creator", "review", "evaluate", "autobuild", "trace-analyze"];

/** Marker proving the step-file contract is inlined rather than pointing at a rule file. */
const STEP_FILE_MARKER = "## Step-File Contract";

/** Text extensions worth reading; anything else is binary or generated noise. */
const TEXT_EXTENSIONS = [
	".md",
	".mdx",
	".ts",
	".js",
	".cjs",
	".mjs",
	".json",
	".py",
	".sh",
	".yaml",
	".yml",
	".toml",
];

module.exports = {
	MOVED,
	RETIRED_PATHS,
	ROOTS,
	PRUNED_PREFIXES,
	PRUNED_SEGMENTS,
	EXEMPT,
	STEP_FILE_WORKFLOWS,
	STEP_FILE_MARKER,
	TEXT_EXTENSIONS,
};
