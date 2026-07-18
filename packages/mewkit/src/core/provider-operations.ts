// Per-provider LOGICAL WORKFLOW OPERATIONS — the second trusted adapter table.
//
// ─── Why this is NOT a second capability schema ──────────────────────────────
// It reuses the existing provider/diagnostics plumbing (same provider keys as
// provider-invocation.ts / provider-projection.ts, surfaced through the existing
// `doctor --providers` and `validate --portable` commands). It adds no manifest
// field, no CLI command, and no user-authored file. It is consumed ONLY by
// adapter code resolving operations named in skill PROSE.
//
// ─── Why frontmatter can never reach it ──────────────────────────────────────
// `capability.ts` keeps a closed enum, KNOWN_INVOCATION_IDS, for exactly one
// reason: a capability's `invocation.id` comes from FRONTMATTER, which is
// author-controlled and therefore hostile-input. Restricting it to a closed set
// of logical ids means hostile frontmatter can name an id at most — never smuggle
// an executable string. provider-invocation.ts is the seam that maps those ids to
// provider-native operations.
//
// The four operations here — `ask_user`, `manage_plan`, `run_shell`,
// `delegate_agent` — MUST NOT join that enum. `run_shell` and `delegate_agent`
// are precisely the strings the enum exists to keep out of frontmatter's reach:
// admitting them would hand author-controlled input a name for "execute a shell
// command" and "spawn an agent". The enum's value is entirely in what it EXCLUDES,
// so growing it to be convenient dissolves it.
//
// These names are therefore keyed off a SEPARATE type that frontmatter never
// indexes, and `assertOperationsNotInvocable()` fails the build if the two sets
// ever intersect. That is enforcement, not documentation — see the test.
//
// Mapping of the capability model vs these operations:
//
//   | Layer                | Source           | Trust      | Reachable from frontmatter |
//   |----------------------|------------------|------------|----------------------------|
//   | invocation.id        | capability YAML  | hostile    | YES — closed enum only     |
//   | InvocationShape      | adapter constant | trusted    | no (mapped from id)        |
//   | LogicalOperation     | skill prose      | hostile    | NO — never id-indexed      |
//   | OperationShape       | adapter constant | trusted    | no (mapped from operation) |
//
// Prose naming an operation is resolved by adapter code, never executed from the
// name. Descriptors below are DESCRIPTIVE (what the host does), not runnable.
import { KNOWN_INVOCATION_IDS } from "./capability.js";

/** The four portable workflow operations a skill's prose may refer to. */
export const LOGICAL_OPERATIONS = ["ask_user", "manage_plan", "run_shell", "delegate_agent"] as const;
export type LogicalOperation = (typeof LOGICAL_OPERATIONS)[number];

/**
 * Per-operation conformance state.
 * - `supported`         — the host exposes a real primitive for it.
 * - `unsupported`       — it does not, and there is no fallback. Say so; do not pretend.
 * - `permission-blocked`— the primitive exists but the host's policy denies it here.
 * - `local-fallback`    — no host primitive; the kit degrades to a disclosed substitute.
 * - `unknown`           — no tested projection for this provider. Claims nothing.
 */
export type OperationSupport = "supported" | "unsupported" | "permission-blocked" | "local-fallback" | "unknown";

export interface OperationShape {
	/** The provider-native operation, described — never a runnable string. */
	operation: string;
	support: OperationSupport;
	/** Citable in-repo/runtime proof, matching provider-lifecycle.ts's evidence convention. */
	evidence: string;
	/** Set ONLY for `local-fallback`: what happens instead. An undisclosed fallback is a lie. */
	fallback: string | null;
}

export type OperationShapeMap = Record<LogicalOperation, OperationShape>;

/**
 * What an operation may NEVER do, regardless of provider support.
 *
 * Host support answers "can this run here". Authority answers "may it". A host
 * that happily exposes a task-writing tool does not thereby grant permission to
 * write gate-approval state — capability is not authority, and conflating the two
 * is how an automated step ends up approving its own gate.
 */
export interface OperationAuthority {
	mayNot: string;
	rationale: string;
}

export const OPERATION_AUTHORITY: Record<LogicalOperation, OperationAuthority> = {
	ask_user: {
		mayNot: "Synthesize, infer, or default an answer the human did not give.",
		rationale:
			"The value of asking is that a human answered. A fabricated answer is worse than no answer: it looks like consent.",
	},
	manage_plan: {
		mayNot: "Create or flip Gate 1 / Gate 2 approval state.",
		rationale:
			"gate-rules.md requires that a human explicitly typed approval. An operation that can write approval state lets automation approve its own work. Reading plan state and writing non-gate fields is fine.",
	},
	run_shell: {
		mayNot: "Be named by capability frontmatter, or be reached from any author-controlled string.",
		rationale: "This is the exact string KNOWN_INVOCATION_IDS exists to keep out of hostile frontmatter's reach.",
	},
	delegate_agent: {
		mayNot:
			"Spawn a reviewer/evaluator to produce a verdict outside the orchestrated flow, or bypass the orchestrator boundary.",
		rationale:
			"orchestration-rules.md routes delegation through the orchestrator. A skill that could spawn its own evaluator could manufacture the verdict that authorizes its own ship.",
	},
};

