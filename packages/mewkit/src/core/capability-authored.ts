// Authored capabilities that have NO disk artifact and NO frontmatter: external-tool
// integrations and repo/context/state services. Every field is hand-authored
// (provenance `authored`). They are described and discoverable, but they claim no
// invocability (invocation `none`, empty `support`) until a later slice supplies adapter
// evidence — an authored entry must never assert invocability it cannot back.
import type { CapabilityEntry, Provenance } from "./capability.js";

/** All fields of an authored entry originate from this file. */
const ALL_AUTHORED = (fields: string[]): Record<string, Provenance> =>
	Object.fromEntries(fields.map((f) => [f, "authored" as Provenance]));

const AUTHORED_FIELDS = ["kind", "description", "intents", "whenToUse", "invocation", "requirements", "owner"];

function authored(
	partial: Pick<CapabilityEntry, "id" | "kind" | "description" | "intents"> &
		Partial<CapabilityEntry>,
): CapabilityEntry {
	return {
		aliases: [],
		sourcePath: null,
		inventoryId: null,
		owner: "integration",
		installedState: "unknown",
		whenToUse: null,
		invocation: { kind: "none", id: "none" },
		requirements: [],
		support: {},
		verification: { kind: "unknown" },
		dependencies: { upstream: [], downstream: [] },
		provenance: ALL_AUTHORED(AUTHORED_FIELDS),
		...partial,
	};
}

/** Minimal, real authored set. Expanded in later slices as adapter evidence lands. */
export const AUTHORED_CAPABILITIES: CapabilityEntry[] = [
	// Tool entries are describe-only (no user-facing intents): they model the external
	// integration + its requirement and stay discoverable via `list`/`explain`, but a user
	// intent like "create a jira issue" must resolve to the INVOCABLE skill, not to a tool
	// entry whose invocation is `none`. Wiring a tool's invocation to its skill entrypoint
	// is adapter work (deferred), so until then the tool must not win intent resolution.
	authored({
		id: "jira",
		kind: "tool",
		description: "Jira issue tracking integration (surfaced via the mk:jira hub skills).",
		intents: [],
		requirements: [{ type: "mcp_or_app", id: "jira", provenance: "authored" }],
	}),
	authored({
		id: "browser",
		kind: "tool",
		description: "Browser automation (surfaced via mk:agent-browser / mk:playwright-cli).",
		intents: [],
		requirements: [{ type: "external_binary", id: "chromium", provenance: "authored" }],
	}),
	authored({
		id: "project-context",
		kind: "context-service",
		description: "Loads project conventions and context at session start.",
		intents: ["load project context", "read project conventions"],
		requirements: [{ type: "file_or_config", id: "docs/project-context.md", provenance: "authored" }],
	}),
	authored({
		id: "wiki-recall",
		kind: "context-service",
		description: "Disciplined recall of long-term, provenance-bearing project knowledge.",
		intents: ["search project knowledge", "recall prior decisions"],
		// Provided by the `mewkit wiki context` subcommand — availability = CLI present,
		// not a file on disk (a path probe would misreport a CLI subcommand as missing).
		requirements: [{ type: "external_binary", id: "mewkit", provenance: "authored" }],
	}),
	authored({
		id: "task-record",
		kind: "state-service",
		description: "Durable task/plan records under tasks/.",
		intents: ["record task state", "resume a plan"],
		requirements: [{ type: "file_or_config", id: "tasks", provenance: "authored" }],
	}),
	authored({
		id: "trace-log",
		kind: "state-service",
		description: "Append-only trace/friction log for cross-session recall.",
		intents: ["record friction", "audit trace"],
		// Provided by the `mewkit trace` subcommand — availability = CLI present.
		requirements: [{ type: "external_binary", id: "mewkit", provenance: "authored" }],
	}),
];

/**
 * Flagship intent overlay for disk-backed capabilities. Batch 1: scout/research +
 * plan→cook→review. When a built capability's id is here, its inferred keyword intents
 * are REPLACED by this curated, bounded set and its `intents` provenance becomes
 * `authored` — deterministic resolution for the highest-traffic flows. Keys must be real
 * capability ids (validated by the live-harness test).
 */
export const AUTHORED_INTENTS: Record<string, { intents: string[]; aliases?: string[] }> = {
	// Batch 1: scout/research + plan→cook→review.
	"mk:scout": { intents: ["scout the codebase", "find related files", "orient in the code", "locate code"], aliases: ["scout"] },
	"mk:research": { intents: ["research a library", "evaluate a technology", "gather best practices"], aliases: ["research"] },
	"mk:plan-creator": { intents: ["plan this feature", "create a plan", "draft a spec", "design the approach"], aliases: ["plan"] },
	"mk:cook": { intents: ["implement this feature", "build this", "write the code", "make this change"], aliases: ["cook", "implement"] },
	"mk:review": { intents: ["review this code", "code review", "check before shipping", "audit the change"], aliases: ["review"] },
	// Batch 2: fix/test/ship + wiki authoring + memory. jira/browser stay owned by their
	// authored tool entries; wiki-recall (read service) keeps the recall intents, so mk:wiki
	// here owns only the authoring verbs — no phrase collides across capabilities.
	"mk:fix": { intents: ["fix this bug", "fix the failing test", "debug this error"], aliases: ["fix"] },
	"mk:testing": { intents: ["run the tests", "write tests for this", "check test coverage"], aliases: ["test"] },
	"mk:ship": { intents: ["ship this change", "open a pull request", "create the PR"], aliases: ["ship"] },
	"mk:wiki": { intents: ["propose a wiki page", "initialize the wiki", "approve a wiki page"], aliases: ["wiki"] },
	"mk:memory": { intents: ["remember this decision", "recall a past fix", "prune old memory"], aliases: ["memory"] },
};
