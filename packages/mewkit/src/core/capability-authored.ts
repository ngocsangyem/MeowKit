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
	authored({
		id: "jira",
		kind: "tool",
		description: "Jira issue tracking integration (hub-routed).",
		intents: ["create a jira issue", "search jira", "update jira issue"],
		requirements: [{ type: "mcp_or_app", id: "jira", provenance: "authored" }],
	}),
	authored({
		id: "browser",
		kind: "tool",
		description: "Browser automation for navigation and scripted flows.",
		intents: ["navigate to a url", "run a browser script", "test a web page"],
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
		requirements: [{ type: "skill_script", id: "wiki-context", provenance: "authored" }],
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
		requirements: [{ type: "skill_script", id: "trace", provenance: "authored" }],
	}),
];