// ─── Per-provider mappings ───────────────────────────────────────────────────
// Trusted constants. As with provider-projection.ts, they must never over-claim:
// assert `supported` only where the host really exposes the primitive.

// Claude Code exposes each of these as a typed tool in the current runtime.
const CLAUDE_CODE_OPERATIONS: OperationShapeMap = {
	ask_user: {
		operation: "AskUserQuestion tool",
		support: "supported",
		evidence: "typed AskUserQuestion tool in the Claude Code runtime",
		fallback: null,
	},
	manage_plan: {
		operation: "TaskCreate / TaskUpdate / TaskList tools, plus plan files under tasks/plans/",
		support: "supported",
		evidence: "typed Task tools in the Claude Code runtime; plan files on disk",
		fallback: null,
	},
	run_shell: {
		operation: "Bash tool",
		support: "supported",
		evidence: "typed Bash tool in the Claude Code runtime",
		fallback: null,
	},
	delegate_agent: {
		operation: "Agent/Task tool (by agent type)",
		support: "supported",
		evidence: "typed Agent/Task tool; mirrors invoke-agent in provider-invocation.ts",
		fallback: null,
	},
};

const CLAUDE_PLUGIN_OPERATIONS: OperationShapeMap = { ...CLAUDE_CODE_OPERATIONS };

// Codex reaches skills/commands/agents through instruction/prompt projection rather
// than typed invoke tools (see provider-projection.ts: codex invocable = advisory).
// Prompt projection is not a primitive: the model may comply or not. Anything that
// depends on a typed tool is therefore NOT `supported` here.
const CODEX_OPERATIONS: OperationShapeMap = {
	ask_user: {
		operation: "question asked inline in the assistant's prose",
		support: "local-fallback",
		evidence: "no typed prompt primitive; codex surfaces are prompt-projected (provider-projection.ts)",
		fallback:
			"The agent asks in prose and waits. There is no structured option list and no host guarantee that the turn actually blocks.",
	},
	manage_plan: {
		operation: "plan files under tasks/plans/ (no typed task tool)",
		support: "local-fallback",
		evidence: "no typed Task tool on codex; plan files are plain files the kit already writes",
		fallback: "Plan state lives only in files. Nothing enforces that the agent updates them.",
	},
	run_shell: {
		operation: "codex shell execution",
		support: "unknown",
		evidence: "no in-repo proof of the shell surface's contract for this kit; not asserted",
		fallback: null,
	},
	delegate_agent: {
		operation: "codex subagent surface",
		support: "unsupported",
		evidence:
			"subagent surface exists (SubagentStart) but is not a typed invoke — invoke-agent is advisory on codex (provider-invocation.ts)",
		fallback: null,
	},
};

const OPERATIONS_BY_PROVIDER: Record<string, OperationShapeMap> = {
	"claude-code": CLAUDE_CODE_OPERATIONS,
	"claude-plugin": CLAUDE_PLUGIN_OPERATIONS,
	codex: CODEX_OPERATIONS,
};

/** An all-`unknown` map for a provider with no tested projection (claims nothing). */
function unknownOperations(): OperationShapeMap {
	const out = {} as OperationShapeMap;
	for (const op of LOGICAL_OPERATIONS) {
		out[op] = {
			operation: "(unknown)",
			support: "unknown",
			evidence: "no tested operation projection for this provider",
			fallback: null,
		};
	}
	return out;
}

/** The operation map for a provider, or an all-`unknown` report-only fallback. */
export function getOperationShapes(provider: string): OperationShapeMap {
	return OPERATIONS_BY_PROVIDER[provider] ?? unknownOperations();
}

/** The shape for one operation on a provider (unknown-fallback if unrecognized). */
export function getOperationShape(provider: string, operation: string): OperationShape {
	const map = getOperationShapes(provider);
	return (
		map[operation as LogicalOperation] ?? {
			operation: "(unknown)",
			support: "unknown",
			evidence: "unrecognized operation name",
			fallback: null,
		}
	);
}

/** True when `name` is one of the four logical operations. */
export function isLogicalOperation(name: string): name is LogicalOperation {
	return (LOGICAL_OPERATIONS as readonly string[]).includes(name);
}

/**
 * The anti-smuggling invariant, enforced rather than documented: no logical
 * operation may ever appear in the frontmatter-reachable invocation enum.
 *
 * Called by `validate`; also covered by a unit test. If someone "helpfully" adds
 * `run_shell` to KNOWN_INVOCATION_IDS to make a skill resolve, this fails loudly
 * instead of silently handing author-controlled frontmatter a shell.
 */
export function assertOperationsNotInvocable(): string[] {
	const leaked = LOGICAL_OPERATIONS.filter((op) => KNOWN_INVOCATION_IDS.has(op));
	return leaked.map(
		(op) =>
			`"${op}" appears in KNOWN_INVOCATION_IDS — frontmatter could then name it. ` +
			`Logical operations are adapter-internal by design; remove it from the enum.`,
	);
}
