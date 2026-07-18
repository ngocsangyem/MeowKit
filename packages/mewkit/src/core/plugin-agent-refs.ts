// Agent-reference rewriting for the generated plugin payload.
//
// Why this exists: the flat-copy install resolves an agent by its `name:`
// frontmatter verbatim, so the shipped source keeps BARE agent names and BARE
// `subagent_type` references (e.g. `developer`). A Claude Code / Codex plugin,
// however, auto-prefixes the plugin name onto each agent's bare `name:` — a bare
// `subagent_type` is then rejected and only `<plugin>:<agent>` resolves
// (verified against the live `claude plugin` registry). To support BOTH installs
// from one source tree, the plugin payload is generated: agent `name:` stays
// bare (the runtime adds the prefix) and every reference to a kit agent is
// rewritten to `<plugin>:<agent>` here.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Built-in agent types the host runtime provides. References to these are left
 * bare in the plugin payload — they are not kit agents and are never prefixed.
 */
export const BUILTIN_AGENT_TYPES = new Set<string>(["Explore", "Bash", "general-purpose", "Plan"]);

/** Read the bare `name:` frontmatter value from each agent file in a dir. */
export function collectAgentNames(agentsDir: string): Set<string> {
	const names = new Set<string>();
	let entries: string[];
	try {
		entries = readdirSync(agentsDir);
	} catch {
		return names;
	}
	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;
		const name = readFrontmatterName(join(agentsDir, entry));
		if (name) names.add(name);
	}
	return names;
}

/** First `name:` value in a markdown file's YAML frontmatter, or null. */
function readFrontmatterName(filePath: string): string | null {
	let text: string;
	try {
		text = readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
	const match = text.match(/^name:\s*["']?([^"'\r\n]+)["']?\s*$/m);
	return match ? match[1].trim() : null;
}

/** Escape a string for safe inclusion in a RegExp. */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface RewriteResult {
	content: string;
	/** Number of references rewritten. */
	count: number;
}

/**
 * Rewrite bare `subagent_type` references to kit agents into the namespaced
 * `<plugin>:<agent>` form. Only values that exactly match a name in `agentNames`
 * are touched; built-ins, template placeholders (`[type]`), and already-prefixed
 * values are left untouched. The match anchors immediately after the
 * `subagent_type` assignment, so `subagent_type="mk:developer"` is never
 * double-prefixed.
 */
export function rewriteAgentRefs(content: string, agentNames: Set<string>, pluginName = "mk"): RewriteResult {
	const targets = [...agentNames].filter((n) => !BUILTIN_AGENT_TYPES.has(n));
	if (targets.length === 0) return { content, count: 0 };

	// Longest names first so e.g. `jira-evaluator` wins over `evaluator`.
	const alternation = targets
		.sort((a, b) => b.length - a.length)
		.map(escapeRegExp)
		.join("|");

	// group1: the `subagent_type` assignment up to an optional opening quote.
	// group2: the bare agent name, bounded by a quote/space/comma/paren/EOL so
	// it cannot be a fragment of a longer identifier.
	const re = new RegExp(`(subagent_type\\s*[:=]\\s*["']?)(${alternation})(?=["'\\s),]|$)`, "g");

	let count = 0;
	const rewritten = content.replace(re, (_match, prefix: string, name: string) => {
		count += 1;
		return `${prefix}${pluginName}:${name}`;
	});
	return { content: rewritten, count };
}
