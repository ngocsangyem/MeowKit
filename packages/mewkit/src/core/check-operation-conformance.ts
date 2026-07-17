// Operation-level conformance: which logical operations does each installed skill
// reference, and are they honored on every advertised provider? Without this, a
// cross-harness payload can silently ship a skill whose operation the target host
// cannot perform — the exact "silent degrade" the portability work exists to prevent.
//
// The reference signal is a skill's `allowed-tools` frontmatter: the host tools its
// author declared. That is DESCRIPTIVE metadata, not a runnable string — each tool
// maps to a LOGICAL operation through a trusted constant, exactly as `invocation.id`
// does. Frontmatter still cannot NAME a logical operation (see provider-operations.ts):
// it names a host tool; the adapter, not the author, resolves the operation.
import { enumerateArtifacts, readFrontmatter } from "./build-inventory.js";
import { ADAPTED_PROVIDERS } from "./provider-adapter.js";
import { getOperationShape, type LogicalOperation, type OperationSupport } from "./provider-operations.js";

/**
 * Claude Code host tool → the logical operation it realizes. Trusted constant; a unit
 * test asserts every value is a real `LogicalOperation`, so it can never drift from the
 * operation set. Keys are BASE tool names (scoped forms like `Bash(git:*)` are normalized
 * to `Bash` before lookup).
 */
export const TOOL_TO_OPERATION: Record<string, LogicalOperation> = {
	AskUserQuestion: "ask_user",
	Bash: "run_shell",
	Agent: "delegate_agent",
	Task: "delegate_agent",
	TaskCreate: "manage_plan",
	TaskUpdate: "manage_plan",
	TaskList: "manage_plan",
	TaskGet: "manage_plan",
};

/** `Bash(git:*)` → `Bash`, `Task(Explore)` → `Task`, ` Read ` → `Read`. */
function baseToolName(raw: string): string {
	return raw.trim().replace(/\(.*$/, "").trim();
}

/** Read a skill's declared host tools from `allowed-tools` (YAML array or comma scalar). */
function declaredTools(meta: Record<string, unknown>): string[] {
	const value = meta["allowed-tools"];
	if (Array.isArray(value)) return value.filter((tool): tool is string => typeof tool === "string");
	if (typeof value === "string") return value.split(",").map((tool) => tool.trim()).filter(Boolean);
	return [];
}

/** The distinct logical operations a set of declared tools references. */
function operationsForTools(tools: string[]): LogicalOperation[] {
	const operations = new Set<LogicalOperation>();
	for (const tool of tools) {
		const operation = TOOL_TO_OPERATION[baseToolName(tool)];
		if (operation) operations.add(operation);
	}
	return [...operations];
}

export interface OperationConformanceFinding {
	skill: string;
	operation: LogicalOperation;
	provider: string;
	support: OperationSupport;
}

/**
 * For every installed skill, resolve the operations it references (via declared tools)
 * and record, per advertised provider, each operation whose support is not `supported`.
 * Disclosed degradation (`local-fallback`) and hard gaps (`unsupported`/`unknown`) are all
 * surfaced so a cross-harness projection never advertises an operation the host cannot honor.
 */
export function findOperationConformance(claudeDir: string): OperationConformanceFinding[] {
	const { refs } = enumerateArtifacts(claudeDir);
	const findings: OperationConformanceFinding[] = [];
	for (const ref of refs) {
		if (ref.type !== "skill") continue;
		const operations = operationsForTools(declaredTools(readFrontmatter(ref.abs)));
		for (const operation of operations) {
			for (const provider of ADAPTED_PROVIDERS) {
				const support = getOperationShape(provider, operation).support;
				if (support !== "supported") findings.push({ skill: ref.id, operation, provider, support });
			}
		}
	}
	return findings;
}

/** `unsupported`/`unknown` = the operation genuinely fails or is untested on that provider;
 * `local-fallback` = disclosed graceful degradation. Only the former are blocking-worthy. */
export function isBlockingGap(finding: OperationConformanceFinding): boolean {
	return finding.support === "unsupported" || finding.support === "unknown";
}

/** Compact deterministic per-provider summary for validate output. */
export function summarizeOperationConformance(findings: readonly OperationConformanceFinding[]): string {
	const byProvider = new Map<string, number>();
	for (const finding of findings) byProvider.set(finding.provider, (byProvider.get(finding.provider) ?? 0) + 1);
	return [...byProvider.entries()]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([provider, count]) => `${provider}=${count}`)
		.join(", ");
}
