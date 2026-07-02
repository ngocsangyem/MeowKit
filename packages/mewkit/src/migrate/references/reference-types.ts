// Shared types for source-reference classification and rewriting.
// A "reference" is any occurrence of a source-runtime path (`.claude/...`) or
// the source config token (`CLAUDE.md`) inside migrated content.

/** Markdown span the occurrence was found in */
export type ReferenceSpan = "frontmatter" | "fenced" | "inline-code" | "prose";

/** What the reference points at */
export type ReferenceKind =
	| "mapped-asset" // path under a source dir that maps to a provider target (agents, commands, skills, rules, hooks, config)
	| "unmapped-runtime" // source runtime path with no provider equivalent (scripts, memory, cache, ...)
	| "citation" // historical/attribution reference — must survive verbatim
	| "brand" // toolkit/brand token
	| "env" // source-runtime environment variable
	| "slash-command"; // source-runtime slash command

/** What the rewriter decided to do with the occurrence */
export type RewriteDecision = "rewrite" | "preserve" | "preserve-warn";

/** One classified occurrence, emitted so the report layer can surface every decision */
export interface ReferenceOccurrence {
	/** File the occurrence belongs to (target-relative filename or source path) */
	file: string;
	/** 1-based line number in the scanned content */
	line: number;
	span: ReferenceSpan;
	kind: ReferenceKind;
	decision: RewriteDecision;
	/** The matched source text */
	original: string;
	/** Present when decision === "rewrite" */
	rewrittenTo?: string;
	/** Human-readable reason for preserve-warn decisions */
	reason?: string;
}
