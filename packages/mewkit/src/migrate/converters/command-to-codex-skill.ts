// Converts a source command template into a Codex Agent Skill
// (.agents/skills/<dir>/SKILL.md). Codex has no command-template surface —
// custom prompts are deprecated in favor of skills, which validates converting
// each command into a skill whose body carries the original template
// (source: https://developers.openai.com/codex/changelog). Dynamic template
// syntax has no skill equivalent: it is kept verbatim and surfaced as a
// manual-adaptation warning, never silently stripped.
//
// Positional-argument policy (verified 2026-07 via Context7): the custom-prompt
// argument/placeholder syntax ($1–$9 / $ARGUMENTS) is NOT surfaced in Codex docs
// (https://developers.openai.com/codex/import), and custom prompts are deprecated
// anyway. We therefore do NOT emit native positional args — status quo is kept:
// placeholders are preserved verbatim and flagged for manual adaptation. Recorded
// as UNKNOWN.

import type { ReferenceIntegrityIndex } from "../references/fence-aware-reference-rewriter.js";
import { codexCommandSkillDirName, codexCommandSkillRelativePath } from "../references/codex-command-skill-path.js";
import type { ConversionResult, PortableItem } from "../types.js";
import { stripClaudeRefs } from "./md-strip.js";

export { codexCommandSkillDirName, codexCommandSkillRelativePath };

interface DynamicFeature {
	pattern: RegExp;
	label: string;
}

const DYNAMIC_FEATURES: DynamicFeature[] = [
	{ pattern: /\$ARGUMENTS\b/, label: "$ARGUMENTS placeholder" },
	{ pattern: /\$[1-9]\b/, label: "positional $1–$9 placeholders" },
	{ pattern: /\{\{[^}]+\}\}/, label: "{{...}} template variables" },
	{ pattern: /!`[^`]*`/, label: "inline !`command` execution" },
	{ pattern: /(^|\s)@[\w~][\w./~-]*\.\w+/m, label: "@file references" },
];

/** Dynamic command-template constructs with no Codex skill equivalent */
export function detectDynamicCommandSyntax(body: string): string[] {
	return DYNAMIC_FEATURES.filter((feature) => feature.pattern.test(body)).map((feature) => feature.label);
}

function yamlQuote(value: string): string {
	return JSON.stringify(value.replace(/\s+/g, " ").trim());
}

export function convertCommandToCodexSkill(
	item: PortableItem,
	context?: { migratedRefs?: ReferenceIntegrityIndex | null },
): ConversionResult {
	const commandName = item.segments && item.segments.length > 0 ? item.segments.join("/") : item.name;
	const dirName = codexCommandSkillDirName(commandName);
	const filename = codexCommandSkillRelativePath(commandName);
	const warnings: string[] = [];

	const description =
		(typeof item.frontmatter.description === "string" && item.frontmatter.description.trim()) ||
		item.description.trim() ||
		`Reusable command template for ${commandName}`;

	const stripped = stripClaudeRefs(item.body, {
		provider: "codex",
		file: filename,
		migratedRefs: context?.migratedRefs,
	});
	warnings.push(...stripped.warnings);

	const dynamicSyntax = detectDynamicCommandSyntax(item.body);
	if (dynamicSyntax.length > 0) {
		warnings.push(
			`Command "${commandName}" uses dynamic template syntax with no Codex skill equivalent (${dynamicSyntax.join(
				"; ",
			)}). Codex custom-prompt argument syntax is unconfirmed in its docs, and custom prompts are ` +
				`deprecated in favor of skills (https://developers.openai.com/codex/changelog). The template is ` +
				`migrated verbatim — manual adaptation needed.`,
		);
	}

	// Command frontmatter that has no SKILL.md equivalent becomes plain guidance text.
	const guidance: string[] = [];
	const argumentHint = item.frontmatter.argumentHint ?? item.frontmatter["argument-hint"];
	if (typeof argumentHint === "string" && argumentHint.trim()) {
		guidance.push(`- Expected arguments: \`${argumentHint.trim()}\``);
	}
	const allowedTools = item.frontmatter["allowed-tools"] ?? item.frontmatter.allowedTools;
	if (typeof allowedTools === "string" && allowedTools.trim()) {
		guidance.push(`- Originally restricted to these tools: \`${allowedTools.trim()}\``);
	}
	if (guidance.length > 0) {
		warnings.push(
			`Command "${commandName}" frontmatter (allowed-tools/argument-hint) has no skill equivalent; rendered as guidance text in the skill body.`,
		);
	}
	if (dynamicSyntax.length > 0) {
		guidance.push(
			`- This template uses dynamic syntax (${dynamicSyntax.join("; ")}) that the host runtime does not substitute — adapt these placeholders manually when invoking.`,
		);
	}

	const sections = [
		"---",
		`name: ${dirName}`,
		`description: ${yamlQuote(description)}`,
		"---",
		"",
		`# Command template: ${commandName}`,
		"",
	];
	if (guidance.length > 0) {
		sections.push("## Usage guidance", "", ...guidance, "");
	}
	sections.push(stripped.content.trim(), "");

	return {
		content: sections.join("\n"),
		filename,
		warnings,
		occurrences: stripped.occurrences,
	};
}
