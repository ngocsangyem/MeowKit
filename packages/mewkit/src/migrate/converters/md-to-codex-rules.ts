import type { ConversionResult, PortableItem } from "../types.js";

interface CodexRuleMapping {
	pattern: string[];
	decision: "allow" | "prompt" | "forbidden";
	justification: string;
}

interface CodexRuleAnalysis {
	kind: "native" | "translated" | "unsupported";
	content?: string;
	reason?: string;
}

const TRANSLATION_RULES: Array<{ test: RegExp; build: () => CodexRuleMapping[] }> = [
	{
		test: /use\s+`rg`\s+instead\s+of\s+`grep`/i,
		build: () => [
			{
				pattern: ["grep"],
				decision: "forbidden",
				justification: "Use `rg` instead of `grep`.",
			},
		],
	},
	{
		test: /`rm\s+-rf`|`git\s+reset\s+--hard`/i,
		build: () => [
			{
				pattern: ["rm", "-rf"],
				decision: "forbidden",
				justification: "Destructive deletion requires an explicit user request.",
			},
			{
				pattern: ["git", "reset", "--hard"],
				decision: "forbidden",
				justification: "Destructive history resets require an explicit user request.",
			},
		],
	},
];

function isLikelyNativeCodexRules(body: string): boolean {
	const lines = body.split("\n");
	let depth = 0;
	let seenRule = false;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		if (line.startsWith("```") || /^#{1,6}\s/.test(line) || /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) return false;
		if (line === "prefix_rule(") {
			depth += 1;
			seenRule = true;
			continue;
		}
		if (line === ")") {
			if (depth === 0) return false;
			depth -= 1;
			continue;
		}
		if (depth === 0) return false;
	}

	return seenRule && depth === 0;
}

function renderCodexRule(mapping: CodexRuleMapping): string {
	return [
		"prefix_rule(",
		`    pattern = [${mapping.pattern.map((part) => JSON.stringify(part)).join(", ")}],`,
		`    decision = ${JSON.stringify(mapping.decision)},`,
		`    justification = ${JSON.stringify(mapping.justification)},`,
		")",
	].join("\n");
}

export function analyzeCodexRuleSource(item: Pick<PortableItem, "body">): CodexRuleAnalysis {
	const body = item.body.trim();
	if (!body) return { kind: "unsupported", reason: "empty rule body" };
	if (isLikelyNativeCodexRules(body)) return { kind: "native", content: `${body}\n` };

	const mappings = TRANSLATION_RULES.filter((rule) => rule.test.test(body)).flatMap((rule) => rule.build());
	if (mappings.length === 0) {
		return {
			kind: "unsupported",
			reason: "Codex `.rules` files require native `prefix_rule()` entries or a supported Markdown command policy",
		};
	}

	const uniqueMappings = new Map<string, CodexRuleMapping>();
	for (const mapping of mappings) {
		uniqueMappings.set(JSON.stringify(mapping.pattern), mapping);
	}

	return {
		kind: "translated",
		content: `${Array.from(uniqueMappings.values())
			.map(renderCodexRule)
			.join("\n\n")}\n`,
	};
}

export function convertMdToCodexRules(item: PortableItem): ConversionResult {
	const analyzed = analyzeCodexRuleSource(item);
	if (analyzed.kind === "unsupported" || !analyzed.content) {
		return {
			content: "",
			filename: `${item.name}.rules`,
			warnings: analyzed.reason ? [analyzed.reason] : [],
			error: analyzed.reason ?? "Unsupported Codex rule content",
		};
	}

	return {
		content: analyzed.content,
		filename: `${item.name}.rules`,
		warnings: analyzed.kind === "translated" ? ["Translated Markdown policy into Codex prefix_rule() entries"] : [],
	};
}
